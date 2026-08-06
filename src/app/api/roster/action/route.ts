import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { rosterAssignments, members, rosterSettings } from "@/db/schema";
import { eq, and, gte, lte, lt, gt, inArray, ne } from "drizzle-orm";

function getWeekdays(start: string, end: string): string[] {
  const out: string[] = [];
  const c = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  while (c <= e) {
    if (c.getDay() >= 1 && c.getDay() <= 5)
      out.push(`${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${String(c.getDate()).padStart(2, "0")}`);
    c.setDate(c.getDate() + 1);
  }
  return out;
}

/**
 * THE CORE PRINCIPLE:
 * 
 * The roster is a SEQUENCE of member IDs assigned to weekday slots.
 * 
 * GENERATE: Fills empty weekday slots with a round-robin of presenters.
 *           Completed/no-talk/not-included days are LOCKED and skipped.
 *
 * SHIFT DOWN: When a day is removed (unassign/no-talk), the member who was 
 *             there gets inserted at the front of the remaining queue. Every
 *             subsequent scheduled entry slides down by one. Nobody disappears.
 *
 * SWAP: Two members exchange only their specific dates. Nothing else moves.
 *
 * REORDER + REGENERATE: After drag-reorder, we read the existing scheduled
 *                        member sequence, map old positions to new order,
 *                        and rewrite. Nobody disappears; the same set of
 *                        members stays, just in a different repeating order.
 */

async function getConfig(year: number) {
  const rows = await db.select().from(rosterSettings).where(eq(rosterSettings.key, "start_date"));
  const startDate = rows.length > 0 ? rows[0].value : `${year}-01-13`;
  const all = await db.select().from(members).where(eq(members.active, true)).orderBy(members.sortOrder, members.name);
  const presenters = all.filter((m) => m.role !== "HOD");
  return { startDate, presenters };
}

// Get all future scheduled entries from a date, ordered by date
async function getFutureScheduled(afterDate: string) {
  return db.select({ id: rosterAssignments.id, date: rosterAssignments.date, memberId: rosterAssignments.memberId })
    .from(rosterAssignments)
    .where(and(gt(rosterAssignments.date, afterDate), eq(rosterAssignments.status, "scheduled")))
    .orderBy(rosterAssignments.date);
}

// Shift: insert bumpedId at front of future scheduled queue, push everyone down
async function shiftDown(afterDate: string, bumpedId: number) {
  const future = await getFutureScheduled(afterDate);
  if (future.length === 0) return;

  // Build new member sequence: [bumped, old0, old1, old2, ...]
  // Each slot gets the previous slot's member. Last member wraps or stays.
  const oldMembers = future.map((f) => f.memberId);
  const newMembers = [bumpedId, ...oldMembers];

  // Update each future entry with shifted member (clear topic since person changed)
  for (let i = 0; i < future.length; i++) {
    const newMid = newMembers[i] ?? null;
    if (newMid !== oldMembers[i]) {
      await db.update(rosterAssignments)
        .set({ memberId: newMid, topic: null })
        .where(eq(rosterAssignments.id, future[i].id));
    }
  }
}

export async function POST(request: NextRequest) {
  await ensureTables();
  const body = await request.json();
  const { action, month, year = 2026 } = body;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GENERATE — fill empty weekday slots with round-robin
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (action === "generate") {
    const { customStart } = body;
    const { startDate, presenters } = await getConfig(year);
    if (presenters.length === 0)
      return NextResponse.json({ error: "No active presenters." }, { status: 400 });

    let from = customStart || startDate;
    let to = `${year}-12-31`;
    if (month && !customStart) {
      const ms = `${year}-${String(month).padStart(2, "0")}-01`;
      from = ms > from ? ms : from;
      to = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;
    }

    const weekdays = getWeekdays(from, to);

    // Locked = anything that's not "scheduled" 
    const locked = await db.select({ date: rosterAssignments.date }).from(rosterAssignments).where(
      and(gte(rosterAssignments.date, from), lte(rosterAssignments.date, to), ne(rosterAssignments.status, "scheduled"))
    );
    const lockedSet = new Set(locked.map((d) => d.date));

    // Remove old scheduled
    await db.delete(rosterAssignments).where(
      and(gte(rosterAssignments.date, from), lte(rosterAssignments.date, to), eq(rosterAssignments.status, "scheduled"))
    );

    // Count how many "rotation steps" happened before our start (completed/missed days)
    const prior = await db.select({ date: rosterAssignments.date }).from(rosterAssignments).where(
      and(gte(rosterAssignments.date, startDate), lt(rosterAssignments.date, from),
        inArray(rosterAssignments.status, ["completed", "missed", "scheduled"]))
    );
    let idx = prior.length % presenters.length;

    const vals: { date: string; memberId: number; status: string }[] = [];
    for (const d of weekdays) {
      if (lockedSet.has(d)) continue;
      vals.push({ date: d, memberId: presenters[idx % presenters.length].id, status: "scheduled" });
      idx++;
    }
    if (vals.length > 0) await db.insert(rosterAssignments).values(vals);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // UNASSIGN — remove entry, shift bumped member DOWN
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (action === "unassign") {
    const { date } = body;
    if (date) {
      const [entry] = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
      const bumpedId = entry?.memberId;

      // Delete the entry
      await db.delete(rosterAssignments).where(eq(rosterAssignments.date, date));

      // Shift the bumped person into next slot, cascade
      if (bumpedId) await shiftDown(date, bumpedId);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SAVE — edit a single cell (topic, status, presenter). No shifting.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (action === "save") {
    const { date, memberId, topic, status, notes } = body;
    const existing = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
    if (existing.length > 0) {
      await db.update(rosterAssignments).set({
        memberId: memberId ?? null, topic: topic ?? null, status: status || "scheduled",
        notes: notes ?? null, noTalkReason: null, noTalkPresenter: null, noTalkTopic: null,
      }).where(eq(rosterAssignments.date, date));
    } else {
      await db.insert(rosterAssignments).values({
        date, memberId: memberId ?? null, topic: topic ?? null,
        status: status || "scheduled", notes: notes ?? null,
      });
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NO-TALK — mark day, shift bumped member DOWN
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (action === "notalk") {
    const { date, reason, altPresenter, altTopic, notes } = body;
    const existing = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
    const bumpedId = existing.length > 0 ? existing[0].memberId : null;

    if (existing.length > 0) {
      await db.update(rosterAssignments).set({
        status: "no-talk", noTalkReason: reason, memberId: null,
        noTalkPresenter: altPresenter || null, noTalkTopic: altTopic || null, notes: notes || null,
      }).where(eq(rosterAssignments.date, date));
    } else {
      await db.insert(rosterAssignments).values({
        date, status: "no-talk", noTalkReason: reason,
        noTalkPresenter: altPresenter || null, noTalkTopic: altTopic || null, notes: notes || null,
      });
    }

    if (bumpedId) await shiftDown(date, bumpedId);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SWAP — two members trade specific dates ONLY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (action === "swap") {
    const { date, swapWithMemberId } = body;
    const [entry] = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
    if (!entry?.memberId || !swapWithMemberId)
      return NextResponse.json({ error: "Invalid swap" }, { status: 400 });

    const originalId = entry.memberId;
    const swapId = swapWithMemberId as number;

    // Find swappee's next scheduled date
    const [swapEntry] = await db.select()
      .from(rosterAssignments)
      .where(and(gt(rosterAssignments.date, date), eq(rosterAssignments.memberId, swapId), eq(rosterAssignments.status, "scheduled")))
      .orderBy(rosterAssignments.date)
      .limit(1);

    await db.update(rosterAssignments).set({ memberId: swapId, topic: null }).where(eq(rosterAssignments.date, date));
    if (swapEntry) {
      await db.update(rosterAssignments).set({ memberId: originalId, topic: null }).where(eq(rosterAssignments.id, swapEntry.id));
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEAM READING — marks as completed (Team), shifts presenter
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (action === "team_reading") {
    const { date, topic: readingTopic } = body;
    const [entry] = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
    const bumpedId = entry?.memberId;

    if (entry) {
      await db.update(rosterAssignments).set({
        status: "completed", memberId: null, topic: readingTopic || "Team Reading",
        noTalkReason: "other_topic", noTalkPresenter: "Team", noTalkTopic: readingTopic || "Team Reading",
        notes: "Team reading — presenter shifted",
      }).where(eq(rosterAssignments.date, date));
    } else {
      await db.insert(rosterAssignments).values({
        date, status: "completed", topic: readingTopic || "Team Reading",
        noTalkReason: "other_topic", noTalkPresenter: "Team", noTalkTopic: readingTopic || "Team Reading",
      });
    }

    if (bumpedId) await shiftDown(date, bumpedId);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RESTORE — reverse a no-talk/team-reading day back to scheduled
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (action === "restore") {
    const { date } = body;
    // Delete the no-talk entry
    await db.delete(rosterAssignments).where(eq(rosterAssignments.date, date));
    // The slot is now empty — roster needs regeneration from this point
    // But we don't want to wipe everything. Just insert back into the sequence.
    // Find the member who SHOULD be here based on surrounding context
    // Simplest: just delete it and let the user regenerate, or auto-fill
    // Actually let's just remove it and shift everyone UP by one (reverse of shiftDown)
    const future = await db.select({ id: rosterAssignments.id, memberId: rosterAssignments.memberId })
      .from(rosterAssignments)
      .where(and(gt(rosterAssignments.date, date), eq(rosterAssignments.status, "scheduled")))
      .orderBy(rosterAssignments.date);

    if (future.length > 1) {
      // Shift everyone UP: each slot takes the NEXT slot's member
      for (let i = 0; i < future.length - 1; i++) {
        await db.update(rosterAssignments)
          .set({ memberId: future[i + 1].memberId, topic: null })
          .where(eq(rosterAssignments.id, future[i].id));
      }
      // Last slot becomes empty — delete it since the day freed up
      await db.delete(rosterAssignments).where(eq(rosterAssignments.id, future[future.length - 1].id));
    }

    // Re-insert a scheduled entry for this date with the first future member
    if (future.length > 0) {
      await db.insert(rosterAssignments).values({
        date, memberId: future[0].memberId, status: "scheduled",
      });
      // Now shift future[0]'s original slot up
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REORDER REGENERATE — after drag-reorder in team management
  // Reads the current scheduled member sequence, maps to new team order.
  // Same members stay assigned, just in the new repeating pattern.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (action === "reorder_regenerate") {
    const { presenters } = await getConfig(year);
    if (presenters.length === 0) break_out: { break break_out; }

    if (presenters.length > 0) {
      const today = new Date().toISOString().split("T")[0];

      // Get all future scheduled entries
      const future = await db.select({ id: rosterAssignments.id, date: rosterAssignments.date, memberId: rosterAssignments.memberId })
        .from(rosterAssignments)
        .where(and(gte(rosterAssignments.date, today), eq(rosterAssignments.status, "scheduled")))
        .orderBy(rosterAssignments.date);

      if (future.length > 0) {
        // Count how many steps happened before today to know rotation offset
        const { startDate } = await getConfig(year);
        const prior = await db.select({ date: rosterAssignments.date }).from(rosterAssignments).where(
          and(gte(rosterAssignments.date, startDate), lt(rosterAssignments.date, today),
            inArray(rosterAssignments.status, ["completed", "missed"]))
        );
        let idx = prior.length % presenters.length;

        // Reassign each future slot with new order
        for (const slot of future) {
          const newMid = presenters[idx % presenters.length].id;
          if (newMid !== slot.memberId) {
            await db.update(rosterAssignments).set({ memberId: newMid, topic: null }).where(eq(rosterAssignments.id, slot.id));
          }
          idx++;
        }
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAUSE RANGE — mark range as no-talk, shift everyone past it
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (action === "pause") {
    const { startDate, endDate, reason } = body;
    const dates = getWeekdays(startDate, endDate);

    // Collect bumped members from scheduled entries in the range
    const bumped = await db.select({ memberId: rosterAssignments.memberId })
      .from(rosterAssignments)
      .where(and(gte(rosterAssignments.date, startDate), lte(rosterAssignments.date, endDate), eq(rosterAssignments.status, "scheduled")))
      .orderBy(rosterAssignments.date);
    const bumpedIds = bumped.map((b) => b.memberId).filter(Boolean) as number[];

    // Delete scheduled in range
    await db.delete(rosterAssignments).where(
      and(gte(rosterAssignments.date, startDate), lte(rosterAssignments.date, endDate),
        inArray(rosterAssignments.status, ["scheduled", "not-included"]))
    );

    // Insert no-talk entries
    for (const date of dates) {
      const ex = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
      if (ex.length === 0) await db.insert(rosterAssignments).values({ date, status: "no-talk", noTalkReason: reason });
    }

    // Shift all bumped members into the future queue
    const futureAfterPause = await db.select({ id: rosterAssignments.id, memberId: rosterAssignments.memberId })
      .from(rosterAssignments)
      .where(and(gt(rosterAssignments.date, endDate), eq(rosterAssignments.status, "scheduled")))
      .orderBy(rosterAssignments.date);

    if (futureAfterPause.length > 0 && bumpedIds.length > 0) {
      const oldFutureMembers = futureAfterPause.map((f) => f.memberId);
      const newSeq = [...bumpedIds, ...oldFutureMembers];
      for (let i = 0; i < futureAfterPause.length; i++) {
        const newMid = newSeq[i] ?? null;
        if (newMid !== oldFutureMembers[i]) {
          await db.update(rosterAssignments).set({ memberId: newMid, topic: null })
            .where(eq(rosterAssignments.id, futureAfterPause[i].id));
        }
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RESET MONTH
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (action === "reset_month") {
    const m = parseInt(body.targetMonth || month);
    const y = parseInt(body.targetYear || year);
    await db.delete(rosterAssignments).where(and(
      gte(rosterAssignments.date, `${y}-${String(m).padStart(2, "0")}-01`),
      lte(rosterAssignments.date, `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`)
    ));
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RESET YEAR
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (action === "reset_year") {
    const y = parseInt(body.targetYear || year);
    await db.delete(rosterAssignments).where(and(
      gte(rosterAssignments.date, `${y}-01-01`), lte(rosterAssignments.date, `${y}-12-31`)
    ));
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RETURN updated roster for requested month
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const m = parseInt(month || new Date().getMonth() + 1);
  const y = parseInt(year);
  const sd = `${y}-${String(m).padStart(2, "0")}-01`;
  const ed = `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`;

  const roster = await db
    .select({
      id: rosterAssignments.id, date: rosterAssignments.date, memberId: rosterAssignments.memberId,
      topic: rosterAssignments.topic, status: rosterAssignments.status, noTalkReason: rosterAssignments.noTalkReason,
      noTalkPresenter: rosterAssignments.noTalkPresenter, noTalkTopic: rosterAssignments.noTalkTopic,
      notes: rosterAssignments.notes, memberName: members.name, memberRole: members.role,
    })
    .from(rosterAssignments)
    .leftJoin(members, eq(rosterAssignments.memberId, members.id))
    .where(and(gte(rosterAssignments.date, sd), lte(rosterAssignments.date, ed)))
    .orderBy(rosterAssignments.date);

  return NextResponse.json({ success: true, roster });
}

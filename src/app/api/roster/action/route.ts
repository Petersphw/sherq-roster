import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { rosterAssignments, members, rosterSettings } from "@/db/schema";
import { eq, and, gte, lte, gt, lt, inArray, sql } from "drizzle-orm";

function getWeekdays(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cur = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  while (cur <= end) {
    if (cur.getDay() >= 1 && cur.getDay() <= 5) {
      dates.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

async function getStartAndPresenters(year: number) {
  const settingsRows = await db.select().from(rosterSettings).where(eq(rosterSettings.key, "start_date"));
  const savedStart = settingsRows.length > 0 ? settingsRows[0].value : `${year}-01-13`;
  const activeMembers = await db.select().from(members).where(eq(members.active, true)).orderBy(members.sortOrder, members.name);
  const presenters = activeMembers.filter((m) => m.role !== "HOD");
  return { savedStart, presenters };
}

// Figure out where in the rotation we are by counting how many
// rotation steps happened BEFORE a given date.
// Each completed/scheduled/missed entry = one rotation step.
// No-talk and not-included do NOT advance the rotation.
async function getRotationIndex(beforeDate: string, startDate: string, presenterCount: number): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rosterAssignments)
    .where(
      and(
        gte(rosterAssignments.date, startDate),
        lt(rosterAssignments.date, beforeDate),
        inArray(rosterAssignments.status, ["completed", "scheduled", "missed", "cancelled"])
      )
    );
  return (result[0]?.count || 0) % presenterCount;
}

// Smart regenerate: only replaces FUTURE scheduled days,
// continuing the rotation from wherever it currently is.
async function smartRegenerate(fromDate: string, year: number) {
  const { savedStart, presenters } = await getStartAndPresenters(year);
  if (presenters.length === 0) return;

  const effectiveStart = fromDate > savedStart ? fromDate : savedStart;
  const endOfYear = `${year}-12-31`;
  const weekdays = getWeekdays(effectiveStart, endOfYear);

  // Get locked days (completed, no-talk, not-included) — never touch these
  const locked = await db.select().from(rosterAssignments).where(
    and(
      gte(rosterAssignments.date, effectiveStart),
      lte(rosterAssignments.date, endOfYear),
      inArray(rosterAssignments.status, ["no-talk", "completed", "not-included", "missed"])
    )
  );
  const lockedSet = new Set(locked.map((d) => d.date));

  // Delete only future scheduled entries
  await db.delete(rosterAssignments).where(
    and(
      gte(rosterAssignments.date, effectiveStart),
      lte(rosterAssignments.date, endOfYear),
      eq(rosterAssignments.status, "scheduled")
    )
  );

  // Figure out rotation position
  const rotIdx = await getRotationIndex(effectiveStart, savedStart, presenters.length);

  // Fill available days continuing from current rotation position
  const vals: { date: string; memberId: number; status: string }[] = [];
  let idx = rotIdx;
  for (const date of weekdays) {
    if (lockedSet.has(date)) continue;
    vals.push({ date, memberId: presenters[idx % presenters.length].id, status: "scheduled" });
    idx++;
  }
  if (vals.length > 0) await db.insert(rosterAssignments).values(vals);
}

export async function POST(request: NextRequest) {
  await ensureTables();
  const body = await request.json();
  const { action, month, year = 2026 } = body;

  // ─── GENERATE ───
  if (action === "generate") {
    const { customStart } = body;
    const { savedStart, presenters } = await getStartAndPresenters(year);
    if (presenters.length === 0) return NextResponse.json({ error: "No active presenters." }, { status: 400 });

    let effectiveStart = customStart || savedStart;
    let effectiveEnd = `${year}-12-31`;

    // If month-specific and no custom start, only do that month
    if (month && !customStart) {
      const ms = `${year}-${String(month).padStart(2, "0")}-01`;
      effectiveStart = ms > effectiveStart ? ms : effectiveStart;
      effectiveEnd = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;
    }

    const weekdays = getWeekdays(effectiveStart, effectiveEnd);
    const locked = await db.select().from(rosterAssignments).where(
      and(
        gte(rosterAssignments.date, effectiveStart),
        lte(rosterAssignments.date, effectiveEnd),
        inArray(rosterAssignments.status, ["no-talk", "completed", "not-included", "missed"])
      )
    );
    const lockedSet = new Set(locked.map((d) => d.date));

    await db.delete(rosterAssignments).where(
      and(
        gte(rosterAssignments.date, effectiveStart),
        lte(rosterAssignments.date, effectiveEnd),
        eq(rosterAssignments.status, "scheduled")
      )
    );

    // Get rotation index at the start point
    const rotIdx = await getRotationIndex(effectiveStart, customStart || savedStart, presenters.length);

    const vals: { date: string; memberId: number; status: string }[] = [];
    let idx = rotIdx;
    for (const date of weekdays) {
      if (lockedSet.has(date)) continue;
      vals.push({ date, memberId: presenters[idx % presenters.length].id, status: "scheduled" });
      idx++;
    }
    if (vals.length > 0) await db.insert(rosterAssignments).values(vals);
  }

  // ─── RESET MONTH ───
  if (action === "reset_month") {
    const m = parseInt(body.targetMonth || month);
    const y = parseInt(body.targetYear || year);
    const s = `${y}-${String(m).padStart(2, "0")}-01`;
    const e = `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`;
    await db.delete(rosterAssignments).where(and(gte(rosterAssignments.date, s), lte(rosterAssignments.date, e)));
  }

  // ─── RESET YEAR ───
  if (action === "reset_year") {
    const y = parseInt(body.targetYear || year);
    await db.delete(rosterAssignments).where(
      and(gte(rosterAssignments.date, `${y}-01-01`), lte(rosterAssignments.date, `${y}-12-31`))
    );
  }

  // ─── UNASSIGN (delete entry + SHIFT everyone down, don't regenerate from scratch) ───
  if (action === "unassign") {
    const { date } = body;
    if (date) {
      const [entry] = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
      const bumpedId = entry?.memberId;

      // Delete this entry
      await db.delete(rosterAssignments).where(eq(rosterAssignments.date, date));

      // Shift: put bumped member into next slot, cascade everyone down
      if (bumpedId) {
        const future = await db
          .select({ id: rosterAssignments.id, memberId: rosterAssignments.memberId })
          .from(rosterAssignments)
          .where(and(gt(rosterAssignments.date, date), eq(rosterAssignments.status, "scheduled")))
          .orderBy(rosterAssignments.date);

        if (future.length > 0) {
          const seq = [bumpedId, ...future.map((f) => f.memberId).filter(Boolean)] as number[];
          for (let i = 0; i < future.length; i++) {
            await db.update(rosterAssignments)
              .set({ memberId: seq[i] ?? null, topic: null })
              .where(eq(rosterAssignments.id, future[i].id));
          }
        }
      }
    }
  }

  // ─── SAVE ASSIGNMENT (edit a single cell — no shifting) ───
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

  // ─── NO-TALK (mark day + shift bumped presenter down through rest of year) ───
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

    // Shift future: bumped member → next day, everyone cascades
    if (bumpedId) {
      const future = await db
        .select({ id: rosterAssignments.id, memberId: rosterAssignments.memberId })
        .from(rosterAssignments)
        .where(and(gt(rosterAssignments.date, date), eq(rosterAssignments.status, "scheduled")))
        .orderBy(rosterAssignments.date);

      if (future.length > 0) {
        const seq = [bumpedId, ...future.map((f) => f.memberId).filter(Boolean)] as number[];
        for (let i = 0; i < future.length; i++) {
          await db.update(rosterAssignments)
            .set({ memberId: seq[i] ?? null, topic: null })
            .where(eq(rosterAssignments.id, future[i].id));
        }
      }
    }
  }

  // ─── SWAP (two members trade specific dates only — no roster shifting) ───
  if (action === "swap") {
    const { date, swapWithMemberId } = body;
    const [entry] = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
    if (!entry || !entry.memberId || !swapWithMemberId) {
      return NextResponse.json({ error: "Invalid swap" }, { status: 400 });
    }

    const originalId = entry.memberId;
    const swapId = swapWithMemberId as number;

    // Find the swappee's NEXT upcoming scheduled date
    const [swapEntry] = await db.select()
      .from(rosterAssignments)
      .where(and(
        gt(rosterAssignments.date, date),
        eq(rosterAssignments.memberId, swapId),
        eq(rosterAssignments.status, "scheduled")
      ))
      .orderBy(rosterAssignments.date)
      .limit(1);

    // Today: original → swapId
    await db.update(rosterAssignments)
      .set({ memberId: swapId, topic: null })
      .where(eq(rosterAssignments.date, date));

    // Swappee's next date: swapId → original
    if (swapEntry) {
      await db.update(rosterAssignments)
        .set({ memberId: originalId, topic: null })
        .where(eq(rosterAssignments.id, swapEntry.id));
    }
  }

  // ─── REORDER (drag reorder — smart regenerate that continues rotation) ───
  if (action === "reorder_regenerate") {
    const today = new Date().toISOString().split("T")[0];
    await smartRegenerate(today, year);
  }

  // ─── PAUSE RANGE ───
  if (action === "pause") {
    const { startDate, endDate, reason } = body;
    const dates = getWeekdays(startDate, endDate);

    await db.delete(rosterAssignments).where(
      and(
        gte(rosterAssignments.date, startDate),
        lte(rosterAssignments.date, endDate),
        inArray(rosterAssignments.status, ["scheduled", "not-included"])
      )
    );
    for (const date of dates) {
      const ex = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
      if (ex.length === 0) {
        await db.insert(rosterAssignments).values({ date, status: "no-talk", noTalkReason: reason });
      }
    }

    // Smart regenerate from day after pause ends
    const nextDay = new Date(endDate + "T00:00:00");
    nextDay.setDate(nextDay.getDate() + 1);
    const nextStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;
    await smartRegenerate(nextStr, year);
  }

  // ─── Return updated roster for the requested month ───
  const m = parseInt(month || new Date().getMonth() + 1);
  const y = parseInt(year);
  const sd = `${y}-${String(m).padStart(2, "0")}-01`;
  const ed = `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`;

  const updatedRoster = await db
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

  return NextResponse.json({ success: true, roster: updatedRoster });
}

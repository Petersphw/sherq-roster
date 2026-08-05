import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { rosterAssignments, members, rosterSettings } from "@/db/schema";
import { eq, and, gte, lte, gt, inArray } from "drizzle-orm";

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

// Combined action endpoint — handles all roster mutations in one call
// Returns the updated roster for the requested month so client doesn't need a second fetch
export async function POST(request: NextRequest) {
  await ensureTables();
  const body = await request.json();
  const { action, month, year = 2026 } = body;

  // ─── GENERATE ───
  if (action === "generate") {
    const { customStart } = body;
    const settingsRows = await db.select().from(rosterSettings).where(eq(rosterSettings.key, "start_date"));
    const savedStart = settingsRows.length > 0 ? settingsRows[0].value : `${year}-01-13`;
    const activeMembers = await db.select().from(members).where(eq(members.active, true)).orderBy(members.sortOrder, members.name);
    const presenters = activeMembers.filter((m) => m.role !== "HOD");
    if (presenters.length === 0) return NextResponse.json({ error: "No active presenters." }, { status: 400 });

    let effectiveStart = customStart || savedStart;
    let effectiveEnd = `${year}-12-31`;
    if (month) {
      const ms = `${year}-${String(month).padStart(2, "0")}-01`;
      effectiveStart = ms > effectiveStart ? ms : effectiveStart;
      effectiveEnd = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;
    }

    const weekdays = getWeekdays(effectiveStart, effectiveEnd);
    const skip = await db.select().from(rosterAssignments).where(
      and(gte(rosterAssignments.date, effectiveStart), lte(rosterAssignments.date, effectiveEnd),
        inArray(rosterAssignments.status, ["no-talk", "completed", "not-included"]))
    );
    const skipSet = new Set(skip.map((d) => d.date));
    await db.delete(rosterAssignments).where(
      and(gte(rosterAssignments.date, effectiveStart), lte(rosterAssignments.date, effectiveEnd), eq(rosterAssignments.status, "scheduled"))
    );

    const vals: { date: string; memberId: number; status: string }[] = [];
    let idx = 0;
    for (const date of weekdays) {
      if (skipSet.has(date)) continue;
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
    await db.delete(rosterAssignments).where(and(gte(rosterAssignments.date, `${y}-01-01`), lte(rosterAssignments.date, `${y}-12-31`)));
  }

  // ─── UNASSIGN (delete single entry) ───
  if (action === "unassign") {
    const { date } = body;
    if (date) await db.delete(rosterAssignments).where(eq(rosterAssignments.date, date));
  }

  // ─── SAVE ASSIGNMENT ───
  if (action === "save") {
    const { date, memberId, topic, status, notes } = body;
    const existing = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
    if (existing.length > 0) {
      await db.update(rosterAssignments).set({
        memberId: memberId ?? null, topic: topic ?? null, status: status || "scheduled", notes: notes ?? null,
        noTalkReason: null, noTalkPresenter: null, noTalkTopic: null,
      }).where(eq(rosterAssignments.date, date));
    } else {
      await db.insert(rosterAssignments).values({
        date, memberId: memberId ?? null, topic: topic ?? null, status: status || "scheduled", notes: notes ?? null,
      });
    }
  }

  // ─── NO-TALK SINGLE ───
  if (action === "notalk") {
    const { date, reason, altPresenter, altTopic, notes } = body;
    const existing = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
    const bumpedId = existing.length > 0 ? existing[0].memberId : null;
    if (existing.length > 0) {
      await db.update(rosterAssignments).set({
        status: "no-talk", noTalkReason: reason, noTalkPresenter: altPresenter || null, noTalkTopic: altTopic || null, notes: notes || null,
      }).where(eq(rosterAssignments.date, date));
    } else {
      await db.insert(rosterAssignments).values({
        date, status: "no-talk", noTalkReason: reason, noTalkPresenter: altPresenter || null, noTalkTopic: altTopic || null, notes: notes || null,
      });
    }
    // Shift future
    if (bumpedId) {
      const future = await db.select({ id: rosterAssignments.id, memberId: rosterAssignments.memberId })
        .from(rosterAssignments).where(and(gt(rosterAssignments.date, date), eq(rosterAssignments.status, "scheduled"))).orderBy(rosterAssignments.date);
      if (future.length > 0) {
        const seq = [bumpedId, ...future.map((f) => f.memberId).filter(Boolean)] as number[];
        for (let i = 0; i < future.length; i++) {
          await db.update(rosterAssignments).set({ memberId: seq[i] ?? null, topic: null }).where(eq(rosterAssignments.id, future[i].id));
        }
      }
    }
  }

  // ─── PAUSE RANGE ───
  if (action === "pause") {
    const { startDate, endDate, reason } = body;
    const dates = getWeekdays(startDate, endDate);
    await db.delete(rosterAssignments).where(
      and(gte(rosterAssignments.date, startDate), lte(rosterAssignments.date, endDate), inArray(rosterAssignments.status, ["scheduled", "not-included"]))
    );
    for (const date of dates) {
      const ex = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
      if (ex.length === 0) await db.insert(rosterAssignments).values({ date, status: "no-talk", noTalkReason: reason });
    }
    // Re-generate after pause
    const settingsRows = await db.select().from(rosterSettings).where(eq(rosterSettings.key, "start_date"));
    const savedStart = settingsRows.length > 0 ? settingsRows[0].value : `${year}-01-13`;
    const activeMembers = await db.select().from(members).where(eq(members.active, true)).orderBy(members.sortOrder, members.name);
    const presenters = activeMembers.filter((m) => m.role !== "HOD");
    if (presenters.length > 0) {
      const regenStart = endDate < savedStart ? savedStart : endDate;
      const allWeekdays = getWeekdays(regenStart, `${year}-12-31`);
      const skipRows = await db.select().from(rosterAssignments).where(
        and(gte(rosterAssignments.date, regenStart), lte(rosterAssignments.date, `${year}-12-31`),
          inArray(rosterAssignments.status, ["no-talk", "completed", "not-included"]))
      );
      const skipSet = new Set(skipRows.map((d) => d.date));
      await db.delete(rosterAssignments).where(
        and(gte(rosterAssignments.date, regenStart), lte(rosterAssignments.date, `${year}-12-31`), eq(rosterAssignments.status, "scheduled"))
      );
      const vals: { date: string; memberId: number; status: string }[] = [];
      let idx = 0;
      for (const d of allWeekdays) {
        if (skipSet.has(d)) continue;
        vals.push({ date: d, memberId: presenters[idx % presenters.length].id, status: "scheduled" });
        idx++;
      }
      if (vals.length > 0) await db.insert(rosterAssignments).values(vals);
    }
  }

  // ─── Return updated roster for the requested month ───
  const m = parseInt(month || new Date().getMonth() + 1);
  const y = parseInt(year);
  const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
  const endDate = `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`;

  const updatedRoster = await db
    .select({
      id: rosterAssignments.id, date: rosterAssignments.date, memberId: rosterAssignments.memberId,
      topic: rosterAssignments.topic, status: rosterAssignments.status, noTalkReason: rosterAssignments.noTalkReason,
      noTalkPresenter: rosterAssignments.noTalkPresenter, noTalkTopic: rosterAssignments.noTalkTopic,
      notes: rosterAssignments.notes, memberName: members.name, memberRole: members.role,
    })
    .from(rosterAssignments)
    .leftJoin(members, eq(rosterAssignments.memberId, members.id))
    .where(and(gte(rosterAssignments.date, startDate), lte(rosterAssignments.date, endDate)))
    .orderBy(rosterAssignments.date);

  return NextResponse.json({ success: true, roster: updatedRoster });
}

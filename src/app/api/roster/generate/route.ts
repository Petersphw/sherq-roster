import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { rosterAssignments, members } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

function getWeekdays(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  while (current <= end) {
    const day = current.getDay();
    if (day >= 1 && day <= 5) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export async function POST(request: NextRequest) {
  await ensureTables();
  const body = await request.json();
  const { startDate = "2026-01-13", endDate = "2026-12-18", month } = body;

  const activeMembers = await db
    .select()
    .from(members)
    .where(eq(members.active, true))
    .orderBy(members.sortOrder, members.name);

  const presenters = activeMembers.filter((m) => m.role !== "HOD");

  if (presenters.length === 0) {
    return NextResponse.json({ error: "No active presenters found." }, { status: 400 });
  }

  let effectiveStart = startDate;
  let effectiveEnd = endDate;

  if (month) {
    const m = parseInt(month);
    effectiveStart = `2026-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(2026, m, 0).getDate();
    effectiveEnd = `2026-${String(m).padStart(2, "0")}-${lastDay}`;
  }

  const weekdays = getWeekdays(effectiveStart, effectiveEnd);

  const noTalkDays = await db
    .select()
    .from(rosterAssignments)
    .where(and(gte(rosterAssignments.date, effectiveStart), lte(rosterAssignments.date, effectiveEnd), eq(rosterAssignments.status, "no-talk")));
  const noTalkSet = new Set(noTalkDays.map((d) => d.date));

  const completedDays = await db
    .select()
    .from(rosterAssignments)
    .where(and(gte(rosterAssignments.date, effectiveStart), lte(rosterAssignments.date, effectiveEnd), eq(rosterAssignments.status, "completed")));
  const completedSet = new Set(completedDays.map((d) => d.date));

  await db
    .delete(rosterAssignments)
    .where(and(gte(rosterAssignments.date, effectiveStart), lte(rosterAssignments.date, effectiveEnd), eq(rosterAssignments.status, "scheduled")));

  const values: Array<{ date: string; memberId: number; status: string }> = [];
  let presenterIndex = 0;
  for (const date of weekdays) {
    if (noTalkSet.has(date) || completedSet.has(date)) continue;
    values.push({ date, memberId: presenters[presenterIndex % presenters.length].id, status: "scheduled" });
    presenterIndex++;
  }

  if (values.length > 0) {
    await db.insert(rosterAssignments).values(values);
  }

  return NextResponse.json({ success: true, assignmentsCreated: values.length, presentersUsed: presenters.length });
}

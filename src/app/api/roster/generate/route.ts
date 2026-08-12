import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { rosterAssignments, members, rosterSettings } from "@/db/schema";
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
  const { month, customStart } = body;

  // Get the saved start date from settings
  const settingsRows = await db.select().from(rosterSettings).where(eq(rosterSettings.key, "start_date"));
  const savedStart = settingsRows.length > 0 ? settingsRows[0].value : "2026-01-13";

  const activeMembers = await db
    .select()
    .from(members)
    .where(eq(members.active, true))
    .orderBy(members.sortOrder, members.name);

  const presenters = activeMembers.filter((m) => m.role !== "HOD");

  if (presenters.length === 0) {
    return NextResponse.json({ error: "No active presenters found." }, { status: 400 });
  }

  let effectiveStart = customStart || savedStart;
  let effectiveEnd = "2026-12-18";

  if (month) {
    const m = parseInt(month);
    const monthStart = `2026-${String(m).padStart(2, "0")}-01`;
    effectiveStart = monthStart > effectiveStart ? monthStart : effectiveStart;
    const lastDay = new Date(2026, m, 0).getDate();
    effectiveEnd = `2026-${String(m).padStart(2, "0")}-${lastDay}`;
  }

  const weekdays = getWeekdays(effectiveStart, effectiveEnd);

  // Get days to skip (no-talk, completed)
  const skipDays = await db
    .select()
    .from(rosterAssignments)
    .where(
      and(
        gte(rosterAssignments.date, effectiveStart),
        lte(rosterAssignments.date, effectiveEnd),
        eq(rosterAssignments.status, "no-talk")
      )
    );
  const completedDays = await db
    .select()
    .from(rosterAssignments)
    .where(
      and(
        gte(rosterAssignments.date, effectiveStart),
        lte(rosterAssignments.date, effectiveEnd),
        eq(rosterAssignments.status, "completed")
      )
    );
  const skipSet = new Set([
    ...skipDays.map((d) => d.date),
    ...completedDays.map((d) => d.date),
  ]);

  // Delete only scheduled entries
  await db
    .delete(rosterAssignments)
    .where(
      and(
        gte(rosterAssignments.date, effectiveStart),
        lte(rosterAssignments.date, effectiveEnd),
        eq(rosterAssignments.status, "scheduled")
      )
    );

  // Round-robin assign
  const values: Array<{ date: string; memberId: number; status: string }> = [];
  let idx = 0;
  for (const date of weekdays) {
    if (skipSet.has(date)) continue;
    values.push({
      date,
      memberId: presenters[idx % presenters.length].id,
      status: "scheduled",
    });
    idx++;
  }

  if (values.length > 0) {
    await db.insert(rosterAssignments).values(values);
  }

  return NextResponse.json({
    success: true,
    assignmentsCreated: values.length,
    presentersUsed: presenters.length,
    startDate: effectiveStart,
  });
}

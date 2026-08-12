import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { rosterAssignments } from "@/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";

export async function POST(request: NextRequest) {
  await ensureTables();
  const body = await request.json();
  const { startDate, endDate, reason = "paused", status = "no-talk" } = body;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
  }

  // Get weekdays in the range
  const dates: string[] = [];
  const current = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  while (current <= end) {
    const dow = current.getDay();
    if (dow >= 1 && dow <= 5) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    current.setDate(current.getDate() + 1);
  }

  // Use the status provided (either "no-talk" or "not-included")
  const effectiveStatus = status === "not-included" ? "not-included" : "no-talk";

  // Delete existing scheduled/not-included entries in range (preserve completed)
  await db
    .delete(rosterAssignments)
    .where(
      and(
        gte(rosterAssignments.date, startDate),
        lte(rosterAssignments.date, endDate),
        inArray(rosterAssignments.status, ["scheduled", "not-included"])
      )
    );

  // Insert entries for weekdays that don't already have one
  let inserted = 0;
  for (const date of dates) {
    const existing = await db
      .select()
      .from(rosterAssignments)
      .where(eq(rosterAssignments.date, date));
    if (existing.length === 0) {
      await db.insert(rosterAssignments).values({
        date,
        status: effectiveStatus,
        noTalkReason: reason,
      });
      inserted++;
    }
  }

  return NextResponse.json({ success: true, marked: inserted, total: dates.length });
}

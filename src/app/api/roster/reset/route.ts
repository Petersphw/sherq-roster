import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { rosterAssignments } from "@/db/schema";
import { and, gte, lte } from "drizzle-orm";

export async function POST(request: NextRequest) {
  await ensureTables();
  const body = await request.json();
  const { month, year = 2026 } = body;

  if (!month) {
    return NextResponse.json({ error: "Month is required" }, { status: 400 });
  }

  const m = parseInt(month);
  const startDate = `${year}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(year, m, 0).getDate();
  const endDate = `${year}-${String(m).padStart(2, "0")}-${lastDay}`;

  const result = await db
    .delete(rosterAssignments)
    .where(
      and(
        gte(rosterAssignments.date, startDate),
        lte(rosterAssignments.date, endDate)
      )
    )
    .returning();

  return NextResponse.json({
    success: true,
    deleted: result.length,
    month: m,
  });
}

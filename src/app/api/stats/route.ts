import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { rosterAssignments, members, rosterSettings } from "@/db/schema";
import { eq, sql, ne, and, inArray } from "drizzle-orm";

export async function GET() {
  await ensureTables();

  // Get start date
  const settingsRows = await db.select().from(rosterSettings).where(eq(rosterSettings.key, "start_date"));
  const startDate = settingsRows.length > 0 ? settingsRows[0].value : null;

  // Active members
  const memRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(members)
    .where(eq(members.active, true));

  // Count by status
  const scheduled = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rosterAssignments)
    .where(eq(rosterAssignments.status, "scheduled"));

  const completed = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rosterAssignments)
    .where(eq(rosterAssignments.status, "completed"));

  // Total = everything that's part of the roster (not "not-included")
  const total = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rosterAssignments)
    .where(ne(rosterAssignments.status, "not-included"));

  // Legitimate no-talk (holiday, other_topic, meeting)
  const legitNoTalk = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rosterAssignments)
    .where(
      and(
        eq(rosterAssignments.status, "no-talk"),
        inArray(rosterAssignments.noTalkReason, ["holiday", "other_topic", "meeting"])
      )
    );

  const notIncluded = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rosterAssignments)
    .where(eq(rosterAssignments.status, "not-included"));

  // Per member stats
  const perMember = await db
    .select({
      memberName: members.name,
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${rosterAssignments.status} = 'completed')::int`,
    })
    .from(rosterAssignments)
    .innerJoin(members, eq(rosterAssignments.memberId, members.id))
    .where(ne(rosterAssignments.status, "not-included"))
    .groupBy(members.name)
    .orderBy(members.name);

  return NextResponse.json({
    totalMembers: memRows[0]?.count || 0,
    totalAssignments: total[0]?.count || 0,
    completedTalks: completed[0]?.count || 0,
    scheduledTalks: scheduled[0]?.count || 0,
    legitimateNoTalk: legitNoTalk[0]?.count || 0,
    notIncluded: notIncluded[0]?.count || 0,
    perMember,
    startDate,
  });
}

import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { rosterAssignments, members, rosterSettings } from "@/db/schema";
import { eq, sql, ne, and } from "drizzle-orm";

export async function GET() {
  await ensureTables();

  // Get start date
  const settingsRows = await db.select().from(rosterSettings).where(eq(rosterSettings.key, "start_date"));
  const startDate = settingsRows.length > 0 ? settingsRows[0].value : null;

  const totalMembers = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(members)
    .where(eq(members.active, true));

  // Total talks = scheduled + completed + missed (NOT "not-included", NOT valid no-talk reasons)
  // We count: scheduled, completed, missed, cancelled
  // We also count no-talk days where reason is NOT holiday/other_topic/meeting
  const countableStatuses = ["scheduled", "completed", "missed", "cancelled"];

  const totalAssignments = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rosterAssignments)
    .where(
      sql`(${rosterAssignments.status} = ANY(${countableStatuses}))`
    );

  // Also count no-talk days that are NOT legitimate (shutdown, paused, other, before_start)
  const nonLegitNoTalk = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rosterAssignments)
    .where(
      and(
        eq(rosterAssignments.status, "no-talk"),
        sql`(${rosterAssignments.noTalkReason} IS NULL OR ${rosterAssignments.noTalkReason} NOT IN ('holiday', 'other_topic', 'meeting'))`
      )
    );

  const completedTalks = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rosterAssignments)
    .where(eq(rosterAssignments.status, "completed"));

  // Legitimate no-talk (holiday, other_topic, meeting) — these are fine, don't count against
  const legitimateNoTalk = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rosterAssignments)
    .where(
      and(
        eq(rosterAssignments.status, "no-talk"),
        sql`${rosterAssignments.noTalkReason} IN ('holiday', 'other_topic', 'meeting')`
      )
    );

  const scheduledTalks = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rosterAssignments)
    .where(eq(rosterAssignments.status, "scheduled"));

  const notIncluded = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rosterAssignments)
    .where(eq(rosterAssignments.status, "not-included"));

  // Total = countable + non-legit no-talk (these are missed opportunities)
  const total = (totalAssignments[0]?.count || 0) + (nonLegitNoTalk[0]?.count || 0);

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
    totalMembers: totalMembers[0]?.count || 0,
    totalAssignments: total,
    completedTalks: completedTalks[0]?.count || 0,
    scheduledTalks: scheduledTalks[0]?.count || 0,
    legitimateNoTalk: legitimateNoTalk[0]?.count || 0,
    notIncluded: notIncluded[0]?.count || 0,
    perMember,
    startDate,
  });
}

import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { rosterAssignments, members } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  await ensureTables();

  const totalMembers = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(members)
    .where(eq(members.active, true));

  const totalAssignments = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rosterAssignments);

  const completedTalks = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rosterAssignments)
    .where(eq(rosterAssignments.status, "completed"));

  const scheduledTalks = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rosterAssignments)
    .where(eq(rosterAssignments.status, "scheduled"));

  const perMember = await db
    .select({
      memberName: members.name,
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${rosterAssignments.status} = 'completed')::int`,
    })
    .from(rosterAssignments)
    .innerJoin(members, eq(rosterAssignments.memberId, members.id))
    .groupBy(members.name)
    .orderBy(members.name);

  return NextResponse.json({
    totalMembers: totalMembers[0]?.count || 0,
    totalAssignments: totalAssignments[0]?.count || 0,
    completedTalks: completedTalks[0]?.count || 0,
    scheduledTalks: scheduledTalks[0]?.count || 0,
    perMember,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rosterAssignments, members } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year") || "2026";

  let assignments;

  if (month) {
    const startDate = `${year}-${month.padStart(2, "0")}-01`;
    const endMonth = parseInt(month);
    const endYear = parseInt(year);
    const lastDay = new Date(endYear, endMonth, 0).getDate();
    const endDate = `${year}-${month.padStart(2, "0")}-${lastDay}`;

    assignments = await db
      .select({
        id: rosterAssignments.id,
        date: rosterAssignments.date,
        memberId: rosterAssignments.memberId,
        topic: rosterAssignments.topic,
        status: rosterAssignments.status,
        noTalkReason: rosterAssignments.noTalkReason,
        noTalkPresenter: rosterAssignments.noTalkPresenter,
        noTalkTopic: rosterAssignments.noTalkTopic,
        notes: rosterAssignments.notes,
        memberName: members.name,
        memberRole: members.role,
      })
      .from(rosterAssignments)
      .leftJoin(members, eq(rosterAssignments.memberId, members.id))
      .where(
        and(
          gte(rosterAssignments.date, startDate),
          lte(rosterAssignments.date, endDate)
        )
      )
      .orderBy(rosterAssignments.date);
  } else {
    assignments = await db
      .select({
        id: rosterAssignments.id,
        date: rosterAssignments.date,
        memberId: rosterAssignments.memberId,
        topic: rosterAssignments.topic,
        status: rosterAssignments.status,
        noTalkReason: rosterAssignments.noTalkReason,
        noTalkPresenter: rosterAssignments.noTalkPresenter,
        noTalkTopic: rosterAssignments.noTalkTopic,
        notes: rosterAssignments.notes,
        memberName: members.name,
        memberRole: members.role,
      })
      .from(rosterAssignments)
      .leftJoin(members, eq(rosterAssignments.memberId, members.id))
      .orderBy(rosterAssignments.date);
  }

  return NextResponse.json(assignments);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { date, memberId, topic, status, notes, noTalkReason, noTalkPresenter, noTalkTopic } = body;

  if (!date) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  // Check if assignment already exists for this date
  const existing = await db
    .select()
    .from(rosterAssignments)
    .where(eq(rosterAssignments.date, date));

  if (existing.length > 0) {
    const [updated] = await db
      .update(rosterAssignments)
      .set({
        memberId: memberId ?? null,
        topic: topic ?? null,
        status: status || "scheduled",
        notes: notes ?? null,
        noTalkReason: noTalkReason ?? null,
        noTalkPresenter: noTalkPresenter ?? null,
        noTalkTopic: noTalkTopic ?? null,
      })
      .where(eq(rosterAssignments.date, date))
      .returning();
    return NextResponse.json(updated);
  }

  const [newAssignment] = await db
    .insert(rosterAssignments)
    .values({
      date,
      memberId: memberId ?? null,
      topic: topic ?? null,
      status: status || "scheduled",
      notes: notes ?? null,
      noTalkReason: noTalkReason ?? null,
      noTalkPresenter: noTalkPresenter ?? null,
      noTalkTopic: noTalkTopic ?? null,
    })
    .returning();

  return NextResponse.json(newAssignment, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  await db.delete(rosterAssignments).where(eq(rosterAssignments.id, parseInt(id)));
  return NextResponse.json({ success: true });
}

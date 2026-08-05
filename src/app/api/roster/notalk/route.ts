import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rosterAssignments, members } from "@/db/schema";
import { eq, gt, and, gte, lte } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    date,
    reason,
    altPresenter,
    altTopic,
    notes,
  } = body as {
    date: string;
    reason: string; // "holiday" | "other_topic" | "meeting" | "other"
    altPresenter?: string;
    altTopic?: string;
    notes?: string;
  };

  if (!date || !reason) {
    return NextResponse.json({ error: "Date and reason required" }, { status: 400 });
  }

  // Get the existing assignment for this date (the member who was supposed to present)
  const existing = await db
    .select()
    .from(rosterAssignments)
    .where(eq(rosterAssignments.date, date));

  const bumpedMemberId = existing.length > 0 ? existing[0].memberId : null;

  // Mark this date as no-talk
  if (existing.length > 0) {
    await db
      .update(rosterAssignments)
      .set({
        status: "no-talk",
        noTalkReason: reason,
        noTalkPresenter: altPresenter || null,
        noTalkTopic: altTopic || null,
        notes: notes || null,
        // Keep the memberId so we know who was bumped
      })
      .where(eq(rosterAssignments.date, date));
  } else {
    await db.insert(rosterAssignments).values({
      date,
      memberId: null,
      status: "no-talk",
      noTalkReason: reason,
      noTalkPresenter: altPresenter || null,
      noTalkTopic: altTopic || null,
      notes: notes || null,
    });
  }

  // Now shift: get all scheduled assignments AFTER this date
  const futureAssignments = await db
    .select({
      id: rosterAssignments.id,
      date: rosterAssignments.date,
      memberId: rosterAssignments.memberId,
      status: rosterAssignments.status,
      topic: rosterAssignments.topic,
    })
    .from(rosterAssignments)
    .where(
      and(
        gt(rosterAssignments.date, date),
        eq(rosterAssignments.status, "scheduled")
      )
    )
    .orderBy(rosterAssignments.date);

  if (bumpedMemberId && futureAssignments.length > 0) {
    // We need to insert the bumped member at the front and shift everyone down
    // Collect the current member sequence: [bumped, future[0].member, future[1].member, ...]
    const memberSequence = [bumpedMemberId];
    for (const fa of futureAssignments) {
      if (fa.memberId) memberSequence.push(fa.memberId);
    }

    // Reassign: each future date gets the shifted member
    for (let i = 0; i < futureAssignments.length; i++) {
      const newMemberId = memberSequence[i] ?? null;
      await db
        .update(rosterAssignments)
        .set({ memberId: newMemberId, topic: null })
        .where(eq(rosterAssignments.id, futureAssignments[i].id));
    }

    // If there are more members than slots, the last member(s) need new slot(s)
    // We'll handle this by trusting the generate function for full re-generation
  }

  return NextResponse.json({
    success: true,
    date,
    reason,
    shifted: futureAssignments.length,
  });
}

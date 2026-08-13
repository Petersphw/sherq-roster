import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { rosterAssignments } from "@/db/schema";
import { eq, gt, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  await ensureTables();
  const body = await request.json();
  const { date, reason, altPresenter, altTopic, notes } = body as {
    date: string;
    reason: string;
    altPresenter?: string;
    altTopic?: string;
    notes?: string;
  };

  if (!date || !reason) {
    return NextResponse.json({ error: "Date and reason required" }, { status: 400 });
  }

  const existing = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
  const bumpedMemberId = existing.length > 0 ? existing[0].memberId : null;

  if (existing.length > 0) {
    await db
      .update(rosterAssignments)
      .set({ status: "no-talk", noTalkReason: reason, noTalkPresenter: altPresenter || null, noTalkTopic: altTopic || null, notes: notes || null })
      .where(eq(rosterAssignments.date, date));
  } else {
    await db.insert(rosterAssignments).values({
      date, memberId: null, status: "no-talk", noTalkReason: reason,
      noTalkPresenter: altPresenter || null, noTalkTopic: altTopic || null, notes: notes || null,
    });
  }

  const futureAssignments = await db
    .select({ id: rosterAssignments.id, date: rosterAssignments.date, memberId: rosterAssignments.memberId, status: rosterAssignments.status, topic: rosterAssignments.topic })
    .from(rosterAssignments)
    .where(and(gt(rosterAssignments.date, date), eq(rosterAssignments.status, "scheduled")))
    .orderBy(rosterAssignments.date);

  if (bumpedMemberId && futureAssignments.length > 0) {
    const memberSequence = [bumpedMemberId];
    for (const fa of futureAssignments) {
      if (fa.memberId) memberSequence.push(fa.memberId);
    }
    for (let i = 0; i < futureAssignments.length; i++) {
      const newMemberId = memberSequence[i] ?? null;
      await db.update(rosterAssignments).set({ memberId: newMemberId, topic: null }).where(eq(rosterAssignments.id, futureAssignments[i].id));
    }
  }

  return NextResponse.json({ success: true, date, reason, shifted: futureAssignments.length });
}

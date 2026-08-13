import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { actionHistory, rosterAssignments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  await ensureTables();
  const rows = await db
    .select({ id: actionHistory.id, action: actionHistory.action, detail: actionHistory.detail, changedBy: actionHistory.changedBy, createdAt: actionHistory.createdAt })
    .from(actionHistory)
    .orderBy(desc(actionHistory.id))
    .limit(50);
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  await ensureTables();
  const body = await request.json();
  const { historyId } = body;
  if (!historyId) return NextResponse.json({ error: "historyId required" }, { status: 400 });

  const [row] = await db.select().from(actionHistory).where(eq(actionHistory.id, historyId));
  if (!row) return NextResponse.json({ error: "History item not found" }, { status: 404 });

  const snapshot = JSON.parse(row.snapshotJson) as Array<{
    date: string;
    memberId: number | null;
    topic: string | null;
    status: string;
    noTalkReason: string | null;
    noTalkPresenter: string | null;
    noTalkTopic: string | null;
    notes: string | null;
  }>;

  await db.delete(rosterAssignments);
  if (snapshot.length > 0) {
    await db.insert(rosterAssignments).values(snapshot);
  }

  return NextResponse.json({ success: true });
}

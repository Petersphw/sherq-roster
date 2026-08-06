import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { messages, members } from "@/db/schema";
import { eq, or, and, desc, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  await ensureTables();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const withId = searchParams.get("withId");

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const uid = parseInt(userId);

  // Get conversation with specific user
  if (withId) {
    const wid = parseInt(withId);
    const msgs = await db
      .select({
        id: messages.id,
        fromId: messages.fromId,
        toId: messages.toId,
        body: messages.body,
        replyToId: messages.replyToId,
        read: messages.read,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(
        or(
          and(eq(messages.fromId, uid), eq(messages.toId, wid)),
          and(eq(messages.fromId, wid), eq(messages.toId, uid))
        )
      )
      .orderBy(messages.createdAt)
      .limit(100);

    // Mark as read
    await db.update(messages).set({ read: true }).where(and(eq(messages.fromId, wid), eq(messages.toId, uid), eq(messages.read, false)));

    return NextResponse.json(msgs);
  }

  // Get inbox summary — latest message per conversation + unread count
  const convos = await db.execute(sql`
    SELECT 
      CASE WHEN from_id = ${uid} THEN to_id ELSE from_id END as other_id,
      MAX(created_at) as last_at,
      COUNT(*) FILTER (WHERE to_id = ${uid} AND read = false) as unread
    FROM messages
    WHERE from_id = ${uid} OR to_id = ${uid}
    GROUP BY other_id
    ORDER BY last_at DESC
  `);

  // Get member names
  const allMembers = await db.select({ id: members.id, name: members.name }).from(members);
  const nameMap = new Map(allMembers.map((m) => [m.id, m.name]));

  const inbox = (convos.rows as Array<{ other_id: number; last_at: string; unread: string }>).map((c) => ({
    otherId: c.other_id,
    otherName: nameMap.get(c.other_id) || "Unknown",
    lastAt: c.last_at,
    unread: parseInt(c.unread),
  }));

  // Total unread
  const totalUnread = inbox.reduce((s, c) => s + c.unread, 0);

  return NextResponse.json({ inbox, totalUnread });
}

export async function POST(request: NextRequest) {
  await ensureTables();
  const body = await request.json();
  const { fromId, toId, bodyText, replyToId } = body;

  if (!fromId || !toId || !bodyText?.trim()) {
    return NextResponse.json({ error: "fromId, toId, body required" }, { status: 400 });
  }

  const [msg] = await db.insert(messages).values({
    fromId,
    toId,
    body: bodyText.trim(),
    replyToId: replyToId || null,
  }).returning();

  return NextResponse.json(msg, { status: 201 });
}

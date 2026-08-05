import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const all = await db
    .select()
    .from(announcements)
    .where(eq(announcements.active, true))
    .orderBy(announcements.eventDate, announcements.createdAt);
  return NextResponse.json(all);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, title, description, eventDate, addedBy } = body;

  if (!type || !title) {
    return NextResponse.json({ error: "Type and title required" }, { status: 400 });
  }

  const [newAnn] = await db
    .insert(announcements)
    .values({
      type,
      title,
      description: description || null,
      eventDate: eventDate || null,
      addedBy: addedBy || null,
    })
    .returning();

  return NextResponse.json(newAnn, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  await db.delete(announcements).where(eq(announcements.id, parseInt(id)));
  return NextResponse.json({ success: true });
}

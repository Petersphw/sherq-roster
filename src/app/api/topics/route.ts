import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { topics } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const allTopics = await db
    .select()
    .from(topics)
    .orderBy(topics.category, topics.title);
  return NextResponse.json(allTopics);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { category, title, description, addedBy } = body;

  if (!category || !title) {
    return NextResponse.json({ error: "Category and title are required" }, { status: 400 });
  }

  const [newTopic] = await db
    .insert(topics)
    .values({
      category,
      title,
      description: description || null,
      addedBy: addedBy || null,
    })
    .returning();

  return NextResponse.json(newTopic, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  await db.delete(topics).where(eq(topics.id, parseInt(id)));
  return NextResponse.json({ success: true });
}

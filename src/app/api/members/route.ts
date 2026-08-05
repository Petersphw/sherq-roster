import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const allMembers = await db
    .select()
    .from(members)
    .orderBy(members.sortOrder, members.name);
  return NextResponse.json(allMembers);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, role, department, email, birthday } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const all = await db.select().from(members);
  const maxOrder = all.reduce((max, m) => Math.max(max, m.sortOrder), -1);

  const [newMember] = await db
    .insert(members)
    .values({
      name,
      role: role || "Presenter",
      department: department || "SHERQ",
      email: email || null,
      birthday: birthday || null,
      sortOrder: maxOrder + 1,
    })
    .returning();

  return NextResponse.json(newMember, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, name, role, department, email, active, sortOrder, birthday } = body;

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (role !== undefined) updateData.role = role;
  if (department !== undefined) updateData.department = department;
  if (email !== undefined) updateData.email = email;
  if (active !== undefined) updateData.active = active;
  if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
  if (birthday !== undefined) updateData.birthday = birthday;

  const [updated] = await db
    .update(members)
    .set(updateData)
    .where(eq(members.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  await db.delete(members).where(eq(members.id, parseInt(id)));
  return NextResponse.json({ success: true });
}

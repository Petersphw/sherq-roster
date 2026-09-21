import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { members, rosterAssignments } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

export async function GET() {
  await ensureTables();
  const allMembers = await db
    .select()
    .from(members)
    .orderBy(members.sortOrder, members.name);
  return NextResponse.json(allMembers);
}

export async function POST(request: NextRequest) {
  await ensureTables();
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
  await ensureTables();
  const body = await request.json();
  const { id, name, role, department, email, active, sortOrder, birthday, isAdmin } = body;

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
  if (isAdmin !== undefined) updateData.isAdmin = isAdmin;

  const [updated] = await db
    .update(members)
    .set(updateData)
    .where(eq(members.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  await ensureTables();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const memberId = parseInt(id);

  try {
    // 1. Unlink the member from all roster assignments (set memberId = null).
    // NEVER delete any date row from roster_assignments! Keep all calendar dates and topics intact!
    await db
      .update(rosterAssignments)
      .set({ memberId: null })
      .where(eq(rosterAssignments.memberId, memberId));

    // 2. Now delete the member from members table
    await db.delete(members).where(eq(members.id, memberId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Member delete failed:", err);
    return NextResponse.json({ error: "Could not remove member." }, { status: 500 });
  }
}

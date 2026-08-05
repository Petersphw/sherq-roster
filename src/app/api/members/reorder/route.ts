import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { members } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { orderedIds } = body as { orderedIds: number[] };

  if (!orderedIds || !Array.isArray(orderedIds)) {
    return NextResponse.json({ error: "orderedIds array required" }, { status: 400 });
  }

  // Update each member's sort order
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(members)
      .set({ sortOrder: i })
      .where(eq(members.id, orderedIds[i]));
  }

  return NextResponse.json({ success: true, count: orderedIds.length });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { rosterSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  await ensureTables();
  const rows = await db.select().from(rosterSettings);
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
  await ensureTables();
  const body = await request.json();
  const { key, value } = body;

  if (!key) {
    return NextResponse.json({ error: "Key required" }, { status: 400 });
  }

  // Upsert
  const existing = await db.select().from(rosterSettings).where(eq(rosterSettings.key, key));
  if (existing.length > 0) {
    await db.update(rosterSettings).set({ value }).where(eq(rosterSettings.key, key));
  } else {
    await db.insert(rosterSettings).values({ key, value });
  }

  return NextResponse.json({ success: true, key, value });
}

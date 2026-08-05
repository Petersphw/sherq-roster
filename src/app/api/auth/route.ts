import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { members } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";

function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

export async function POST(request: NextRequest) {
  await ensureTables();
  const body = await request.json();
  const { action, memberId, pin, newPin } = body;

  // CHECK — verify PIN for login
  if (action === "check") {
    const [member] = await db.select().from(members).where(eq(members.id, memberId));
    if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // No PIN set = open access
    if (!member.pin) {
      return NextResponse.json({ ok: true, hasPin: false });
    }

    // PIN set — verify
    if (!pin) {
      return NextResponse.json({ ok: false, hasPin: true, needsPin: true });
    }

    if (hashPin(pin) === member.pin) {
      return NextResponse.json({ ok: true, hasPin: true });
    }

    return NextResponse.json({ ok: false, hasPin: true, error: "Wrong PIN" }, { status: 401 });
  }

  // SET — set or change PIN
  if (action === "set") {
    if (!newPin || newPin.length < 4) {
      return NextResponse.json({ error: "PIN must be at least 4 characters" }, { status: 400 });
    }
    await db.update(members).set({ pin: hashPin(newPin), pinResetRequested: false }).where(eq(members.id, memberId));
    return NextResponse.json({ ok: true });
  }

  // REMOVE — remove PIN (member removes their own, or admin resets)
  if (action === "remove") {
    await db.update(members).set({ pin: null, pinResetRequested: false }).where(eq(members.id, memberId));
    return NextResponse.json({ ok: true });
  }

  // REQUEST_RESET — member asks admin to reset their PIN
  if (action === "request_reset") {
    await db.update(members).set({ pinResetRequested: true }).where(eq(members.id, memberId));
    return NextResponse.json({ ok: true });
  }

  // HAS_PIN — quick check if a member has a PIN set
  if (action === "has_pin") {
    const [member] = await db.select().from(members).where(eq(members.id, memberId));
    if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ hasPin: !!member.pin, resetRequested: member.pinResetRequested });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { rosterAssignments, members, rosterSettings, actionHistory } from "@/db/schema";
import { eq, and, gte, lte, gt, inArray, ne, asc, desc } from "drizzle-orm";

function getWeekdays(start: string, end: string): string[] {
  const out: string[] = [];
  const c = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  while (c <= e) {
    if (c.getDay() >= 1 && c.getDay() <= 5) {
      out.push(`${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${String(c.getDate()).padStart(2, "0")}`);
    }
    c.setDate(c.getDate() + 1);
  }
  return out;
}

async function getConfig(year: number) {
  const rows = await db.select().from(rosterSettings).where(eq(rosterSettings.key, "start_date"));
  const startDate = rows.length > 0 ? rows[0].value : `${year}-01-13`;
  const all = await db.select().from(members).where(eq(members.active, true)).orderBy(asc(members.sortOrder), asc(members.name));
  const presenters = all.filter((m) => m.role !== "HOD");
  return { startDate, presenters };
}

type SnapshotRow = {
  date: string;
  memberId: number | null;
  topic: string | null;
  status: string;
  noTalkReason: string | null;
  noTalkPresenter: string | null;
  noTalkTopic: string | null;
  notes: string | null;
};

async function saveHistory(action: string, detail: string) {
  const snapshot = await db
    .select({
      date: rosterAssignments.date,
      memberId: rosterAssignments.memberId,
      topic: rosterAssignments.topic,
      status: rosterAssignments.status,
      noTalkReason: rosterAssignments.noTalkReason,
      noTalkPresenter: rosterAssignments.noTalkPresenter,
      noTalkTopic: rosterAssignments.noTalkTopic,
      notes: rosterAssignments.notes,
    })
    .from(rosterAssignments)
    .orderBy(asc(rosterAssignments.date));

  await db.insert(actionHistory).values({
    action,
    detail,
    snapshotJson: JSON.stringify(snapshot),
  });
}

async function restoreSnapshot(snapshot: SnapshotRow[]) {
  await db.delete(rosterAssignments);
  if (snapshot.length === 0) return;
  await db.insert(rosterAssignments).values(
    snapshot.map((s) => ({
      date: s.date,
      memberId: s.memberId,
      topic: s.topic,
      status: s.status,
      noTalkReason: s.noTalkReason,
      noTalkPresenter: s.noTalkPresenter,
      noTalkTopic: s.noTalkTopic,
      notes: s.notes,
    }))
  );
}

async function getMemberTopicMap(from: string, to: string) {
  const rows = await db
    .select({ memberId: rosterAssignments.memberId, topic: rosterAssignments.topic, date: rosterAssignments.date })
    .from(rosterAssignments)
    .where(
      and(
        gte(rosterAssignments.date, from),
        lte(rosterAssignments.date, to),
        eq(rosterAssignments.status, "scheduled")
      )
    )
    .orderBy(asc(rosterAssignments.date));

  const map = new Map<number, string>();
  for (const row of rows) {
    if (row.memberId && row.topic && !map.has(row.memberId)) {
      map.set(row.memberId, row.topic);
    }
  }
  return map;
}

async function fillScheduledSequence(from: string, to: string, year: number) {
  const { startDate, presenters } = await getConfig(year);
  if (presenters.length === 0) return;

  const days = getWeekdays(from, to);
  const memberTopics = await getMemberTopicMap(from, to);

  const locked = await db
    .select({ date: rosterAssignments.date })
    .from(rosterAssignments)
    .where(
      and(
        gte(rosterAssignments.date, from),
        lte(rosterAssignments.date, to),
        ne(rosterAssignments.status, "scheduled")
      )
    );
  const lockedSet = new Set(locked.map((d) => d.date));

  const priorTurns = await db
    .select({ date: rosterAssignments.date })
    .from(rosterAssignments)
    .where(
      and(
        gte(rosterAssignments.date, startDate),
        gt(rosterAssignments.date, "1900-01-01"),
        ne(rosterAssignments.status, "no-talk"),
        ne(rosterAssignments.status, "not-included"),
        lte(rosterAssignments.date, from)
      )
    );

  // rotation index starts based on already-consumed turns BEFORE from
  let idx = Math.max(0, priorTurns.filter((r) => r.date < from).length) % presenters.length;

  await db.delete(rosterAssignments).where(
    and(gte(rosterAssignments.date, from), lte(rosterAssignments.date, to), eq(rosterAssignments.status, "scheduled"))
  );

  const vals: Array<{ date: string; memberId: number; topic: string | null; status: string }> = [];
  for (const date of days) {
    if (lockedSet.has(date)) continue;
    const mid = presenters[idx % presenters.length].id;
    vals.push({
      date,
      memberId: mid,
      topic: memberTopics.get(mid) || null,
      status: "scheduled",
    });
    idx++;
  }

  if (vals.length > 0) await db.insert(rosterAssignments).values(vals);
}

async function shiftDownFrom(date: string, bumpedId: number, bumpedTopic: string | null) {
  const future = await db
    .select({ id: rosterAssignments.id, memberId: rosterAssignments.memberId, topic: rosterAssignments.topic })
    .from(rosterAssignments)
    .where(and(gt(rosterAssignments.date, date), eq(rosterAssignments.status, "scheduled")))
    .orderBy(asc(rosterAssignments.date));

  if (future.length === 0) return;

  const newMembers = [bumpedId, ...future.map((f) => f.memberId)];
  const newTopics = [bumpedTopic, ...future.map((f) => f.topic)];

  for (let i = 0; i < future.length; i++) {
    await db
      .update(rosterAssignments)
      .set({
        memberId: newMembers[i] ?? null,
        topic: newTopics[i] ?? null,
      })
      .where(eq(rosterAssignments.id, future[i].id));
  }
}

async function shiftUpInto(date: string) {
  const future = await db
    .select({ id: rosterAssignments.id, memberId: rosterAssignments.memberId, topic: rosterAssignments.topic, date: rosterAssignments.date })
    .from(rosterAssignments)
    .where(and(gt(rosterAssignments.date, date), eq(rosterAssignments.status, "scheduled")))
    .orderBy(asc(rosterAssignments.date));

  if (future.length === 0) return;

  await db.insert(rosterAssignments).values({
    date,
    memberId: future[0].memberId,
    topic: future[0].topic,
    status: "scheduled",
  });

  for (let i = 0; i < future.length - 1; i++) {
    await db
      .update(rosterAssignments)
      .set({ memberId: future[i + 1].memberId, topic: future[i + 1].topic })
      .where(eq(rosterAssignments.id, future[i].id));
  }

  await db.delete(rosterAssignments).where(eq(rosterAssignments.id, future[future.length - 1].id));
}

async function resequenceFromMember(startDate: string, memberId: number, year: number) {
  const { presenters } = await getConfig(year);
  if (presenters.length === 0) return;
  const idx0 = presenters.findIndex((p) => p.id === memberId);
  if (idx0 < 0) return;

  const to = `${year}-12-31`;
  const days = getWeekdays(startDate, to);
  const memberTopics = await getMemberTopicMap(startDate, to);

  const locked = await db
    .select({ date: rosterAssignments.date })
    .from(rosterAssignments)
    .where(and(gte(rosterAssignments.date, startDate), lte(rosterAssignments.date, to), ne(rosterAssignments.status, "scheduled")));
  const lockedSet = new Set(locked.map((d) => d.date));

  await db.delete(rosterAssignments).where(
    and(gte(rosterAssignments.date, startDate), lte(rosterAssignments.date, to), eq(rosterAssignments.status, "scheduled"))
  );

  const vals: Array<{ date: string; memberId: number; topic: string | null; status: string }> = [];
  let idx = idx0;
  for (const d of days) {
    if (lockedSet.has(d)) continue;
    const mid = presenters[idx % presenters.length].id;
    vals.push({ date: d, memberId: mid, topic: memberTopics.get(mid) || null, status: "scheduled" });
    idx++;
  }
  if (vals.length > 0) await db.insert(rosterAssignments).values(vals);
}

async function monthlyRoster(month: number, year: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;
  return db
    .select({
      id: rosterAssignments.id,
      date: rosterAssignments.date,
      memberId: rosterAssignments.memberId,
      topic: rosterAssignments.topic,
      status: rosterAssignments.status,
      noTalkReason: rosterAssignments.noTalkReason,
      noTalkPresenter: rosterAssignments.noTalkPresenter,
      noTalkTopic: rosterAssignments.noTalkTopic,
      notes: rosterAssignments.notes,
      memberName: members.name,
      memberRole: members.role,
    })
    .from(rosterAssignments)
    .leftJoin(members, eq(rosterAssignments.memberId, members.id))
    .where(and(gte(rosterAssignments.date, start), lte(rosterAssignments.date, end)))
    .orderBy(asc(rosterAssignments.date));
}

export async function GET() {
  await ensureTables();
  const history = await db
    .select({ id: actionHistory.id, action: actionHistory.action, detail: actionHistory.detail, createdAt: actionHistory.createdAt })
    .from(actionHistory)
    .orderBy(desc(actionHistory.id))
    .limit(50);
  return NextResponse.json(history);
}

export async function POST(request: NextRequest) {
  await ensureTables();
  const body = await request.json();
  const { action, month, year = 2026 } = body;

  try {
    if (action === "undo_specific") {
      const { historyId } = body;
      const [row] = await db.select().from(actionHistory).where(eq(actionHistory.id, historyId));
      if (!row) return NextResponse.json({ error: "History item not found" }, { status: 404 });
      const snapshot = JSON.parse(row.snapshotJson) as SnapshotRow[];
      await restoreSnapshot(snapshot);
      return NextResponse.json({ success: true, roster: await monthlyRoster(Number(month), Number(year)) });
    }

    if (action === "generate") {
      const { customStart } = body;
      const { startDate } = await getConfig(year);
      const from = customStart || startDate;
      const to = month
        ? `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`
        : `${year}-12-31`;
      await saveHistory("generate", `Generate from ${from}`);
      await fillScheduledSequence(from, to, year);
    }

    if (action === "save") {
      const { date, memberId, topic, status, notes } = body;
      const existing = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
      if (existing.length > 0) {
        await db.update(rosterAssignments).set({
          memberId: memberId ?? null,
          topic: topic ?? null,
          status: status || "scheduled",
          notes: notes ?? null,
          noTalkReason: null,
          noTalkPresenter: null,
          noTalkTopic: null,
        }).where(eq(rosterAssignments.date, date));
      } else {
        await db.insert(rosterAssignments).values({
          date,
          memberId: memberId ?? null,
          topic: topic ?? null,
          status: status || "scheduled",
          notes: notes ?? null,
        });
      }
    }

    if (action === "unassign") {
      const { date } = body;
      const [entry] = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
      if (entry) {
        await saveHistory("unassign", `Unassign ${date}`);
        await db.delete(rosterAssignments).where(eq(rosterAssignments.date, date));
        if (entry.memberId) await shiftDownFrom(date, entry.memberId, entry.topic ?? null);
      }
    }

    if (action === "notalk") {
      const { date, reason, altPresenter, altTopic, notes } = body;
      const [entry] = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
      await saveHistory("no-talk", `No-talk ${date}`);
      const bumpedId = entry?.memberId ?? null;
      const bumpedTopic = entry?.topic ?? null;

      if (entry) {
        await db.update(rosterAssignments).set({
          status: "no-talk",
          memberId: null,
          topic: null,
          noTalkReason: reason,
          noTalkPresenter: altPresenter || null,
          noTalkTopic: altTopic || null,
          notes: notes || null,
        }).where(eq(rosterAssignments.date, date));
      } else {
        await db.insert(rosterAssignments).values({
          date,
          status: "no-talk",
          noTalkReason: reason,
          noTalkPresenter: altPresenter || null,
          noTalkTopic: altTopic || null,
          notes: notes || null,
        });
      }

      if (bumpedId) await shiftDownFrom(date, bumpedId, bumpedTopic);
    }

    if (action === "team_reading") {
      const { date, topic: readingTopic } = body;
      const [entry] = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
      await saveHistory("team-reading", `Team reading ${date}`);
      const bumpedId = entry?.memberId ?? null;
      const bumpedTopic = entry?.topic ?? null;

      if (entry) {
        await db.update(rosterAssignments).set({
          status: "completed",
          memberId: null,
          topic: readingTopic || "Team Reading",
          noTalkReason: "other_topic",
          noTalkPresenter: "Team",
          noTalkTopic: readingTopic || "Team Reading",
          notes: "Team reading — presenter shifted",
        }).where(eq(rosterAssignments.date, date));
      } else {
        await db.insert(rosterAssignments).values({
          date,
          status: "completed",
          topic: readingTopic || "Team Reading",
          noTalkReason: "other_topic",
          noTalkPresenter: "Team",
          noTalkTopic: readingTopic || "Team Reading",
        });
      }

      if (bumpedId) await shiftDownFrom(date, bumpedId, bumpedTopic);
    }

    if (action === "restore") {
      const { date } = body;
      const [entry] = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
      if (entry && entry.status !== "scheduled") {
        await saveHistory("restore", `Restore ${date}`);
        await db.delete(rosterAssignments).where(eq(rosterAssignments.date, date));
        await shiftUpInto(date);
      }
    }

    if (action === "swap") {
      const { date, swapWithMemberId } = body;
      const [entry] = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, date));
      if (entry?.memberId && swapWithMemberId) {
        await saveHistory("swap", `Swap ${date}`);
        const originalId = entry.memberId;
        const originalTopic = entry.topic;
        const [swapEntry] = await db.select().from(rosterAssignments)
          .where(and(gt(rosterAssignments.date, date), eq(rosterAssignments.memberId, swapWithMemberId), eq(rosterAssignments.status, "scheduled")))
          .orderBy(asc(rosterAssignments.date))
          .limit(1);
        await db.update(rosterAssignments).set({ memberId: swapWithMemberId, topic: null }).where(eq(rosterAssignments.date, date));
        if (swapEntry) {
          await db.update(rosterAssignments).set({ memberId: originalId, topic: originalTopic ?? null }).where(eq(rosterAssignments.id, swapEntry.id));
        }
      }
    }

    if (action === "reorder_regenerate") {
      const { startDate } = await getConfig(year);
      const firstScheduled = await db.select({ date: rosterAssignments.date }).from(rosterAssignments)
        .where(eq(rosterAssignments.status, "scheduled"))
        .orderBy(asc(rosterAssignments.date))
        .limit(1);
      const from = firstScheduled[0]?.date || startDate;
      await saveHistory("reorder", `Reorder from ${from}`);
      await fillScheduledSequence(from, `${year}-12-31`, year);
    }

    if (action === "start_from_member") {
      const { date, memberId } = body;
      if (date && memberId) {
        await saveHistory("start-from-member", `Start from ${memberId} on ${date}`);
        await resequenceFromMember(date, Number(memberId), year);
      }
    }

    if (action === "pause") {
      const { startDate, endDate, reason } = body;
      const days = getWeekdays(startDate, endDate);
      await saveHistory("pause", `Pause ${startDate} to ${endDate}`);

      const bumped = await db.select({ memberId: rosterAssignments.memberId, topic: rosterAssignments.topic })
        .from(rosterAssignments)
        .where(and(gte(rosterAssignments.date, startDate), lte(rosterAssignments.date, endDate), eq(rosterAssignments.status, "scheduled")))
        .orderBy(asc(rosterAssignments.date));

      await db.delete(rosterAssignments).where(
        and(gte(rosterAssignments.date, startDate), lte(rosterAssignments.date, endDate), inArray(rosterAssignments.status, ["scheduled", "not-included"]))
      );

      for (const day of days) {
        const ex = await db.select().from(rosterAssignments).where(eq(rosterAssignments.date, day));
        if (ex.length === 0) {
          await db.insert(rosterAssignments).values({ date: day, status: "no-talk", noTalkReason: reason });
        }
      }

      if (bumped.length > 0) {
        const future = await db.select({ id: rosterAssignments.id, memberId: rosterAssignments.memberId, topic: rosterAssignments.topic })
          .from(rosterAssignments)
          .where(and(gt(rosterAssignments.date, endDate), eq(rosterAssignments.status, "scheduled")))
          .orderBy(asc(rosterAssignments.date));

        const memberSeq = [...bumped.map((b) => b.memberId), ...future.map((f) => f.memberId)];
        const topicSeq = [...bumped.map((b) => b.topic), ...future.map((f) => f.topic)];

        for (let i = 0; i < future.length; i++) {
          await db.update(rosterAssignments).set({
            memberId: memberSeq[i] ?? null,
            topic: topicSeq[i] ?? null,
          }).where(eq(rosterAssignments.id, future[i].id));
        }
      }
    }

    if (action === "undo") {
      const history = await db.select().from(actionHistory).orderBy(desc(actionHistory.id)).limit(1);
      if (history[0]) {
        const snapshot = JSON.parse(history[0].snapshotJson) as SnapshotRow[];
        await restoreSnapshot(snapshot);
        await db.delete(actionHistory).where(eq(actionHistory.id, history[0].id));
      }
    }

    if (action === "reset_month") {
      const m = Number(body.targetMonth || month);
      const y = Number(body.targetYear || year);
      await saveHistory("reset-month", `Reset ${y}-${m}`);
      await db.delete(rosterAssignments).where(
        and(
          gte(rosterAssignments.date, `${y}-${String(m).padStart(2, "0")}-01`),
          lte(rosterAssignments.date, `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`)
        )
      );
    }

    if (action === "reset_year") {
      const y = Number(body.targetYear || year);
      await saveHistory("reset-year", `Reset ${y}`);
      await db.delete(rosterAssignments).where(and(gte(rosterAssignments.date, `${y}-01-01`), lte(rosterAssignments.date, `${y}-12-31`)));
    }
  } catch (error) {
    console.error("Roster action failed:", error);
    return NextResponse.json({ error: "Roster action failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, roster: await monthlyRoster(Number(month), Number(year)) });
}

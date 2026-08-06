import { db } from "@/db";
import { ensureTables } from "@/db/migrate";
import { members, topics, announcements } from "@/db/schema";
import RosterApp from "./RosterApp";

export const dynamic = "force-dynamic";

interface MemberType {
  id: number;
  name: string;
  role: string;
  department: string | null;
  email: string | null;
  birthday: string | null;
  isAdmin: boolean;
  active: boolean;
  sortOrder: number;
  pin?: string | null;
  pinResetRequested?: boolean;
}

interface TopicType {
  id: number;
  category: string;
  title: string;
  description: string | null;
  addedBy: string | null;
}

interface AnnouncementType {
  id: number;
  type: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  addedBy: string | null;
  active: boolean;
}

export default async function HomePage() {
  let allMembers: MemberType[] = [];
  let allTopics: TopicType[] = [];
  let allAnnouncements: AnnouncementType[] = [];
  let needsSeed = false;

  try {
    await ensureTables();
    const [m, t, a] = await Promise.allSettled([
      db.select().from(members).orderBy(members.sortOrder, members.name),
      db.select().from(topics).orderBy(topics.category, topics.title),
      db.select().from(announcements).orderBy(announcements.eventDate),
    ]);
    if (m.status === "fulfilled") allMembers = m.value;
    if (t.status === "fulfilled") allTopics = t.value;
    if (a.status === "fulfilled") allAnnouncements = a.value;
    if (allMembers.length === 0) needsSeed = true;
  } catch (err) {
    console.error("Page load error:", err);
    needsSeed = true;
  }

  return (
    <RosterApp
      initialMembers={allMembers}
      initialTopics={allTopics}
      initialAnnouncements={allAnnouncements}
      needsSeed={needsSeed}
    />
  );
}

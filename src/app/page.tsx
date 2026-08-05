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
  active: boolean;
  sortOrder: number;
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
    allMembers = await db.select().from(members).orderBy(members.sortOrder, members.name);
    allTopics = await db.select().from(topics).orderBy(topics.category, topics.title);
    allAnnouncements = await db.select().from(announcements).orderBy(announcements.eventDate);
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

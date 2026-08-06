"use client";

import { useState, useEffect, useCallback } from "react";
import { SASLogo, SASLogoText } from "./SASLogo";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */
interface Member {
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

interface Topic {
  id: number;
  category: string;
  title: string;
  description: string | null;
  addedBy: string | null;
}

interface Announcement {
  id: number;
  type: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  addedBy: string | null;
  active: boolean;
}

interface RosterEntry {
  id: number;
  date: string;
  memberId: number | null;
  topic: string | null;
  status: string;
  notes: string | null;
  memberName: string | null;
  memberRole: string | null;
  noTalkReason: string | null;
  noTalkPresenter: string | null;
  noTalkTopic: string | null;
}

interface Stats {
  totalMembers: number;
  totalAssignments: number;
  completedTalks: number;
  scheduledTalks: number;
  legitimateNoTalk: number;
  notIncluded: number;
  startDate: string | null;
  perMember: { memberName: string; total: number; completed: number }[];
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TEAMS_LINK = "https://teams.microsoft.com/meet/32805846945212?p=3EwCxiW9TfHplYcW6X";

// South African public holidays 2026
const SA_HOLIDAYS: { date: string; name: string }[] = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-03-21", name: "Human Rights Day" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-04-06", name: "Family Day" },
  { date: "2026-04-27", name: "Freedom Day" },
  { date: "2026-05-01", name: "Workers' Day" },
  { date: "2026-06-16", name: "Youth Day" },
  { date: "2026-08-10", name: "National Women's Day" },
  { date: "2026-09-24", name: "Heritage Day" },
  { date: "2026-12-16", name: "Day of Reconciliation" },
  { date: "2026-12-25", name: "Christmas Day" },
  { date: "2026-12-26", name: "Day of Goodwill" },
];

const SA_HOLIDAY_MAP = new Map(SA_HOLIDAYS.map((h) => [h.date, h.name]));

// Weather code to description and icon
function weatherInfo(code: number): { desc: string; icon: string } {
  if (code === 0) return { desc: "Clear sky", icon: "☀️" };
  if (code <= 3) return { desc: "Partly cloudy", icon: "⛅" };
  if (code <= 48) return { desc: "Foggy", icon: "🌫️" };
  if (code <= 57) return { desc: "Drizzle", icon: "🌦️" };
  if (code <= 67) return { desc: "Rain", icon: "🌧️" };
  if (code <= 77) return { desc: "Snow", icon: "❄️" };
  if (code <= 82) return { desc: "Rain showers", icon: "🌧️" };
  if (code <= 86) return { desc: "Snow showers", icon: "🌨️" };
  if (code >= 95) return { desc: "Thunderstorm", icon: "⛈️" };
  return { desc: "Cloudy", icon: "☁️" };
}

const CAT_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  Safety: { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-400", border: "border-rose-200 dark:border-rose-800", icon: "🦺" },
  Health: { bg: "bg-sky-50 dark:bg-sky-950/30", text: "text-sky-700 dark:text-sky-400", border: "border-sky-200 dark:border-sky-800", icon: "🏥" },
  Environment: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800", icon: "🌊" },
  Risk: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800", icon: "⚠️" },
  Quality: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-400", border: "border-violet-200 dark:border-violet-800", icon: "✅" },
  General: { bg: "bg-slate-50 dark:bg-slate-800/50", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200 dark:border-slate-700", icon: "📋" },
};

const STATUS_STYLES: Record<string, { bg: string; dot: string; label: string }> = {
  scheduled: { bg: "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300", dot: "bg-sky-500", label: "Scheduled" },
  completed: { bg: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", label: "Completed" },
  missed: { bg: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300", dot: "bg-rose-500", label: "Missed" },
  cancelled: { bg: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400", dot: "bg-slate-400", label: "Cancelled" },
  "no-talk": { bg: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300", dot: "bg-amber-500", label: "No Talk" },
  "not-included": { bg: "bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500", dot: "bg-slate-300 dark:bg-slate-600", label: "Not Included" },
};

// No-talk reasons that count as legitimate misses (not counted in totals)
const VALID_NOTALK_REASONS = ["holiday", "other_topic", "meeting"];
// Reasons that count against the roster (should have talked)
// "paused", "shutdown", "other", "before_start" — these are operational

type Tab = "dashboard" | "calendar" | "roster" | "members" | "topics" | "messages";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "calendar", label: "Calendar", icon: "📅" },
  { key: "roster", label: "Roster", icon: "📋" },
  { key: "members", label: "Team", icon: "👥" },
  { key: "topics", label: "Topics", icon: "📚" },
  { key: "messages", label: "Messages", icon: "💬" },
];

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function getMemberColor(index: number): string {
  // Professional, muted color palette - no rainbow
  const colors = [
    "bg-slate-600 dark:bg-slate-500",
    "bg-zinc-600 dark:bg-zinc-500",
    "bg-stone-600 dark:bg-stone-500",
    "bg-neutral-600 dark:bg-neutral-500",
    "bg-slate-700 dark:bg-slate-600",
    "bg-zinc-700 dark:bg-zinc-600",
    "bg-stone-700 dark:bg-stone-600",
    "bg-neutral-700 dark:bg-neutral-600",
    "bg-slate-500 dark:bg-slate-400",
    "bg-zinc-500 dark:bg-zinc-400",
    "bg-stone-500 dark:bg-stone-400",
    "bg-neutral-500 dark:bg-neutral-400",
  ];
  return colors[index % colors.length];
}

function getMemberBadgeColor(index: number): string {
  const colors = [
    "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
    "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700",
    "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700",
  ];
  return colors[index % colors.length];
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════ */
export default function RosterApp({
  initialMembers,
  initialTopics,
  initialAnnouncements,
  needsSeed,
}: {
  initialMembers: Member[];
  initialTopics: Topic[];
  initialAnnouncements: Announcement[];
  needsSeed: boolean;
}) {
  const [darkMode, setDarkMode] = useState(true);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [mems, setMems] = useState<Member[]>(initialMembers);
  const [tops, setTops] = useState<Topic[]>(initialTopics);
  const [anns, setAnns] = useState<Announcement[]>(initialAnnouncements);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [dashboardRoster, setDashboardRoster] = useState<RosterEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [mo, setMo] = useState(() => new Date().getMonth() + 1);
  const [yr, setYr] = useState(() => new Date().getFullYear());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [weather, setWeather] = useState<any>(null);
  const [seeded, setSeeded] = useState(!needsSeed);
  const [busy, setBusy] = useState(false);
  const [addMem, setAddMem] = useState(false);
  const [editing, setEditing] = useState<RosterEntry | null>(null);
  const [noTalkModal, setNoTalkModal] = useState<RosterEntry | null>(null);
  const [msg, setMsg] = useState("");
  const [addTopicOpen, setAddTopicOpen] = useState(false);
  const [addAnnOpen, setAddAnnOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [rosterStartDate, setRosterStartDate] = useState<string>("");
  const [pauseModal, setPauseModal] = useState(false);
  const [pinModal, setPinModal] = useState<{ memberId: number; mode: "login" | "set" | "change" | "reset_confirm" } | null>(null);
  const [pinResetQueue, setPinResetQueue] = useState<Member[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [inbox, setInbox] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [chatWith, setChatWith] = useState<{ id: number; name: string } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [chatMsgs, setChatMsgs] = useState<any[]>([]);
  const [msgDraft, setMsgDraft] = useState("");

  // Initialize dark mode and current user from localStorage
  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const saved = localStorage.getItem("darkMode");
    setDarkMode(saved !== null ? saved === "true" : true);
    const savedUser = localStorage.getItem("currentUserId");
    if (savedUser) setCurrentUserId(parseInt(savedUser, 10));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  const switchUser = async (id: number | null) => {
    if (!id) {
      setCurrentUserId(null);
      localStorage.removeItem("currentUserId");
      return;
    }
    // Check if this member has a PIN
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "has_pin", memberId: id }),
    });
    const data = await res.json();
    if (data.hasPin) {
      // Need PIN — show modal
      setPinModal({ memberId: id, mode: "login" });
    } else {
      // No PIN — log in directly
      setCurrentUserId(id);
      localStorage.setItem("currentUserId", String(id));
    }
  };

  const confirmLogin = (id: number) => {
    setCurrentUserId(id);
    localStorage.setItem("currentUserId", String(id));
    setPinModal(null);
  };

  const currentUser = mems.find((m) => m.id === currentUserId) || null;
  const isLoggedIn = !!currentUser;
  // Peter S. Mavundla = developer, always full control. HOD and assigned admins also get admin.
  const isDeveloper = currentUser?.email === "PeterSM@sas.co.za";
  const isAdmin = isDeveloper || currentUser?.isAdmin || currentUser?.role === "HOD" || false;

  // My upcoming talks (full timeline, not tied to browsed month)
  const myUpcoming = dashboardRoster
    .filter((r) => r.memberId === currentUserId && r.status === "scheduled")
    .sort((a, b) => a.date.localeCompare(b.date));

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  const safeFetch = async (url: string) => {
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  };

  const fetchRoster = useCallback(async (m: number, y?: number) => {
    const d = await safeFetch(`/api/roster?month=${m}&year=${y ?? yr}`);
    if (d) setRoster(d);
  }, [yr]);

  const fetchDashboardRoster = useCallback(async () => {
    // Always fetch full roster so dashboard stays tied to the real calendar, not the browsed month
    const d = await safeFetch(`/api/roster`);
    if (d) setDashboardRoster(d);
  }, []);

  const fetchStats = useCallback(async () => {
    const d = await safeFetch("/api/stats");
    if (d) setStats(d);
  }, []);

  const fetchMems = async () => { const d = await safeFetch("/api/members"); if (d) setMems(d); };
  const fetchTops = async () => { const d = await safeFetch("/api/topics"); if (d) setTops(d); };
  const fetchAnns = async () => { const d = await safeFetch("/api/announcements"); if (d) setAnns(d); };
  const fetchWeather = async () => { const d = await safeFetch("/api/weather"); if (d) setWeather(d); };
  const fetchSettings = async () => { const d = await safeFetch("/api/roster/settings"); if (d?.start_date) setRosterStartDate(d.start_date); };
  const fetchInbox = async () => {
    if (!currentUserId) return;
    const d = await safeFetch(`/api/messages?userId=${currentUserId}`);
    if (d) { setInbox(d.inbox || []); setUnreadCount(d.totalUnread || 0); }
  };
  const fetchChat = async (otherId: number) => {
    if (!currentUserId) return;
    const d = await safeFetch(`/api/messages?userId=${currentUserId}&withId=${otherId}`);
    if (d) setChatMsgs(d);
  };
  const sendMsg = async () => {
    if (!currentUserId || !chatWith || !msgDraft.trim()) return;
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromId: currentUserId, toId: chatWith.id, bodyText: msgDraft }),
    });
    setMsgDraft("");
    fetchChat(chatWith.id);
    fetchInbox();
  };

  useEffect(() => {
    if (seeded) {
      fetchRoster(mo, yr);            // browsed month/year for Calendar + Roster tabs
      fetchDashboardRoster();         // always full/current-aware for Dashboard
      fetchStats();
      fetchWeather();
      fetchSettings();
      if (currentUserId) fetchInbox();
    }
  }, [mo, yr, tab, seeded, fetchRoster, fetchDashboardRoster, fetchStats, currentUserId]);

  // Check for PIN reset requests (admin only)
  useEffect(() => {
    if (isAdmin && mems.length > 0) {
      setPinResetQueue(mems.filter((m) => m.pinResetRequested));
    }
  }, [isAdmin, mems]);

  // Auto-refresh every 30 seconds so everyone sees the latest changes
  useEffect(() => {
    if (!seeded) return;
    const interval = setInterval(() => {
      fetchRoster(mo, yr);
      fetchDashboardRoster();
      fetchMems();
      fetchAnns();
      if (currentUserId) fetchInbox();
    }, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, mo, yr, currentUserId]);

  const seed = async () => {
    setBusy(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch("/api/seed", { method: "POST", signal: controller.signal });
      clearTimeout(timeout);
      
      let data: Record<string, string> = {};
      try { data = await res.json(); } catch {}
      
      if (!res.ok) {
        toast(data.error || `Setup failed (${res.status})`);
        setBusy(false);
        return;
      }
      
      // Fetch data in parallel, don't fail if one errors
      await Promise.allSettled([fetchMems(), fetchTops(), fetchAnns()]);
      setSeeded(true);
      toast("System ready — Welcome aboard! ⚓");
    } catch (err) {
      const msg = err instanceof Error && err.name === "AbortError"
        ? "Request timed out — try again"
        : "Connection error — check DATABASE_URL";
      toast(msg);
    }
    setBusy(false);
  };

  // ─── Fast action helper: single API call, returns updated roster ───
  const rosterAction = async (actionBody: Record<string, unknown>, toastMsg?: string) => {
    const payload = { ...actionBody, month: mo, year: yr };
    try {
      const r = await fetch("/api/roster/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (d.error) { toast(d.error); return; }
      if (d.roster) setRoster(d.roster);
      if (toastMsg) toast(toastMsg);
    } catch {
      toast("Action failed — check connection");
    }
    // Background refreshes so dashboard stays time-smart and current
    fetchStats();
    fetchDashboardRoster();
  };

  const generate = async (monthOnly?: number) => {
    await rosterAction(
      { action: "generate", ...(monthOnly ? { month: monthOnly } : {}), customStart: rosterStartDate || undefined },
      "⚓ Roster generated"
    );
  };

  const addMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const m = f.get("bday_month") as string;
    const d = f.get("bday_day") as string;
    const birthday = m && d ? `${m}-${d}` : null;
    const r = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: f.get("name"),
        role: f.get("role"),
        email: f.get("email"),
        birthday,
      }),
    });
    if (r.ok) {
      await fetchMems();
      setAddMem(false);
      toast("Crew member added! 🎉");
      (e.target as HTMLFormElement).reset();
    }
  };

  const toggleMem = async (m: Member) => {
    await fetch("/api/members", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, active: !m.active }),
    });
    await fetchMems();
    toast(`${m.name} ${m.active ? "stood down" : "back on deck"}`);
  };

  const deleteMem = async (id: number) => {
    const target = mems.find((m) => m.id === id);
    if (target?.email === "PeterSM@sas.co.za") { toast("Developer cannot be removed"); return; }
    if (!confirm("Remove this crew member?")) return;
    await fetch(`/api/members?id=${id}`, { method: "DELETE" });
    await fetchMems();
    toast("Member removed");
  };

  const toggleAdmin = async (member: Member) => {
    if (!isAdmin) return;
    // Can't remove developer's admin
    if (member.email === "PeterSM@sas.co.za") { toast("Developer access cannot be changed"); return; }
    await fetch("/api/members", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: member.id, isAdmin: !member.isAdmin }),
    });
    await fetchMems();
    toast(`${member.name} ${member.isAdmin ? "admin removed" : "is now admin"}`);
  };

  const updateMember = async (id: number, data: { name?: string; role?: string; email?: string; birthday?: string | null }) => {
    await fetch("/api/members", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    await fetchMems();
    setEditingMember(null);
    toast("Member updated ✓");
  };

  const saveAssignment = async (
    date: string,
    memberId: number | null,
    topic: string | null,
    status: string,
    notes: string | null
  ) => {
    setEditing(null);
    await rosterAction({ action: "save", date, memberId, topic, status, notes }, "Assignment updated ✓");
  };

  const unassignDate = async (date: string) => {
    const entry = roster.find((r) => r.date === date);
    setRoster((prev) => prev.filter((r) => r.date !== date));
    setEditing(null);
    await rosterAction({ action: "unassign", date }, `${entry?.memberName || "Entry"} shifted to next available day ✓`);
  };

  const swapMembers = async (date: string, swapWithMemberId: number) => {
    setEditing(null);
    await rosterAction({ action: "swap", date, swapWithMemberId }, "Members swapped ✓");
  };

  const teamReading = async (date: string) => {
    setEditing(null);
    const entry = roster.find((r) => r.date === date);
    await rosterAction(
      { action: "team_reading", date, topic: "Team Reading" },
      `Team reading (completed) — ${entry?.memberName || "presenter"} shifted ✓`
    );
  };

  const restoreDay = async (date: string) => {
    setEditing(null);
    await rosterAction({ action: "restore", date }, "Day restored ✓");
  };

  const markNoTalk = async (
    date: string,
    reason: string,
    altPresenter: string,
    altTopic: string,
    notes: string
  ) => {
    const entry = roster.find((r) => r.date === date);
    setNoTalkModal(null);
    await rosterAction(
      { action: "notalk", date, reason, altPresenter, altTopic, notes },
      `No-talk set — ${entry?.memberName || "presenter"} shifted to next day ✓`
    );
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const items = [...mems];
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setMems(items); // Optimistic update
    const ids = items.map((m) => m.id);
    // Save new order first, then smart-regenerate (continues rotation, doesn't restart)
    await fetch("/api/members/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ids }),
    });
    await rosterAction({ action: "reorder_regenerate" }, "Roster reordered ✓");
  };

  const addTopic = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: f.get("category"),
        title: f.get("title"),
        description: f.get("description"),
        addedBy: f.get("addedBy"),
      }),
    });
    if (r.ok) {
      await fetchTops();
      setAddTopicOpen(false);
      toast("Topic added ✓");
      (e.target as HTMLFormElement).reset();
    }
  };

  const deleteTopic = async (id: number) => {
    if (!confirm("Delete this topic?")) return;
    await fetch(`/api/topics?id=${id}`, { method: "DELETE" });
    await fetchTops();
    toast("Topic removed");
  };

  const addAnnouncement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: f.get("type"),
        title: f.get("title"),
        description: f.get("description"),
        eventDate: f.get("eventDate") || null,
        addedBy: f.get("addedBy"),
      }),
    });
    if (r.ok) {
      await fetchAnns();
      setAddAnnOpen(false);
      toast("Announcement added ✓");
      (e.target as HTMLFormElement).reset();
    }
  };

  const deleteAnn = async (id: number) => {
    await fetch(`/api/announcements?id=${id}`, { method: "DELETE" });
    await fetchAnns();
    toast("Removed");
  };

  const setStartDate = async (date: string) => {
    // Save setting
    fetch("/api/roster/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "start_date", value: date }),
    });
    setRosterStartDate(date);

    // Mark before start as not-included
    const yearStr = date.slice(0, 4);
    if (date > `${yearStr}-01-01`) {
      const dayBefore = new Date(date + "T00:00:00");
      dayBefore.setDate(dayBefore.getDate() - 1);
      const endStr = dayBefore.toISOString().split("T")[0];
      await fetch("/api/roster/bulk-notalk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: `${yearStr}-01-01`, endDate: endStr, reason: "before_start", status: "not-included" }),
      });
    }

    // Generate and get updated roster in one call
    await rosterAction(
      { action: "generate", customStart: date },
      `Roster starts ${new Date(date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "long" })}`
    );
  };

  const pauseRange = async (startDate: string, endDate: string, reason: string) => {
    setPauseModal(false);
    await rosterAction({ action: "pause", startDate, endDate, reason }, "Roster paused ✓");
  };

  const resetMonth = async (month: number) => {
    if (!confirm(`⚠️ Reset ${MONTHS[month - 1]} ${yr}?\n\nAll assignments will be deleted.\nThis cannot be undone.`)) return;
    setRoster([]); // Optimistic clear
    await rosterAction({ action: "reset_month", targetMonth: month, targetYear: yr }, `${MONTHS[month - 1]} reset`);
  };

  const resetYear = async () => {
    if (!confirm(`⚠️ Reset the ENTIRE year ${yr}?\n\nAll roster assignments for ${yr} will be deleted.\nThis cannot be undone.`)) return;
    if (!confirm(`FINAL CONFIRMATION:\n\nDelete ALL of ${yr}?`)) return;
    setRoster([]);
    await rosterAction({ action: "reset_year", targetYear: yr }, `${yr} reset`);
  };

  const teamsCalUrl = (entry: RosterEntry) => {
    const d = new Date(entry.date + "T00:00:00");
    const start = d.toISOString().split("T")[0] + "T07:00:00+02:00";
    const end = d.toISOString().split("T")[0] + "T07:30:00+02:00";
    const title = encodeURIComponent(`SHERQ Talk: ${entry.memberName || "TBC"} — ${entry.topic || "Toolbox Talk"}`);
    const body = encodeURIComponent(
      `SHERQ Toolbox Talk\n\nPresenter: ${entry.memberName || "TBC"}\nTopic: ${entry.topic || "TBC"}\n\nJoin Teams: ${TEAMS_LINK}\nMeeting ID: 328 058 469 452 12\nPasscode: ZF6DQ69D`
    );
    return `https://teams.microsoft.com/l/meeting/new?subject=${title}&startTime=${encodeURIComponent(start)}&endTime=${encodeURIComponent(end)}&content=${body}&location=${encodeURIComponent("Microsoft Teams")}`;
  };

  // Get upcoming birthdays
  const getUpcomingBirthdays = () => {
    const today = new Date();
    
    return mems
      .filter((m) => m.birthday && m.active)
      .map((m) => {
        // birthday is stored as "MM-DD"
        const [month, day] = m.birthday!.split("-").map(Number);
        const bday = new Date(today.getFullYear(), month - 1, day);
        if (bday < today) {
          bday.setFullYear(today.getFullYear() + 1);
        }
        const daysUntil = Math.ceil((bday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { ...m, month, day, daysUntil };
      })
      .filter((m) => m.daysUntil <= 31)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  };

  /* ═══ SEED SCREEN ═══ */
  if (!seeded) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors relative ${darkMode ? "dark bg-[#0a0f1a]" : "bg-[#dce3ec]"}`}>
        {/* Animated orb background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none orb-bg">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#1A4687]/15 rounded-full blur-[120px]" style={{animation:"orb1 20s ease-in-out infinite"}} />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#6EC1E4]/10 rounded-full blur-[100px]" style={{animation:"orb2 15s ease-in-out infinite"}} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#225CB2]/8 rounded-full blur-[140px]" />
        </div>
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:"radial-gradient(circle, var(--text-muted) 1px, transparent 1px)", backgroundSize:"32px 32px"}} />
        <div className="glass-card rounded-3xl shadow-theme-xl p-12 max-w-md text-center anim-scale relative z-10">
          <div className="mb-8 anim-float flex justify-center">
            <SASLogo size="lg" />
          </div>
          <h1 className="text-3xl font-black text-theme-primary mb-2 tracking-tight">SHERQ Talk Roster</h1>
          <p className="gradient-text text-base font-bold mb-2">Sandock Austral Shipyards</p>
          <p className="text-theme-muted text-sm mb-10">Initialize with your SHERQ team and toolbox talk topics.</p>
          <button
            onClick={seed}
            disabled={busy}
            className="w-full py-4 px-6 gradient-premium text-white font-bold rounded-2xl transition-all shadow-xl hover:shadow-2xl disabled:opacity-50 btn-press relative overflow-hidden shimmer-overlay text-base tracking-wide"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-3 relative z-10">
                <svg className="w-5 h-5 anim-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                Initializing…
              </span>
            ) : (
              <span className="relative z-10">⚓ Launch System</span>
            )}
          </button>
        </div>
      </div>
    );
  }

  /* ═══ MAIN LAYOUT ═══ */
  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? "dark" : ""}`}>
      <div className="min-h-screen bg-theme-secondary relative">
        {/* Subtle mesh gradient background */}
        <div className="fixed inset-0 gradient-mesh pointer-events-none opacity-50 z-0" />
        {/* Dot grid pattern */}
        <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.015]" style={{backgroundImage:"radial-gradient(circle, var(--text-primary) 1px, transparent 1px)", backgroundSize:"24px 24px"}} />

        {/* HEADER */}
        <header className="relative z-10 gradient-premium-dark text-white shadow-2xl overflow-hidden">
          {/* Animated waves */}
          <div className="absolute bottom-0 left-0 right-0 overflow-hidden h-8 opacity-10">
            <div className="wave-container">
              <svg viewBox="0 0 2400 40" fill="none" preserveAspectRatio="none" className="w-full h-full">
                <path d="M0 20 Q75 0 150 20 Q225 40 300 20 Q375 0 450 20 Q525 40 600 20 Q675 0 750 20 Q825 40 900 20 Q975 0 1050 20 Q1125 40 1200 20 Q1275 0 1350 20 Q1425 40 1500 20 Q1575 0 1650 20 Q1725 40 1800 20 Q1875 0 1950 20 Q2025 40 2100 20 Q2175 0 2250 20 Q2325 40 2400 20 L2400 40 L0 40 Z" fill="#6EC1E4"/>
              </svg>
            </div>
          </div>
          {/* Noise texture */}
          <div className="absolute inset-0 noise" />
          <div className="relative max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between anim-fade-down">
              <div className="flex items-center gap-3">
                <SASLogo size="md" />
                <div>
                  <h1 className="text-sm sm:text-base font-bold tracking-wide flex items-center gap-2">
                    SHERQ TALK ROSTER
                    <span className="bg-[#6EC1E4] text-[#1D2130] text-[10px] font-black px-2 py-0.5 rounded-full">2026</span>
                  </h1>
                  <p className="text-blue-300/80 text-[11px]">SA Shipyards • Daily 07:00–07:30</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Who am I selector */}
                <select
                  value={currentUserId ?? ""}
                  onChange={(e) => { const v = e.target.value; switchUser(v ? parseInt(v, 10) : null); }}
                  className="bg-white/10 hover:bg-white/20 backdrop-blur text-white text-xs font-medium pl-2 pr-1 py-2 rounded-lg transition-all border border-white/10 outline-none max-w-[140px] sm:max-w-[180px] cursor-pointer appearance-none"
                  title="Select who you are"
                >
                  <option value="" className="text-gray-900">👤 Who are you?</option>
                  {mems.filter((m) => m.active).map((m) => (
                    <option key={m.id} value={m.id} className="text-gray-900">{m.name}{m.pin ? " 🔒" : ""}</option>
                  ))}
                </select>
                {/* Set/Change PIN button when logged in */}
                {currentUser && (
                  <button
                    onClick={() => setPinModal({ memberId: currentUser.id, mode: currentUser.pin ? "change" : "set" })}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-xs"
                    title={currentUser.pin ? "Change PIN" : "Set a PIN to protect your account"}
                  >
                    {currentUser.pin ? "🔒" : "🔓"}
                  </button>
                )}
                {/* Dark mode toggle */}
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
                  title={darkMode ? "Light mode" : "Dark mode"}
                >
                  {darkMode ? "☀️" : "🌙"}
                </button>
                {/* Teams button */}
                <a
                  href={TEAMS_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur text-white text-xs font-medium px-3 py-2 rounded-lg transition-all"
                >
                  <span>📹</span> Join Meeting
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* TABS */}
        <nav className="relative z-20 glass-strong sticky top-0 no-print border-b border-theme shadow-theme">
          <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-3.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap btn-press ${
                  tab === t.key
                    ? "border-[#6EC1E4] text-[#1A4687] dark:text-[#6EC1E4] bg-[#6EC1E4]/10"
                    : "border-transparent text-theme-muted hover:text-theme-secondary hover:bg-theme-hover/50"
                }`}
              >
                <span className="mr-1.5">{t.icon}</span>
                {t.label}
                {t.key === "messages" && unreadCount > 0 && (
                  <span className="ml-1 bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">{unreadCount}</span>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* TOAST */}
        {msg && (
          <div className="fixed top-4 right-4 z-50 px-5 py-3.5 rounded-2xl shadow-2xl anim-slide-in glass-strong text-theme-primary text-sm font-semibold flex items-center gap-2.5 border border-[#6EC1E4]/30">
            <span className="w-6 h-6 rounded-full bg-[#6EC1E4] text-[#1D2130] flex items-center justify-center text-xs font-black">✓</span>
            {msg}
          </div>
        )}

        {/* BLUR OVERLAY when not logged in */}
        {!isLoggedIn && seeded && (
          <div className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none" style={{top:"100px"}}>
            <div className="glass-card rounded-3xl p-8 text-center max-w-sm pointer-events-auto shadow-2xl anim-scale">
              <span className="text-4xl mb-4 block">👤</span>
              <h3 className="text-lg font-bold text-theme-primary mb-2">Select Your Name</h3>
              <p className="text-sm text-theme-muted mb-4">Choose who you are from the dropdown in the top-right corner to view and interact with the roster.</p>
              <div className="flex items-center justify-center gap-1 text-xs text-theme-muted">
                <span>👆</span> Look for <strong className="text-theme-primary mx-1">&ldquo;Who are you?&rdquo;</strong> in the header
              </div>
            </div>
          </div>
        )}

        {/* MAIN CONTENT */}
        <main className={`relative z-10 max-w-7xl mx-auto px-4 py-8 transition-all duration-300 ${!isLoggedIn && seeded ? "blur-sm opacity-60 pointer-events-none select-none" : ""}`}>
          <div className="anim-fade-up">
            {tab === "dashboard" && (
              <DashboardView
                stats={stats}
                roster={dashboardRoster}
                mems={mems}
                anns={anns}
                addAnnOpen={addAnnOpen}
                setAddAnnOpen={setAddAnnOpen}
                addAnnouncement={addAnnouncement}
                deleteAnn={deleteAnn}
                getUpcomingBirthdays={getUpcomingBirthdays}
                generate={generate}
                busy={busy}
                mo={mo}
                currentUser={currentUser}
                myUpcoming={myUpcoming}
                setEditing={setEditing}
                teamsCalUrl={teamsCalUrl}
                weather={weather}
                setTab={setTab}
                isAdmin={isAdmin}
              />
            )}
            {tab === "calendar" && (
              <CalendarView
                roster={roster}
                mems={mems}
                mo={mo}
                setMo={setMo}
                yr={yr}
                setYr={setYr}
                generate={generate}
                setEditing={setEditing}
                setNoTalkModal={setNoTalkModal}
                busy={busy}
                teamsCalUrl={teamsCalUrl}
                resetMonth={resetMonth}
                resetYear={resetYear}
                rosterStartDate={rosterStartDate}
                setStartDate={setStartDate}
                setPauseModal={setPauseModal}
                isAdmin={isAdmin}
              />
            )}
            {tab === "roster" && (
              <RosterListView
                roster={roster}
                mo={mo}
                setMo={setMo}
                setEditing={setEditing}
                setNoTalkModal={setNoTalkModal}
                teamsCalUrl={teamsCalUrl}
              />
            )}
            {tab === "members" && (
              <MembersView
                mems={mems}
                addMem={addMem}
                setAddMem={setAddMem}
                addMember={addMember}
                toggleMem={toggleMem}
                deleteMem={deleteMem}
                onDragEnd={onDragEnd}
                onEditMember={setEditingMember}
                isAdmin={isAdmin}
                toggleAdmin={toggleAdmin}
                onResetPin={async (m: Member) => {
                  if (!confirm(`Reset PIN for ${m.name}?\nThey will be able to log in without a PIN until they set a new one.`)) return;
                  await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", memberId: m.id }) });
                  await fetchMems();
                  toast(`PIN reset for ${m.name}`);
                }}
                pinResetQueue={pinResetQueue}
              />
            )}
            {tab === "topics" && (
              <TopicsView
                tops={tops}
                addTopicOpen={addTopicOpen}
                setAddTopicOpen={setAddTopicOpen}
                addTopic={addTopic}
                deleteTopic={deleteTopic}
              />
            )}
            {tab === "messages" && currentUser && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-theme-primary flex items-center gap-2 anim-fade-down">
                  💬 Messages
                  {unreadCount > 0 && <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full">{unreadCount}</span>}
                </h2>
                <div className="grid lg:grid-cols-3 gap-4" style={{minHeight:"400px"}}>
                  {/* Contacts / Inbox */}
                  <div className="glass-card rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-theme"><p className="text-xs font-semibold text-theme-muted uppercase">Conversations</p></div>
                    <div className="divide-y divide-theme max-h-96 overflow-y-auto">
                      {mems.filter((m) => m.active && m.id !== currentUser.id).map((m) => {
                        const conv = inbox.find((c: {otherId: number}) => c.otherId === m.id);
                        return (
                          <button key={m.id} onClick={() => { setChatWith({ id: m.id, name: m.name }); fetchChat(m.id); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-theme-hover transition ${chatWith?.id === m.id ? "bg-[#6EC1E4]/10" : ""}`}>
                            <div className={`w-9 h-9 rounded-full ${getMemberColor(mems.indexOf(m))} text-white flex items-center justify-center font-bold text-xs`}>{initials(m.name)}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-theme-primary truncate">{m.name}</p>
                            </div>
                            {conv && conv.unread > 0 && <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{conv.unread}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* Chat */}
                  <div className="lg:col-span-2 glass-card rounded-2xl flex flex-col overflow-hidden">
                    {chatWith ? (
                      <>
                        <div className="px-4 py-3 border-b border-theme flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full ${getMemberColor(0)} text-white flex items-center justify-center font-bold text-xs`}>{initials(chatWith.name)}</div>
                          <p className="font-semibold text-theme-primary text-sm">{chatWith.name}</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80">
                          {chatMsgs.length === 0 && <p className="text-center text-theme-muted text-sm py-8">No messages yet. Say hello! 👋</p>}
                          {chatMsgs.map((msg: {id:number;fromId:number;body:string;createdAt:string}) => (
                            <div key={msg.id} className={`flex ${msg.fromId === currentUser.id ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${msg.fromId === currentUser.id ? "bg-[#1A4687] text-white rounded-br-md" : "bg-theme-secondary text-theme-primary rounded-bl-md"}`}>
                                <p>{msg.body}</p>
                                <p className={`text-[9px] mt-1 ${msg.fromId === currentUser.id ? "text-white/50" : "text-theme-muted"}`}>
                                  {new Date(msg.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="p-3 border-t border-theme flex gap-2">
                          <input value={msgDraft} onChange={(e) => setMsgDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && msgDraft.trim()) sendMsg(); }}
                            className="flex-1 px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none" placeholder="Type a message..." />
                          <button onClick={sendMsg} disabled={!msgDraft.trim()} className="px-4 py-2.5 gradient-premium text-white rounded-xl text-sm font-semibold btn-press disabled:opacity-50">Send</button>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-theme-muted text-sm"><p>Select a conversation</p></div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {tab === "messages" && !currentUser && (
              <div className="glass-card rounded-2xl p-12 text-center"><p className="text-theme-muted">Select your name to use messages</p></div>
            )}
          </div>
        </main>

        {/* MODALS */}
        {editing && (
          <EditModal
            entry={editing}
            members={mems.filter((m) => m.active)}
            topics={tops}
            onSave={saveAssignment}
            onSwap={swapMembers}
            onTeamReading={teamReading}
            onRestore={restoreDay}
            onClose={() => setEditing(null)}
          />
        )}
        {noTalkModal && (
          <NoTalkModal
            entry={noTalkModal}
            onSave={markNoTalk}
            onClose={() => setNoTalkModal(null)}
          />
        )}
        {pauseModal && (
          <PauseRosterModal
            onSave={pauseRange}
            onClose={() => setPauseModal(false)}
          />
        )}
        {pinModal && (
          <PinModal
            modal={pinModal}
            memberName={mems.find((m) => m.id === pinModal.memberId)?.name || ""}
            onLogin={confirmLogin}
            onClose={() => setPinModal(null)}
            onDone={async () => { setPinModal(null); await fetchMems(); toast("PIN updated ✓"); }}
          />
        )}
        {editingMember && (
          <EditMemberModal
            member={editingMember}
            onSave={updateMember}
            onClose={() => setEditingMember(null)}
          />
        )}

        {/* FOOTER */}
        <footer className="relative z-10 bg-gradient-to-b from-[#0a0f1a] to-[#1D2130] text-slate-400 text-center py-10 text-xs mt-12 border-t border-[#1A4687]/30 overflow-hidden">
          {/* Noise */}
          <div className="absolute inset-0 noise opacity-50" />
          <div className="relative z-10">
            <div className="flex items-center justify-center mb-3">
              <SASLogo size="sm" />
            </div>
            <p className="font-bold text-white text-sm tracking-wide">Sandock Austral Shipyards</p>
            <p className="mt-1.5 text-slate-500">SHERQ Department © 2026</p>
            <a
              href={TEAMS_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-4 text-[#6EC1E4] hover:text-white transition text-xs font-medium bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/10"
            >
              📹 Join SHERQ Talk on Teams
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD VIEW
   ═══════════════════════════════════════════════════════════════ */
function DashboardView({
  stats,
  roster,
  mems,
  anns,
  addAnnOpen,
  setAddAnnOpen,
  addAnnouncement,
  deleteAnn,
  getUpcomingBirthdays,
  generate,
  busy,
  mo,
  currentUser,
  myUpcoming,
  setEditing,
  teamsCalUrl,
  weather,
  setTab,
  isAdmin,
}: {
  stats: Stats | null;
  roster: RosterEntry[];
  mems: Member[];
  anns: Announcement[];
  addAnnOpen: boolean;
  setAddAnnOpen: (v: boolean) => void;
  addAnnouncement: (e: React.FormEvent<HTMLFormElement>) => void;
  deleteAnn: (id: number) => void;
  getUpcomingBirthdays: () => (Member & { daysUntil: number; month: number; day: number })[];
  generate: (m?: number) => void;
  busy: boolean;
  mo: number;
  currentUser: Member | null;
  myUpcoming: RosterEntry[];
  setEditing: (e: RosterEntry) => void;
  teamsCalUrl: (e: RosterEntry) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  weather: any;
  setTab: (t: Tab) => void;
  isAdmin: boolean;
}) {
  const upcomingBirthdays = getUpcomingBirthdays();

  // Live clock
  const [now, setNow] = useState(new Date());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);

  // South Africa time helpers
  const saParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const getPart = (type: string) => saParts.find((p) => p.type === type)?.value || "00";
  const saDate = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
  const saHour = Number(getPart("hour"));
  const saMinute = Number(getPart("minute"));

  // After 07:00, show the following scheduled talk, not today's
  const nextBaseDate = (() => {
    if (saHour > 7 || (saHour === 7 && saMinute >= 0)) {
      const d = new Date(`${saDate}T00:00:00`);
      d.setDate(d.getDate() + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    return saDate;
  })();

  const today = saDate;
  const todayDate = new Date(`${saDate}T12:00:00`);
  const nextTalk = roster.find((r) => r.status === "scheduled" && r.date >= nextBaseDate);

  // This week's roster (Mon-Fri of current week)
  const weekStart = new Date(todayDate);
  weekStart.setDate(todayDate.getDate() - ((todayDate.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 4);
  const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
  const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, "0")}-${String(weekEnd.getDate()).padStart(2, "0")}`;
  const thisWeek = roster.filter((r) => r.date >= weekStartStr && r.date <= weekEndStr);

  // Filter past announcements
  const activeAnns = anns.filter((a) => !a.eventDate || a.eventDate >= today);

  return (
    <div className="space-y-6">
      {/* Date & Time */}
      <div className="flex items-center justify-between anim-fade-down">
        <div>
          <h2 className="text-2xl font-black text-theme-primary">
            {now.toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </h2>
          <p className="text-theme-muted text-sm">{now.toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hour12: false })} • Durban, South Africa</p>
        </div>
      </div>

      {/* Next SHERQ Talk — TOP PRIORITY */}
      {nextTalk && (
        <div className="glass-card rounded-2xl shadow-theme-lg overflow-hidden anim-fade-up">
          <div className="bg-gradient-to-r from-[#1A4687] to-[#225CB2] px-5 py-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">📣 Next SHERQ Talk</h3>
          </div>
          <div className="p-5 flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#1A4687] to-[#225CB2] flex flex-col items-center justify-center text-white shadow-lg shrink-0">
              <span className="text-[9px] uppercase font-medium opacity-70">{new Date(nextTalk.date + "T00:00:00").toLocaleDateString("en", { month: "short" })}</span>
              <span className="text-2xl font-black leading-none">{new Date(nextTalk.date + "T00:00:00").getDate()}</span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-theme-primary text-lg">{nextTalk.memberName || "Unassigned"}</p>
              <p className="text-sm text-theme-secondary">{nextTalk.topic || "Topic TBC"}</p>
              <p className="text-xs text-theme-muted mt-1">{new Date(nextTalk.date + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })} • 07:00–07:30</p>
            </div>
            <a href={TEAMS_LINK} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 bg-[#5B5FC7] hover:bg-[#4B4FB7] text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0">📹 Join</a>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Crew", value: stats?.totalMembers ?? 0, icon: "👥", gradient: "from-slate-600 to-slate-800" },
          { label: "Roster Days", value: stats?.totalAssignments ?? 0, icon: "📋", gradient: "from-[#1A4687] to-[#0a1628]", sub: stats?.notIncluded ? `${stats.notIncluded} not included` : undefined },
          { label: "Completed", value: stats?.completedTalks ?? 0, icon: "✅", gradient: "from-emerald-600 to-emerald-900", sub: stats?.legitimateNoTalk ? `+${stats.legitimateNoTalk} valid skip${stats.legitimateNoTalk !== 1 ? "s" : ""}` : undefined },
          { label: "Upcoming", value: stats?.scheduledTalks ?? 0, icon: "📅", gradient: "from-amber-500 to-amber-800" },
        ].map((card, i) => (
          <div
            key={card.label}
            className="stat-card hover-lift anim-fade-up text-white shimmer-overlay"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className={`bg-gradient-to-br ${card.gradient} p-6 relative`}>
              <p className="text-[10px] text-white/50 uppercase tracking-[0.15em] font-semibold">{card.label}</p>
              <p className="text-4xl font-black mt-2 anim-count drop-shadow-lg">{card.value}</p>
              {"sub" in card && card.sub && <p className="text-[10px] text-white/40 mt-1">{card.sub}</p>}
              <span className="absolute top-4 right-4 text-3xl opacity-20">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* My Upcoming Talks - only shows when user is selected */}
      {currentUser && (
        <div className="glass-card rounded-2xl shadow-theme overflow-hidden anim-fade-up">
          <div className="px-5 py-4 border-b border-theme bg-gradient-to-r from-[#1A4687]/5 dark:from-[#6EC1E4]/5 to-transparent">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-theme-primary flex items-center gap-2">
                <span className="text-lg">🎯</span> My Upcoming Talks
                <span className="text-xs font-normal text-theme-muted">— {currentUser.name}</span>
              </h3>
              <span className="text-xs bg-[#1A4687] dark:bg-[#6EC1E4] text-white dark:text-[#1D2130] px-2 py-0.5 rounded-full font-semibold">
                {myUpcoming.length} upcoming
              </span>
            </div>
          </div>
          {myUpcoming.length === 0 ? (
            <div className="p-6 text-center text-theme-muted text-sm">
              No upcoming talks assigned to you this month.
            </div>
          ) : (
            <div className="divide-y divide-theme">
              {myUpcoming.slice(0, 5).map((entry) => {
                const d = new Date(entry.date + "T00:00:00");
                return (
                  <div key={entry.id || entry.date} className="flex items-center gap-4 px-5 py-3 hover:bg-theme-hover transition group">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1A4687] to-[#225CB2] flex flex-col items-center justify-center text-white shadow-sm shrink-0">
                      <span className="text-[9px] uppercase font-medium opacity-70">{d.toLocaleDateString("en", { month: "short" })}</span>
                      <span className="text-lg font-black leading-none">{d.getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-theme-primary">
                        {d.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}
                      </p>
                      <p className="text-xs text-theme-secondary truncate">
                        {entry.topic || "No topic yet — click to set yours"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditing(entry)}
                        className="text-xs px-2.5 py-1.5 bg-[#1A4687] dark:bg-[#6EC1E4] text-white dark:text-[#1D2130] rounded-lg font-medium hover:opacity-90 transition"
                      >
                        {entry.topic ? "✏️ Edit" : "📝 Set Topic"}
                      </button>
                      <a
                        href={teamsCalUrl(entry)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1.5 bg-[#5B5FC7] text-white rounded-lg font-medium hover:opacity-90 transition"
                        title="Add to Teams calendar"
                      >
                        📅
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!currentUser && (
        <div className="glass-card rounded-2xl p-5 shadow-theme anim-fade-up border-dashed">
          <div className="flex items-center gap-3 text-theme-secondary">
            <span className="text-2xl">👤</span>
            <div>
              <p className="font-medium text-theme-primary">Select your name</p>
              <p className="text-xs text-theme-muted">Choose &ldquo;Who are you?&rdquo; in the top-right to see your upcoming talks and quickly set your topics.</p>
            </div>
          </div>
        </div>
      )}

      {/* Setup prompt if no start date */}
      {!stats?.startDate && stats?.totalAssignments === 0 && (
        <div className="glass-card rounded-2xl p-6 shadow-theme-lg anim-scale border-2 border-[#6EC1E4]/30 anim-glow">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl gradient-premium flex items-center justify-center text-white text-xl shrink-0 shadow-lg">📌</div>
            <div className="flex-1">
              <h3 className="font-bold text-theme-primary text-lg">Set Your Roster Start Date</h3>
              <p className="text-sm text-theme-secondary mt-1">Since you&#39;re starting mid-year, go to the <strong>Calendar</strong> tab, click <strong>&ldquo;📌 Set Start&rdquo;</strong>, then click the day you want the roster to begin. Everything before it will be marked as &ldquo;Not Included&rdquo; and won&#39;t count in your stats.</p>
              <button onClick={() => setTab("calendar")} className="mt-3 px-4 py-2 gradient-premium text-white rounded-xl text-sm font-medium btn-press shadow-lg">
                📅 Go to Calendar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Next Up */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick Actions — admin only for generate */}
          <div className="glass-card rounded-2xl p-5 shadow-theme anim-fade-up delay-1">
            <h3 className="font-bold text-theme-primary mb-3 flex items-center gap-2">
              <span className="text-lg">⚡</span> Quick Actions
            </h3>
            <div className="flex flex-wrap gap-3">
              {isAdmin && (
                <>
                  <button onClick={() => generate(mo)} disabled={busy} className="px-4 py-2.5 gradient-premium text-white btn-press rounded-xl text-sm font-medium transition-all shadow-lg disabled:opacity-50 flex items-center gap-2">
                    {busy && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full anim-spin" />}
                    Generate {MONTHS[mo - 1]}
                  </button>
                  <button onClick={() => generate()} disabled={busy} className="px-4 py-2.5 bg-theme-tertiary hover:bg-theme-hover text-theme-secondary border border-theme rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                    Full Year
                  </button>
                </>
              )}
              <a href={TEAMS_LINK} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 bg-[#5B5FC7] hover:bg-[#4B4FB7] text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2">📹 Join Meeting</a>
            </div>
          </div>

          {/* This Week's Roster */}
          {thisWeek.length > 0 && (
            <div className="glass-card rounded-2xl shadow-theme-lg overflow-hidden anim-fade-up delay-2">
              <div className="px-5 py-3 border-b border-theme bg-gradient-to-r from-[#1A4687]/5 dark:from-[#6EC1E4]/5 to-transparent">
                <h3 className="font-bold text-theme-primary text-sm flex items-center gap-2">📅 This Week</h3>
              </div>
              <div className="divide-y divide-theme">
                {thisWeek.map((r) => {
                  const rd = new Date(r.date + "T00:00:00");
                  const isToday = r.date === today;
                  const isNT = r.status === "no-talk";
                  return (
                    <div key={r.date} className={`flex items-center gap-3 px-5 py-2.5 ${isToday ? "bg-[#6EC1E4]/10" : ""}`}>
                      <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center text-xs shrink-0 ${isToday ? "bg-[#6EC1E4] text-[#1D2130] font-black" : "bg-theme-tertiary/50 text-theme-secondary"}`}>
                        <span className="text-[8px] uppercase">{rd.toLocaleDateString("en", { weekday: "short" })}</span>
                        <span className="text-sm font-bold leading-none">{rd.getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isNT ? "text-amber-500" : "text-theme-primary"}`}>
                          {isNT ? (r.noTalkPresenter || r.noTalkReason === "holiday" ? "🏖️ Holiday" : "🚫 No Talk") : (r.memberName || "Unassigned")}
                        </p>
                        <p className="text-[11px] text-theme-muted truncate">{isNT ? (r.noTalkTopic || "") : (r.topic || "")}</p>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[r.status]?.bg || ""}`}>
                        {STATUS_STYLES[r.status]?.label || r.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Announcements */}
          <div className="glass-card rounded-2xl p-5 shadow-theme anim-fade-up delay-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-theme-primary flex items-center gap-2">
                <span className="text-lg">📢</span> Announcements
              </h3>
              <button
                onClick={() => setAddAnnOpen(!addAnnOpen)}
                className="text-xs px-3 py-1.5 bg-theme-tertiary hover:bg-theme-hover text-theme-secondary rounded-lg transition"
              >
                {addAnnOpen ? "✕ Cancel" : "+ Add"}
              </button>
            </div>

            {addAnnOpen && (
              <form onSubmit={addAnnouncement} className="mb-4 p-4 bg-theme-secondary rounded-xl border border-theme anim-scale">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <select name="type" required className="px-3 py-2 bg-theme-card border border-theme rounded-lg text-sm text-theme-primary">
                    <option value="event">📅 Event</option>
                    <option value="general">📋 General</option>
                  </select>
                  <input name="eventDate" type="date" className="px-3 py-2 bg-theme-card border border-theme rounded-lg text-sm text-theme-primary" />
                </div>
                <input name="title" required placeholder="Title" className="w-full px-3 py-2 bg-theme-card border border-theme rounded-lg text-sm text-theme-primary mb-2" />
                <textarea name="description" placeholder="Description (optional)" rows={2} className="w-full px-3 py-2 bg-theme-card border border-theme rounded-lg text-sm text-theme-primary resize-none mb-2" />
                <input name="addedBy" placeholder="Your name" className="w-full px-3 py-2 bg-theme-card border border-theme rounded-lg text-sm text-theme-primary mb-3" />
                <button type="submit" className="w-full py-2 bg-[#1A4687] hover:bg-[#225CB2] text-white rounded-lg text-sm font-medium transition">Add Announcement</button>
              </form>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activeAnns.length === 0 ? (
                <p className="text-theme-muted text-sm text-center py-4">No announcements</p>
              ) : (
                activeAnns.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 p-3 bg-theme-secondary rounded-xl group">
                    <span className="text-lg">{a.type === "birthday" ? "🎂" : a.type === "event" ? "📅" : "📋"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-theme-primary text-sm">{a.title}</p>
                      {a.description && <p className="text-xs text-theme-muted">{a.description}</p>}
                      {a.eventDate && (
                        <p className="text-xs text-theme-secondary mt-1">
                          📅 {new Date(a.eventDate + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteAnn(a.id)}
                      className="text-theme-muted hover:text-rose-500 text-xs opacity-0 group-hover:opacity-100 transition"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Durban Weather */}
          {weather?.current && (
            <div className="glass-card rounded-2xl p-5 shadow-theme-lg anim-fade-up delay-1 overflow-hidden relative">
              <div className="absolute -top-8 -right-8 text-[80px] opacity-[0.07] pointer-events-none">{weatherInfo(weather.current.weather_code).icon}</div>
              <h3 className="font-bold text-theme-primary mb-3 flex items-center gap-2">
                <span className="text-lg">🌤️</span> Durban Weather
              </h3>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">{weatherInfo(weather.current.weather_code).icon}</span>
                <div>
                  <p className="text-3xl font-black text-theme-primary">{Math.round(weather.current.temperature_2m)}°C</p>
                  <p className="text-xs text-theme-secondary">{weatherInfo(weather.current.weather_code).desc}</p>
                </div>
              </div>
              <div className="flex gap-4 text-[11px] text-theme-muted">
                <span>💨 {Math.round(weather.current.wind_speed_10m)} km/h</span>
                <span>💧 {weather.current.relative_humidity_2m}%</span>
              </div>
              {weather.daily && (
                <div className="mt-3 pt-3 border-t border-theme flex gap-1">
                  {weather.daily.time.slice(0, 5).map((date: string, i: number) => {
                    const d = new Date(date + "T00:00:00");
                    return (
                      <div key={date} className="flex-1 text-center">
                        <p className="text-[9px] text-theme-muted font-medium">{i === 0 ? "Today" : d.toLocaleDateString("en", { weekday: "short" })}</p>
                        <p className="text-sm my-0.5">{weatherInfo(weather.daily.weather_code[i]).icon}</p>
                        <p className="text-[10px] text-theme-secondary font-semibold">{Math.round(weather.daily.temperature_2m_max[i])}°</p>
                        <p className="text-[9px] text-theme-muted">{Math.round(weather.daily.temperature_2m_min[i])}°</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Upcoming SA Holidays */}
          <div className="glass-card rounded-2xl p-5 shadow-theme-lg anim-fade-up delay-2">
            <h3 className="font-bold text-theme-primary mb-3 flex items-center gap-2">
              <span className="text-lg">🇿🇦</span> Upcoming Holidays
            </h3>
            <div className="space-y-2">
              {SA_HOLIDAYS
                .filter((h) => h.date >= today)
                .slice(0, 4)
                .map((h) => {
                  const d = new Date(h.date + "T00:00:00");
                  const diff = Math.ceil((d.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={h.date} className="flex items-center gap-3 p-2 bg-theme-secondary/50 rounded-xl">
                      <div className="w-9 h-9 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[8px] text-rose-500 font-bold uppercase">{d.toLocaleDateString("en", { month: "short" })}</span>
                        <span className="text-sm font-black text-rose-600 dark:text-rose-400 leading-none">{d.getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-theme-primary truncate">{h.name}</p>
                        <p className="text-[10px] text-theme-muted">{diff === 0 ? "Today!" : diff === 1 ? "Tomorrow" : `In ${diff} days`}</p>
                      </div>
                    </div>
                  );
                })}
              {SA_HOLIDAYS.filter((h) => h.date >= today).length === 0 && (
                <p className="text-theme-muted text-sm text-center py-2">No more holidays this year</p>
              )}
            </div>
          </div>

          {/* Birthdays */}
          <div className="glass-card rounded-2xl p-5 shadow-theme-lg anim-fade-up delay-3">
            <h3 className="font-bold text-theme-primary mb-4 flex items-center gap-2">
              <span className="text-lg">🎂</span> Upcoming Birthdays
            </h3>
            <div className="space-y-2">
              {upcomingBirthdays.length === 0 ? (
                <p className="text-theme-muted text-sm text-center py-4">No upcoming birthdays</p>
              ) : (
                upcomingBirthdays.slice(0, 5).map((m, i) => (
                  <div key={m.id} className="flex items-center gap-3 p-2 bg-theme-secondary rounded-xl">
                    <div className={`w-9 h-9 rounded-full ${getMemberColor(i)} text-white flex items-center justify-center font-bold text-xs`}>
                      {initials(m.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-theme-primary text-sm truncate">{m.name}</p>
                      <p className="text-xs text-theme-muted">
                        {m.daysUntil === 0 ? "🎉 Today!" : m.daysUntil === 1 ? "Tomorrow" : `In ${m.daysUntil} days`}
                      </p>
                    </div>
                    <span className="text-xs text-theme-muted">{m.day} {MONTHS[m.month - 1]?.slice(0, 3)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Annual Progress */}
          {stats && stats.totalAssignments > 0 && (
            <div className="glass-card rounded-2xl p-5 shadow-theme anim-fade-up delay-3">
              <h3 className="font-bold text-theme-primary mb-4 flex items-center gap-2">
                <span className="text-lg">📈</span> Annual Progress
              </h3>
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-black text-[#1A4687] dark:text-[#6EC1E4]">
                    {Math.round((stats.completedTalks / stats.totalAssignments) * 100)}%
                  </span>
                  <span className="text-xs text-theme-muted">
                    {stats.completedTalks}/{stats.totalAssignments}
                  </span>
                </div>
                <div className="h-3 bg-theme-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#1A4687] to-[#6EC1E4] rounded-full transition-all duration-1000"
                    style={{ width: `${(stats.completedTalks / stats.totalAssignments) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* removed Top Presenters to keep things fair */}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CALENDAR VIEW
   ═══════════════════════════════════════════════════════════════ */
function CalendarView({
  roster, mems, mo, setMo, yr, setYr, generate, setEditing, setNoTalkModal,
  busy, teamsCalUrl, resetMonth, resetYear, rosterStartDate, setStartDate, setPauseModal, isAdmin,
}: {
  roster: RosterEntry[];
  mems: Member[];
  mo: number;
  setMo: (m: number) => void;
  yr: number;
  setYr: (y: number) => void;
  generate: (m?: number) => void;
  setEditing: (e: RosterEntry) => void;
  setNoTalkModal: (e: RosterEntry) => void;
  busy: boolean;
  teamsCalUrl: (e: RosterEntry) => string;
  resetMonth: (m: number) => void;
  resetYear: () => void;
  rosterStartDate: string;
  setStartDate: (d: string) => void;
  setPauseModal: (v: boolean) => void;
  isAdmin: boolean;
}) {
  const fd = new Date(yr, mo - 1, 1).getDay();
  const dim = new Date(yr, mo, 0).getDate();
  const today = new Date().toISOString().split("T")[0];
  const [settingStart, setSettingStart] = useState(false);
  const rm = new Map(roster.map((r) => [r.date, r]));
  const cells: (number | null)[] = [];
  for (let i = 0; i < fd; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);

  const memberIndexMap = new Map<number, number>();
  mems.filter((m) => m.active).forEach((m, i) => memberIndexMap.set(m.id, i));

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 anim-fade-down">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { if (mo <= 1) { setYr(yr - 1); setMo(12); } else setMo(mo - 1); }}
            className="p-2.5 rounded-xl bg-theme-card border border-theme hover:bg-theme-hover text-theme-secondary transition-all shadow-theme"
          >
            ◀
          </button>
          <select
            value={mo}
            onChange={(e) => setMo(+e.target.value)}
            className="px-4 py-2.5 border border-theme rounded-xl bg-theme-card font-bold text-theme-primary text-lg shadow-theme input-premium outline-none"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={yr}
            onChange={(e) => setYr(+e.target.value)}
            className="px-3 py-2.5 border border-theme rounded-xl bg-theme-card font-bold text-theme-primary shadow-theme input-premium outline-none"
          >
            {[2025, 2026, 2027, 2028].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => { if (mo >= 12) { setYr(yr + 1); setMo(1); } else setMo(mo + 1); }}
            className="p-2.5 rounded-xl bg-theme-card border border-theme hover:bg-theme-hover text-theme-secondary transition-all shadow-theme"
          >
            ▶
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button
              onClick={() => generate(mo)}
              disabled={busy}
              className="px-4 py-2.5 gradient-premium text-white btn-press rounded-xl text-xs font-medium transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
            >
              {busy && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full anim-spin" />}
              Generate
            </button>
          )}
          {isAdmin && (
            <>
              <button
                onClick={() => setSettingStart(!settingStart)}
                className={`px-4 py-2.5 rounded-xl text-xs font-medium transition-all shadow-theme ${settingStart ? "bg-[#6EC1E4] text-[#1D2130]" : "bg-theme-card border border-theme text-theme-secondary hover:bg-theme-hover"}`}
              >
                📌 {settingStart ? "Click a date…" : "Set Start"}
              </button>
              <button
                onClick={() => setPauseModal(true)}
                className="px-4 py-2.5 bg-theme-card border border-theme text-theme-secondary hover:bg-theme-hover rounded-xl text-xs font-medium transition-all shadow-theme"
              >
                ⏸️ Pause
              </button>
            </>
          )}
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-theme-card border border-theme text-theme-secondary hover:bg-theme-hover rounded-xl text-xs font-medium transition-all shadow-theme"
          >
            🖨️
          </button>
          {isAdmin && roster.length > 0 && (
            <button
              onClick={() => resetMonth(mo)}
              disabled={busy}
              className="px-4 py-2.5 bg-rose-500/10 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
            >
              🗑️ Month
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => resetYear()}
              disabled={busy}
              className="px-4 py-2.5 bg-rose-500/10 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
            >
              🗑️ Year
            </button>
          )}
        </div>
      </div>

      {/* Roster start info */}
      {rosterStartDate && (
        <div className="mb-3 flex items-center gap-2 text-xs text-theme-secondary">
          <span className="bg-[#6EC1E4]/10 text-[#1A4687] dark:text-[#6EC1E4] px-3 py-1.5 rounded-lg font-medium border border-[#6EC1E4]/20">
            📌 Roster starts: {new Date(rosterStartDate + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}
          </span>
          <button onClick={() => { setStartDate("2026-01-13"); }} className="text-theme-muted hover:text-rose-500 text-[10px] underline">Clear</button>
        </div>
      )}

      {settingStart && (
        <div className="mb-3 p-3 glass-card rounded-xl anim-scale flex items-center gap-3 border-2 border-[#6EC1E4]/50 anim-glow">
          <span className="text-lg">📌</span>
          <p className="text-sm text-theme-primary font-medium flex-1">Click any weekday on the calendar below to set it as the <strong>roster start date</strong>. Everything before it will be marked as no-talk.</p>
          <button onClick={() => setSettingStart(false)} className="text-xs text-theme-muted hover:text-theme-primary px-2 py-1 rounded-lg hover:bg-theme-hover">Cancel</button>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-1.5 mb-4 no-print text-[10px]">
        {mems.filter((m) => m.active && m.role !== "HOD").map((m, i) => (
          <span key={m.id} className={`px-2 py-1 rounded-lg border font-medium ${getMemberBadgeColor(i)}`}>
            {m.name}
          </span>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="glass-card rounded-2xl shadow-theme-xl overflow-hidden anim-scale">
        <div className="grid grid-cols-7 bg-gradient-to-r from-[#1D2130] to-[#1A4687] text-white">
          {DAY_NAMES.map((d) => (
            <div key={d} className="px-1 py-3 text-center text-xs font-semibold tracking-wide">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (day === null) return <div key={`e${idx}`} className="min-h-24 bg-theme-tertiary/30 border-b border-r border-theme" />;

            const ds = `2026-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dow = new Date(yr, mo - 1, day).getDay();
            const wk = dow === 0 || dow === 6;
            const td = ds === today;
            const isPast = ds < today;
            const en = rm.get(ds);
            const isNoTalk = en?.status === "no-talk";
            const isNotIncluded = en?.status === "not-included";
            const memberIdx = en?.memberId ? memberIndexMap.get(en.memberId) ?? 0 : 0;
            const holiday = SA_HOLIDAY_MAP.get(ds);

            return (
              <div
                key={day}
                className={`min-h-24 border-b border-r border-theme p-1.5 transition-all relative group ${
                  wk ? "bg-theme-tertiary/50 text-theme-muted" :
                  isNotIncluded ? "bg-theme-tertiary/20 text-theme-muted/40" :
                  td ? "bg-[#6EC1E4]/10 ring-2 ring-[#6EC1E4] ring-inset cursor-pointer" :
                  isPast && !en ? "bg-theme-tertiary/30 text-theme-muted/60" :
                  isPast ? "bg-theme-tertiary/20 cursor-pointer" :
                  isNoTalk ? "bg-amber-50/50 dark:bg-amber-950/20 cursor-pointer" :
                  holiday ? "bg-rose-50/50 dark:bg-rose-950/20 cursor-pointer" :
                  "bg-theme-card hover:bg-theme-hover cal-cell cursor-pointer"
                }`}
                onClick={() => {
                  if (wk) return;
                  if (isNotIncluded) return;
                  if (settingStart) {
                    setStartDate(ds);
                    setSettingStart(false);
                    return;
                  }
                  if (isPast && !en) return;
                  if (en) setEditing(en);
                  else setEditing({
                    id: 0, date: ds, memberId: null, topic: null, status: "scheduled",
                    notes: null, memberName: null, memberRole: null, noTalkReason: null,
                    noTalkPresenter: null, noTalkTopic: null,
                  });
                }}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold ${
                    td ? "bg-[#6EC1E4] text-[#1D2130] rounded-full w-6 h-6 flex items-center justify-center shadow-sm" :
                    wk ? "" : "text-theme-secondary"
                  }`}>
                    {day}
                  </span>
                  {en && !wk && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${STATUS_STYLES[en.status]?.bg || ""}`}>
                      {STATUS_STYLES[en.status]?.label?.charAt(0) || ""}
                    </span>
                  )}
                </div>

                {isNotIncluded && !wk && (
                  <div className="mt-2 text-center">
                    <span className="text-[8px] text-theme-muted/50 italic">not included</span>
                  </div>
                )}

                {isNoTalk && !wk && (
                  <div className="mt-1">
                    <div className="text-[10px] font-semibold px-1.5 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 truncate">
                      {en?.noTalkReason === "holiday" ? "🏖️ Holiday" : en?.noTalkPresenter || "🚫 No Talk"}
                    </div>
                  </div>
                )}

                {en && !wk && !isNoTalk && (
                  <div className="mt-1">
                    <div className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-lg truncate border ${getMemberBadgeColor(memberIdx)}`}>
                      {en.memberName || "Unassigned"}
                    </div>
                    {en.topic && <div className="text-[9px] text-theme-muted mt-0.5 truncate px-0.5">{en.topic}</div>}
                  </div>
                )}

                {/* Holiday label */}
                {holiday && !en && !wk && (
                  <div className="mt-1">
                    <div className="text-[9px] font-semibold px-1 py-0.5 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 truncate">🇿🇦 {holiday}</div>
                  </div>
                )}

                {!en && !wk && !holiday && !isPast && (
                  <div className="mt-4 text-[9px] text-theme-muted text-center opacity-0 group-hover:opacity-100 transition-opacity">+ Assign</div>
                )}

                {/* Context buttons */}
                {en && !wk && !isNoTalk && en.status === "scheduled" && (
                  <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 no-print">
                    <button
                      onClick={(e) => { e.stopPropagation(); setNoTalkModal(en); }}
                      className="bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded hover:bg-amber-600 transition"
                      title="No Talk"
                    >
                      🚫
                    </button>
                    <a
                      href={teamsCalUrl(en)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="bg-[#5B5FC7] text-white text-[9px] px-1.5 py-0.5 rounded hover:bg-[#4B4FB7] transition"
                      title="Add to Calendar"
                    >
                      📅
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-theme-muted no-print">
        {Object.entries(STATUS_STYLES).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${v.dot}`} />
            {v.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROSTER LIST VIEW
   ═══════════════════════════════════════════════════════════════ */
function RosterListView({
  roster,
  mo,
  setMo,
  setEditing,
  setNoTalkModal,
  teamsCalUrl,
}: {
  roster: RosterEntry[];
  mo: number;
  setMo: (m: number) => void;
  setEditing: (e: RosterEntry) => void;
  setNoTalkModal: (e: RosterEntry) => void;
  teamsCalUrl: (e: RosterEntry) => string;
}) {
  const weeks: Record<string, RosterEntry[]> = {};
  roster.forEach((e) => {
    const d = new Date(e.date + "T00:00:00");
    const ws = new Date(d);
    ws.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const k = ws.toISOString().split("T")[0];
    if (!weeks[k]) weeks[k] = [];
    weeks[k].push(e);
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 anim-fade-down">
        <select
          value={mo}
          onChange={(e) => setMo(+e.target.value)}
          className="px-4 py-2.5 border border-theme rounded-xl bg-theme-card font-bold text-theme-primary shadow-theme input-premium outline-none"
        >
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m} 2026</option>
          ))}
        </select>
        <span className="bg-[#1A4687]/10 dark:bg-[#6EC1E4]/10 px-3 py-1.5 rounded-full text-xs text-[#1A4687] dark:text-[#6EC1E4] font-medium">
          {roster.length} talks
        </span>
      </div>

      {roster.length === 0 ? (
        <div className="bg-theme-card rounded-2xl border border-theme p-16 text-center anim-scale shadow-theme">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-theme-muted text-lg">No roster for {MONTHS[mo - 1]}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(weeks).map(([wk, entries], wi) => {
            const wd = new Date(wk + "T00:00:00");
            const we = new Date(wd);
            we.setDate(wd.getDate() + 4);
            return (
              <div
                key={wk}
                className="glass-card rounded-2xl shadow-theme-lg overflow-hidden hover-lift anim-fade-up"
                style={{ animationDelay: `${wi * 0.05}s` }}
              >
                <div className="bg-gradient-to-r from-[#1A4687]/5 dark:from-[#6EC1E4]/5 to-transparent px-4 py-3 border-b border-theme flex items-center gap-2">
                  <span className="bg-[#1A4687] dark:bg-[#6EC1E4] text-white dark:text-[#1D2130] text-[10px] font-bold px-2 py-0.5 rounded-full">
                    W{wi + 1}
                  </span>
                  <h3 className="font-semibold text-theme-primary text-sm">
                    {wd.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} – {we.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-[10px] text-theme-muted border-b border-theme bg-theme-secondary/50 uppercase tracking-wider">
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Day</th>
                        <th className="px-4 py-2 text-left">Presenter</th>
                        <th className="px-4 py-2 text-left">Topic</th>
                        <th className="px-4 py-2 text-center">Status</th>
                        <th className="px-4 py-2 text-center no-print">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((en, i) => {
                        const d = new Date(en.date + "T00:00:00");
                        const isNT = en.status === "no-talk";
                        return (
                          <tr
                            key={en.id || en.date}
                            className={`border-b border-theme last:border-b-0 hover:bg-theme-hover transition ${isNT ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}`}
                          >
                            <td className="px-4 py-2.5 text-sm font-medium text-theme-primary">
                              {d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short" })}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-theme-secondary">{DAY_NAMES[d.getDay()]}</td>
                            <td className="px-4 py-2.5">
                              {isNT ? (
                                <span className="text-amber-600 dark:text-amber-400 text-sm font-medium">
                                  {en.noTalkReason === "holiday" ? "🏖️ Holiday" : en.noTalkPresenter || "🚫 No Talk"}
                                </span>
                              ) : en.memberName ? (
                                <div className="flex items-center gap-2">
                                  <span className={`w-7 h-7 rounded-full ${getMemberColor(i)} text-white text-[10px] font-bold flex items-center justify-center`}>
                                    {initials(en.memberName)}
                                  </span>
                                  <span className="text-sm font-medium text-theme-primary">{en.memberName}</span>
                                </div>
                              ) : (
                                <span className="text-theme-muted text-sm">Unassigned</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-theme-secondary max-w-48 truncate">
                              {isNT ? (en.noTalkTopic || "—") : (en.topic || "—")}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[en.status]?.bg || ""}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLES[en.status]?.dot || ""}`} />
                                {STATUS_STYLES[en.status]?.label || en.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center no-print">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setEditing(en)}
                                  className="text-[#1A4687] dark:text-[#6EC1E4] hover:bg-[#1A4687]/10 text-xs px-2 py-1 rounded-lg transition"
                                >
                                  ✏️
                                </button>
                                {!isNT && en.status === "scheduled" && (
                                  <>
                                    <button
                                      onClick={() => setNoTalkModal(en)}
                                      className="text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-xs px-2 py-1 rounded-lg transition"
                                    >
                                      🚫
                                    </button>
                                    <a
                                      href={teamsCalUrl(en)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[#5B5FC7] hover:bg-violet-50 dark:hover:bg-violet-950/50 text-xs px-2 py-1 rounded-lg transition"
                                    >
                                      📅
                                    </a>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MEMBERS VIEW (DRAG & DROP)
   ═══════════════════════════════════════════════════════════════ */
function MembersView({
  mems, addMem, setAddMem, addMember, toggleMem, deleteMem, onDragEnd, onEditMember, isAdmin, toggleAdmin, onResetPin, pinResetQueue,
}: {
  mems: Member[];
  addMem: boolean;
  setAddMem: (v: boolean) => void;
  addMember: (e: React.FormEvent<HTMLFormElement>) => void;
  toggleMem: (m: Member) => void;
  deleteMem: (id: number) => void;
  onDragEnd: (r: DropResult) => void;
  onEditMember: (m: Member) => void;
  isAdmin: boolean;
  toggleAdmin: (m: Member) => void;
  onResetPin: (m: Member) => void;
  pinResetQueue: Member[];
}) {
  return (
    <div>
      {/* PIN Reset Requests */}
      {isAdmin && pinResetQueue.length > 0 && (
        <div className="mb-4 glass-card rounded-2xl p-4 shadow-theme-lg border-2 border-amber-400/30 anim-scale">
          <h4 className="font-bold text-amber-600 dark:text-amber-400 text-sm mb-2 flex items-center gap-2">
            🔑 PIN Reset Requests <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pinResetQueue.length}</span>
          </h4>
          <div className="space-y-2">
            {pinResetQueue.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-950/30 rounded-xl">
                <span className="text-sm font-medium text-theme-primary">{m.name} <span className="text-xs text-theme-muted">requested PIN reset</span></span>
                <button onClick={() => onResetPin(m)} className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition btn-press">
                  Reset PIN
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 anim-fade-down">
        <div>
          <h2 className="text-xl font-bold text-theme-primary flex items-center gap-2">
            ⚓ SHERQ Crew
            <span className="bg-[#1A4687] dark:bg-[#6EC1E4] text-white dark:text-[#1D2130] text-xs px-2 py-0.5 rounded-full">{mems.length}</span>
          </h2>
          <p className="text-xs text-theme-muted mt-0.5">{isAdmin ? "Drag to reorder • HOD stays as observer" : "View team members"}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setAddMem(!addMem)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-theme ${
              addMem ? "bg-theme-tertiary text-theme-secondary border border-theme" : "bg-gradient-to-r from-[#1A4687] to-[#225CB2] text-white"
            }`}
          >
            {addMem ? "✕ Cancel" : "+ Add Member"}
          </button>
        )}
      </div>

      {addMem && (
        <form onSubmit={addMember} className="glass-card rounded-2xl shadow-theme-lg-lg p-5 mb-5 anim-scale">
          <h3 className="font-bold text-theme-primary mb-4 text-sm">New Crew Member</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-theme-muted mb-1 uppercase tracking-wide">Name *</label>
              <input name="name" required className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none" placeholder="Full name" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-theme-muted mb-1 uppercase tracking-wide">Role</label>
              <select name="role" className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none">
                <option value="Presenter">Presenter</option>
                <option value="HOD">HOD</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-theme-muted mb-1 uppercase tracking-wide">Email</label>
              <input name="email" type="email" className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none" placeholder="email@sas.co.za" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-theme-muted mb-1 uppercase tracking-wide">🎂 Birthday</label>
              <div className="grid grid-cols-2 gap-1">
                <select name="bday_month" className="px-2 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none">
                  <option value="">Month</option>
                  {MONTHS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
                </select>
                <select name="bday_day" className="px-2 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none">
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={String(d).padStart(2, "0")}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-[#1A4687] to-[#225CB2] text-white rounded-xl text-sm font-medium transition-all shadow-lg hover:shadow-xl">
              ⚓ Add Member
            </button>
          </div>
        </form>
      )}

      <DragDropContext onDragEnd={(r) => { if (isAdmin) onDragEnd(r); }}>
        <Droppable droppableId="members" isDropDisabled={!isAdmin}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`space-y-2 transition-colors rounded-2xl p-2 -m-2 ${snapshot.isDraggingOver ? "bg-[#6EC1E4]/10" : ""}`}
            >
              {mems.map((m, i) => (
                <Draggable key={m.id} draggableId={String(m.id)} index={i} isDragDisabled={!isAdmin}>
                  {(provided2, snapshot2) => (
                    <div
                      ref={provided2.innerRef}
                      {...provided2.draggableProps}
                      className={`glass-card rounded-2xl overflow-hidden drag-item ${
                        snapshot2.isDragging ? "drag-item-dragging border-[#6EC1E4]" : "border-theme hover-lift"
                      } ${!m.active ? "opacity-50" : ""}`}
                      style={provided2.draggableProps.style}
                    >
                      <div className="flex items-center gap-3 p-3">
                        <div
                          {...provided2.dragHandleProps}
                          className={`transition p-1 -ml-1 ${isAdmin ? "drag-handle text-theme-muted hover:text-theme-secondary" : "text-theme-tertiary cursor-default"}`}
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                            <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                            <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
                          </svg>
                        </div>
                        <span className="bg-theme-tertiary text-theme-muted text-xs font-bold w-6 text-center rounded">{i + 1}</span>
                        <div className={`w-10 h-10 rounded-full ${getMemberColor(i)} text-white flex items-center justify-center font-bold text-sm shadow-sm`}>
                          {initials(m.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-theme-primary text-sm truncate">{m.name}</h3>
                            <span className="text-[10px] text-theme-muted px-1.5 py-0.5 bg-theme-tertiary rounded">
                              {m.role === "HOD" ? "👔 HOD" : "🦺 Presenter"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-theme-muted truncate">
                            {m.email && <span>✉ {m.email}</span>}
                            {m.birthday && (
                              <span className="flex items-center gap-1">
                                🎂 {(() => { const [month, day] = m.birthday!.split("-").map(Number); return `${day} ${MONTHS[month - 1]?.slice(0, 3)}`; })()}
                              </span>
                            )}
                            {!m.birthday && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onEditMember(m); }}
                                className="text-[10px] text-[#6EC1E4] hover:underline"
                              >
                                + Add birthday
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Badges — only functional, no role badges to avoid politics */}
                        <div className="flex gap-1 items-center">
                          {isAdmin && m.pinResetRequested && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 anim-pulse">
                              🔑 Reset
                            </span>
                          )}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            m.active ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400" : "bg-theme-tertiary text-theme-muted"
                          }`}>
                            {m.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => onEditMember(m)}
                            className="text-[10px] py-1.5 px-2.5 rounded-lg font-medium transition bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-900"
                            title="Edit member details & birthday"
                          >
                            ✏️
                          </button>
                          {isAdmin && (
                            <>
                              {m.email !== "PeterSM@sas.co.za" && (
                                <button
                                  onClick={() => toggleAdmin(m)}
                                  className={`text-[10px] py-1.5 px-2.5 rounded-lg font-medium transition ${
                                    m.isAdmin
                                      ? "bg-[#1A4687]/10 text-[#1A4687] dark:text-[#6EC1E4] hover:bg-[#1A4687]/20"
                                      : "bg-theme-tertiary text-theme-muted hover:bg-theme-hover"
                                  }`}
                                  title={m.isAdmin ? "Remove admin" : "Make admin"}
                                >
                                  🛡️
                                </button>
                              )}
                              <button
                                onClick={() => toggleMem(m)}
                                className={`text-[10px] py-1.5 px-2.5 rounded-lg font-medium transition ${
                                  m.active
                                    ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900"
                                    : "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900"
                                }`}
                              >
                                {m.active ? "Deactivate" : "Activate"}
                              </button>
                              {m.pin && (
                                <button
                                  onClick={() => onResetPin(m)}
                                  className="text-[10px] py-1.5 px-2.5 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-lg font-medium hover:bg-amber-200 dark:hover:bg-amber-900 transition"
                                  title="Reset PIN"
                                >
                                  🔑
                                </button>
                              )}
                              {m.email !== "PeterSM@sas.co.za" && (
                                <button
                                  onClick={() => deleteMem(m.id)}
                                  className="text-[10px] py-1.5 px-2.5 bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-lg font-medium hover:bg-rose-200 dark:hover:bg-rose-900 transition"
                                >
                                  ✕
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TOPICS VIEW
   ═══════════════════════════════════════════════════════════════ */
function TopicsView({
  tops,
  addTopicOpen,
  setAddTopicOpen,
  addTopic,
  deleteTopic,
}: {
  tops: Topic[];
  addTopicOpen: boolean;
  setAddTopicOpen: (v: boolean) => void;
  addTopic: (e: React.FormEvent<HTMLFormElement>) => void;
  deleteTopic: (id: number) => void;
}) {
  const cats = [...new Set(tops.map((t) => t.category))];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 anim-fade-down">
        <div>
          <h2 className="text-xl font-bold text-theme-primary">📚 SHERQ Topics Library</h2>
          <p className="text-xs text-theme-muted">{tops.length} topics • Anyone can add</p>
        </div>
        <button
          onClick={() => setAddTopicOpen(!addTopicOpen)}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-theme ${
            addTopicOpen ? "bg-theme-tertiary text-theme-secondary border border-theme" : "bg-gradient-to-r from-[#1A4687] to-[#225CB2] text-white"
          }`}
        >
          {addTopicOpen ? "✕ Cancel" : "+ Add Topic"}
        </button>
      </div>

      {addTopicOpen && (
        <form onSubmit={addTopic} className="glass-card rounded-2xl shadow-theme-lg-lg p-5 mb-5 anim-scale">
          <h3 className="font-bold text-theme-primary mb-4 text-sm">Add New Topic</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-theme-muted mb-1 uppercase">Category *</label>
              <select name="category" required className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none">
                <option value="Safety">🦺 Safety</option>
                <option value="Health">🏥 Health</option>
                <option value="Environment">🌊 Environment</option>
                <option value="Risk">⚠️ Risk</option>
                <option value="Quality">✅ Quality</option>
                <option value="General">📋 General</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-theme-muted mb-1 uppercase">Your Name</label>
              <input name="addedBy" className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none" placeholder="Who's adding?" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-medium text-theme-muted mb-1 uppercase">Topic Title *</label>
              <input name="title" required className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none" placeholder="e.g. Confined Space Entry" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-medium text-theme-muted mb-1 uppercase">Description</label>
              <textarea name="description" rows={2} className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none resize-none" placeholder="Brief description..." />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-[#1A4687] to-[#225CB2] text-white rounded-xl text-sm font-medium transition-all shadow-lg hover:shadow-xl">
              Add Topic
            </button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {cats.map((cat, ci) => {
          const catStyle = CAT_COLORS[cat] || CAT_COLORS.General;
          return (
            <div key={cat} className="anim-fade-up" style={{ animationDelay: `${ci * 0.05}s` }}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                  {catStyle.icon} {cat}
                </span>
                <span className="text-xs text-theme-muted">{tops.filter((t) => t.category === cat).length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tops
                  .filter((t) => t.category === cat)
                  .map((t) => (
                    <div key={t.id} className="glass-card rounded-2xl p-4 hover-glow group transition-all shadow-theme">
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-theme-primary text-sm flex-1">{t.title}</h4>
                        <button
                          onClick={() => deleteTopic(t.id)}
                          className="text-theme-muted hover:text-rose-500 text-xs opacity-0 group-hover:opacity-100 transition ml-2"
                        >
                          ✕
                        </button>
                      </div>
                      {t.description && <p className="text-[11px] text-theme-secondary mt-1.5">{t.description}</p>}
                      {t.addedBy && <p className="text-[10px] text-theme-muted mt-2">Added by {t.addedBy}</p>}
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EDIT MODAL
   ═══════════════════════════════════════════════════════════════ */
function EditModal({
  entry, members, topics, onSave, onSwap, onTeamReading, onRestore, onClose,
}: {
  entry: RosterEntry;
  members: Member[];
  topics: Topic[];
  onSave: (d: string, mId: number | null, t: string | null, s: string, n: string | null) => void;
  onSwap: (date: string, swapWithId: number) => void;
  onTeamReading: (date: string) => void;
  onRestore: (date: string) => void;
  onClose: () => void;
}) {
  const [mid, setMid] = useState<number | null>(entry.memberId);
  const [top, setTop] = useState(entry.topic || "");
  const [st, setSt] = useState(entry.status === "no-talk" ? "scheduled" : entry.status);
  const [notes, setNotes] = useState(entry.notes || "");
  const [showSwap, setShowSwap] = useState(false);

  const d = new Date(entry.date + "T00:00:00");
  const dl = d.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center p-4 anim-modal-bg" onClick={onClose}>
      <div className="glass-card rounded-3xl shadow-2xl w-full max-w-lg border border-theme anim-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#1D2130] to-[#1A4687] rounded-t-2xl px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Edit Assignment</h3>
              <p className="text-blue-300/80 text-xs">{dl}</p>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white text-lg w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition">✕</button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">Presenter</label>
            <select value={mid ?? ""} onChange={(e) => { const v = e.target.value; if (v === "TEAM_READING") { onTeamReading(entry.date); return; } setMid(v ? +v : null); }} className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none">
              <option value="">— Select —</option>
              <option value="TEAM_READING">📖 Team Reading (shifts roster)</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">Topic</label>
            <select value={top} onChange={(e) => setTop(e.target.value)} className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none mb-2">
              <option value="">— From library —</option>
              {[...new Set(topics.map((t) => t.category))].map((c) => (
                <optgroup key={c} label={`${CAT_COLORS[c]?.icon || ""} ${c}`}>
                  {topics.filter((t) => t.category === c).map((t) => <option key={t.id} value={t.title}>{t.title}</option>)}
                </optgroup>
              ))}
            </select>
            <input value={top} onChange={(e) => setTop(e.target.value)} className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none" placeholder="Or type custom topic..." />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">Status</label>
            <div className="flex gap-1.5">
              {(["scheduled", "completed", "missed", "cancelled"] as const).map((s) => (
                <button key={s} onClick={() => setSt(s)} className={`flex-1 px-2 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${st === s ? s === "completed" ? "bg-emerald-600 text-white border-emerald-600" : s === "missed" ? "bg-rose-600 text-white border-rose-600" : s === "cancelled" ? "bg-slate-500 text-white border-slate-500" : "bg-[#1A4687] text-white border-[#1A4687]" : "bg-theme-card text-theme-secondary border-theme hover:border-theme-secondary"}`}>
                  {STATUS_STYLES[s]?.label || s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none resize-none" placeholder="Optional notes..." />
          </div>

          {/* Swap */}
          {entry.memberId && entry.status === "scheduled" && (
            <div>
              <button onClick={() => setShowSwap(!showSwap)} className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider flex items-center gap-1 hover:text-theme-secondary transition mb-1.5">
                🔄 {showSwap ? "Hide" : "Swap presenter"} <span className="text-theme-muted/50 font-normal normal-case">(absent / late)</span>
              </button>
              {showSwap && (
                <div className="p-3 bg-theme-secondary rounded-xl border border-theme anim-scale">
                  <p className="text-xs text-theme-muted mb-2">Swap <strong>{entry.memberName}</strong> with another member for this date only.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {members.filter((m) => m.id !== entry.memberId).map((m) => (
                      <button key={m.id} onClick={() => onSwap(entry.date, m.id)} className="text-xs px-3 py-2 bg-theme-card border border-theme rounded-xl hover:border-[#6EC1E4] hover:bg-[#6EC1E4]/5 transition text-left font-medium text-theme-primary btn-press">
                        🔄 {m.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-theme bg-theme-secondary rounded-b-2xl flex items-center gap-2">
          {(entry.status === "no-talk" || (entry.status === "completed" && entry.noTalkReason)) && (
            <button
              onClick={() => { if (confirm("Restore this day to scheduled?")) onRestore(entry.date); }}
              className="px-3 py-2.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs font-medium rounded-xl transition mr-auto"
            >
              ↩️ Restore
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2.5 text-theme-secondary hover:text-theme-primary text-sm font-medium rounded-xl hover:bg-theme-hover transition">Cancel</button>
          <button onClick={() => onSave(entry.date, mid, top || null, st, notes || null)} className="px-5 py-2.5 bg-gradient-to-r from-[#1A4687] to-[#225CB2] text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-xl">
            ⚓ Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   NO-TALK MODAL
   ═══════════════════════════════════════════════════════════════ */
function NoTalkModal({
  entry,
  onSave,
  onClose,
}: {
  entry: RosterEntry;
  onSave: (d: string, r: string, ap: string, at: string, n: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("holiday");
  const [altPres, setAltPres] = useState("");
  const [altTopic, setAltTopic] = useState("");
  const [notes, setNotes] = useState("");

  const d = new Date(entry.date + "T00:00:00");
  const dl = d.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center p-4 anim-modal-bg" onClick={onClose}>
      <div className="glass-card rounded-3xl shadow-2xl w-full max-w-md border border-theme anim-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-amber-600 to-amber-500 rounded-t-2xl px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">🚫 Mark as No-Talk Day</h3>
              <p className="text-amber-100/80 text-xs">{dl}</p>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white text-lg w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition">✕</button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {entry.memberName && (
            <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-xl p-3 text-sm text-sky-800 dark:text-sky-300">
              <span className="font-semibold">{entry.memberName}</span> will be shifted to the next available date.
            </div>
          )}
          <div>
            <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">Reason *</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-amber-400 outline-none">
              <option value="holiday">🏖️ Public Holiday</option>
              <option value="other_topic">📢 Different Topic / Presenter</option>
              <option value="meeting">📋 Other Meeting</option>
              <option value="other">🚫 Other Reason</option>
            </select>
          </div>
          {reason === "other_topic" && (
            <>
              <div>
                <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">Who Presented?</label>
                <input value={altPres} onChange={(e) => setAltPres(e.target.value)} className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-amber-400 outline-none" placeholder="e.g. Safety Manager" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">Topic</label>
                <input value={altTopic} onChange={(e) => setAltTopic(e.target.value)} className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-amber-400 outline-none" placeholder="e.g. Annual Safety Stand-down" />
              </div>
            </>
          )}
          <div>
            <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-amber-400 outline-none resize-none" placeholder="Optional notes..." />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-theme bg-theme-secondary rounded-b-2xl flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 text-theme-secondary hover:text-theme-primary text-sm font-medium rounded-xl hover:bg-theme-hover transition">Cancel</button>
          <button onClick={() => onSave(entry.date, reason, altPres, altTopic, notes)} className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-xl">
             🚫 Set No-Talk Day
           </button>
         </div>
       </div>
     </div>
   );
}

/* ═══════════════════════════════════════════════════════════════
   EDIT MEMBER MODAL
   ═══════════════════════════════════════════════════════════════ */
function EditMemberModal({
  member,
  onSave,
  onClose,
}: {
  member: Member;
  onSave: (id: number, data: { name?: string; role?: string; email?: string; birthday?: string | null }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState(member.role);
  const [email, setEmail] = useState(member.email || "");
  const [bdayMonth, setBdayMonth] = useState(member.birthday?.split("-")[0] || "");
  const [bdayDay, setBdayDay] = useState(member.birthday?.split("-")[1] || "");

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center p-4 anim-modal-bg" onClick={onClose}>
      <div className="glass-card rounded-3xl shadow-2xl w-full max-w-md border border-theme anim-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#1D2130] to-[#1A4687] rounded-t-2xl px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                {initials(member.name)}
              </div>
              <div>
                <h3 className="text-sm font-bold">Edit Member</h3>
                <p className="text-blue-300/80 text-xs">{member.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white text-lg w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition">
              ✕
            </button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">Full Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none"
              >
                <option value="Presenter">Presenter</option>
                <option value="HOD">HOD</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">
                🎂 Birthday
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={bdayMonth}
                  onChange={(e) => setBdayMonth(e.target.value)}
                  className="px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none"
                >
                  <option value="">Month</option>
                  {MONTHS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
                </select>
                <select
                  value={bdayDay}
                  onChange={(e) => setBdayDay(e.target.value)}
                  className="px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none"
                >
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={String(d).padStart(2, "0")}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none"
              placeholder="email@sas.co.za"
            />
          </div>
          {bdayMonth && bdayDay && (
            <div className="bg-theme-secondary rounded-xl p-3 flex items-center gap-3 border border-theme">
              <span className="text-2xl">🎂</span>
              <div>
                <p className="text-sm font-medium text-theme-primary">
                  {parseInt(bdayDay, 10)} {MONTHS[parseInt(bdayMonth, 10) - 1]}
                </p>
                <p className="text-[11px] text-theme-muted">Birthday will appear on the Dashboard when approaching</p>
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-theme bg-theme-secondary rounded-b-2xl flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 text-theme-secondary hover:text-theme-primary text-sm font-medium rounded-xl hover:bg-theme-hover transition">
            Cancel
          </button>
          <button
            onClick={() =>
              onSave(member.id, {
                name,
                role,
                email: email || undefined,
                birthday: bdayMonth && bdayDay ? `${bdayMonth}-${bdayDay}` : null,
              })
            }
            className="px-5 py-2.5 bg-gradient-to-r from-[#1A4687] to-[#225CB2] text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-xl"
          >
            ⚓ Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAUSE ROSTER MODAL
   ═══════════════════════════════════════════════════════════════ */
function PauseRosterModal({
  onSave,
  onClose,
}: {
  onSave: (start: string, end: string, reason: string) => void;
  onClose: () => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("shutdown");

  const reasons = [
    { value: "shutdown", label: "🏭 Yard Shutdown" },
    { value: "holiday", label: "🏖️ Holiday Period" },
    { value: "training", label: "📚 Training Week" },
    { value: "other", label: "📋 Other" },
  ];

  const dayCount = startDate && endDate ? (() => {
    let count = 0;
    const cur = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    while (cur <= end) { if (cur.getDay() >= 1 && cur.getDay() <= 5) count++; cur.setDate(cur.getDate() + 1); }
    return count;
  })() : 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center p-4 anim-modal-bg" onClick={onClose}>
      <div className="glass-card rounded-3xl shadow-2xl w-full max-w-md border border-theme anim-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-amber-600 to-amber-500 rounded-t-3xl px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">⏸️ Pause Roster</h3>
              <p className="text-amber-100/80 text-xs">Mark a date range as no-talk days</p>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white text-lg w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition">✕</button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">From</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">To</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary input-premium outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">Reason</label>
            <div className="grid grid-cols-2 gap-2">
              {reasons.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all btn-press ${
                    reason === r.value ? "bg-amber-500 text-white border-amber-500" : "bg-theme-card text-theme-secondary border-theme hover:border-amber-300"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {dayCount > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-sm">
              <p className="text-amber-800 dark:text-amber-300 font-medium">
                ⏸️ {dayCount} weekday{dayCount !== 1 ? "s" : ""} will be marked as no-talk.
              </p>
              <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">Presenters will be shifted to resume after the pause.</p>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-theme bg-theme-secondary rounded-b-3xl flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 text-theme-secondary hover:text-theme-primary text-sm font-medium rounded-xl hover:bg-theme-hover transition">Cancel</button>
          <button
            onClick={() => { if (startDate && endDate) onSave(startDate, endDate, reason); }}
            disabled={!startDate || !endDate || startDate > endDate}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 btn-press"
          >
            ⏸️ Pause {dayCount} Day{dayCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PIN MODAL
   ═══════════════════════════════════════════════════════════════ */
function PinModal({
  modal,
  memberName,
  onLogin,
  onClose,
  onDone,
}: {
  modal: { memberId: number; mode: "login" | "set" | "change" | "reset_confirm" };
  memberName: string;
  onLogin: (id: number) => void;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check", memberId: modal.memberId, pin }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.ok) {
      onLogin(modal.memberId);
    } else {
      setError("Wrong PIN. Try again.");
      setPin("");
    }
  };

  const handleSet = async () => {
    if (newPin.length < 4) { setError("PIN must be at least 4 characters"); return; }
    if (newPin !== confirmPin) { setError("PINs don't match"); return; }
    setBusy(true);
    setError("");
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set", memberId: modal.memberId, newPin }),
    });
    setBusy(false);
    onDone();
  };

  const handleRemove = async () => {
    setBusy(true);
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", memberId: modal.memberId }),
    });
    setBusy(false);
    onDone();
  };

  const handleRequestReset = async () => {
    setBusy(true);
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request_reset", memberId: modal.memberId }),
    });
    setBusy(false);
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center p-4 anim-modal-bg" onClick={onClose}>
      <div className="glass-card rounded-3xl shadow-2xl w-full max-w-sm border border-theme anim-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#1D2130] to-[#1A4687] rounded-t-3xl px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">
                {modal.mode === "login" ? "🔒 Enter PIN" : modal.mode === "set" ? "🔓 Set a PIN" : "🔒 Change PIN"}
              </h3>
              <p className="text-blue-300/80 text-xs">{memberName}</p>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white text-lg w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition">✕</button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* LOGIN */}
          {modal.mode === "login" && (
            <>
              <p className="text-sm text-theme-secondary">This account is protected. Enter your PIN to continue.</p>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && pin) handleLogin(); }}
                placeholder="Enter PIN"
                autoFocus
                className="w-full px-4 py-3 bg-theme-secondary border border-theme rounded-xl text-center text-lg font-mono tracking-[0.3em] text-theme-primary input-premium outline-none"
              />
              {error && <p className="text-rose-500 text-xs text-center font-medium">{error}</p>}
              <button
                onClick={handleLogin}
                disabled={!pin || busy}
                className="w-full py-3 gradient-premium text-white font-semibold rounded-xl btn-press disabled:opacity-50"
              >
                {busy ? "Checking…" : "Unlock"}
              </button>
              <button
                onClick={handleRequestReset}
                disabled={busy}
                className="w-full text-xs text-theme-muted hover:text-theme-secondary text-center py-2"
              >
                Forgot PIN? Request admin reset
              </button>
            </>
          )}

          {/* SET or CHANGE */}
          {(modal.mode === "set" || modal.mode === "change") && (
            <>
              <p className="text-sm text-theme-secondary">
                {modal.mode === "set"
                  ? "Set a PIN to prevent others from selecting your name. Leave it open if you prefer."
                  : "Change your PIN or remove it entirely."}
              </p>
              <div>
                <label className="block text-[10px] font-semibold text-theme-muted mb-1 uppercase tracking-wider">New PIN</label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="At least 4 characters"
                  autoFocus
                  className="w-full px-4 py-3 bg-theme-secondary border border-theme rounded-xl text-center text-lg font-mono tracking-[0.3em] text-theme-primary input-premium outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-theme-muted mb-1 uppercase tracking-wider">Confirm PIN</label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newPin && confirmPin) handleSet(); }}
                  placeholder="Repeat PIN"
                  className="w-full px-4 py-3 bg-theme-secondary border border-theme rounded-xl text-center text-lg font-mono tracking-[0.3em] text-theme-primary input-premium outline-none"
                />
              </div>
              {error && <p className="text-rose-500 text-xs text-center font-medium">{error}</p>}
              <button
                onClick={handleSet}
                disabled={!newPin || !confirmPin || busy}
                className="w-full py-3 gradient-premium text-white font-semibold rounded-xl btn-press disabled:opacity-50"
              >
                {busy ? "Saving…" : modal.mode === "set" ? "🔒 Set PIN" : "🔒 Change PIN"}
              </button>
              {modal.mode === "change" && (
                <button
                  onClick={handleRemove}
                  disabled={busy}
                  className="w-full py-2 text-xs text-rose-500 hover:text-rose-600 text-center font-medium"
                >
                  🔓 Remove PIN (leave account open)
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

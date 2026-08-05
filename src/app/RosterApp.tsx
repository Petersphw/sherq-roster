"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
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
  active: boolean;
  sortOrder: number;
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
  perMember: { memberName: string; total: number; completed: number }[];
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TEAMS_LINK = "https://teams.microsoft.com/meet/32805846945212?p=3EwCxiW9TfHplYcW6X";

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
};

type Tab = "dashboard" | "calendar" | "roster" | "members" | "topics";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "calendar", label: "Calendar", icon: "📅" },
  { key: "roster", label: "Roster", icon: "📋" },
  { key: "members", label: "Team", icon: "👥" },
  { key: "topics", label: "Topics", icon: "📚" },
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
  const [darkMode, setDarkMode] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [mems, setMems] = useState<Member[]>(initialMembers);
  const [tops, setTops] = useState<Topic[]>(initialTopics);
  const [anns, setAnns] = useState<Announcement[]>(initialAnnouncements);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [mo, setMo] = useState(1);
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

  // Initialize dark mode and current user from localStorage
  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const saved = localStorage.getItem("darkMode");
    setDarkMode(saved ? saved === "true" : prefersDark);
    const savedUser = localStorage.getItem("currentUserId");
    if (savedUser) setCurrentUserId(parseInt(savedUser, 10));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  const switchUser = (id: number | null) => {
    setCurrentUserId(id);
    if (id) localStorage.setItem("currentUserId", String(id));
    else localStorage.removeItem("currentUserId");
  };

  const currentUser = mems.find((m) => m.id === currentUserId) || null;

  // My upcoming talks
  const myUpcoming = roster
    .filter((r) => r.memberId === currentUserId && r.status === "scheduled")
    .sort((a, b) => a.date.localeCompare(b.date));

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  const fetchRoster = useCallback(async (m: number) => {
    const r = await fetch(`/api/roster?month=${m}&year=2026`);
    setRoster(await r.json());
  }, []);

  const fetchStats = useCallback(async () => {
    const r = await fetch("/api/stats");
    setStats(await r.json());
  }, []);

  const fetchMems = async () => { const r = await fetch("/api/members"); setMems(await r.json()); };
  const fetchTops = async () => { const r = await fetch("/api/topics"); setTops(await r.json()); };
  const fetchAnns = async () => { const r = await fetch("/api/announcements"); setAnns(await r.json()); };

  useEffect(() => { if (seeded) { fetchRoster(mo); fetchStats(); } }, [mo, seeded, fetchRoster, fetchStats]);

  // Auto-refresh every 30 seconds so everyone sees the latest changes
  useEffect(() => {
    if (!seeded) return;
    const interval = setInterval(() => {
      fetchRoster(mo);
      fetchMems();
      fetchAnns();
    }, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, mo]);

  const seed = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data.error || "Setup failed — check database connection");
        setBusy(false);
        return;
      }
      await Promise.all([fetchMems(), fetchTops(), fetchAnns()]);
      setSeeded(true);
      toast("System ready — Welcome aboard! ⚓");
    } catch (err) {
      toast("Connection error — check your DATABASE_URL on Vercel");
    }
    setBusy(false);
  };

  const generate = async (monthOnly?: number) => {
    setBusy(true);
    const body: Record<string, string> = {};
    if (monthOnly) body.month = String(monthOnly);
    const r = await fetch("/api/roster/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (d.error) {
      toast(d.error);
    } else {
      toast(`⚓ ${d.assignmentsCreated} talks assigned`);
      fetchRoster(mo);
      fetchStats();
    }
    setBusy(false);
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
    if (!confirm("Remove this crew member?")) return;
    await fetch(`/api/members?id=${id}`, { method: "DELETE" });
    await fetchMems();
    toast("Member removed");
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
    await fetch("/api/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, memberId, topic, status, notes }),
    });
    await fetchRoster(mo);
    setEditing(null);
    toast("Assignment updated ✓");
  };

  const markNoTalk = async (
    date: string,
    reason: string,
    altPresenter: string,
    altTopic: string,
    notes: string
  ) => {
    await fetch("/api/roster/notalk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, reason, altPresenter, altTopic, notes }),
    });
    await fetchRoster(mo);
    setNoTalkModal(null);
    toast("No-talk day set — roster shifted ✓");
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const items = [...mems];
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setMems(items);
    const ids = items.map((m) => m.id);
    await fetch("/api/members/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ids }),
    });
    toast("Order updated — regenerate to apply");
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
      <div className={`min-h-screen flex items-center justify-center transition-colors ${darkMode ? "dark bg-slate-950" : "bg-gradient-to-br from-slate-100 to-slate-200"}`}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#1A4687]/10 rounded-full blur-3xl anim-float" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#6EC1E4]/10 rounded-full blur-3xl anim-float delay-2" />
        </div>
        <div className="bg-theme-card border border-theme rounded-2xl shadow-theme-xl p-10 max-w-md text-center anim-scale relative z-10">
          <div className="mb-6 anim-float">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1A4687] to-[#225CB2] shadow-lg">
              <span className="text-3xl">⚓</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-theme-primary mb-1">SHERQ Talk Roster</h1>
          <p className="text-[#1A4687] dark:text-[#6EC1E4] text-sm font-semibold mb-1">SA Shipyards</p>
          <p className="text-theme-muted text-sm mb-8">Initialize with your team and toolbox talk topics.</p>
          <button
            onClick={seed}
            disabled={busy}
            className="w-full py-3 px-6 bg-gradient-to-r from-[#1A4687] to-[#225CB2] hover:from-[#225CB2] hover:to-[#1A4687] text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 anim-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Setting up…
              </span>
            ) : (
              "⚓ Launch System"
            )}
          </button>
        </div>
      </div>
    );
  }

  /* ═══ MAIN LAYOUT ═══ */
  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? "dark" : ""}`}>
      <div className="min-h-screen bg-theme-secondary">
        {/* HEADER */}
        <header className="bg-gradient-to-r from-[#1D2130] via-[#1A4687] to-[#225CB2] text-white shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/images/hero-shipyard.jpg')] bg-cover bg-center opacity-10" />
          <div className="relative max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between anim-fade-down">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
                  <Image src="/images/sas-logo-white.png" alt="SAS" width={40} height={28} className="opacity-90" />
                </div>
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
                  onChange={(e) => switchUser(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="bg-white/10 hover:bg-white/20 backdrop-blur text-white text-xs font-medium pl-2 pr-1 py-2 rounded-lg transition-all border border-white/10 outline-none max-w-[140px] sm:max-w-[180px] cursor-pointer appearance-none"
                  title="Select who you are"
                >
                  <option value="" className="text-gray-900">👤 Who are you?</option>
                  {mems.filter((m) => m.active).map((m) => (
                    <option key={m.id} value={m.id} className="text-gray-900">{m.name}</option>
                  ))}
                </select>
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
        <nav className="bg-theme-card border-b border-theme sticky top-0 z-30 no-print">
          <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
            {TABS.map((t, i) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  tab === t.key
                    ? "border-[#1A4687] text-[#1A4687] dark:text-[#6EC1E4] dark:border-[#6EC1E4] bg-[#1A4687]/5 dark:bg-[#6EC1E4]/5"
                    : "border-transparent text-theme-muted hover:text-theme-secondary"
                }`}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <span className="mr-1.5">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </nav>

        {/* TOAST */}
        {msg && (
          <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-theme-xl anim-slide-in bg-[#1D2130] text-white text-sm font-medium flex items-center gap-2">
            <span className="text-[#6EC1E4]">✓</span> {msg}
          </div>
        )}

        {/* MAIN CONTENT */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="anim-fade-up">
            {tab === "dashboard" && (
              <DashboardView
                stats={stats}
                roster={roster}
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
              />
            )}
            {tab === "calendar" && (
              <CalendarView
                roster={roster}
                mems={mems}
                mo={mo}
                setMo={setMo}
                generate={generate}
                setEditing={setEditing}
                setNoTalkModal={setNoTalkModal}
                busy={busy}
                teamsCalUrl={teamsCalUrl}
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
          </div>
        </main>

        {/* MODALS */}
        {editing && (
          <EditModal
            entry={editing}
            members={mems.filter((m) => m.active)}
            topics={tops}
            onSave={saveAssignment}
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
        {editingMember && (
          <EditMemberModal
            member={editingMember}
            onSave={updateMember}
            onClose={() => setEditingMember(null)}
          />
        )}

        {/* FOOTER */}
        <footer className="bg-[#1D2130] text-slate-400 text-center py-6 text-xs mt-8 border-t-2 border-[#1A4687]">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <span className="text-sm">⚓</span>
            </div>
          </div>
          <p className="font-semibold text-white text-sm">Sandock Austral Shipyards</p>
          <p className="mt-1">SHERQ Department © 2026</p>
          <a
            href={TEAMS_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-[#6EC1E4] hover:text-white transition text-xs"
          >
            📹 Join SHERQ Talk on Teams
          </a>
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
}) {
  const upcomingBirthdays = getUpcomingBirthdays();
  const nextTalk = roster.find((r) => r.status === "scheduled" && new Date(r.date + "T00:00:00") >= new Date());

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Team Members", value: stats?.totalMembers ?? 0, icon: "👥", gradient: "from-slate-600 to-slate-700" },
          { label: "Total Talks", value: stats?.totalAssignments ?? 0, icon: "📋", gradient: "from-[#1A4687] to-[#225CB2]" },
          { label: "Completed", value: stats?.completedTalks ?? 0, icon: "✅", gradient: "from-emerald-600 to-emerald-700" },
          { label: "Scheduled", value: stats?.scheduledTalks ?? 0, icon: "📅", gradient: "from-amber-600 to-amber-700" },
        ].map((card, i) => (
          <div
            key={card.label}
            className={`relative overflow-hidden rounded-2xl text-white hover-lift anim-fade-up`}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className={`bg-gradient-to-br ${card.gradient} p-5`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-wider font-medium">{card.label}</p>
                  <p className="text-3xl font-black mt-1">{card.value}</p>
                </div>
                <span className="text-2xl opacity-50">{card.icon}</span>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent anim-shimmer pointer-events-none" />
          </div>
        ))}
      </div>

      {/* My Upcoming Talks - only shows when user is selected */}
      {currentUser && (
        <div className="bg-theme-card border border-theme rounded-2xl shadow-theme overflow-hidden anim-fade-up">
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
        <div className="bg-theme-card border border-theme rounded-2xl p-5 shadow-theme anim-fade-up border-dashed">
          <div className="flex items-center gap-3 text-theme-secondary">
            <span className="text-2xl">👤</span>
            <div>
              <p className="font-medium text-theme-primary">Select your name</p>
              <p className="text-xs text-theme-muted">Choose &ldquo;Who are you?&rdquo; in the top-right to see your upcoming talks and quickly set your topics.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Next Up */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick Actions */}
          <div className="bg-theme-card border border-theme rounded-2xl p-5 shadow-theme anim-fade-up delay-1">
            <h3 className="font-bold text-theme-primary mb-4 flex items-center gap-2">
              <span className="text-lg">⚡</span> Quick Actions
            </h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => generate(mo)}
                disabled={busy}
                className="px-4 py-2.5 bg-gradient-to-r from-[#1A4687] to-[#225CB2] hover:from-[#225CB2] hover:to-[#1A4687] text-white rounded-xl text-sm font-medium transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center gap-2"
              >
                {busy && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full anim-spin" />}
                Generate {MONTHS[mo - 1]} Roster
              </button>
              <button
                onClick={() => generate()}
                disabled={busy}
                className="px-4 py-2.5 bg-theme-tertiary hover:bg-theme-hover text-theme-secondary border border-theme rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              >
                Generate Full Year
              </button>
              <a
                href={TEAMS_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-[#5B5FC7] hover:bg-[#4B4FB7] text-white rounded-xl text-sm font-medium transition-all flex items-center gap-2"
              >
                📹 Join Meeting
              </a>
            </div>
          </div>

          {/* Next Talk */}
          {nextTalk && (
            <div className="bg-theme-card border border-theme rounded-2xl p-5 shadow-theme anim-fade-up delay-2">
              <h3 className="font-bold text-theme-primary mb-4 flex items-center gap-2">
                <span className="text-lg">📣</span> Next SHERQ Talk
              </h3>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#1A4687] to-[#225CB2] flex flex-col items-center justify-center text-white shadow-lg">
                  <span className="text-xs uppercase font-medium opacity-70">
                    {new Date(nextTalk.date + "T00:00:00").toLocaleDateString("en", { month: "short" })}
                  </span>
                  <span className="text-2xl font-black">
                    {new Date(nextTalk.date + "T00:00:00").getDate()}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-theme-primary">{nextTalk.memberName || "Unassigned"}</p>
                  <p className="text-sm text-theme-secondary">{nextTalk.topic || "Topic TBC"}</p>
                  <p className="text-xs text-theme-muted mt-1">
                    {new Date(nextTalk.date + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Announcements */}
          <div className="bg-theme-card border border-theme rounded-2xl p-5 shadow-theme anim-fade-up delay-3">
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
              {anns.length === 0 ? (
                <p className="text-theme-muted text-sm text-center py-4">No announcements yet</p>
              ) : (
                anns.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 p-3 bg-theme-secondary rounded-xl group">
                    <span className="text-lg">{a.type === "birthday" ? "🎂" : a.type === "event" ? "📅" : "📋"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-theme-primary text-sm">{a.title}</p>
                      {a.description && <p className="text-xs text-theme-muted">{a.description}</p>}
                      {a.eventDate && (
                        <p className="text-xs text-theme-secondary mt-1">
                          {new Date(a.eventDate + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
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

        {/* Birthdays & Progress */}
        <div className="space-y-4">
          {/* Birthdays */}
          <div className="bg-theme-card border border-theme rounded-2xl p-5 shadow-theme anim-fade-up delay-2">
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
            <div className="bg-theme-card border border-theme rounded-2xl p-5 shadow-theme anim-fade-up delay-3">
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

          {/* Top Presenters */}
          {stats && stats.perMember.length > 0 && (
            <div className="bg-theme-card border border-theme rounded-2xl p-5 shadow-theme anim-fade-up delay-4">
              <h3 className="font-bold text-theme-primary mb-4 flex items-center gap-2">
                <span className="text-lg">🏆</span> Top Presenters
              </h3>
              <div className="space-y-2">
                {stats.perMember
                  .sort((a, b) => b.completed - a.completed)
                  .slice(0, 5)
                  .map((pm, i) => (
                    <div key={pm.memberName} className="flex items-center gap-3">
                      <span className="text-xs text-theme-muted w-4">#{i + 1}</span>
                      <div className={`w-7 h-7 rounded-full ${getMemberColor(i)} text-white flex items-center justify-center font-bold text-[10px]`}>
                        {initials(pm.memberName)}
                      </div>
                      <span className="flex-1 text-sm text-theme-primary truncate">{pm.memberName}</span>
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{pm.completed}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CALENDAR VIEW
   ═══════════════════════════════════════════════════════════════ */
function CalendarView({
  roster,
  mems,
  mo,
  setMo,
  generate,
  setEditing,
  setNoTalkModal,
  busy,
  teamsCalUrl,
}: {
  roster: RosterEntry[];
  mems: Member[];
  mo: number;
  setMo: (m: number) => void;
  generate: (m?: number) => void;
  setEditing: (e: RosterEntry) => void;
  setNoTalkModal: (e: RosterEntry) => void;
  busy: boolean;
  teamsCalUrl: (e: RosterEntry) => string;
}) {
  const yr = 2026;
  const fd = new Date(yr, mo - 1, 1).getDay();
  const dim = new Date(yr, mo, 0).getDate();
  const today = new Date().toISOString().split("T")[0];
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
            onClick={() => setMo(Math.max(1, mo - 1))}
            className="p-2.5 rounded-xl bg-theme-card border border-theme hover:bg-theme-hover text-theme-secondary transition-all shadow-theme"
            disabled={mo <= 1}
          >
            ◀
          </button>
          <select
            value={mo}
            onChange={(e) => setMo(+e.target.value)}
            className="px-4 py-2.5 border border-theme rounded-xl bg-theme-card font-bold text-theme-primary text-lg shadow-theme focus:ring-2 focus:ring-[#6EC1E4] outline-none"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m} 2026</option>
            ))}
          </select>
          <button
            onClick={() => setMo(Math.min(12, mo + 1))}
            className="p-2.5 rounded-xl bg-theme-card border border-theme hover:bg-theme-hover text-theme-secondary transition-all shadow-theme"
            disabled={mo >= 12}
          >
            ▶
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => generate(mo)}
            disabled={busy}
            className="px-4 py-2.5 bg-gradient-to-r from-[#1A4687] to-[#225CB2] hover:from-[#225CB2] hover:to-[#1A4687] text-white rounded-xl text-xs font-medium transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
          >
            {busy && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full anim-spin" />}
            Generate
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-theme-card border border-theme text-theme-secondary hover:bg-theme-hover rounded-xl text-xs font-medium transition-all shadow-theme"
          >
            🖨️ Print
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-1.5 mb-4 no-print text-[10px]">
        {mems.filter((m) => m.active && m.role !== "HOD").map((m, i) => (
          <span key={m.id} className={`px-2 py-1 rounded-lg border font-medium ${getMemberBadgeColor(i)}`}>
            {m.name}
          </span>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="bg-theme-card rounded-2xl shadow-theme-lg border border-theme overflow-hidden anim-scale">
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
            const en = rm.get(ds);
            const isNoTalk = en?.status === "no-talk";
            const memberIdx = en?.memberId ? memberIndexMap.get(en.memberId) ?? 0 : 0;

            return (
              <div
                key={day}
                className={`min-h-24 border-b border-r border-theme p-1.5 transition-all relative group cursor-pointer ${
                  wk ? "bg-theme-tertiary/50 text-theme-muted" :
                  td ? "bg-[#6EC1E4]/10 ring-2 ring-[#6EC1E4] ring-inset" :
                  isNoTalk ? "bg-amber-50/50 dark:bg-amber-950/20" :
                  "bg-theme-card hover:bg-theme-hover"
                }`}
                onClick={() => {
                  if (wk) return;
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

                {!en && !wk && (
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
          className="px-4 py-2.5 border border-theme rounded-xl bg-theme-card font-bold text-theme-primary shadow-theme focus:ring-2 focus:ring-[#6EC1E4] outline-none"
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
                className="bg-theme-card rounded-2xl border border-theme shadow-theme overflow-hidden hover-lift anim-fade-up"
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
  mems,
  addMem,
  setAddMem,
  addMember,
  toggleMem,
  deleteMem,
  onDragEnd,
  onEditMember,
}: {
  mems: Member[];
  addMem: boolean;
  setAddMem: (v: boolean) => void;
  addMember: (e: React.FormEvent<HTMLFormElement>) => void;
  toggleMem: (m: Member) => void;
  deleteMem: (id: number) => void;
  onDragEnd: (r: DropResult) => void;
  onEditMember: (m: Member) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 anim-fade-down">
        <div>
          <h2 className="text-xl font-bold text-theme-primary flex items-center gap-2">
            ⚓ SHERQ Crew
            <span className="bg-[#1A4687] dark:bg-[#6EC1E4] text-white dark:text-[#1D2130] text-xs px-2 py-0.5 rounded-full">{mems.length}</span>
          </h2>
          <p className="text-xs text-theme-muted mt-0.5">Drag to reorder • HOD stays as observer</p>
        </div>
        <button
          onClick={() => setAddMem(!addMem)}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-theme ${
            addMem ? "bg-theme-tertiary text-theme-secondary border border-theme" : "bg-gradient-to-r from-[#1A4687] to-[#225CB2] text-white"
          }`}
        >
          {addMem ? "✕ Cancel" : "+ Add Member"}
        </button>
      </div>

      {addMem && (
        <form onSubmit={addMember} className="bg-theme-card rounded-2xl border border-theme shadow-theme-lg p-5 mb-5 anim-scale">
          <h3 className="font-bold text-theme-primary mb-4 text-sm">New Crew Member</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-theme-muted mb-1 uppercase tracking-wide">Name *</label>
              <input name="name" required className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none" placeholder="Full name" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-theme-muted mb-1 uppercase tracking-wide">Role</label>
              <select name="role" className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none">
                <option value="Presenter">Presenter</option>
                <option value="HOD">HOD</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-theme-muted mb-1 uppercase tracking-wide">Email</label>
              <input name="email" type="email" className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none" placeholder="email@sas.co.za" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-theme-muted mb-1 uppercase tracking-wide">🎂 Birthday</label>
              <div className="grid grid-cols-2 gap-1">
                <select name="bday_month" className="px-2 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none">
                  <option value="">Month</option>
                  {MONTHS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
                </select>
                <select name="bday_day" className="px-2 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none">
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

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="members">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`space-y-2 transition-colors rounded-2xl p-2 -m-2 ${snapshot.isDraggingOver ? "bg-[#6EC1E4]/10" : ""}`}
            >
              {mems.map((m, i) => (
                <Draggable key={m.id} draggableId={String(m.id)} index={i}>
                  {(provided2, snapshot2) => (
                    <div
                      ref={provided2.innerRef}
                      {...provided2.draggableProps}
                      className={`bg-theme-card rounded-xl border overflow-hidden drag-item ${
                        snapshot2.isDragging ? "drag-item-dragging border-[#6EC1E4]" : "border-theme hover-lift"
                      } ${!m.active ? "opacity-50" : ""}`}
                      style={provided2.draggableProps.style}
                    >
                      <div className="flex items-center gap-3 p-3">
                        <div
                          {...provided2.dragHandleProps}
                          className="drag-handle text-theme-muted hover:text-theme-secondary transition p-1 -ml-1"
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
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          m.active ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400" : "bg-theme-tertiary text-theme-muted"
                        }`}>
                          {m.active ? "Active" : "Inactive"}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => onEditMember(m)}
                            className="text-[10px] py-1.5 px-2.5 rounded-lg font-medium transition bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-400 hover:bg-sky-200 dark:hover:bg-sky-900"
                            title="Edit member details & birthday"
                          >
                            ✏️
                          </button>
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
                          <button
                            onClick={() => deleteMem(m.id)}
                            className="text-[10px] py-1.5 px-2.5 bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-lg font-medium hover:bg-rose-200 dark:hover:bg-rose-900 transition"
                          >
                            ✕
                          </button>
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
        <form onSubmit={addTopic} className="bg-theme-card rounded-2xl border border-theme shadow-theme-lg p-5 mb-5 anim-scale">
          <h3 className="font-bold text-theme-primary mb-4 text-sm">Add New Topic</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-theme-muted mb-1 uppercase">Category *</label>
              <select name="category" required className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none">
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
              <input name="addedBy" className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none" placeholder="Who's adding?" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-medium text-theme-muted mb-1 uppercase">Topic Title *</label>
              <input name="title" required className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none" placeholder="e.g. Confined Space Entry" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-medium text-theme-muted mb-1 uppercase">Description</label>
              <textarea name="description" rows={2} className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none resize-none" placeholder="Brief description..." />
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
                    <div key={t.id} className="bg-theme-card rounded-xl border border-theme p-4 hover-lift group transition-all shadow-theme">
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
  entry,
  members,
  topics,
  onSave,
  onClose,
}: {
  entry: RosterEntry;
  members: Member[];
  topics: Topic[];
  onSave: (d: string, mId: number | null, t: string | null, s: string, n: string | null) => void;
  onClose: () => void;
}) {
  const [mid, setMid] = useState<number | null>(entry.memberId);
  const [top, setTop] = useState(entry.topic || "");
  const [st, setSt] = useState(entry.status === "no-talk" ? "scheduled" : entry.status);
  const [notes, setNotes] = useState(entry.notes || "");

  const d = new Date(entry.date + "T00:00:00");
  const dl = d.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 anim-modal-bg" onClick={onClose}>
      <div className="bg-theme-card rounded-2xl shadow-theme-xl w-full max-w-lg border border-theme anim-modal" onClick={(e) => e.stopPropagation()}>
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
            <select value={mid ?? ""} onChange={(e) => setMid(e.target.value ? +e.target.value : null)} className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none">
              <option value="">— Select —</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">Topic</label>
            <select value={top} onChange={(e) => setTop(e.target.value)} className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none mb-2">
              <option value="">— From library —</option>
              {[...new Set(topics.map((t) => t.category))].map((c) => (
                <optgroup key={c} label={`${CAT_COLORS[c]?.icon || ""} ${c}`}>
                  {topics.filter((t) => t.category === c).map((t) => <option key={t.id} value={t.title}>{t.title}</option>)}
                </optgroup>
              ))}
            </select>
            <input value={top} onChange={(e) => setTop(e.target.value)} className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none" placeholder="Or type custom topic..." />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">Status</label>
            <div className="flex gap-1.5">
              {(["scheduled", "completed", "missed", "cancelled"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSt(s)}
                  className={`flex-1 px-2 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                    st === s
                      ? s === "completed" ? "bg-emerald-600 text-white border-emerald-600" :
                        s === "missed" ? "bg-rose-600 text-white border-rose-600" :
                        s === "cancelled" ? "bg-slate-500 text-white border-slate-500" :
                        "bg-[#1A4687] text-white border-[#1A4687]"
                      : "bg-theme-card text-theme-secondary border-theme hover:border-theme-secondary"
                  }`}
                >
                  {STATUS_STYLES[s]?.label || s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none resize-none" placeholder="Optional notes..." />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-theme bg-theme-secondary rounded-b-2xl flex justify-end gap-2">
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 anim-modal-bg" onClick={onClose}>
      <div className="bg-theme-card rounded-2xl shadow-theme-xl w-full max-w-md border border-theme anim-modal" onClick={(e) => e.stopPropagation()}>
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 anim-modal-bg" onClick={onClose}>
      <div className="bg-theme-card rounded-2xl shadow-theme-xl w-full max-w-md border border-theme anim-modal" onClick={(e) => e.stopPropagation()}>
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
              className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-theme-muted mb-1.5 uppercase tracking-wider">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none"
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
                  className="px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none"
                >
                  <option value="">Month</option>
                  {MONTHS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
                </select>
                <select
                  value={bdayDay}
                  onChange={(e) => setBdayDay(e.target.value)}
                  className="px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none"
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
              className="w-full px-3 py-2.5 bg-theme-secondary border border-theme rounded-xl text-sm text-theme-primary focus:ring-2 focus:ring-[#6EC1E4] outline-none"
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

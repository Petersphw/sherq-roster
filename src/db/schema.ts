import {
  pgTable,
  serial,
  varchar,
  date,
  text,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 100 }).notNull().default("Presenter"),
  department: varchar("department", { length: 255 }).default("SHERQ"),
  email: varchar("email", { length: 255 }),
  birthday: varchar("birthday", { length: 10 }),
  pin: varchar("pin", { length: 255 }),
  pinResetRequested: boolean("pin_reset_requested").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rosterAssignments = pgTable("roster_assignments", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  memberId: integer("member_id").references(() => members.id),
  topic: varchar("topic", { length: 500 }),
  status: varchar("status", { length: 50 }).notNull().default("scheduled"),
  noTalkReason: varchar("no_talk_reason", { length: 50 }),
  noTalkPresenter: varchar("no_talk_presenter", { length: 255 }),
  noTalkTopic: varchar("no_talk_topic", { length: 500 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 100 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  addedBy: varchar("added_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rosterSettings = pgTable("roster_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: varchar("value", { length: 500 }).notNull(),
});

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  eventDate: date("event_date"),
  addedBy: varchar("added_by", { length: 255 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const actionHistory = pgTable("action_history", {
  id: serial("id").primaryKey(),
  action: varchar("action", { length: 100 }).notNull(),
  detail: text("detail"),
  snapshotJson: text("snapshot_json").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  fromId: integer("from_id").notNull(),
  toId: integer("to_id").notNull(),
  body: text("body").notNull(),
  replyToId: integer("reply_to_id"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const analysisHistory = pgTable("analysis_history", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  language: text("language"),
  summary: text("summary"),
  issueCount: integer("issue_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAnalysisHistorySchema = createInsertSchema(analysisHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertAnalysisHistory = z.infer<typeof insertAnalysisHistorySchema>;
export type AnalysisHistory = typeof analysisHistory.$inferSelect;

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  goal: text("goal").notNull(),
  files: text("files").notNull(),
  agentSequence: text("agent_sequence"),
  fileCount: integer("file_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

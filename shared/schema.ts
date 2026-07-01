import { pgTable, text, serial, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
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

export const coderProjects = pgTable("coder_projects", {
  id: serial("id").primaryKey(),
  goal: text("goal").notNull(),
  files: jsonb("files").notNull().default([]),
  agentSequence: jsonb("agent_sequence").default([]),
  fileCount: integer("file_count").default(0),
  totalTokens: integer("total_tokens").default(0),
  totalCostUsd: integer("total_cost_usd").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProjectSchema = createInsertSchema(coderProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof coderProjects.$inferSelect;

export const employeeTasks = pgTable("employee_tasks", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(), // e.g. "github", "slack", "cron"
  sourceId: text("source_id"), // e.g. "issue_123"
  goal: text("goal").notNull(),
  status: text("status").notNull().default("pending"), // "pending", "running", "completed", "failed"
  result: jsonb("result"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEmployeeTaskSchema = createInsertSchema(employeeTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmployeeTask = z.infer<typeof insertEmployeeTaskSchema>;
export type EmployeeTask = typeof employeeTasks.$inferSelect;

// ─── BYOK: Per-user AI provider API keys ────────────────────────────────────
// Ported from codeforge-v2 (Convex) — lets any user supply their own
// DeepSeek/Kilo/Groq/Gemini/Cerebras/GitHub/Cohere key instead of relying
// on the platform's shared keys.

export const userApiKeys = pgTable("user_api_keys", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(), // deepseek | kilo | groq | gemini | cerebras | github | cohere
  encryptedKey: text("encrypted_key").notNull(),
  maskedKey: text("masked_key").notNull(),
  isValid: boolean("is_valid").default(true),
  validatedAt: timestamp("validated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserApiKeySchema = createInsertSchema(userApiKeys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserApiKey = z.infer<typeof insertUserApiKeySchema>;
export type UserApiKey = typeof userApiKeys.$inferSelect;

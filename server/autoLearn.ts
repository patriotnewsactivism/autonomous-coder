/**
 * AutoLearn — Persistent cross-session knowledge accumulation
 *
 * Every build generates structured learnings that are stored and surfaced
 * to future agents. The more it builds, the smarter it gets.
 *
 * Knowledge types:
 * - "pattern"   : What worked (stack choices, code patterns, architectures)
 * - "anti"      : What failed (avoid this approach for this type of goal)
 * - "shortcut"  : Reusable snippets / boilerplate that consistently score well
 * - "meta"      : Which agents perform best for which categories of task
 */

import { callAI, parseJsonResponse } from "./aiCore";
import { storeMemory, retrieveMemory } from "./agentMemory";

export interface BuildSummary {
  sessionId: string;
  goal: string;
  agentSequence: string[];
  agentScores: Record<string, number>;
  files: Array<{ path: string; content: string }>;
  healCycles: number;
  totalTokens: number;
  success: boolean;
}

const EXTRACT_LEARNINGS_PROMPT = `You are a meta-learning AI. Analyze this completed build and extract 
high-value, generalizable knowledge that will help future builds succeed faster.

Focus on:
- What stack / architecture choices made this succeed?
- What code patterns appeared in the best-scoring files?
- What should be avoided for similar goals in the future?
- Which agent performed best and why?

OUTPUT JSON:
{
  "patterns": ["Pattern 1: description", "Pattern 2: description"],
  "antiPatterns": ["Avoid X when building Y because Z"],
  "shortcuts": ["Reusable snippet or boilerplate description"],
  "metaInsights": ["Agent X worked best here because...", "This type of goal always needs..."],
  "qualityScore": 8
}`;

export async function extractAndStoreLearnigns(summary: BuildSummary, model?: string): Promise<void> {
  try {
    const { content } = await callAI(
      EXTRACT_LEARNINGS_PROMPT,
      `GOAL: ${summary.goal}
AGENTS USED: ${summary.agentSequence.join(" → ")}
AGENT SCORES: ${JSON.stringify(summary.agentScores)}
FILES GENERATED: ${summary.files.map(f => f.path).join(", ")}
HEAL CYCLES: ${summary.healCycles}
SUCCESS: ${summary.success}
TOTAL TOKENS: ${summary.totalTokens}

SAMPLE CODE (top-scoring file):
${summary.files.slice(0, 1).map(f => f.content.slice(0, 1500)).join("\n")}`,
      model
    );

    const learnings = parseJsonResponse(content);

    const stores = [
      ...(learnings.patterns || []).map((p: string) => ({
        session_id: summary.sessionId,
        agent: "autolearn",
        type: "pattern" as const,
        content: p,
        tags: ["pattern", summary.agentSequence[0] || "general"],
        score: learnings.qualityScore || 7,
      })),
      ...(learnings.antiPatterns || []).map((p: string) => ({
        session_id: summary.sessionId,
        agent: "autolearn",
        type: "failure" as const,
        content: `ANTI-PATTERN: ${p}`,
        tags: ["anti", "avoid"],
        score: -1,
      })),
      ...(learnings.metaInsights || []).map((p: string) => ({
        session_id: summary.sessionId,
        agent: "autolearn",
        type: "context" as const,
        content: p,
        tags: ["meta", "routing"],
        score: 8,
      })),
    ];

    await Promise.all(stores.map(entry => storeMemory(entry)));
    console.log(`[autolearn] Stored ${stores.length} learnings for session ${summary.sessionId.slice(0, 8)}`);
  } catch (e) {
    console.error("[autolearn] Failed to extract learnings:", e);
  }
}

/**
 * Inject relevant cross-session memory into any agent's context
 * Call this before every agent run to give them accumulated wisdom
 */
export async function getSmartContext(goal: string, agentType: string): Promise<string> {
  try {
    const memories = await retrieveMemory(goal, 12);
    if (memories.length === 0) return "";

    const patterns = memories.filter(m => m.type === "pattern").slice(0, 4);
    const failures = memories.filter(m => m.type === "failure").slice(0, 3);
    const meta = memories.filter(m => m.type === "context").slice(0, 3);

    const lines = ["\n\n━━━ ACCUMULATED BUILD WISDOM ━━━"];
    if (patterns.length > 0) {
      lines.push("\n✓ PROVEN PATTERNS (apply these):");
      patterns.forEach(p => lines.push(`  • ${p.content}`));
    }
    if (failures.length > 0) {
      lines.push("\n✗ KNOWN FAILURES (avoid these):");
      failures.forEach(f => lines.push(`  • ${f.content}`));
    }
    if (meta.length > 0) {
      lines.push("\n💡 META INSIGHTS:");
      meta.forEach(m => lines.push(`  • ${m.content}`));
    }
    lines.push("━━━ END WISDOM ━━━\n");
    return lines.join("\n");
  } catch {
    return "";
  }
}

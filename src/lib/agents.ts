// ── Agent Types ───────────────────────────────────────────────────────────────
export type AgentType =
  | "orchestrator"
  | "strategist"
  | "database"
  | "api"
  | "ui"
  | "builder"
  | "testing"
  | "security"
  | "performance"
  | "reviewer"
  | "fixer"
  | "refiner"
  | "deployer";

export interface AgentTask {
  id: number;
  title: string;
  description: string;
  type: "component" | "function" | "api" | "style" | "config" | "database" | "test" | "deploy";
  priority: "high" | "medium" | "low";
  dependencies: number[];
  status?: "pending" | "in_progress" | "completed" | "failed";
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: "create" | "update";
}

export interface CodeIssue {
  id: string;
  severity: "critical" | "warning" | "suggestion";
  type: "bug" | "security" | "performance" | "style" | "logic";
  file: string;
  line?: number;
  message: string;
  suggestion: string;
}

export interface AgentMessage {
  id: string;
  agent: AgentType;
  type: "thinking" | "action" | "result" | "error" | "streaming";
  content: string;
  timestamp: Date;
  data?: any;
  retryable?: boolean;
  retryGoal?: string;
  tokenCount?: number;
  costUsd?: number;
}

// ── Cross-agent memory (ported from ai-assist) ────────────────────────────────
export interface AgentMemory {
  agent: AgentType;
  round: number;
  keyInsights: string[];
  openQuestions: string[];
  positionSummary: string;
}

export interface BuildMemory {
  round: number;
  agentOutputs: Partial<Record<AgentType, string>>;
  agentMemories: AgentMemory[];
  filesSoFar: number;
  issuesSoFar: string[];
}

/** Build a cross-agent memory block to inject into each agent's context */
export function buildBuildMemory(memories: BuildMemory[]): string {
  if (memories.length === 0) return "";
  const lines = ["\n\n━━━ BUILD MEMORY (context from previous phases) ━━━"];
  for (const bm of memories) {
    lines.push(`\n[Phase ${bm.round} — ${bm.filesSoFar} files generated]`);
    if (bm.agentMemories.length > 0) {
      bm.agentMemories.forEach(m => {
        if (m.keyInsights.length > 0)
          lines.push(`  ${m.agent}: ${m.keyInsights.slice(0, 2).join("; ")}`);
      });
    }
    if (bm.issuesSoFar.length > 0) {
      lines.push("  Issues to avoid:");
      bm.issuesSoFar.slice(0, 3).forEach(i => lines.push(`    ✗ ${i}`));
    }
  }
  lines.push("━━━ END MEMORY ━━━\n");
  return lines.join("\n");
}

/** Extract structured memory from an agent's raw output */
export function extractAgentMemory(agent: AgentType, round: number, output: string): AgentMemory {
  const sentences = output.split(/(?<=[.!?])\s+/).slice(0, 3).join(" ");
  const bulletLines = output.split("\n")
    .filter(l => /^[\s]*[-*•\d]/.test(l))
    .map(l => l.replace(/^[\s\-*•\d.]+/, "").trim())
    .filter(l => l.length > 10 && l.length < 200)
    .slice(0, 5);
  const questionLines = output.split("\n")
    .filter(l => /\?|missing|unclear|needs|unaddressed|gap|todo/i.test(l))
    .map(l => l.trim())
    .filter(l => l.length > 10 && l.length < 200)
    .slice(0, 3);
  return { agent, round, keyInsights: bulletLines, openQuestions: questionLines, positionSummary: sentences.slice(0, 400) };
}

// ── Result types ──────────────────────────────────────────────────────────────
export interface OrchestratorResult {
  understanding: string;
  approach: string;
  strategy: string;
  agentSequence: AgentType[];
  requiresDatabase: boolean;
  requiresAPI: boolean;
  requiresUI: boolean;
  requiresTesting: boolean;
  requiresSecurity: boolean;
  projectType: "webapp" | "component" | "api" | "fullstack" | "landing" | "dashboard";
  estimatedSteps: number;
  readyToStart: boolean;
  tokenCount: number;
  costUsd: number;
}

export interface StrategyResult {
  analysis: string;
  architecture: string;
  approach: string;
  tasks: AgentTask[];
  techStack: string[];
  estimatedComplexity: "simple" | "moderate" | "complex";
  tokenCount: number;
  costUsd: number;
}

export interface BuildResult {
  files: GeneratedFile[];
  explanation: string;
  nextSteps: string[];
  tokenCount: number;
  costUsd: number;
}

export interface ReviewResult {
  overallScore: number;
  issues: CodeIssue[];
  strengths: string[];
  summary: string;
  tokenCount: number;
  costUsd: number;
}

export interface FixResult {
  files: Array<{
    path: string;
    fixedCode: string;
    explanation: string;
  }>;
  summary: string;
  tokenCount: number;
  costUsd: number;
}

export interface SpecialistResult {
  files: GeneratedFile[];
  output: string;
  explanation: string;
  summary: string;
  tokenCount: number;
  costUsd: number;
}

export interface RefineResult {
  files: GeneratedFile[];
  explanation: string;
  summary: string;
  tokenCount: number;
  costUsd: number;
}

// ── Token & Cost tracking ─────────────────────────────────────────────────────
export const SESSION_TOKENS_KEY = "acw_session_tokens";
export const SESSION_COST_KEY = "acw_session_cost";
export const SELECTED_MODEL_KEY = "acw_selected_model";
export const AUTOSAVE_KEY = "acw_autosave";

export function getSessionTokens(): number {
  try { return parseInt(localStorage.getItem(SESSION_TOKENS_KEY) || "0") || 0; } catch { return 0; }
}
export function addSessionTokens(n: number): number {
  try {
    const total = getSessionTokens() + n;
    localStorage.setItem(SESSION_TOKENS_KEY, String(total));
    return total;
  } catch { return 0; }
}
export function resetSessionTokens(): void {
  try { localStorage.setItem(SESSION_TOKENS_KEY, "0"); } catch { /* noop */ }
}

export function getSessionCost(): number {
  try { return parseFloat(localStorage.getItem(SESSION_COST_KEY) || "0") || 0; } catch { return 0; }
}
export function addSessionCost(n: number): number {
  try {
    const total = getSessionCost() + n;
    localStorage.setItem(SESSION_COST_KEY, String(total));
    return total;
  } catch { return 0; }
}
export function resetSessionCost(): void {
  try { localStorage.setItem(SESSION_COST_KEY, "0"); } catch { /* noop */ }
}
export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.001) return `$${(usd * 100000).toFixed(1)}μ`;
  if (usd < 0.01) return `$${(usd * 1000).toFixed(2)}m`;
  return `$${usd.toFixed(4)}`;
}
export function estimateCost(tokens: number, model: string): number {
  const pricing: Record<string, [number, number]> = {
    "gemini-2.5-flash": [0, 0],
    "gemini-2.0-flash": [0, 0],
    "gemini-2.0-flash-lite": [0, 0],
    "llama-3.3-70b-versatile": [0.00059, 0.00079],
    "deepseek-chat": [0.00014, 0.00028],
  };
  const [inRate] = pricing[model] || [0.0002, 0.0006];
  return (tokens / 1000) * inRate;
}
export function getSelectedModel(): string {
  try { return localStorage.getItem(SELECTED_MODEL_KEY) || ""; } catch { return ""; }
}
export function setSelectedModel(model: string): void {
  try { localStorage.setItem(SELECTED_MODEL_KEY, model); } catch { /* noop */ }
}

// ── Autosave ──────────────────────────────────────────────────────────────────
export interface AutoSaveData {
  goal: string;
  files: GeneratedFile[];
  agentSequence: AgentType[];
  messages: Pick<AgentMessage, "agent" | "type" | "content">[];
  timestamp: number;
}
export function autoSave(data: AutoSaveData): void {
  try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data)); } catch { /* noop */ }
}
export function getAutoSave(): AutoSaveData | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function clearAutoSave(): void {
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* noop */ }
}

// ── API helpers ───────────────────────────────────────────────────────────────
const API_BASE = (import.meta as any).env?.VITE_API_URL || "";

async function apiRequest(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchModels(): Promise<{
  models: string[];
  default: string;
  pricing: Record<string, { input: number; output: number }>;
}> {
  return apiRequest("/api/models");
}

export interface ProviderStatusResult {
  totalProviders: number;
  activeProviders: number;
  allConfigured: boolean;
  anyConfigured: boolean;
  providers: Array<{
    name: string; label: string; isFree: boolean; active: boolean;
    envVar: string; signupUrl: string;
    models: Array<{ id: string; label: string }>;
  }>;
  freeUnconfigured: Array<{ name: string; label: string; envVar: string; signupUrl: string }>;
}
export async function fetchProviderStatus(): Promise<ProviderStatusResult> {
  return apiRequest("/api/providers/status");
}

// ── Low-level streaming + non-streaming agent call ────────────────────────────
async function runAgentRaw<T>(agentType: AgentType, goal: string, context?: any): Promise<T & { tokenCount: number; costUsd: number }> {
  const model = getSelectedModel() || undefined;
  const data = await apiRequest("/api/ai-agent", {
    method: "POST",
    body: JSON.stringify({ agentType, goal, context, model }),
  });
  if (data.error) throw new Error(data.error);
  if (data.tokens) addSessionTokens(data.tokens);
  if (data.costUsd) addSessionCost(data.costUsd);
  return { ...(data.result as T), tokenCount: data.tokens || 0, costUsd: data.costUsd || 0 };
}

async function runAgentStreaming<T>(
  agentType: AgentType,
  goal: string,
  context: any,
  onToken: (token: string) => void
): Promise<T & { tokenCount: number; costUsd: number }> {
  const model = getSelectedModel() || undefined;
  const response = await fetch(`${API_BASE}/api/ai-agent/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentType, goal, context, model }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let result: (T & { tokenCount: number; costUsd: number }) | null = null;
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.content !== undefined) onToken(data.content);
        else if (data.result !== undefined) {
          const tokens = data.tokens || 0;
          const costUsd = data.costUsd || 0;
          addSessionTokens(tokens);
          addSessionCost(costUsd);
          result = { ...(data.result as T), tokenCount: tokens, costUsd };
        } else if (data.message !== undefined) throw new Error(data.message);
      } catch (e) {
        if (e instanceof Error && e.message && !e.message.includes("JSON")) throw e;
      }
    }
  }
  if (!result) throw new Error("No result received from agent");
  return result;
}

// ── Public agent helpers (matching VibeCoding.tsx call signatures) ────────────

export async function runOrchestrator(
  goal: string,
  onToken?: (token: string) => void
): Promise<OrchestratorResult> {
  const r = onToken
    ? await runAgentStreaming<OrchestratorResult>("orchestrator", goal, {}, onToken)
    : await runAgentRaw<OrchestratorResult>("orchestrator", goal, {});
  // Ensure strategy field is populated
  return { ...r, strategy: r.strategy || r.approach || r.understanding || "" };
}

export async function runStrategist(
  goal: string,
  orchResult: OrchestratorResult,
  onToken?: (token: string) => void
): Promise<StrategyResult> {
  const context = { orchestratorResult: orchResult };
  const r = onToken
    ? await runAgentStreaming<StrategyResult>("strategist", goal, context, onToken)
    : await runAgentRaw<StrategyResult>("strategist", goal, context);
  return { ...r, approach: r.approach || r.analysis || r.architecture || "" };
}

export async function runBuilder(
  goal: string,
  orchResult: OrchestratorResult,
  stratResult: StrategyResult,
  seedFiles: GeneratedFile[],
  onToken?: (token: string) => void
): Promise<BuildResult> {
  const context = {
    orchestratorResult: orchResult,
    strategyResult: stratResult,
    seedFiles: seedFiles.map(f => ({ path: f.path, content: f.content.slice(0, 8000) })),
    memory: buildBuildMemory([]),
  };
  return onToken
    ? runAgentStreaming<BuildResult>("builder", goal, context, onToken)
    : runAgentRaw<BuildResult>("builder", goal, context);
}

export async function runSpecialist(
  agentType: AgentType,
  goal: string,
  orchResult: OrchestratorResult,
  buildResult: BuildResult,
  onToken?: (token: string) => void
): Promise<SpecialistResult> {
  const context = {
    orchestratorResult: orchResult,
    buildResult: { files: buildResult.files.map(f => f.path), explanation: buildResult.explanation },
  };
  const r = onToken
    ? await runAgentStreaming<SpecialistResult>(agentType, goal, context, onToken)
    : await runAgentRaw<SpecialistResult>(agentType, goal, context);
  return { ...r, output: r.output || r.explanation || r.summary || "" };
}

export async function runReviewer(
  goal: string,
  files: GeneratedFile[],
  onToken?: (token: string) => void
): Promise<ReviewResult> {
  const context = { files: files.map(f => ({ path: f.path, content: f.content.slice(0, 2000) })) };
  const r = onToken
    ? await runAgentStreaming<ReviewResult>("reviewer", `Review code for goal: ${goal}`, context, onToken)
    : await runAgentRaw<ReviewResult>("reviewer", `Review code for goal: ${goal}`, context);
  return { ...r, issues: r.issues || [], summary: r.summary || "Review complete" };
}

export async function runFixer(
  goal: string,
  files: GeneratedFile[],
  reviewResult: ReviewResult,
  onToken?: (token: string) => void
): Promise<FixResult> {
  const context = {
    files: files.map(f => ({ path: f.path, content: f.content.slice(0, 2000) })),
    issues: reviewResult.issues,
    summary: reviewResult.summary,
  };
  const r = onToken
    ? await runAgentStreaming<FixResult>("fixer", `Fix issues for goal: ${goal}`, context, onToken)
    : await runAgentRaw<FixResult>("fixer", `Fix issues for goal: ${goal}`, context);
  return { ...r, files: r.files || [] };
}

export async function runRefiner(
  request: string,
  files: GeneratedFile[],
  onToken?: (token: string) => void
): Promise<RefineResult> {
  const context = { currentFiles: files };
  return onToken
    ? runAgentStreaming<RefineResult>("refiner", `User refinement: ${request}`, context, onToken)
    : runAgentRaw<RefineResult>("refiner", `User refinement: ${request}`, context);
}

// Legacy runAgent for components that haven't been updated yet
export async function runAgent<T>(agentType: AgentType, goal: string, context?: any): Promise<T> {
  return runAgentRaw<T>(agentType, goal, context) as unknown as T;
}

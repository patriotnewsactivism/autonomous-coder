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
  retryContext?: any;
}

export interface OrchestratorResult {
  understanding: string;
  approach: string;
  agentSequence: AgentType[];
  requiresDatabase: boolean;
  requiresAPI: boolean;
  requiresUI: boolean;
  requiresTesting: boolean;
  requiresSecurity: boolean;
  projectType: "webapp" | "component" | "api" | "fullstack" | "landing" | "dashboard";
  estimatedSteps: number;
  readyToStart: boolean;
}

export interface StrategyResult {
  analysis: string;
  architecture: string;
  tasks: AgentTask[];
  techStack: string[];
  estimatedComplexity: "simple" | "moderate" | "complex";
}

export interface BuildResult {
  files: GeneratedFile[];
  explanation: string;
  nextSteps: string[];
}

export interface ReviewResult {
  overallScore: number;
  issues: CodeIssue[];
  strengths: string[];
  summary: string;
}

export interface FixResult {
  fixes: Array<{
    issueId: string;
    file: string;
    originalCode: string;
    fixedCode: string;
    explanation: string;
  }>;
  additionalImprovements: Array<{
    file: string;
    improvement: string;
    code: string;
  }>;
  summary: string;
}

export interface RefineResult {
  files: GeneratedFile[];
  explanation: string;
  summary: string;
}

export interface SpecialistResult {
  files: GeneratedFile[];
  explanation: string;
  summary: string;
}

// ── Token tracking ────────────────────────────────────────────────────────────
export const SESSION_TOKENS_KEY = "acw_session_tokens";

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

export function resetSessionTokens() {
  try { localStorage.setItem(SESSION_TOKENS_KEY, "0"); } catch { /* noop */ }
}

// GPT-4o pricing: $2.50/1M input + $10/1M output — simplified to avg ~$6.25/1M
export function estimateCost(tokens: number): string {
  const cost = (tokens / 1_000_000) * 6.25;
  if (cost < 0.01) return "<$0.01";
  return `$${cost.toFixed(3)}`;
}

// ── API helpers ──────────────────────────────────────────────────────────────
async function apiRequest(endpoint: string, options?: RequestInit) {
  const response = await fetch(endpoint, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

export async function runAgent<T>(agentType: AgentType, goal: string, context?: any): Promise<T> {
  const data = await apiRequest("/api/ai-agent", {
    method: "POST",
    body: JSON.stringify({ agentType, goal, context }),
  });
  if (data.error) throw new Error(data.error);
  if (data.tokens) addSessionTokens(data.tokens);
  return data.result as T;
}

export async function runAgentStreaming<T>(
  agentType: AgentType,
  goal: string,
  context: any,
  onToken: (token: string) => void
): Promise<T> {
  const response = await fetch("/api/ai-agent/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentType, goal, context }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let result: T | null = null;
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
          result = data.result as T;
          if (data.tokens) addSessionTokens(data.tokens);
        }
        else if (data.message !== undefined) throw new Error(data.message);
      } catch (e) {
        if (e instanceof Error && e.message && !e.message.includes("JSON")) throw e;
      }
    }
  }

  if (!result) throw new Error("No result received from agent");
  return result;
}

// ── Helpers ────────────────────────────────────────────────────────────────
type TokenCb = (t: string) => void;

export async function runOrchestrator(goal: string, onToken?: TokenCb) {
  if (onToken) return runAgentStreaming<OrchestratorResult>("orchestrator", goal, {}, onToken);
  return runAgent<OrchestratorResult>("orchestrator", goal);
}

export async function runStrategist(goal: string, context?: any, onToken?: TokenCb) {
  if (onToken) return runAgentStreaming<StrategyResult>("strategist", goal, context || {}, onToken);
  return runAgent<StrategyResult>("strategist", goal, context);
}

export async function runBuilder(task: AgentTask, context?: any, onToken?: TokenCb) {
  const goal = `Build: ${task.title}\n\nDetails: ${task.description}`;
  if (onToken) return runAgentStreaming<BuildResult>("builder", goal, context || {}, onToken);
  return runAgent<BuildResult>("builder", goal, context);
}

export async function runSpecialist(
  agentType: AgentType,
  goal: string,
  context: any,
  onToken?: TokenCb
) {
  if (onToken) return runAgentStreaming<SpecialistResult>(agentType, goal, context, onToken);
  return runAgent<SpecialistResult>(agentType, goal, context);
}

export async function runReviewer(files: GeneratedFile[], onToken?: TokenCb) {
  if (onToken) return runAgentStreaming<ReviewResult>("reviewer", "Review the following code for issues", { files }, onToken);
  return runAgent<ReviewResult>("reviewer", "Review the following code for issues", { files });
}

export async function runFixer(issues: CodeIssue[], files: GeneratedFile[], onToken?: TokenCb) {
  if (onToken) return runAgentStreaming<FixResult>("fixer", "Fix the following issues in the code", { issues, files }, onToken);
  return runAgent<FixResult>("fixer", "Fix the following issues in the code", { issues, files });
}

export async function runRefiner(request: string, files: GeneratedFile[], onToken?: TokenCb) {
  const goal = `User refinement request: ${request}`;
  const context = { currentFiles: files };
  if (onToken) return runAgentStreaming<RefineResult>("refiner", goal, context, onToken);
  return runAgent<RefineResult>("refiner", goal, context);
}

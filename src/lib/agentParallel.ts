
// ── Parallel Build Types ────────────────────────────────────────────────────
export type WorkerStatus = "queued" | "running" | "done" | "failed" | "retrying";

export interface WorkerEvent {
  type: "worker:status" | "worker:thinking" | "worker:eval" | "worker:done"
      | "worker:failed" | "worker:retrying" | "worker:spawned"
      | "parallel:start" | "parallel:done" | "memory:stored" | "sandbox:update"
      | "superagent:progress" | "superagent:classified" | "superagent:classifying"
      | "superagent:epic:start" | "superagent:epic:done" | "superagent:done";
  jobId?: string;
  agent?: string;
  sessionId?: string;
  status?: WorkerStatus;
  score?: number;
  reason?: string;
  attempt?: number;
  count?: number;
  agents?: string[];
  error?: string;
  totalAgents?: number;
  avgScore?: number;
  message?: string;
  classification?: any;
}

export interface ParallelBuildResult {
  sessionId: string;
  results: Array<{
    jobId: string;
    agent: AgentType;
    status: WorkerStatus;
    output: any;
    score?: number;
    attempts: number;
    durationMs: number;
  }>;
  finalContext: any;
}

// ── SSE stream hook ─────────────────────────────────────────────────────────
export function createAgentEventSource(sessionId: string): EventSource | null {
  if (typeof window === "undefined") return null;
  const apiBase = (import.meta as any).env?.VITE_API_URL || "";
  return new EventSource(`${apiBase}/api/agent/stream/${sessionId}`);
}

// ── Parallel build runner ───────────────────────────────────────────────────
export async function runParallelBuild(
  goal: string,
  agentSequence: AgentType[],
  context: any = {},
  model?: string,
  sessionId?: string,
  onEvent?: (event: WorkerEvent) => void,
): Promise<ParallelBuildResult> {
  const sid = sessionId || crypto.randomUUID();
  const apiBase = (import.meta as any).env?.VITE_API_URL || "";

  // Set up SSE listener BEFORE starting the build
  let es: EventSource | null = null;
  if (onEvent) {
    es = createAgentEventSource(sid);
    if (es) {
      const eventTypes = [
        "worker:status", "worker:thinking", "worker:eval", "worker:done",
        "worker:failed", "worker:retrying", "worker:spawned",
        "parallel:start", "parallel:done"
      ];
      eventTypes.forEach(type => {
        es!.addEventListener(type, (e: MessageEvent) => {
          try { onEvent({ type: type as WorkerEvent["type"], ...JSON.parse(e.data) }); } catch { /* ignore malformed SSE data */ }
        });
      });
    }
  }

  try {
    const res = await fetch(`${apiBase}/api/agent/parallel-build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal, agentSequence, context, model, sessionId: sid }),
    });

    if (!res.ok) throw new Error(`Parallel build failed: ${res.statusText}`);
    const data: ParallelBuildResult = await res.json();
    return data;
  } finally {
    es?.close();
  }
}

// ── Session memory retrieval ────────────────────────────────────────────────
export async function fetchAgentMemory(sessionId: string) {
  const apiBase = (import.meta as any).env?.VITE_API_URL || "";
  const res = await fetch(`${apiBase}/api/agent/memory/${sessionId}`);
  if (!res.ok) return null;
  return res.json();
}


import { useState, useEffect, useRef, useCallback } from "react";
import { GeneratedFile, AgentType } from "./agents";
import { WorkerEvent } from "./agentParallel";

export type SandboxStatus =
  | "idle"
  | "connecting"
  | "building"
  | "evaluating"
  | "retrying"
  | "done"
  | "error";

export interface SandboxState {
  status: SandboxStatus;
  files: GeneratedFile[];
  buildLog: string[];
  workerEvents: WorkerEvent[];
  activeAgents: Set<AgentType>;
  completedAgents: AgentType[];
  agentScores: Record<string, number>;
  error: string | null;
  sessionId: string | null;
  totalAgents: number;
  avgScore: number;
}

const initialState: SandboxState = {
  status: "idle",
  files: [],
  buildLog: [],
  workerEvents: [],
  activeAgents: new Set(),
  completedAgents: [],
  agentScores: {},
  error: null,
  sessionId: null,
  totalAgents: 0,
  avgScore: 0,
};

export function useSandbox() {
  const [state, setState] = useState<SandboxState>(initialState);
  const esRef = useRef<EventSource | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const log = useCallback((line: string) => {
    setState(s => ({ ...s, buildLog: [...s.buildLog, line] }));
  }, []);

  // Connect to SSE stream for a given session
  const connectStream = useCallback((sessionId: string) => {
    // Close any existing connection
    esRef.current?.close();
    sessionIdRef.current = sessionId;

    const apiBase = (import.meta as any).env?.VITE_API_URL || "";
    const es = new EventSource(`${apiBase}/api/agent/stream/${sessionId}`);
    esRef.current = es;

    setState(s => ({ ...s, status: "connecting", sessionId, error: null }));
    log(`⚡ Connecting to agent stream (session: ${sessionId.slice(0, 8)}…)`);

    es.onopen = () => {
      setState(s => ({ ...s, status: "building" }));
      log("⚡ Stream connected — agents are initializing");
    };

    es.onerror = () => {
      // SSE auto-reconnects, only log if session was active
      if (sessionIdRef.current === sessionId) {
        log("🔄 Stream reconnecting…");
      }
    };

    // ── Worker lifecycle events ──────────────────────────────────────────────
    es.addEventListener("worker:status", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      if (ev.status === "running" && ev.agent) {
        setState(s => {
          const next = new Set(s.activeAgents);
          next.add(ev.agent as AgentType);
          return { ...s, activeAgents: next, workerEvents: [...s.workerEvents, ev] };
        });
        log(`🤖 [${ev.agent}] starting…`);
      }
    });

    es.addEventListener("worker:thinking", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      setState(s => ({ ...s, status: "building", workerEvents: [...s.workerEvents, ev] }));
      log(`🧠 [${ev.agent}] thinking${ev.attempt && ev.attempt > 1 ? ` (attempt ${ev.attempt})` : ""}…`);
    });

    es.addEventListener("worker:eval", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      setState(s => ({
        ...s,
        status: "evaluating",
        workerEvents: [...s.workerEvents, ev],
        agentScores: { ...s.agentScores, [ev.agent || ""]: ev.score || 0 },
      }));
      const bar = "█".repeat(Math.round((ev.score || 0))) + "░".repeat(10 - Math.round((ev.score || 0)));
      log(`📊 [${ev.agent}] self-eval: ${bar} ${ev.score}/10 — ${ev.reason || ""}`);
    });

    es.addEventListener("worker:retrying", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      setState(s => ({ ...s, status: "retrying", workerEvents: [...s.workerEvents, ev] }));
      log(`🔄 [${ev.agent}] score too low — retrying (attempt ${ev.attempt}): ${ev.reason || ""}`);
    });

    es.addEventListener("worker:done", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      setState(s => {
        const active = new Set(s.activeAgents);
        active.delete(ev.agent as AgentType);
        const completed = ev.agent && !s.completedAgents.includes(ev.agent as AgentType)
          ? [...s.completedAgents, ev.agent as AgentType]
          : s.completedAgents;
        return { ...s, activeAgents: active, completedAgents: completed, workerEvents: [...s.workerEvents, ev] };
      });
      log(`✅ [${ev.agent}] done — score: ${ev.score}/10`);
    });

    es.addEventListener("worker:failed", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      setState(s => {
        const active = new Set(s.activeAgents);
        active.delete(ev.agent as AgentType);
        return { ...s, activeAgents: active, workerEvents: [...s.workerEvents, ev] };
      });
      log(`❌ [${ev.agent}] failed: ${ev.error || "unknown"}`);
    });

    es.addEventListener("worker:spawned", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      setState(s => ({ ...s, workerEvents: [...s.workerEvents, ev] }));
      log(`🌿 Spawned ${ev.count} sub-workers: ${(ev.agents || []).join(", ")}`);
    });

    es.addEventListener("parallel:start", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      setState(s => ({ ...s, status: "building", workerEvents: [...s.workerEvents, ev] }));
      log(`⚡ Parallel build started`);
    });

    es.addEventListener("parallel:done", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      setState(s => ({
        ...s,
        status: "done",
        totalAgents: ev.totalAgents || 0,
        avgScore: ev.avgScore || 0,
        workerEvents: [...s.workerEvents, ev],
      }));
      log(`🏁 All ${ev.totalAgents} agents complete — avg score: ${ev.avgScore?.toFixed(1)}/10`);
    });

    // ── Sandbox file update event (backend emits this when builder writes files) ──
    es.addEventListener("sandbox:update", (e: MessageEvent) => {
      const { files }: { files: GeneratedFile[] } = JSON.parse(e.data);
      if (files?.length) {
        setState(s => {
          // Merge: update existing paths, append new ones
          const map = new Map(s.files.map(f => [f.path, f]));
          files.forEach(f => map.set(f.path, f));
          const merged = Array.from(map.values());
          return { ...s, files: merged };
        });
        log(`📁 Preview updated: ${files.map(f => f.path.split("/").pop()).join(", ")}`);
      }
    });

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [log]);

  // Inject files directly (for non-SSE builds using the existing agent pipeline)
  const injectFiles = useCallback((files: GeneratedFile[], append = true) => {
    setState(s => {
      if (!append) return { ...s, files };
      const map = new Map(s.files.map(f => [f.path, f]));
      files.forEach(f => map.set(f.path, f));
      return { ...s, files: Array.from(map.values()) };
    });
    if (files.length > 0) {
      log(`📁 Files loaded: ${files.map(f => f.path.split("/").pop()).join(", ")}`);
    }
  }, [log]);

  const setBuilding = useCallback((building: boolean) => {
    setState(s => ({ ...s, status: building ? "building" : "done" }));
    if (building) log("⚡ Build started");
  }, [log]);

  const reset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    sessionIdRef.current = null;
    setState(initialState);
  }, []);

  const addLog = useCallback((line: string) => log(line), [log]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { esRef.current?.close(); };
  }, []);

  return { state, connectStream, injectFiles, setBuilding, reset, addLog };
}

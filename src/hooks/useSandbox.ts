
import { useState, useEffect, useRef, useCallback } from "react";
import { GeneratedFile, AgentType } from "./agents";
import { WorkerEvent } from "./agentParallel";

export type SandboxStatus =
  | "idle"
  | "connecting"
  | "building"
  | "evaluating"
  | "retrying"
  | "observing"   // NEW: agent is reading preview errors
  | "correcting"  // NEW: agent is fixing based on what it observed
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
  previewErrors: string[];       // NEW: errors caught from iframe
  observationCount: number;       // NEW: how many self-correction loops ran
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
  previewErrors: [],
  observationCount: 0,
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

  // ── Iframe message listener (preview errors + ready) ──────────────────────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "preview:error") {
        const err = String(e.data.error || "Unknown preview error");
        setState(s => ({
          ...s,
          previewErrors: [...s.previewErrors, err],
        }));
        log(`⚠️ Preview error: ${err.slice(0, 120)}`);
      }
      if (e.data?.type === "preview:ready") {
        setState(s => ({
          ...s,
          previewErrors: s.previewErrors, // keep for observation loop
        }));
        log("👁️ Preview rendered successfully");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [log]);

  // ── SSE stream connection ─────────────────────────────────────────────────
  const connectStream = useCallback((sessionId: string) => {
    esRef.current?.close();
    sessionIdRef.current = sessionId;

    const apiBase = (import.meta as any).env?.VITE_API_URL || "";
    const es = new EventSource(`${apiBase}/api/agent/stream/${sessionId}`);
    esRef.current = es;

    setState(s => ({ ...s, status: "connecting", sessionId, error: null }));
    log(`⚡ Connecting to agent stream (session: ${sessionId.slice(0, 8)}…)`);

    es.onopen = () => {
      setState(s => ({ ...s, status: "building" }));
      log("⚡ Stream connected — agents initializing");
    };

    es.onerror = () => {
      if (sessionIdRef.current === sessionId) log("🔄 Stream reconnecting…");
    };

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
        ...s, status: "evaluating",
        workerEvents: [...s.workerEvents, ev],
        agentScores: { ...s.agentScores, [ev.agent || ""]: ev.score || 0 },
      }));
      const filled = Math.round(ev.score || 0);
      const bar = "█".repeat(filled) + "░".repeat(10 - filled);
      log(`📊 [${ev.agent}] self-eval: ${bar} ${ev.score}/10`);
    });

    es.addEventListener("worker:retrying", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      setState(s => ({ ...s, status: "retrying", workerEvents: [...s.workerEvents, ev] }));
      log(`🔄 [${ev.agent}] retrying (attempt ${ev.attempt}): ${ev.reason || ""}`);
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
      log("⚡ Parallel build started");
    });

    es.addEventListener("parallel:done", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      setState(s => ({
        ...s, status: "done",
        totalAgents: ev.totalAgents || 0,
        avgScore: ev.avgScore || 0,
        workerEvents: [...s.workerEvents, ev],
      }));
      log(`🏁 All ${ev.totalAgents} agents complete — avg score: ${ev.avgScore?.toFixed(1)}/10`);
    });

    es.addEventListener("sandbox:update", (e: MessageEvent) => {
      const { files }: { files: GeneratedFile[] } = JSON.parse(e.data);
      if (files?.length) {
        setState(s => {
          const map = new Map(s.files.map(f => [f.path, f]));
          files.forEach(f => map.set(f.path, f));
          return { ...s, files: Array.from(map.values()) };
        });
        log(`📁 Preview updated: ${files.map(f => f.path.split("/").pop()).join(", ")}`);
      }
    });

    es.addEventListener("debate:start", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      setState(s => ({ ...s, workerEvents: [...s.workerEvents, ev] }));
      log(`⚖️ Debate started: ${ev.operationType || "architectural"} change`);
    });

    es.addEventListener("debate:thinking", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      setState(s => ({ ...s, workerEvents: [...s.workerEvents, ev] }));
      log(`🤔 Debate ${ev.role} is thinking...`);
    });

    es.addEventListener("debate:argument", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      setState(s => ({ ...s, workerEvents: [...s.workerEvents, ev] }));
      log(`💬 Debate ${ev.role} presented argument`);
    });

    es.addEventListener("debate:verdict", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      setState(s => ({ ...s, workerEvents: [...s.workerEvents, ev] }));
      log(`⚖️ Debate concluded: ${ev.result?.verdict}`);
    });

    es.addEventListener("superagent:progress", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      log(`📋 ${ev.message || "Superagent progress"}`);
    });

    es.addEventListener("superagent:classified", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      log(`📋 Superagent classified: ${ev.classification?.title || "unknown"}`);
    });

    es.addEventListener("superagent:done", (e: MessageEvent) => {
      const ev: WorkerEvent = JSON.parse(e.data);
      setState(s => ({ ...s, status: "done" }));
      log(`🏁 Superagent done — ${ev.result?.summary || "task complete"}`);
    });

    return () => { es.close(); esRef.current = null; };
  }, [log]);

  // ── Inject files directly (non-SSE pipeline) ─────────────────────────────
  const injectFiles = useCallback((files: GeneratedFile[], append = true) => {
    if (!files?.length) return;
    setState(s => {
      if (!append) return { ...s, files };
      const map = new Map(s.files.map(f => [f.path, f]));
      files.forEach(f => map.set(f.path, f));
      return { ...s, files: Array.from(map.values()) };
    });
  }, []);

  // ── Clear preview errors (call before observation loop check) ─────────────
  const clearPreviewErrors = useCallback(() => {
    setState(s => ({ ...s, previewErrors: [] }));
  }, []);

  // ── Mark observation loop start/end ──────────────────────────────────────
  const startObserving = useCallback(() => {
    setState(s => ({
      ...s,
      status: "observing",
      observationCount: s.observationCount + 1,
    }));
    log(`👁️ Agent observing preview output (loop ${state.observationCount + 1})…`);
  }, [log, state.observationCount]);

  const startCorrecting = useCallback(() => {
    setState(s => ({ ...s, status: "correcting" }));
    log("🔧 Agent self-correcting based on preview errors…");
  }, [log]);

  const setBuilding = useCallback((building: boolean) => {
    setState(s => ({ ...s, status: building ? "building" : "done" }));
    if (building) log("⚡ Build started");
    else log("🏁 Build complete");
  }, [log]);

  const reset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    sessionIdRef.current = null;
    setState(initialState);
  }, []);

  const addLog = useCallback((line: string) => log(line), [log]);

  useEffect(() => () => { esRef.current?.close(); }, []);

  return {
    state,
    connectStream,
    injectFiles,
    clearPreviewErrors,
    startObserving,
    startCorrecting,
    setBuilding,
    reset,
    addLog,
  };
}

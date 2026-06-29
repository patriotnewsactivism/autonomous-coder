
import { AgentMessage, AgentType, WorkerEvent } from "@/lib/agents";
import AgentAvatar, { agentConfig } from "./AgentAvatar";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Zap, Check, X, RefreshCw, GitBranch, Star, ChevronDown, ChevronUp, Activity } from "lucide-react";
import { useState } from "react";

interface AgentActivityFeedProps {
  messages: AgentMessage[];
  workerEvents?: WorkerEvent[];
  isRunning?: boolean;
}

function WorkerEventRow({ event }: { event: WorkerEvent }) {
  const config = event.agent ? (agentConfig[event.agent as AgentType] || agentConfig.orchestrator) : agentConfig.orchestrator;
  const icons = {
    "worker:thinking": <Brain className="h-3 w-3 text-purple-400 animate-pulse" />,
    "worker:eval": <Star className="h-3 w-3 text-amber-400" />,
    "worker:done": <Check className="h-3 w-3 text-emerald-400" />,
    "worker:failed": <X className="h-3 w-3 text-red-400" />,
    "worker:retrying": <RefreshCw className="h-3 w-3 text-amber-400 animate-spin" />,
    "worker:spawned": <GitBranch className="h-3 w-3 text-cyan-400" />,
    "parallel:start": <Zap className="h-3 w-3 text-cyan-400" />,
    "parallel:done": <Activity className="h-3 w-3 text-emerald-400" />,
    "debate:start": <Activity className="h-3 w-3 text-fuchsia-400" />,
    "debate:thinking": <Brain className="h-3 w-3 text-fuchsia-400 animate-pulse" />,
    "debate:argument": <Activity className="h-3 w-3 text-amber-400" />,
    "debate:verdict": <Star className="h-3 w-3 text-emerald-400" />,
  } as Record<string, JSX.Element>;

  const labels = {
    "worker:thinking": `${event.agent} is thinking… (attempt ${event.attempt || 1})`,
    "worker:eval": `${event.agent} self-eval: ${event.score}/10 — ${event.reason || ""}`,
    "worker:done": `${event.agent} completed (score: ${event.score}/10)`,
    "worker:failed": `${event.agent} failed: ${event.error || "unknown"}`,
    "worker:retrying": `${event.agent} retrying (attempt ${event.attempt})… ${event.reason || ""}`,
    "worker:spawned": `Spawned ${event.count} sub-workers: ${(event.agents || []).join(", ")}`,
    "parallel:start": `Parallel build started`,
    "parallel:done": `All ${event.totalAgents} agents done — avg score ${event.avgScore?.toFixed(1)}/10`,
    "debate:start": `Debate started: ${event.operationType || "architectural"} change`,
    "debate:thinking": `Debate ${event.role} is thinking...`,
    "debate:argument": `Debate ${event.role} presented argument`,
    "debate:verdict": `Debate concluded: ${event.result?.verdict}`,
  } as Record<string, string>;

  const colors = {
    "worker:done": "border-l-emerald-500/50 bg-emerald-950/20",
    "worker:failed": "border-l-red-500/50 bg-red-950/20",
    "worker:retrying": "border-l-amber-500/50 bg-amber-950/20",
    "worker:spawned": "border-l-cyan-500/50 bg-cyan-950/20",
    "parallel:start": "border-l-cyan-500/50 bg-cyan-950/20",
    "parallel:done": "border-l-emerald-500/50 bg-emerald-950/20",
    "worker:eval": "border-l-amber-500/30 bg-amber-950/10",
    "worker:thinking": "border-l-purple-500/30 bg-purple-950/10",
    "debate:start": "border-l-fuchsia-500/30 bg-fuchsia-950/10",
    "debate:thinking": "border-l-fuchsia-500/30 bg-fuchsia-950/10",
    "debate:argument": "border-l-amber-500/30 bg-amber-950/10",
    "debate:verdict": "border-l-emerald-500/30 bg-emerald-950/10",
  } as Record<string, string>;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-start gap-2 p-2 rounded-lg border-l-2 ${colors[event.type] || "border-l-slate-500/30 bg-slate-900/20"}`}
    >
      <div className="mt-0.5 flex-shrink-0">{icons[event.type] || <Activity className="h-3 w-3 text-slate-400" />}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-slate-300 leading-relaxed truncate">{labels[event.type] || event.type}</p>
        {event.type === "worker:eval" && event.score !== undefined && (
          <div className="mt-1 flex items-center gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className={`h-1 w-3 rounded-full ${i < (event.score || 0) ? "bg-amber-400" : "bg-slate-700"}`} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

const AgentActivityFeed = ({ messages, workerEvents = [], isRunning }: AgentActivityFeedProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showWorkerEvents, setShowWorkerEvents] = useState(true);

  const toggle = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    return next;
  });

  const allItems = [
    ...messages.map(m => ({ ...m, _kind: "message" as const })),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Worker events panel */}
      {workerEvents.length > 0 && (
        <div className="border-b border-white/10">
          <button
            onClick={() => setShowWorkerEvents(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <GitBranch className="h-3 w-3 text-cyan-400" />
              Worker Events ({workerEvents.length})
            </span>
            {showWorkerEvents ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <AnimatePresence>
            {showWorkerEvents && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                className="overflow-hidden">
                <div className="px-3 pb-2 space-y-1 max-h-48 overflow-y-auto">
                  {workerEvents.slice(-20).map((ev, i) => (
                    <WorkerEventRow key={i} event={ev} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Message feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isRunning && messages.length === 0 && workerEvents.length === 0 && (
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Activity className="h-3 w-3 animate-pulse text-cyan-500" />
            Agents initializing…
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const config = agentConfig[msg.agent] || agentConfig.orchestrator;
            const isExpanded = expandedIds.has(msg.id);
            const isLong = msg.content.length > 200;
            const preview = isLong && !isExpanded ? msg.content.slice(0, 200) + "…" : msg.content;

            return (
              <motion.div key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-lg border p-2.5 ${
                  msg.type === "error" ? "border-red-500/30 bg-red-950/20" :
                  msg.type === "result" ? "border-emerald-500/20 bg-emerald-950/10" :
                  msg.type === "streaming" ? "border-cyan-500/20 bg-cyan-950/10" :
                  "border-white/5 bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <AgentAvatar agent={msg.agent} size="sm" isActive={msg.type === "streaming"} />
                  <span className={`text-[11px] font-semibold ${config.color}`}>{config.label}</span>
                  <span className="text-[10px] text-slate-600 ml-auto">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap break-words">{preview}</p>
                {isLong && (
                  <button onClick={() => toggle(msg.id)}
                    className="mt-1 text-[10px] text-cyan-500 hover:text-cyan-300 flex items-center gap-0.5">
                    {isExpanded ? <><ChevronUp className="h-3 w-3" />Show less</> : <><ChevronDown className="h-3 w-3" />Show more</>}
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AgentActivityFeed;

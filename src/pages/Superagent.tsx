
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Zap, Send, Loader2, CheckCircle, AlertTriangle,
  FileCode, BookOpen, PenTool, Map, Bug, Search, Database,
  Cpu, Rocket, ChevronDown, ChevronRight, Clock, Star,
  Layers, GitBranch, Activity, Sparkles, Terminal
} from "lucide-react";
import { useSandbox } from "@/hooks/useSandbox";
import SandboxPanel from "@/components/agents/SandboxPanel";
import Header from "@/components/Header";
import { getSelectedModel } from "@/lib/agents";

type TaskCategory = "code"|"research"|"write"|"plan"|"debug"|"review"|"design"|"automate"|"data"|"general";
type TaskComplexity = "simple"|"moderate"|"complex"|"epic";

interface TaskClassification {
  category: TaskCategory;
  complexity: TaskComplexity;
  title: string;
  reasoning: string;
  requiresAgentPipeline: boolean;
  suggestedAgents: string[];
  canAnswerDirectly: boolean;
  directAnswer?: string;
  subtasks?: string[];
  estimatedMinutes: number;
}

interface TaskResult {
  sessionId: string;
  classification: TaskClassification;
  output?: string;
  files?: any[];
  jobs?: any[];
  summary: string;
  durationMs: number;
}

const CATEGORY_META: Record<TaskCategory, { icon: any; color: string; label: string }> = {
  code:     { icon: FileCode,  color: "text-cyan-400",    label: "Code" },
  research: { icon: Search,    color: "text-blue-400",    label: "Research" },
  write:    { icon: PenTool,   color: "text-purple-400",  label: "Writing" },
  plan:     { icon: Map,       color: "text-amber-400",   label: "Planning" },
  debug:    { icon: Bug,       color: "text-red-400",     label: "Debug" },
  review:   { icon: Star,      color: "text-yellow-400",  label: "Review" },
  design:   { icon: Layers,    color: "text-pink-400",    label: "Design" },
  automate: { icon: Cpu,       color: "text-teal-400",    label: "Automate" },
  data:     { icon: Database,  color: "text-orange-400",  label: "Data" },
  general:  { icon: Brain,     color: "text-slate-400",   label: "General" },
};

const COMPLEXITY_META: Record<TaskComplexity, { color: string; label: string; desc: string }> = {
  simple:   { color: "text-emerald-400 bg-emerald-400/10",  label: "Simple",   desc: "Single-pass — done in seconds" },
  moderate: { color: "text-amber-400 bg-amber-400/10",      label: "Moderate", desc: "2-5 agents — done in minutes" },
  complex:  { color: "text-orange-400 bg-orange-400/10",    label: "Complex",  desc: "Full pipeline — deep build" },
  epic:     { color: "text-red-400 bg-red-400/10",          label: "Epic",     desc: "Exponential workers — massive scope" },
};

const EXAMPLE_TASKS = [
  "Build a full SaaS analytics dashboard with auth, charts, and team management",
  "Research the best architecture for a real-time multiplayer game backend",
  "Write a technical blog post about how large language models work",
  "Create a complete CI/CD pipeline for a Node.js app on AWS",
  "Debug why my React app re-renders 50 times on a single keypress",
  "Design the database schema for a social media platform at scale",
  "Build a Python web scraper that extracts job listings and sends daily email digests",
  "Plan a 6-month product roadmap for a B2B SaaS startup in fintech",
];

export default function Superagent() {
  const [goal, setGoal] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [classification, setClassification] = useState<TaskClassification | null>(null);
  const [result, setResult] = useState<TaskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const sandbox = useSandbox();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const apiBase = (import.meta as any).env?.VITE_API_URL || "";

  // Connect SSE stream for live agent events
  useEffect(() => {
    if (isRunning) {
      const cleanup = sandbox.connectStream(sessionId);
      return cleanup;
    }
  }, [isRunning, sessionId]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  }, [goal]);

  const runTask = async () => {
    if (!goal.trim() || isRunning) return;
    setIsRunning(true);
    setError(null);
    setClassification(null);
    setResult(null);
    sandbox.reset();
    sandbox.setBuilding(true);
    sandbox.addLog("⚡ Superagent activated");
    sandbox.addLog(`📋 Goal: ${goal.slice(0, 100)}${goal.length > 100 ? "…" : ""}`);

    try {
      const model = getSelectedModel();
      const res = await fetch(`${apiBase}/api/superagent/task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, model, sessionId }),
      });

      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data: TaskResult = await res.json();
      setResult(data);
      setClassification(data.classification);

      if (data.files?.length) {
        sandbox.injectFiles(data.files);
      }
      sandbox.setBuilding(false);
      sandbox.addLog(`🏁 Done in ${(data.durationMs / 1000).toFixed(1)}s — ${data.summary}`);
    } catch (err: any) {
      setError(err?.message || "Task failed");
      sandbox.addLog(`❌ ${err?.message}`);
      sandbox.setBuilding(false);
    } finally {
      setIsRunning(false);
    }
  };

  const hasFiles = (result?.files?.length || 0) > 0 || sandbox.state.files.length > 0;
  const catMeta = classification ? CATEGORY_META[classification.category] : null;
  const cxMeta = classification ? COMPLEXITY_META[classification.complexity] : null;

  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100 flex flex-col">
      <Header />

      <div className="flex-1 flex flex-col gap-6 p-4 md:p-6 max-w-screen-2xl mx-auto w-full">

        {/* Hero bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
            <Brain className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-semibold text-cyan-400">Superagent</span>
          </div>
          <p className="text-sm text-slate-500">Any task. Simple or complex. Fully autonomous.</p>
        </div>

        {/* Input */}
        <div className="relative">
          <div className={`rounded-2xl border transition-all ${isRunning ? "border-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.1)]" : "border-white/10 hover:border-white/20"} bg-[#0b1120] overflow-hidden`}>
            <textarea
              ref={textareaRef}
              value={goal}
              onChange={e => setGoal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runTask(); }}
              placeholder="Give me any task — build a SaaS app, research a topic, write a report, plan a product, debug code, design a system…"
              className="w-full bg-transparent px-4 sm:px-5 pt-4 sm:pt-5 pb-2 text-sm sm:text-base text-slate-200 placeholder-slate-600 resize-none outline-none min-h-[60px] sm:min-h-[80px] max-h-[160px] sm:max-h-[200px]"
              disabled={isRunning}
            />
            <div className="flex items-center justify-between px-5 pb-4 pt-1">
              <p className="text-[11px] text-slate-600">⌘+Enter to run</p>
              <button
                onClick={runTask}
                disabled={!goal.trim() || isRunning}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  goal.trim() && !isRunning
                    ? "bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/25"
                    : "bg-slate-800 text-slate-600 cursor-not-allowed"
                }`}
              >
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {isRunning ? "Working…" : "Run"}
              </button>
            </div>
          </div>

          {/* Example tasks */}
          {!goal && !isRunning && !result && (
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLE_TASKS.slice(0, 4).map((ex, i) => (
                <button key={i} onClick={() => setGoal(ex)}
                  className="text-[11px] text-slate-500 hover:text-slate-300 border border-white/5 hover:border-white/15 rounded-lg px-2.5 py-1.5 transition-all text-left truncate max-w-xs">
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Classification badge */}
        <AnimatePresence>
          {classification && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 flex-wrap">
              {catMeta && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 text-xs font-medium ${catMeta.color}`}>
                  <catMeta.icon className="h-3 w-3" />
                  {catMeta.label}
                </div>
              )}
              {cxMeta && (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cxMeta.color}`}>
                  {cxMeta.label} — {cxMeta.desc}
                </span>
              )}
              <span className="text-xs text-slate-500 font-medium">{classification.title}</span>
              {classification.estimatedMinutes > 0 && (
                <span className="text-xs text-slate-600 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> ~{classification.estimatedMinutes}m
                </span>
              )}
              {classification.suggestedAgents?.length > 0 && (
                <div className="flex items-center gap-1">
                  {classification.suggestedAgents.map(a => (
                    <span key={a} className="text-[10px] text-slate-600 bg-white/5 rounded px-1.5 py-0.5">{a}</span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content — result + sandbox side by side when files present */}
        <div className="flex-1 grid gap-4 md:grid-cols-2">

          {/* Result / output panel */}
          <div className="flex flex-col gap-4">
            {/* Text output */}
            {result?.output && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-[#0b1120] border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Completed in {(result.durationMs / 1000).toFixed(1)}s</span>
                </div>
                <div className="prose prose-invert prose-sm max-w-none">
                  <pre className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">{result.output}</pre>
                </div>
              </motion.div>
            )}

            {/* Agent jobs summary */}
            {result?.jobs && result.jobs.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-[#0b1120] border border-white/10 rounded-2xl p-4">
                <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
                  <GitBranch className="h-3 w-3" /> {result.jobs.length} agents ran
                </p>
                <div className="space-y-1.5">
                  {result.jobs.map((job: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className={`w-1.5 h-1.5 rounded-full ${job.status === "done" ? "bg-emerald-400" : "bg-red-400"}`} />
                      <span className="text-slate-400 font-mono">{job.agent}</span>
                      {job.score !== undefined && (
                        <div className="flex gap-0.5 ml-auto">
                          {Array.from({length:10}).map((_,k) => (
                            <div key={k} className={`h-1 w-2 rounded-sm ${k < job.score ? "bg-emerald-400" : "bg-slate-700"}`} />
                          ))}
                          <span className="text-slate-600 ml-1">{job.score}/10</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-950/30 border border-red-500/20 rounded-2xl p-4 text-sm text-red-400 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Build log when no file output */}
            {sandbox.state.buildLog.length > 0 && sandbox.state.files.length === 0 && (
              <div className="bg-[#0b1120] border border-white/10 rounded-2xl p-4 font-mono text-[11px] space-y-0.5 max-h-48 overflow-y-auto">
                {sandbox.state.buildLog.map((line, i) => (
                  <div key={i} className={`${line.startsWith("✅") ? "text-emerald-400" : line.startsWith("❌") ? "text-red-400" : line.startsWith("⚡") ? "text-cyan-400" : "text-slate-500"}`}>
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sandbox panel — always visible, shows idle state before files arrive */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="min-h-[500px]">
              <SandboxPanel
                files={sandbox.state.files.length > 0 ? sandbox.state.files : (result?.files || [])}
                status={sandbox.state.status}
                buildLog={sandbox.state.buildLog}
                workerEvents={sandbox.state.workerEvents}
                agentScores={sandbox.state.agentScores}
                activeAgents={sandbox.state.activeAgents}
                completedAgents={sandbox.state.completedAgents}
                previewErrors={sandbox.state.previewErrors}
                observationCount={sandbox.state.observationCount}
                error={sandbox.state.error}
                className="h-full"
              />
            </motion.div>
        </div>
      </div>
    </div>
  );
}

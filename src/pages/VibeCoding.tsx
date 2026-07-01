import { useState, useCallback, useRef, useEffect } from "react";
import {
  Sparkles, Activity, Brain, Github, History, Clock,
  Coins, RotateCcw, ChevronDown, ChevronLeft, DollarSign, Save,
  FolderGit2, AlertTriangle, Rocket, GitBranch, CheckCircle2,
  XCircle, Upload, RefreshCw, Eye, Terminal, Zap, Play,
  Info, ChevronUp, Minimize2, Maximize2
} from "lucide-react";
import Header from "@/components/Header";
import VibeInput, { BuildMode, ProjectType } from "@/components/agents/VibeInput";
import AgentSelector, { AgentPreset, PRESETS } from "@/components/agents/AgentSelector";
import CompactInput from "@/components/agents/CompactInput";
import AgentPipeline from "@/components/agents/AgentPipeline";
import AgentActivityFeed from "@/components/agents/AgentActivityFeed";
import TaskList from "@/components/agents/TaskList";
import CodeWorkspace from "@/components/agents/CodeWorkspace";
import ChatIteration from "@/components/agents/ChatIteration";
import GitHubConnect from "@/components/GitHubConnect";
import RepoImport from "@/components/RepoImport";
import SandboxPanel from "@/components/agents/SandboxPanel";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AgentType, AgentMessage, AgentTask, GeneratedFile,
  OrchestratorResult, StrategyResult, BuildResult, ReviewResult, FixResult,
  runOrchestrator, runStrategist, runBuilder, runSpecialist, runReviewer, runFixer,
  getSessionTokens, addSessionTokens, resetSessionTokens, estimateCost, SESSION_TOKENS_KEY,
  getSessionCost, resetSessionCost, formatCost,
  getSelectedModel, setSelectedModel, fetchModels, fetchProviderStatus,
  autoSave, getAutoSave, clearAutoSave, AutoSaveData,
  type ProviderStatusResult,
} from "@/lib/agents";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useSandbox } from "@/hooks/useSandbox";

interface ProjectHistory {
  id: number;
  goal: string;
  fileCount: number;
  createdAt: string;
}

const API_BASE = (import.meta as any).env?.VITE_API_URL || "";

// ── Deploy Panel ─────────────────────────────────────────────────────────────
function DeployPanel({ files, goal }: { files: GeneratedFile[]; goal: string }) {
  const [token, setToken] = useState(() => localStorage.getItem("gh_deploy_token") || "");
  const [repo, setRepo] = useState(() => localStorage.getItem("gh_deploy_repo") || "");
  const [commitMsg, setCommitMsg] = useState("");
  const [pushing, setPushing] = useState(false);
  const [lastCommit, setLastCommit] = useState<{ sha: string; url?: string } | null>(null);

  useEffect(() => {
    if (token) localStorage.setItem("gh_deploy_token", token);
  }, [token]);
  useEffect(() => {
    if (repo) localStorage.setItem("gh_deploy_repo", repo);
  }, [repo]);

  const push = async () => {
    if (!token || !repo) { toast.error("Enter your GitHub token and repo (owner/name)"); return; }
    if (!files.length) { toast.error("No files to push yet"); return; }
    setPushing(true);
    try {
      const res = await fetch(`${API_BASE}/api/github/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fullName: repo, files, message: commitMsg || `feat: autonomous coder — ${files.length} files` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLastCommit({ sha: data.commitSha?.slice(0, 7), url: data.url });
      toast.success(`✅ Pushed ${files.length} files to ${repo}`);
      setCommitMsg("");
    } catch (e: any) {
      toast.error(`Push failed: ${e.message}`);
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <input
          type="password"
          placeholder="GitHub Personal Access Token"
          value={token}
          onChange={e => setToken(e.target.value)}
          className="w-full text-xs bg-muted/40 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="text"
          placeholder="owner/repo-name"
          value={repo}
          onChange={e => setRepo(e.target.value)}
          className="w-full text-xs bg-muted/40 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="text"
          placeholder={`Commit message (optional)`}
          value={commitMsg}
          onChange={e => setCommitMsg(e.target.value)}
          className="w-full text-xs bg-muted/40 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <button
        onClick={push}
        disabled={pushing || !files.length}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {pushing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {pushing ? "Pushing…" : `Push ${files.length} file${files.length !== 1 ? "s" : ""} to GitHub`}
      </button>

      {lastCommit && (
        <div className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-400/10 rounded-lg px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Committed <code className="font-mono">{lastCommit.sha}</code></span>
          {lastCommit.url && (
            <a href={lastCommit.url} target="_blank" rel="noopener noreferrer" className="ml-auto underline opacity-70 hover:opacity-100">view</a>
          )}
        </div>
      )}

      {files.length === 0 && (
        <p className="text-[11px] text-muted-foreground text-center py-1">Run a build first to generate files</p>
      )}

      <div className="border-t border-border/40 pt-3">
        <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">One-click deploys (after push)</p>
        <div className="space-y-1.5">
          {[
            { name: "Vercel", url: "https://vercel.com/import", color: "text-foreground" },
            { name: "Render", url: "https://dashboard.render.com/select-repo", color: "text-teal-400" },
            { name: "Railway", url: "https://railway.app/new", color: "text-violet-400" },
            { name: "Netlify", url: "https://app.netlify.com/start", color: "text-cyan-400" },
          ].map(p => (
            <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/60 text-xs ${p.color} transition-colors`}>
              <Rocket className="h-3 w-3" />
              Deploy to {p.name}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── History Panel ────────────────────────────────────────────────────────────
function HistoryPanel({ history, onLoad }: { history: ProjectHistory[]; onLoad: (id: number) => void }) {
  if (!history.length) return (
    <p className="text-xs text-muted-foreground text-center py-8">No saved projects yet. Build something!</p>
  );
  return (
    <div className="space-y-2">
      {history.map(p => (
        <button key={p.id} onClick={() => onLoad(p.id)}
          className="w-full text-left px-3 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/60 border border-border/30 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-foreground truncate pr-2">{p.goal || "Untitled"}</span>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">{p.fileCount || 0} files</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            <span>{new Date(p.createdAt).toLocaleString()}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
const VibeCoding = () => {
  const qc = useQueryClient();
  const sandbox = useSandbox();

  const [isRunning, setIsRunning] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<AgentType | undefined>();
  const [completedAgents, setCompletedAgents] = useState<AgentType[]>([]);
  const [agentSequence, setAgentSequence] = useState<AgentType[]>([]);
  const [agentPreset, setAgentPreset] = useState<AgentPreset>("auto");
  const [customAgentList, setCustomAgentList] = useState<AgentType[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [currentTaskId, setCurrentTaskId] = useState<number | undefined>();
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [currentGoal, setCurrentGoal] = useState("");
  const [sessionTokens, setSessionTokens] = useState(getSessionTokens);
  const [sessionCost, setSessionCost] = useState(getSessionCost);
  const [lastProjectId, setLastProjectId] = useState<number | null>(null);
  const [selectedModel, setSelectedModelState] = useState(getSelectedModel);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelPricing, setModelPricing] = useState<Record<string, { input: number; output: number }>>({});
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [providerStatus, setProviderStatus] = useState<ProviderStatusResult | null>(null);
  const [buildMode, setBuildMode] = useState<BuildMode>("vibe");
  const [projectType, setProjectType] = useState<ProjectType | null>(null);
  const [rightTab, setRightTab] = useState<"preview" | "code" | "logs">("preview");
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [importPrompt, setImportPrompt] = useState("");
  const [bottomTab, setBottomTab] = useState<"activity" | "tasks" | "deploy" | "history" | "import" | "github">("activity");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const stopRef = useRef(false);
  const seedFilesRef = useRef<GeneratedFile[]>([]);
  const seedRepoRef = useRef<string>("");

  useEffect(() => {
    fetchModels().then((data) => {
      setAvailableModels(data.models);
      setModelPricing(data.pricing);
      if (!getSelectedModel() && data.default) {
        setSelectedModel(data.default);
        setSelectedModelState(data.default);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchProviderStatus().then(setProviderStatus).catch(() => {}); }, []);

  useEffect(() => {
    const handler = () => { setSessionTokens(getSessionTokens()); setSessionCost(getSessionCost()); };
    window.addEventListener("storage", handler);
    const interval = setInterval(handler, 2000);
    return () => { window.removeEventListener("storage", handler); clearInterval(interval); };
  }, []);

  // ── Autosave to localStorage + backend on every file change ─────────────
  useEffect(() => {
    if (generatedFiles.length === 0) return;
    autoSave({
      goal: currentGoal,
      files: generatedFiles,
      agentSequence: agentSequence as AgentType[],
      messages: messages.map(m => ({ agent: m.agent, type: m.type, content: m.content })),
      timestamp: Date.now(),
    });
    setAutoSaved(true);
    const t = setTimeout(() => setAutoSaved(false), 2000);
    return () => clearTimeout(t);
  }, [generatedFiles]);

  // Restore autosave on mount
  useEffect(() => {
    const saved = getAutoSave();
    if (saved?.files?.length && generatedFiles.length === 0) {
      if (Date.now() - saved.timestamp < 24 * 60 * 60 * 1000) {
        setGeneratedFiles(saved.files);
        setCurrentGoal(saved.goal || "");
        if (saved.agentSequence?.length) setAgentSequence(saved.agentSequence);
        toast.info("Restored auto-saved session");
      }
    }
  }, []);

  const { data: searchStatus } = useQuery<{ tavily: boolean; ddg: boolean } | null>({
    queryKey: ["/api/search/status"],
    queryFn: () => fetch(`${API_BASE}/api/search/status`).then(r => r.ok ? r.json() : null).catch(() => null),
    refetchOnWindowFocus: false,
    refetchInterval: 60000,
    initialData: null,
  });

  const { data: projectHistory = [] } = useQuery<ProjectHistory[]>({
    queryKey: ["/api/projects/recent"],
    queryFn: () => fetch(`${API_BASE}/api/projects/recent?limit=30`).then(r => r.json()),
    refetchOnWindowFocus: false,
    refetchInterval: 30000,
  });

  const saveMutation = useMutation({
    mutationFn: (data: { goal: string; files: GeneratedFile[]; agentSequence: AgentType[] }) =>
      fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/projects/recent"] });
      if (data?.id) setLastProjectId(data.id);
    },
  });

  const loadProject = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${id}`);
      const project = await res.json();
      setGeneratedFiles(project.files || []);
      setCurrentGoal(project.goal || "");
      setTasks([]); setMessages([]); setAgentSequence([]);
      setLastProjectId(id);
      toast.success("Project loaded");
    } catch { toast.error("Failed to load project"); }
  };

  const addMessage = useCallback((agent: AgentType, type: AgentMessage["type"], content: string, extras?: Partial<AgentMessage>) => {
    setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, agent, type, content, timestamp: new Date(), ...extras }]);
  }, []);

  const addStreamingMessage = useCallback((agent: AgentType) => {
    const id = `stream-${Date.now()}-${Math.random()}`;
    setMessages(prev => [...prev, { id, agent, type: "streaming", content: "", timestamp: new Date() }]);
    return (token: string) => setMessages(prev => prev.map(m => m.id === id ? { ...m, content: m.content + token } : m));
  }, []);

  const finalizeStreamingMessage = useCallback((agent: AgentType, finalContent: string) => {
    setMessages(prev => {
      const idx = [...prev].reverse().findIndex(m => m.agent === agent && m.type === "streaming");
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      return prev.map((m, i) => i === realIdx ? { ...m, type: "result", content: finalContent } : m);
    });
  }, []);

  // ── Main pipeline ─────────────────────────────────────────────────────────
  const runAutonomousAgents = useCallback(async (rawGoal: string, mode: BuildMode = "vibe", pt?: ProjectType) => {
    setIsRunning(true);
    setCurrentGoal(rawGoal);
    sandbox.setBuilding(true);
    sandbox.reset();
    sandbox.addLog("⚡ Build started");
    setBuildMode(mode);
    if (pt) setProjectType(pt);
    stopRef.current = false;
    setMessages([]); setTasks([]); setGeneratedFiles([]);
    setCompletedAgents([]); setAgentSequence([]);
    setLastProjectId(null);
    setRightTab("preview"); // Always show preview when build starts
    setBottomTab("activity");

    const seedFiles = seedFilesRef.current;
    const seedRepo = seedRepoRef.current;
    const seedHeader = seedFiles.length > 0
      ? `[IMPORTED REPOSITORY: ${seedRepo || "GitHub"}]\n${seedFiles.length} file(s) imported as starting codebase. Preserve structure. Seed files: ${seedFiles.map(f => f.path).join(", ")}\n\n`
      : "";
    const baseGoal = `${seedHeader}${rawGoal}`;
    const goal = mode === "superagent" && pt
      ? `[SUPERAGENT MODE - ${pt.label.toUpperCase()}]\nProject Type: ${pt.label}\nTech Stack: ${pt.techStack}\nSpecialization: ${pt.agentHint}\n\nUser Request: ${baseGoal}\n\nWork with FULL AUTONOMY. Build end-to-end. Produce production-ready, deployable code.`
      : baseGoal;

    resetSessionTokens();
    setSessionTokens(0);
    const allFiles: GeneratedFile[] = [...seedFiles];
    const tick = () => setSessionTokens(getSessionTokens());

    try {
      // STEP 1: Orchestrator
      setCurrentAgent("orchestrator");
      addMessage("orchestrator", "thinking", "Analyzing your request and designing agent strategy…");
      const orchStream = addStreamingMessage("orchestrator");
      let orchResult: OrchestratorResult;
      try {
        orchResult = await runOrchestrator(goal, orchStream);
        tick();
        finalizeStreamingMessage("orchestrator", orchResult.strategy);

        // ── Preset override: if user picked a specific pipeline, use it ──
        if (agentPreset !== "auto" && agentPreset !== "custom" && (PRESETS[agentPreset]?.agents?.length ?? 0) > 0) {
          orchResult = { ...orchResult, agentSequence: PRESETS[agentPreset].agents as AgentType[] };
        } else if (agentPreset === "custom" && customAgentList.length > 0) {
          orchResult = { ...orchResult, agentSequence: customAgentList };
        }

        // Safety guard — ensure agentSequence is always a valid array
        if (!Array.isArray(orchResult.agentSequence) || orchResult.agentSequence.length === 0) {
          orchResult = { ...orchResult, agentSequence: ["strategist", "builder", "reviewer", "fixer"] as AgentType[] };
        }

        setAgentSequence(orchResult.agentSequence);
        setCompletedAgents(prev => [...prev, "orchestrator"]);
        addMessage("orchestrator", "result", `Pipeline: ${orchResult.agentSequence.join(" → ")}`, { tokenCount: orchResult.tokenCount });
        if (stopRef.current) return;
      } catch (e: any) {
        addMessage("orchestrator", "error", e.message);
        throw e;
      }

      // STEP 2: Strategist
      setCurrentAgent("strategist");
      addMessage("strategist", "thinking", "Breaking down into concrete tasks…");
      const stratStream = addStreamingMessage("strategist");
      let stratResult: StrategyResult;
      try {
        stratResult = await runStrategist(goal, orchResult, stratStream);
        tick();
        finalizeStreamingMessage("strategist", stratResult.approach);
        setTasks(stratResult.tasks.map((t, i) => ({ ...t, id: i + 1, status: "pending" as const })));
        setCompletedAgents(prev => [...prev, "strategist"]);
        addMessage("strategist", "result", `${stratResult.tasks.length} tasks planned`, { tokenCount: stratResult.tokenCount });
        if (stopRef.current) return;
      } catch (e: any) {
        addMessage("strategist", "error", e.message);
        throw e;
      }

      // STEP 3: Builder (or SpawnEngine for epic complexity)
      setCurrentAgent("builder");
      const builderStream = addStreamingMessage("builder");
      let buildResult: BuildResult;

      // Epic mode: use parallel spawn for very large goals
      const isEpic = (orchResult as any).estimatedComplexity === "epic"
        || (orchResult.estimatedSteps && orchResult.estimatedSteps >= 8)
        || orchResult.agentSequence.length >= 7;

      if (isEpic && !stopRef.current) {
        addMessage("builder", "thinking", "⚡ Epic build detected — spawning parallel agent shards…");
        try {
          const [planRes, spawnCtxRes] = await Promise.all([
            fetch(`${API_BASE}/api/spawn/plan`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ goal, model: getSelectedModel() || undefined }),
            }),
            Promise.resolve(null),
          ]);
          const plan = await planRes.json();
          addMessage("builder", "thinking", `📦 ${plan.shards?.length || 0} parallel shards planned`);

          const execRes = await fetch(`${API_BASE}/api/spawn/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              plan,
              sessionId: `spawn-${Date.now()}`,
              goal,
              model: getSelectedModel() || undefined,
            }),
          });
          const { files: spawnedFiles } = await execRes.json();
          buildResult = {
            files: spawnedFiles || [],
            explanation: `Parallel spawn complete — ${spawnedFiles?.length || 0} files across ${plan.shards?.length} shards`,
            nextSteps: [],
            tokenCount: 0,
            costUsd: 0,
          };
        } catch (spawnErr: any) {
          addMessage("builder", "error", `Spawn failed, falling back to serial: ${spawnErr.message}`);
          // Fallback to normal builder
          buildResult = await runBuilder(goal, orchResult, stratResult, seedFiles, builderStream);
        }
      } else {
        try {
          buildResult = await runBuilder(goal, orchResult, stratResult, seedFiles, builderStream);
        tick();
        finalizeStreamingMessage("builder", `Generated ${buildResult.files.length} files`);
        if (buildResult.files.length > 0) {
          allFiles.push(...buildResult.files);
          setGeneratedFiles([...allFiles]);
          sandbox.injectFiles(buildResult.files);
        }
        setCompletedAgents(prev => [...prev, "builder"]);
        addMessage("builder", "result", `${buildResult.files.length} files generated`, { tokenCount: buildResult.tokenCount });
        if (stopRef.current) return;
      } catch (e: any) {
        addMessage("builder", "error", e.message);
        throw e;
      }
      } // end else (non-epic)

      // Merge spawn files if epic mode produced them
      if (buildResult.files.length > 0) {
        buildResult.files.forEach(f => {
          const idx = allFiles.findIndex(x => x.path === f.path);
          if (idx >= 0) allFiles[idx] = f;
          else allFiles.push(f);
        });
        setGeneratedFiles([...allFiles]);
        sandbox.injectFiles(buildResult.files);
        setCompletedAgents(prev => [...prev, "builder"]);
        addMessage("builder", "result", `${buildResult.files.length} files built`, { tokenCount: buildResult.tokenCount ?? 0 });
      }

      // STEP 4: Specialists (parallel)
      const specialists = orchResult.agentSequence.filter(a => !["orchestrator","strategist","builder","reviewer","fixer"].includes(a));
      if (specialists.length > 0 && !stopRef.current) {
        const specResults = await Promise.allSettled(
          specialists.map(async (spec) => {
            if (stopRef.current) return;
            setCurrentAgent(spec);
            const stream = addStreamingMessage(spec);
            try {
              const result = await runSpecialist(spec, goal, orchResult, buildResult, stream);
              tick();
              finalizeStreamingMessage(spec, result.output || `${spec} complete`);
              if (result.files?.length) {
                allFiles.push(...result.files);
                setGeneratedFiles([...allFiles]);
                sandbox.injectFiles(result.files);
              }
              setCompletedAgents(prev => [...prev, spec]);
              addMessage(spec, "result", result.output?.slice(0, 120) || "Complete", { tokenCount: result.tokenCount });
            } catch (e: any) {
              addMessage(spec, "error", e.message);
            }
          })
        );
      }

      if (stopRef.current) return;

      // STEP 5: Reviewer
      setCurrentAgent("reviewer");
      const reviewStream = addStreamingMessage("reviewer");
      let reviewResult: ReviewResult;
      try {
        reviewResult = await runReviewer(goal, allFiles, reviewStream);
        tick();
        finalizeStreamingMessage("reviewer", reviewResult.summary);
        setCompletedAgents(prev => [...prev, "reviewer"]);
        addMessage("reviewer", "result", reviewResult.summary, { tokenCount: reviewResult.tokenCount });
        if (stopRef.current) return;
      } catch (e: any) {
        addMessage("reviewer", "error", e.message);
        reviewResult = { issues: [], summary: "Review skipped", tokenCount: 0, costUsd: 0 };
      }

      // STEP 6: Fixer (if issues)
      if (reviewResult.issues?.length > 0 && !stopRef.current) {
        setCurrentAgent("fixer");
        const fixStream = addStreamingMessage("fixer");
        try {
          const fixResult: FixResult = await runFixer(goal, allFiles, reviewResult, fixStream);
          tick();
          finalizeStreamingMessage("fixer", `Fixed ${fixResult.files.length} files`);
          if (fixResult.files.length > 0) {
            fixResult.files.forEach(fix => {
              const idx = allFiles.findIndex(f => f.path === fix.path);
              if (idx >= 0) allFiles[idx] = { ...allFiles[idx], content: fix.fixedCode };
            });
            setGeneratedFiles([...allFiles]);
            sandbox.injectFiles(allFiles.filter(f => fixResult.files.some(fx => fx.path === f.path)));
          }
          setCompletedAgents(prev => [...prev, "fixer"]);
          addMessage("fixer", "result", `${fixResult.files.length} files patched`, { tokenCount: fixResult.tokenCount });
        } catch (e: any) {
          addMessage("fixer", "error", e.message);
        }
      }

      // ── STEP 7: AutoHeal — watch preview errors and self-correct ──
      const previewErrors = sandbox.state.previewErrors;
      if (previewErrors.length > 0 && allFiles.length > 0 && !stopRef.current) {
        setCurrentAgent("fixer" as AgentType);
        sandbox.startObserving();
        addMessage("fixer", "thinking", `🔍 Detected ${previewErrors.length} preview error(s) — auto-healing…`);
        try {
          const healRes = await fetch(`${API_BASE}/api/autoheal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: `build-${Date.now()}`,
              goal: rawGoal,
              files: allFiles,
              errors: previewErrors,
              model: getSelectedModel() || undefined,
              maxCycles: 3,
            }),
          });
          if (healRes.ok) {
            const healResult = await healRes.json();
            if (healResult.patchedFiles?.length) {
              healResult.patchedFiles.forEach((pf: any) => {
                const idx = allFiles.findIndex(f => f.path === pf.path);
                if (idx >= 0) allFiles[idx] = pf;
              });
              setGeneratedFiles([...allFiles]);
              sandbox.injectFiles(allFiles);
              sandbox.startCorrecting();
              addMessage("fixer", "result", `🩹 Auto-healed in ${healResult.cycles} cycle(s): ${healResult.learnings?.[0] || "errors fixed"}`);
            }
          }
        } catch (healErr: any) {
          addMessage("fixer", "error", `Auto-heal skipped: ${healErr.message}`);
        }
      }

      // ── STEP 8: AutoLearn — extract build wisdom for future sessions ──
      if (allFiles.length > 0 && !stopRef.current) {
        try {
          fetch(`${API_BASE}/api/autolearn`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              summary: {
                sessionId: `build-${Date.now()}`,
                goal: rawGoal,
                agentSequence: orchResult.agentSequence,
                agentScores: Object.fromEntries(
                  Object.entries(sandbox.state.agentScores)
                ),
                files: allFiles.slice(0, 5),
                healCycles: sandbox.state.observationCount,
                totalTokens: getSessionTokens(),
                success: true,
              },
              model: getSelectedModel() || undefined,
            }),
          }).catch(() => {}); // fire-and-forget
        } catch { /* non-critical */ }
      }

      // ── Complete ──
      setCurrentAgent(undefined);
      setTasks(prev => prev.map(t => ({ ...t, status: "completed" as const })));
      sandbox.setBuilding(false);

      // Save to backend
      if (allFiles.length > 0) {
        saveMutation.mutate({ goal: rawGoal, files: allFiles, agentSequence: orchResult.agentSequence });
      }

      const totalTok = getSessionTokens();
      addMessage("orchestrator", "result", `✅ Build complete — ${allFiles.length} files · ${totalTok.toLocaleString()} tokens · ${sandbox.state.observationCount} heal cycles`, { tokenCount: 0 });
      toast.success(`Build complete — ${allFiles.length} files generated`);

    } catch (e: any) {
      setCurrentAgent(undefined);
      sandbox.setBuilding(false);
      addMessage("orchestrator", "error", e.message || "Build failed");
      toast.error(`Build failed: ${e.message}`);

      // AutoLearn from failures too — this prevents repeat mistakes
      try {
        fetch(`${API_BASE}/api/autolearn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: {
              sessionId: `build-${Date.now()}`,
              goal: rawGoal,
              agentSequence: [],
              agentScores: {},
              files: [],
              healCycles: 0,
              totalTokens: getSessionTokens(),
              success: false,
            },
          }),
        }).catch(() => {});
      } catch { /* non-critical */ }
    } finally {
      setIsRunning(false);
      sandbox.setBuilding(false);
    }
  }, [addMessage, addStreamingMessage, finalizeStreamingMessage, sandbox]);

  const handleStop = () => { stopRef.current = true; setIsRunning(false); sandbox.setBuilding(false); toast.info("Build stopped"); };

  const handleImportFiles = (files: GeneratedFile[], repoName: string) => {
    seedFilesRef.current = files;
    seedRepoRef.current = repoName;
    toast.success(`Imported ${files.length} files from ${repoName} — describe what to build, debug, or upgrade`);
    setImportPrompt(`Analyze and upgrade ${repoName}: `);
    setBottomTab("activity");
    setShowImportDialog(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-14 flex flex-col" style={{ height: '100dvh', paddingTop: '56px' }}>

        {/* ── Top bar ── */}
        <div className="flex-shrink-0 border-b border-border/40 bg-background/95 backdrop-blur px-3 py-2">

          {/* Row 1: model + import + input + build button */}
          <div className="flex items-center gap-2">
            {/* Model selector — icon only on mobile */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowModelMenu(!showModelMenu)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-muted/40 border border-border/40 text-xs text-muted-foreground hover:bg-muted/60"
              >
                <Brain className="h-3.5 w-3.5 text-purple-400" />
                <span className="hidden sm:inline max-w-[100px] truncate">{selectedModel || "Model"}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {showModelMenu && (
                <div className="absolute top-full mt-1 left-0 z-50 min-w-[180px] bg-popover border border-border rounded-lg shadow-xl p-1 max-h-60 overflow-y-auto">
                  {availableModels.map(m => (
                    <button key={m} onClick={() => { setSelectedModel(m); setSelectedModelState(m); setShowModelMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-xs ${m === selectedModel ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Agent Pipeline Selector */}
            <AgentSelector
              value={agentPreset}
              customAgents={customAgentList}
              onChange={(preset, agents) => {
                setAgentPreset(preset);
                setCustomAgentList(agents as AgentType[]);
              }}
            />

            {/* Import Repo button */}
            <button
              onClick={() => setShowImportDialog(true)}
              className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors text-xs font-medium"
            >
              <FolderGit2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Import Repo</span>
            </button>

            {/* Main input — takes all remaining space */}
            <div className="flex-1 min-w-0">
              <CompactInput onSubmit={runAutonomousAgents} isRunning={isRunning} onStop={handleStop} initialValue={importPrompt} onInitialValueConsumed={() => setImportPrompt("")} />
            </div>

            {/* Activity panel toggle (mobile) */}
            <button
              onClick={() => setRightPanelOpen(v => !v)}
              className="md:hidden flex-shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-muted/40 border border-border/40 text-xs text-muted-foreground hover:bg-muted/60"
            >
              <Activity className="h-3.5 w-3.5" />
              {messages.length > 0 && <span className="text-[10px] bg-primary/20 text-primary rounded-full px-1">{messages.length}</span>}
            </button>
          </div>

          {/* Row 2: cost + status — scrollable on mobile */}
          <div className="flex items-center gap-2 mt-1.5 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/30 px-2 py-1 rounded-lg border border-border/30 flex-shrink-0">
              <DollarSign className="h-3 w-3 text-emerald-400" />
              <span className="font-mono">{formatCost(sessionCost)}</span>
              <span className="opacity-40">·</span>
              <Coins className="h-3 w-3 text-amber-400" />
              <span>{sessionTokens.toLocaleString()}</span>
              <button onClick={() => { resetSessionTokens(); resetSessionCost(); setSessionTokens(0); setSessionCost(0); }}>
                <RotateCcw className="h-2.5 w-2.5 ml-1 opacity-50 hover:opacity-100" />
              </button>
            </div>
            {searchStatus && (
              <div className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border flex-shrink-0 ${
                searchStatus.tavily ? "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" : "text-muted-foreground bg-muted/30 border-border/30"
              }`}>
                <span>{searchStatus.tavily ? "🔍 Live" : "🔍 DDG"}</span>
              </div>
            )}
            {autoSaved && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 flex-shrink-0">
                <Save className="h-3 w-3" /> Saved
              </span>
            )}
            {isRunning && (
              <span className="flex items-center gap-1 text-[11px] text-cyan-400 animate-pulse flex-shrink-0">
                <Zap className="h-3 w-3" /> Building…
              </span>
            )}
          </div>

          {/* Row 3: agent pipeline — scrollable */}
          <div className="mt-1.5 overflow-x-auto no-scrollbar">
            <AgentPipeline currentAgent={currentAgent} completedAgents={completedAgents} agentSequence={agentSequence} />
          </div>
        </div>

        {/* Provider warning */}
        {providerStatus && !providerStatus.anyConfigured && (
          <div className="flex-shrink-0 bg-amber-500/10 border-b border-amber-500/30 px-3 py-2 flex items-center gap-2 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>No AI providers configured — set a free Groq or Gemini key to start.</span>
          </div>
        )}

        {/* ── Main workspace ── */}
        <div className="flex-1 flex overflow-hidden min-h-0 relative">

          {/* LEFT / MAIN: Preview + Code + Logs */}
          <div className="flex flex-col flex-1 min-w-0 border-r border-border/40">
            {/* Tab bar */}
            <div className="flex-shrink-0 flex items-center gap-0.5 px-3 py-1.5 border-b border-border/40 bg-muted/20">
              {[
                { id: "preview", icon: Eye, label: "Preview" },
                { id: "code", icon: Terminal, label: "Code" },
                { id: "logs", icon: Activity, label: "Logs" },
              ].map(({ id, icon: Icon, label }) => (
                <button key={id} onClick={() => setRightTab(id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${rightTab === id ? "bg-background text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                {generatedFiles.length > 0 && <span>{generatedFiles.length} files</span>}
                {/* Show activity panel button on desktop */}
                <button
                  onClick={() => setRightPanelOpen(v => !v)}
                  className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md text-[11px] bg-muted/40 border border-border/40 hover:bg-muted/60"
                >
                  <Activity className="h-3 w-3" />
                  <span>{rightPanelOpen ? "Hide" : "Activity"}</span>
                  {rightPanelOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronDown className="h-3 w-3 rotate-[-90deg]" />}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
              {rightTab === "preview" && (
                <SandboxPanel
                  files={generatedFiles}
                  status={sandbox.state.status}
                  buildLog={sandbox.state.buildLog}
                  workerEvents={sandbox.state.workerEvents}
                  agentScores={sandbox.state.agentScores}
                  activeAgents={sandbox.state.activeAgents}
                  completedAgents={sandbox.state.completedAgents}
                  error={sandbox.state.error}
                  previewErrors={sandbox.state.previewErrors}
                  observationCount={sandbox.state.observationCount}
                  className="h-full"
                />
              )}
              {rightTab === "code" && (
                <div className="h-full overflow-auto">
                  <CodeWorkspace files={generatedFiles} onFilesUpdated={setGeneratedFiles} />
                </div>
              )}
              {rightTab === "logs" && (
                <div className="h-full overflow-auto bg-black/40 font-mono text-[11px] p-4 space-y-0.5">
                  {sandbox.state.buildLog.length === 0 && (
                    <p className="text-muted-foreground text-center py-8">Logs will appear here when a build starts</p>
                  )}
                  {sandbox.state.buildLog.map((line, i) => (
                    <div key={i} className="text-slate-300 leading-5">{line}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat iteration at bottom of main panel */}
            {generatedFiles.length > 0 && (
              <div className="flex-shrink-0 border-t border-border/40">
                <ChatIteration files={generatedFiles} onFilesUpdated={setGeneratedFiles} isAgentRunning={isRunning} />
              </div>
            )}
          </div>

          {/* RIGHT: Activity panel — always visible on desktop, overlay on mobile */}
          <div className={`flex-col min-h-0 bg-background border-l border-border/40 flex-shrink-0
            ${rightPanelOpen
              ? 'flex absolute inset-0 z-30 md:static md:inset-auto md:w-72'
              : 'hidden'}`}>
            {/* Panel header with close on mobile */}
            <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-border/40 bg-muted/20 md:hidden">
              <span className="text-sm font-medium text-foreground">Activity</span>
              <button onClick={() => setRightPanelOpen(false)} className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground">
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex-shrink-0 flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border/40 bg-muted/20">
              {[
                { id: "activity", icon: Activity, label: "Activity", hint: "Agent logs" },
                { id: "tasks", icon: Brain, label: "Tasks", hint: "Build tasks" },
                { id: "deploy", icon: Rocket, label: "Deploy", hint: "Push to GitHub" },
                { id: "history", icon: History, label: "History", hint: "Past projects" },
                { id: "import", icon: FolderGit2, label: "Import", hint: "Clone any repo" },
                { id: "github", icon: Github, label: "GitHub", hint: "Connect account" },
              ].map(({ id, icon: Icon, label, hint }) => (
                <button key={id} onClick={() => setBottomTab(id as any)}
                  title={hint}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${bottomTab === id ? "bg-background text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
                  <Icon className="h-3 w-3 flex-shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                  {id === "history" && projectHistory.length > 0 && (
                    <span className="bg-primary/20 text-primary rounded-full px-1 text-[9px]">{projectHistory.length}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-3">
              {bottomTab === "activity" && (
                <div className="space-y-3">
                  <AgentActivityFeed messages={messages} workerEvents={sandbox.state.workerEvents} isRunning={isRunning} />
                  {messages.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Agent activity appears here as your build runs</p>
                    </div>
                  )}
                </div>
              )}
              {bottomTab === "tasks" && (
                <div>
                  {tasks.length > 0
                    ? <TaskList tasks={tasks} currentTaskId={currentTaskId} />
                    : <p className="text-xs text-muted-foreground text-center py-8">Tasks appear after Strategist runs</p>
                  }
                </div>
              )}
              {bottomTab === "deploy" && (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-3">Push generated files directly to GitHub, then deploy in one click.</p>
                  <DeployPanel files={generatedFiles} goal={currentGoal} />
                </div>
              )}
              {bottomTab === "history" && (
                <HistoryPanel history={projectHistory} onLoad={loadProject} />
              )}
              {bottomTab === "import" && (
                <RepoImport onFilesLoaded={handleImportFiles} />
              )}
              {bottomTab === "github" && (
                <GitHubConnect onFilesLoaded={handleImportFiles} />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Import Repo Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderGit2 className="h-5 w-5" />
              Import Repository
            </DialogTitle>
          </DialogHeader>
          <RepoImport onFilesLoaded={handleImportFiles} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VibeCoding;

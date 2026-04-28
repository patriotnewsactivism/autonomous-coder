import { useState, useCallback, useRef, useEffect } from "react";
import { Sparkles, Activity, FileCode, Brain, Github, History, Clock, Link2, Check, Coins, RotateCcw, ChevronDown, DollarSign, Save } from "lucide-react";
import Header from "@/components/Header";
import VibeInput, { BuildMode, ProjectType } from "@/components/agents/VibeInput";
import AgentPipeline from "@/components/agents/AgentPipeline";
import AgentActivityFeed from "@/components/agents/AgentActivityFeed";
import TaskList from "@/components/agents/TaskList";
import CodeWorkspace from "@/components/agents/CodeWorkspace";
import ChatIteration from "@/components/agents/ChatIteration";
import GitHubConnect from "@/components/GitHubConnect";
import { toast } from "sonner";
import {
  AgentType, AgentMessage, AgentTask, GeneratedFile,
  OrchestratorResult, StrategyResult, BuildResult, ReviewResult, FixResult,
  runOrchestrator, runStrategist, runBuilder, runSpecialist, runReviewer, runFixer,
  getSessionTokens, addSessionTokens, resetSessionTokens, estimateCost, SESSION_TOKENS_KEY,
  getSessionCost, resetSessionCost, formatCost,
  getSelectedModel, setSelectedModel, fetchModels,
  autoSave, getAutoSave, clearAutoSave, AutoSaveData,
} from "@/lib/agents";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

interface ProjectHistory {
  id: number;
  goal: string;
  fileCount: number;
  createdAt: string;
}

const VibeCoding = () => {
  const qc = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<AgentType | undefined>();
  const [completedAgents, setCompletedAgents] = useState<AgentType[]>([]);
  const [agentSequence, setAgentSequence] = useState<AgentType[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [currentTaskId, setCurrentTaskId] = useState<number | undefined>();
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [activeTab, setActiveTab] = useState<"build" | "github" | "history">("build");
  const [sessionTokens, setSessionTokens] = useState(getSessionTokens);
  const [sessionCost, setSessionCost] = useState(getSessionCost);
  const [copiedLink, setCopiedLink] = useState(false);
  const [lastProjectId, setLastProjectId] = useState<number | null>(null);
  const [selectedModel, setSelectedModelState] = useState(getSelectedModel);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelPricing, setModelPricing] = useState<Record<string, { input: number; output: number }>>({});
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [buildMode, setBuildMode] = useState<BuildMode>("vibe");
  const [projectType, setProjectType] = useState<ProjectType | null>(null);
  const stopRef = useRef(false);

  // Fetch available models
  useEffect(() => {
    fetchModels().then((data) => {
      setAvailableModels(data.models);
      setModelPricing(data.pricing);
      if (!getSelectedModel() && data.default) {
        setSelectedModel(data.default);
        setSelectedModelState(data.default);
      }
    }).catch(() => { /* models endpoint not available yet */ });
  }, []);

  // Sync token/cost display on storage changes
  useEffect(() => {
    const handler = () => {
      setSessionTokens(getSessionTokens());
      setSessionCost(getSessionCost());
    };
    window.addEventListener("storage", handler);
    const interval = setInterval(handler, 2000); // Poll for streaming updates
    return () => { window.removeEventListener("storage", handler); clearInterval(interval); };
  }, []);

  // Auto-save on file/message changes
  useEffect(() => {
    if (generatedFiles.length > 0) {
      autoSave({
        goal: "",
        files: generatedFiles,
        agentSequence: agentSequence as AgentType[],
        messages: messages.map(m => ({ agent: m.agent, type: m.type, content: m.content })),
        timestamp: Date.now(),
      });
      setAutoSaved(true);
      const t = setTimeout(() => setAutoSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [generatedFiles, messages]);

  // Restore auto-save on mount
  useEffect(() => {
    const saved = getAutoSave();
    if (saved && saved.files.length > 0 && generatedFiles.length === 0) {
      const age = Date.now() - saved.timestamp;
      if (age < 24 * 60 * 60 * 1000) { // Less than 24h old
        setGeneratedFiles(saved.files);
        if (saved.agentSequence.length) setAgentSequence(saved.agentSequence);
        toast.info("Restored auto-saved project");
      }
    }
  }, []);

  const { data: projectHistory = [] } = useQuery<ProjectHistory[]>({
    queryKey: ["/api/projects/recent"],
    queryFn: () => fetch("/api/projects/recent?limit=20").then((r) => r.json()),
    refetchOnWindowFocus: false,
  });

  const saveMutation = useMutation({
    mutationFn: (data: { goal: string; files: GeneratedFile[]; agentSequence: AgentType[] }) =>
      fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/projects/recent"] });
      if (data?.id) setLastProjectId(data.id);
    },
  });

  const loadProject = async (id: number) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      const project = await res.json();
      setGeneratedFiles(project.files || []);
      setTasks([]); setMessages([]); setAgentSequence([]);
      setLastProjectId(id);
      setActiveTab("build");
      toast.success(`Loaded project`);
    } catch { toast.error("Failed to load project"); }
  };

  const copyShareLink = () => {
    if (!lastProjectId) return;
    const url = `${window.location.origin}/project/${lastProjectId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success("Share link copied!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // ── Message helpers ───────────────────────────────────────────────────────
  const addMessage = useCallback((agent: AgentType, type: AgentMessage["type"], content: string, extras?: Partial<AgentMessage>) => {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, agent, type, content, timestamp: new Date(), ...extras }]);
  }, []);

  const addStreamingMessage = useCallback((agent: AgentType) => {
    const id = `stream-${Date.now()}-${Math.random()}`;
    setMessages((prev) => [...prev, { id, agent, type: "streaming", content: "", timestamp: new Date() }]);
    return (token: string) => setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content: m.content + token } : m));
  }, []);

  const finalizeStreamingMessage = useCallback((agent: AgentType, finalContent: string) => {
    setMessages((prev) => {
      const idx = [...prev].reverse().findIndex((m) => m.agent === agent && m.type === "streaming");
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      return prev.map((m, i) => i === realIdx ? { ...m, type: "result", content: finalContent } : m);
    });
  }, []);

  // ── Main pipeline ─────────────────────────────────────────────────────────
  const runAutonomousAgents = useCallback(async (rawGoal: string, mode: BuildMode = "vibe", pt?: ProjectType) => {
    setIsRunning(true);
    setBuildMode(mode);
    if (pt) setProjectType(pt);
    stopRef.current = false;
    setMessages([]); setTasks([]); setGeneratedFiles([]);
    setCompletedAgents([]); setAgentSequence([]);
    setLastProjectId(null);

    // Enhance goal for AI Employee mode
    const goal = mode === "employee" && pt
      ? `[AI EMPLOYEE MODE - ${pt.label.toUpperCase()}]\nProject Type: ${pt.label}\nTech Stack: ${pt.techStack}\nSpecialization: ${pt.agentHint}\n\nUser Request: ${rawGoal}\n\nIMPORTANT: Work with FULL AUTONOMY. Build the complete project end-to-end. Make all technical decisions independently. Only flag critical business decisions. Produce production-ready, deployable code.`
      : rawGoal;
    resetSessionTokens();
    setSessionTokens(0);

    const allFiles: GeneratedFile[] = [];
    const tick = () => setSessionTokens(getSessionTokens());

    try {
      // STEP 1: Orchestrator
      setCurrentAgent("orchestrator");
      addMessage("orchestrator", "thinking", "Analyzing your goal and building the optimal agent pipeline...");
      const onOrchestratorToken = addStreamingMessage("orchestrator");

      let orchestration: OrchestratorResult;
      try {
        orchestration = await runOrchestrator(goal, onOrchestratorToken);
        tick();
      } catch {
        orchestration = {
          understanding: goal, approach: "Standard build pipeline",
          agentSequence: ["strategist", "builder", "reviewer", "fixer"],
          requiresDatabase: false, requiresAPI: false, requiresUI: false,
          requiresTesting: false, requiresSecurity: false,
          projectType: "webapp", estimatedSteps: 4, readyToStart: true,
        };
      }

      if (stopRef.current) return;
      const pipeline: AgentType[] = ["orchestrator", ...orchestration.agentSequence];
      setAgentSequence(pipeline);
      finalizeStreamingMessage("orchestrator", orchestration.understanding);
      setCompletedAgents(["orchestrator"]);

      // STEP 2: Strategist
      if (orchestration.agentSequence.includes("strategist")) {
        setCurrentAgent("strategist");
        addMessage("strategist", "thinking", "Creating architecture and task breakdown...");
        const onToken = addStreamingMessage("strategist");
        const strategy = await runStrategist(goal, undefined, onToken);
        if (stopRef.current) return;
        tick();
        setTasks(strategy.tasks.map((t) => ({ ...t, status: "pending" as const })));
        finalizeStreamingMessage("strategist", `${strategy.tasks.length} tasks · Stack: ${strategy.techStack.join(", ")} · Complexity: ${strategy.estimatedComplexity}`);
        setCompletedAgents((prev) => [...prev, "strategist"]);

        // Specialist agents
        for (const specialistType of ["database", "api", "ui"] as AgentType[]) {
          if (!orchestration.agentSequence.includes(specialistType)) continue;
          if (stopRef.current) return;
          setCurrentAgent(specialistType);
          const labels: Record<string, string> = { database: "Designing database schema...", api: "Building API routes...", ui: "Designing UI component system..." };
          addMessage(specialistType, "thinking", labels[specialistType]);
          const onSpecToken = addStreamingMessage(specialistType);
          try {
            const result = await runSpecialist(specialistType, `${specialistType} for: ${goal}`, { tasks: strategy.tasks, existingFiles: allFiles, techStack: strategy.techStack }, onSpecToken);
            tick();
            if (result.files) { allFiles.push(...result.files); setGeneratedFiles([...allFiles]); }
            finalizeStreamingMessage(specialistType, result.summary || result.explanation || `${specialistType} complete`);
          } catch { addMessage(specialistType, "error", `${specialistType} agent failed — continuing`, { retryable: false }); }
          setCompletedAgents((prev) => [...prev, specialistType]);
        }

        // STEP 3: Builder
        setCurrentAgent("builder");
        for (let i = 0; i < strategy.tasks.length; i++) {
          if (stopRef.current) return;
          const task = strategy.tasks[i];
          setCurrentTaskId(task.id);
          setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: "in_progress" as const } : t));
          addMessage("builder", "action", `Building: ${task.title}`);
          const onBuildToken = addStreamingMessage("builder");
          try {
            const buildResult = await runBuilder(task, { existingFiles: allFiles, techStack: strategy.techStack, goal }, onBuildToken);
            tick();
            if (buildResult.files) { allFiles.push(...buildResult.files); setGeneratedFiles([...allFiles]); }
            setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: "completed" as const } : t));
            finalizeStreamingMessage("builder", buildResult.explanation || `Done: ${task.title}`);
          } catch {
            setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: "failed" as const } : t));
            addMessage("builder", "error", `Failed: ${task.title}`, { retryable: true, retryGoal: task.title });
          }
        }
        setCompletedAgents((prev) => [...prev, "builder"]);

        // Post-build specialists
        for (const specialistType of ["testing", "security", "deployer"] as AgentType[]) {
          if (!orchestration.agentSequence.includes(specialistType) || allFiles.length === 0) continue;
          if (stopRef.current) return;
          setCurrentAgent(specialistType);
          const labels: Record<string, string> = { testing: "Writing test suite...", security: "Performing security audit...", deployer: "Generating deployment config..." };
          addMessage(specialistType, "thinking", labels[specialistType]);
          const onToken = addStreamingMessage(specialistType);
          try {
            const result = await runSpecialist(specialistType, `${specialistType} for: ${goal}`, { files: allFiles }, onToken);
            tick();
            if (result.files) { allFiles.push(...result.files); setGeneratedFiles([...allFiles]); }
            finalizeStreamingMessage(specialistType, result.summary || result.explanation || `${specialistType} complete`);
          } catch { addMessage(specialistType, "error", `${specialistType} agent failed — continuing`); }
          setCompletedAgents((prev) => [...prev, specialistType]);
        }

        // STEP 4: Reviewer
        if (!stopRef.current && allFiles.length > 0 && orchestration.agentSequence.includes("reviewer")) {
          setCurrentAgent("reviewer");
          addMessage("reviewer", "thinking", `Reviewing ${allFiles.length} files for quality...`);
          const onRevToken = addStreamingMessage("reviewer");
          const review = await runReviewer(allFiles, onRevToken);
          if (stopRef.current) return;
          tick();
          const criticals = review.issues?.filter((i) => i.severity === "critical").length || 0;
          const warnings = review.issues?.filter((i) => i.severity === "warning").length || 0;
          finalizeStreamingMessage("reviewer", `Score: ${review.overallScore}/10 · ${criticals} critical · ${warnings} warnings · ${review.summary}`);
          setCompletedAgents((prev) => [...prev, "reviewer"]);

          // STEP 5: Fixer
          if (orchestration.agentSequence.includes("fixer")) {
            setCurrentAgent("fixer");
            if (review.issues && review.issues.length > 0) {
              addMessage("fixer", "thinking", `Fixing ${review.issues.length} issues...`);
              const onFixToken = addStreamingMessage("fixer");
              const fixes = await runFixer(review.issues, allFiles, onFixToken);
              if (stopRef.current) return;
              tick();
              if (fixes.fixes) {
                const fixedFiles = allFiles.map((file) => {
                  const fix = fixes.fixes.find((f) => f.file === file.path);
                  return fix ? { ...file, content: fix.fixedCode } : file;
                });
                setGeneratedFiles(fixedFiles);
                allFiles.splice(0, allFiles.length, ...fixedFiles);
              }
              finalizeStreamingMessage("fixer", fixes.summary || `Applied ${fixes.fixes?.length || 0} fixes`);
            } else {
              addMessage("fixer", "result", "No issues to fix — code is production-ready! ✨");
            }
            setCompletedAgents((prev) => [...prev, "fixer"]);
          }
        }
      }

      // Save
      if (allFiles.length > 0) {
        saveMutation.mutate({ goal, files: allFiles, agentSequence: pipeline });
      }

      setCurrentAgent(undefined);
      const finalTokens = getSessionTokens();
      setSessionTokens(finalTokens);
      toast.success(`Build complete! ${allFiles.length} files · ${finalTokens.toLocaleString()} tokens used 🎉`);
    } catch (error) {
      addMessage(currentAgent || "orchestrator", "error", error instanceof Error ? error.message : "An error occurred");
      toast.error("Agent pipeline encountered an error");
    } finally {
      setIsRunning(false);
      setCurrentAgent(undefined);
      setCurrentTaskId(undefined);
    }
  }, [addMessage, addStreamingMessage, finalizeStreamingMessage, saveMutation]);

  const handleStop = useCallback(() => {
    stopRef.current = true;
    setIsRunning(false);
    setCurrentAgent(undefined);
    toast.info("Pipeline stopped");
  }, []);

  const handleRetry = useCallback((agent: AgentMessage["agent"], goal?: string) => {
    if (!goal) return;
    toast.info(`Retrying ${agent}...`);
    // For now, just re-run the whole pipeline with the original goal — full retry support
  }, []);

  const handleGitHubFilesLoaded = useCallback((files: GeneratedFile[], repoName: string) => {
    setGeneratedFiles(files);
    addMessage("reviewer", "action", `Loaded ${files.length} files from ${repoName}`);
    setActiveTab("build");
    toast.success(`Loaded ${files.length} files from GitHub`);
  }, [addMessage]);

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <Header />

      <main className="container mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-12 sm:pb-16">
        {/* Hero */}
        <section className="text-center mb-8 sm:mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 sm:px-4 py-1.5 sm:py-2 mb-4 sm:mb-6">
            <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
            <span className="text-xs sm:text-sm font-medium text-primary uppercase tracking-wide">
              Fully Autonomous · {agentSequence.length > 0 ? `${agentSequence.length} Agents Active` : "Up to 11 Agents"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 sm:mb-6 leading-tight px-2">
            {buildMode === "employee" ? <>Your AI <span className="text-emerald-400">Employee</span> is ready</> : <>Vibe code like a <span className="gradient-text-primary">beast</span></>}
          </h1>
          <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
            {buildMode === "employee" ? "Delegate your project. Full autonomy. Production-ready output." : "Describe your idea. The Orchestrator assembles the optimal agent team, then reviews and deploys."}
          </p>

          {/* Model selector + Cost tracker */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {/* Model Selector */}
            <div className="relative">
              <button
                onClick={() => setShowModelMenu(!showModelMenu)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/40 border border-border/40 text-xs text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <Brain className="h-3 w-3 text-purple-400" />
                <span>{selectedModel || "Select model"}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {showModelMenu && (
                <div className="absolute top-full mt-1 left-0 z-50 min-w-[200px] bg-popover border border-border rounded-lg shadow-lg p-1">
                  {availableModels.map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setSelectedModel(m);
                        setSelectedModelState(m);
                        setShowModelMenu(false);
                        toast.success(`Switched to ${m}`);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                        m === selectedModel ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <div className="font-medium">{m}</div>
                      {modelPricing[m] && (
                        <div className="text-[10px] text-muted-foreground">
                          ${modelPricing[m].input}/M in · ${modelPricing[m].output}/M out
                        </div>
                      )}
                    </button>
                  ))}
                  {availableModels.length <= 1 && (
                    <div className="px-3 py-2 text-[10px] text-muted-foreground">
                      Deploy more models in Azure to add them here
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Live Cost Badge */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/40 border border-border/40 text-xs text-muted-foreground"
            >
              <DollarSign className="h-3 w-3 text-emerald-400" />
              <span className="font-mono">{formatCost(sessionCost)}</span>
              <span className="text-muted-foreground/50">·</span>
              <Coins className="h-3 w-3 text-amber-400" />
              <span>{sessionTokens.toLocaleString()}</span>
              <button onClick={() => { resetSessionTokens(); resetSessionCost(); setSessionTokens(0); setSessionCost(0); }}
                className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                title="Reset counters"
              >
                <RotateCcw className="h-2.5 w-2.5" />
              </button>
            </motion.div>

            {/* Auto-save indicator */}
            {autoSaved && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] text-emerald-400"
              >
                <Save className="h-2.5 w-2.5" />
                <span>Saved</span>
              </motion.div>
            )}
          </div>
        </section>

        {/* Pipeline */}
        <section className="mb-6 sm:mb-8 overflow-x-auto">
          <AgentPipeline currentAgent={currentAgent} completedAgents={completedAgents} agentSequence={agentSequence} />
        </section>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 max-w-3xl mx-auto bg-muted/30 rounded-xl p-1 border border-border/40">
          {[
            { id: "build", icon: Sparkles, label: "Vibe Build" },
            { id: "github", icon: Github, label: "GitHub" },
            { id: "history", icon: History, label: "History" },
          ].map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setActiveTab(id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === id ? "bg-background text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"
              }`} data-testid={`tab-${id}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
              {id === "history" && projectHistory.length > 0 && (
                <span className="text-[9px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5">
                  {projectHistory.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Build Tab ── */}
        {activeTab === "build" && (
          <>
            <section className="max-w-3xl mx-auto mb-8 sm:mb-12">
              <VibeInput onSubmit={(goal, mode, pt) => runAutonomousAgents(goal, mode, pt)} isRunning={isRunning} onStop={handleStop} />
            </section>

            <div className="grid lg:grid-cols-3 gap-4 sm:gap-8">
              {/* Left */}
              <div className="space-y-4 sm:space-y-6 order-2 lg:order-1">
                <div className="glass-card rounded-xl border border-border/50 p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <Brain className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    <h3 className="text-sm sm:text-base font-semibold text-foreground">Tasks</h3>
                    <span className="ml-auto text-[10px] sm:text-xs text-muted-foreground">
                      {tasks.filter((t) => t.status === "completed").length}/{tasks.length}
                    </span>
                  </div>
                  {tasks.length > 0
                    ? <TaskList tasks={tasks} currentTaskId={currentTaskId} />
                    : <p className="text-xs sm:text-sm text-muted-foreground text-center py-6 sm:py-8">Tasks appear after Strategist runs</p>
                  }
                </div>

                <div className="glass-card rounded-xl border border-border/50 p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    <h3 className="text-sm sm:text-base font-semibold text-foreground">Agent Activity</h3>
                  </div>
                  <AgentActivityFeed messages={messages} currentAgent={currentAgent} onRetry={handleRetry} />
                </div>
              </div>

              {/* Right */}
              <div className="lg:col-span-2 order-1 lg:order-2 space-y-4 sm:space-y-6">
                <div className="glass-card rounded-xl border border-border/50 p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-4 sm:mb-6">
                    <FileCode className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    <h3 className="text-sm sm:text-base font-semibold text-foreground">Generated Code</h3>
                    <span className="ml-auto text-[10px] sm:text-xs text-muted-foreground">{generatedFiles.length} files</span>

                    {/* Share button */}
                    {lastProjectId && (
                      <button
                        onClick={copyShareLink}
                        className="flex items-center gap-1 text-[10px] sm:text-xs px-2 py-1 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary"
                        data-testid="button-share"
                      >
                        {copiedLink ? <Check className="h-3 w-3 text-emerald-400" /> : <Link2 className="h-3 w-3" />}
                        {copiedLink ? "Copied!" : "Share"}
                      </button>
                    )}
                  </div>
                  <CodeWorkspace files={generatedFiles} onFilesUpdated={setGeneratedFiles} />
                </div>

                <ChatIteration files={generatedFiles} onFilesUpdated={setGeneratedFiles} isAgentRunning={isRunning} />
              </div>
            </div>
          </>
        )}

        {/* ── GitHub Tab ── */}
        {activeTab === "github" && (
          <div className="max-w-2xl mx-auto">
            <GitHubConnect onFilesLoaded={handleGitHubFilesLoaded} />
          </div>
        )}

        {/* ── History Tab ── */}
        {activeTab === "history" && (
          <div className="max-w-2xl mx-auto space-y-3">
            <p className="text-xs text-muted-foreground mb-4 text-center">
              Load any previous build to continue working on it.
            </p>
            {projectHistory.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border/40 rounded-xl">
                <History className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No builds yet</p>
              </div>
            ) : (
              projectHistory.map((project) => (
                <motion.div key={project.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-xl border border-border/50 p-4 flex items-start gap-3 hover:border-primary/30 transition-all"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <FileCode className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{project.goal}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <FileCode className="h-3 w-3" /> {project.fileCount} files
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/project/${project.id}`); toast.success("Share link copied!"); }}
                      className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                      title="Copy share link"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => loadProject(project.id)}
                      className="text-xs text-primary hover:underline px-2 py-1 rounded hover:bg-primary/10 transition-colors"
                      data-testid={`button-load-project-${project.id}`}
                    >
                      Load
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground">
            Autonomous Code Wizard · Up to 11 Specialized AI Agents · Powered by GPT-4o
          </p>
        </div>
      </footer>
    </div>
  );
};

export default VibeCoding;

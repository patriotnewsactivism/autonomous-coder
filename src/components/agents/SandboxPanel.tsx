
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Monitor, Smartphone, Tablet, RefreshCw, AlertTriangle,
  Loader2, Terminal, Eye, Zap, Activity, FileCode, GitBranch,
  Star, ChevronRight, ChevronDown, Copy, Check, Maximize2, Minimize2,
  Brain, X, Play, Pause
} from "lucide-react";
import { GeneratedFile, AgentType } from "@/lib/agents";
import { WorkerEvent, WorkerStatus } from "@/lib/agentParallel";
import { SandboxStatus, SandboxState } from "@/hooks/useSandbox";

// ── Syntax highlighter (zero-dep) ─────────────────────────────────────────
function highlight(code: string, ext: string): string {
  let r = code.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  if (!["ts","tsx","js","jsx","css","json"].includes(ext)) return r;
  // comments
  r = r.replace(/(\/\/[^\n]*)/g, '<span class="text-slate-500 italic">$1</span>');
  r = r.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-slate-500 italic">$1</span>');
  // strings
  r = r.replace(/(&quot;[^&]*?&quot;|&#x27;[^&]*?&#x27;|`[^`]*?`)/g, '<span class="text-emerald-400">$1</span>');
  // keywords
  const kw = "import|export|default|const|let|var|function|return|if|else|for|while|class|interface|type|extends|implements|async|await|from|of|in|new|this|true|false|null|undefined|void|React|useState|useEffect|useCallback|useMemo|useRef";
  r = r.replace(new RegExp(`\\b(${kw})\\b`, "g"), '<span class="text-purple-400 font-medium">$1</span>');
  // JSX components
  r = r.replace(/&lt;(\/?[A-Z][a-zA-Z0-9]*)/g, '&lt;<span class="text-cyan-400">$1</span>');
  // numbers
  r = r.replace(/\b(\d+\.?\d*)\b/g, '<span class="text-amber-400">$1</span>');
  return r;
}

function ext(path: string) { return path.split(".").pop() || ""; }
function fileName(path: string) { return path.split("/").pop() || path; }
function dirName(path: string) { return path.split("/").slice(0, -1).join("/") || "root"; }

// ── File tree ──────────────────────────────────────────────────────────────
function FileTree({ files, selected, onSelect, newPaths }: {
  files: GeneratedFile[];
  selected: string;
  onSelect: (path: string) => void;
  newPaths: Set<string>;
}) {
  const grouped: Record<string, GeneratedFile[]> = {};
  files.forEach(f => {
    const dir = dirName(f.path);
    if (!grouped[dir]) grouped[dir] = [];
    grouped[dir].push(f);
  });

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  return (
    <div className="text-[11px] font-mono select-none">
      {Object.entries(grouped).map(([dir, dirFiles]) => (
        <div key={dir}>
          <button
            onClick={() => setCollapsed(c => { const n = new Set(c); if (n.has(dir)) { n.delete(dir); } else { n.add(dir); } return n; })}
            className="flex items-center gap-1 px-2 py-0.5 text-slate-500 hover:text-slate-300 w-full text-left"
          >
            {collapsed.has(dir) ? <ChevronRight className="h-3 w-3 flex-shrink-0" /> : <ChevronDown className="h-3 w-3 flex-shrink-0" />}
            <span>{dir}/</span>
          </button>
          {!collapsed.has(dir) && dirFiles.map(f => (
            <motion.button
              key={f.path}
              initial={newPaths.has(f.path) ? { backgroundColor: "rgba(6,182,212,0.15)" } : {}}
              animate={{ backgroundColor: "rgba(0,0,0,0)" }}
              transition={{ duration: 1.5 }}
              onClick={() => onSelect(f.path)}
              className={`flex items-center gap-1.5 px-4 py-0.5 w-full text-left hover:bg-white/5 transition-colors truncate ${selected === f.path ? "bg-cyan-500/10 text-cyan-400" : "text-slate-400"}`}
            >
              <FileCode className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{fileName(f.path)}</span>
              {newPaths.has(f.path) && <span className="ml-auto text-[9px] text-cyan-400 bg-cyan-400/10 px-1 rounded">new</span>}
            </motion.button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Preview iframe builder ─────────────────────────────────────────────────
function buildDoc(files: GeneratedFile[]): string {
  const htmlFile = files.find(f => f.path.endsWith(".html"));
  if (htmlFile) return htmlFile.content;

  const cssFiles = files.filter(f => f.path.endsWith(".css"));
  const tsxFiles = files
    .filter(f => /\.(tsx|jsx|js|ts)$/.test(f.path) && !f.path.includes(".test.") && !f.path.includes("server/"))
    .sort((a, b) => {
      const p = (x: string) => x.includes("App.") ? 0 : x.includes("main.") ? 1 : x.includes("index.") ? 2 : 3;
      return p(a.path) - p(b.path);
    });

  const cssContent = cssFiles.map(f => `<style>${f.content}</style>`).join("\n");
  const jsxContent = tsxFiles.map(f => {
    const c = f.content
      .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, "")
      .replace(/^import\s+type\s+.*?['"];?\s*$/gm, "")
      .replace(/^import\s+['"].*?['"];?\s*$/gm, "")
      .replace(/^export\s+default\s+/gm, "const _DefaultExport = ")
      .replace(/^export\s+\{[^}]*\};?\s*$/gm, "")
      .replace(/^export\s+(const|function|class|type|interface)\s+/gm, "$1 ")
      .replace(/:\s*React\.FC[^=]*/g, "").replace(/:\s*FC[^=]*/g, "")
      .replace(/<React\.Fragment>/g, "<>").replace(/<\/React\.Fragment>/g, "</>");
    return `// === ${f.path} ===\n${c}`;
  }).join("\n\n");

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Live Preview</title>
<script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;height:100%;font-family:'Inter',-apple-system,sans-serif;background:#0f172a;color:#f1f5f9}
#root{min-height:100vh}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}
@keyframes fadeSlideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fade-in{animation:fadeSlideIn 0.25s ease}
</style>
<script>
tailwind.config={darkMode:'class',theme:{extend:{colors:{
  primary:{DEFAULT:'#06b6d4',foreground:'#fff'},
  background:'#0f172a',foreground:'#f1f5f9',
  muted:{DEFAULT:'#1e293b',foreground:'#94a3b8'},
  border:'#334155',card:{DEFAULT:'#1e293b',foreground:'#f1f5f9'},
  secondary:{DEFAULT:'#1e293b',foreground:'#f1f5f9'},
  destructive:{DEFAULT:'#ef4444',foreground:'#fff'},
  accent:{DEFAULT:'#1e293b',foreground:'#f1f5f9'},
},fontFamily:{sans:['Inter','system-ui','sans-serif']}}}}
</script>
${cssContent}
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="react,typescript">
const {useState,useEffect,useCallback,useMemo,useRef,createContext,useContext,useReducer,Fragment}=React;
const {createRoot}=ReactDOM;
const cn=(...c)=>c.filter(Boolean).join(' ');

window.onerror=(msg,_s,_l,_c,err)=>{
  window.parent?.postMessage({type:'preview:error',error:err?.stack||String(msg)},'*');
};
window.addEventListener('unhandledrejection',e=>{
  window.parent?.postMessage({type:'preview:error',error:e.reason?.message||String(e.reason)},'*');
});

${jsxContent}

try{
  const AppComponent=typeof _DefaultExport!=='undefined'?_DefaultExport
    :typeof App!=='undefined'?App
    :()=>React.createElement('div',{className:'flex flex-col items-center justify-center min-h-screen gap-4 text-slate-500'},
      React.createElement('div',{className:'text-6xl'},'⚡'),
      React.createElement('p',{className:'text-sm font-medium text-slate-400'},'Agents are building…'),
      React.createElement('p',{className:'text-xs opacity-50'},'Preview updates as files arrive')
    );
  const root=createRoot(document.getElementById('root'));
  root.render(React.createElement(AppComponent));
  window.parent?.postMessage({type:'preview:ready'},'*');
}catch(e){
  window.parent?.postMessage({type:'preview:error',error:e?.stack||e?.message||String(e)},'*');
}
</script>
</body>
</html>`;
}


// ── Status badge ──────────────────────────────────────────────
function StatusBadge({ status, observationCount }: { status: SandboxStatus; observationCount?: number }) {
  const config: Record<SandboxStatus, { label: string; color: string; pulse: boolean; icon?: string }> = {
    idle:        { label: "Idle",           color: "text-slate-500",  pulse: false },
    connecting:  { label: "Connecting…",    color: "text-amber-400",  pulse: true  },
    building:    { label: "Building",       color: "text-cyan-400",   pulse: true  },
    evaluating:  { label: "Evaluating",     color: "text-purple-400", pulse: true  },
    retrying:    { label: "Retrying",       color: "text-amber-400",  pulse: true  },
    observing:   { label: "Observing",      color: "text-blue-400",   pulse: true,  icon: "👁️" },
    correcting:  { label: "Self-Correcting",color: "text-orange-400", pulse: true,  icon: "🔧" },
    done:        { label: "Live",           color: "text-emerald-400",pulse: false, icon: "⚡" },
    error:       { label: "Error",          color: "text-red-400",    pulse: false },
  };
  const c = config[status] || config.idle;
  return (
    <span className={`flex items-center gap-1.5 text-[11px] font-medium ${c.color}`}>
      {c.icon
        ? <span className="text-[11px]">{c.icon}</span>
        : <span className={`inline-block w-1.5 h-1.5 rounded-full bg-current ${c.pulse ? "animate-pulse" : ""}`} />
      }
      {c.label}
      {observationCount !== undefined && observationCount > 0 && (
        <span className="ml-0.5 text-[9px] opacity-60">(loop {observationCount})</span>
      )}
    </span>
  );
}

// ── Main SandboxPanel ─────────────────────────────────────────────────────
interface SandboxPanelProps {
  files: GeneratedFile[];
  status: SandboxStatus;
  buildLog: string[];
  workerEvents: WorkerEvent[];
  agentScores: Record<string, number>;
  activeAgents: Set<AgentType>;
  completedAgents: AgentType[];
  error?: string | null;
  previewErrors?: string[];
  observationCount?: number;
  className?: string;
}

type PanelTab = "preview" | "code" | "log" | "agents";
type Viewport = "desktop" | "tablet" | "mobile";

const VIEWPORTS: Record<Viewport, { width: string; icon: any; label: string }> = {
  desktop: { width: "100%",  icon: Monitor,    label: "Desktop" },
  tablet:  { width: "768px", icon: Tablet,     label: "Tablet" },
  mobile:  { width: "390px", icon: Smartphone, label: "Mobile" },
};

export default function SandboxPanel({
  files, status, buildLog, workerEvents, agentScores,
  activeAgents, completedAgents, error, previewErrors = [], observationCount = 0, className = ""
}: SandboxPanelProps) {
  const [tab, setTab] = useState<PanelTab>("preview");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [newPaths, setNewPaths] = useState<Set<string>>(new Set());
  const [fullscreen, setFullscreen] = useState(false);
  const prevFilesLen = useRef(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Track newly-arrived files for highlighting
  useEffect(() => {
    if (files.length > prevFilesLen.current) {
      const incoming = files.slice(prevFilesLen.current).map(f => f.path);
      setNewPaths(new Set(incoming));
      setTimeout(() => setNewPaths(new Set()), 3000);
      prevFilesLen.current = files.length;

      // Auto-select first file if none selected
      if (!selectedFile && incoming.length > 0) setSelectedFile(incoming[0]);

      // Auto-refresh preview
      setPreviewReady(false);
      setPreviewError(null);
      setRefreshKey(k => k + 1);
    }
  }, [files.length, selectedFile]);

  // Auto-scroll build log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [buildLog.length]);

  // Listen for iframe messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "preview:ready") setPreviewReady(true);
      if (e.data?.type === "preview:error") {
        setPreviewError(e.data.error);
        setPreviewReady(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const activeFile = files.find(f => f.path === selectedFile);
  const doc = buildDoc(files);
  const vp = VIEWPORTS[viewport];
  const isActive = status !== "idle" && status !== "done" && status !== "error";

  const copyCode = async () => {
    if (!activeFile) return;
    await navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs: Array<{ id: PanelTab; label: string; icon: any; badge?: number }> = [
    { id: "preview", label: "Preview",   icon: Eye, badge: previewErrors.length > 0 ? previewErrors.length : undefined },
    { id: "code",    label: "Code",      icon: FileCode,  badge: files.length || undefined },
    { id: "log",     label: "Build Log", icon: Terminal,  badge: buildLog.length || undefined },
    { id: "agents",  label: "Agents",    icon: Brain,     badge: completedAgents.length || undefined },
  ];

  return (
    <div className={`flex flex-col bg-[#080d18] rounded-2xl border border-white/8 overflow-hidden shadow-2xl ${fullscreen ? "fixed inset-4 z-50" : ""} ${className}`}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 px-3 py-2 border-b border-white/8 bg-[#0b1120] flex-shrink-0">
        {/* Tab bar */}
        <div className="flex items-center gap-0.5 flex-1 overflow-x-auto pb-1 sm:pb-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${tab === t.id ? "bg-cyan-500/15 text-cyan-400 shadow-sm" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}>
              <t.icon className="h-3 w-3" />
              {t.label}
              {t.badge !== undefined && (
                <span className={`ml-0.5 px-1 rounded-full text-[9px] ${tab === t.id ? "bg-cyan-500/30 text-cyan-300" : "bg-slate-700 text-slate-400"}`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Viewport (preview only) */}
        {tab === "preview" && (
          <div className="flex items-center gap-0.5 border border-white/10 rounded-lg p-0.5">
            {(Object.entries(VIEWPORTS) as [Viewport, any][]).map(([vKey, v]) => (
              <button key={vKey} onClick={() => setViewport(vKey)}
                title={v.label}
                className={`p-1 rounded transition-colors ${viewport === vKey ? "bg-white/10 text-slate-200" : "text-slate-600 hover:text-slate-300"}`}>
                <v.icon className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}

        {/* Status + controls */}
        <div className="flex items-center gap-2">
          <StatusBadge status={status} observationCount={observationCount} />
          {tab === "preview" && (
            <button onClick={() => { setPreviewReady(false); setPreviewError(null); setRefreshKey(k => k+1); }}
              className="p-1 rounded text-slate-600 hover:text-slate-300 transition-colors" title="Refresh">
              <RefreshCw className={`h-3 w-3 ${isActive ? "animate-spin" : ""}`} />
            </button>
          )}
          <button onClick={() => setFullscreen(f => !f)}
            className="p-1 rounded text-slate-600 hover:text-slate-300 transition-colors">
            {fullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence mode="wait">

          {/* PREVIEW TAB */}
          {tab === "preview" && (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full flex items-start justify-center overflow-auto bg-slate-950 p-3">
              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-4">
                  <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                    className="text-6xl">⚡</motion.div>
                  <p className="text-sm font-medium text-slate-500">Live preview will appear as agents write files</p>
                  <p className="text-xs opacity-50">Hot-reload on every file update</p>
                </div>
              ) : (
                <div className="relative h-full transition-all duration-300" style={{ width: vp.width, maxWidth: "100%" }}>
                  {!previewReady && (
                    <div className="absolute inset-0 bg-[#0f172a] flex items-center justify-center z-10 rounded-xl">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
                        <span className="text-xs">Rendering preview…</span>
                      </div>
                    </div>
                  )}
                  {previewError && previewReady && (
                    <div className="absolute top-2 left-2 right-2 z-20">
                      <div className="bg-red-950/80 border border-red-500/30 rounded-lg p-3 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-red-400 text-xs font-medium mb-1">
                          <AlertTriangle className="h-3 w-3" /> Preview Error
                          <button onClick={() => setPreviewError(null)} className="ml-auto"><X className="h-3 w-3" /></button>
                        </div>
                        <pre className="text-red-300 text-[10px] overflow-auto max-h-24 whitespace-pre-wrap">{previewError}</pre>
                      </div>
                    </div>
                  )}
                  <iframe
                    key={refreshKey}
                    srcDoc={doc}
                    sandbox="allow-scripts allow-same-origin allow-forms"
                    className="w-full rounded-xl border border-white/5 fade-in"
                    style={{ height: "100%", minHeight: 500, background: "#0f172a" }}
                    title="Live Preview"
                    onLoad={() => setTimeout(() => setPreviewReady(true), 200)}
                  />
                </div>
              )}
            </motion.div>
          )}

          {/* CODE TAB */}
          {tab === "code" && (
            <motion.div key="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col sm:flex-row h-full">
              {/* File tree sidebar */}
              <div className="w-full sm:w-44 h-1/3 sm:h-full flex-shrink-0 border-b sm:border-b-0 sm:border-r border-white/8 overflow-y-auto py-2">
                {files.length === 0
                  ? <p className="px-3 py-4 text-[10px] text-slate-600">No files yet</p>
                  : <FileTree files={files} selected={selectedFile} onSelect={setSelectedFile} newPaths={newPaths} />
                }
              </div>
              {/* Code viewer */}
              <div className="flex-1 overflow-auto relative h-2/3 sm:h-full">
                {activeFile ? (
                  <>
                    <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-white/8 bg-[#080d18]/90 backdrop-blur-sm">
                      <span className="text-[11px] text-cyan-400 font-mono">{activeFile.path}</span>
                      <span className="ml-auto text-[10px] text-slate-600">{activeFile.content.split("\n").length} lines</span>
                      <button onClick={copyCode} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre className="p-4 text-[11px] font-mono leading-5 overflow-auto"
                      dangerouslySetInnerHTML={{ __html: highlight(activeFile.content, ext(activeFile.path)) }}
                    />
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-600 text-sm">
                    Select a file to view
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* BUILD LOG TAB */}
          {tab === "log" && (
            <motion.div key="log" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full overflow-y-auto p-3 font-mono space-y-px">
              {buildLog.length === 0
                ? <div className="flex items-center justify-center h-full text-slate-700 text-xs">No build activity yet</div>
                : buildLog.map((line, i) => (
                  <div key={i} className={`text-[11px] leading-5 flex gap-2 ${
                    line.startsWith("✅") ? "text-emerald-400" :
                    line.startsWith("❌") ? "text-red-400" :
                    line.startsWith("⚡") ? "text-cyan-400" :
                    line.startsWith("🔄") ? "text-amber-400" :
                    line.startsWith("🧠") ? "text-purple-400" :
                    line.startsWith("📊") ? "text-amber-300" :
                    line.startsWith("🌿") ? "text-teal-400" :
                    line.startsWith("🏁") ? "text-emerald-300" :
                    "text-slate-500"
                  }`}>
                    <span className="text-slate-700 flex-shrink-0">{String(i+1).padStart(3,"0")}</span>
                    <span className="whitespace-pre-wrap break-all">{line}</span>
                  </div>
                ))
              }
              <div ref={logEndRef} />
            </motion.div>
          )}

          {/* AGENTS TAB */}
          {tab === "agents" && (
            <motion.div key="agents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full overflow-y-auto p-3 space-y-2">
              {/* Active agents */}
              {activeAgents.size > 0 && (
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Active</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(activeAgents).map(a => (
                      <div key={a} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-[11px] text-cyan-400">
                        <Activity className="h-3 w-3 animate-pulse" />{a}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Completed agents with scores */}
              {completedAgents.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2 mt-3">Completed</p>
                  <div className="space-y-1.5">
                    {completedAgents.map(a => {
                      const score = agentScores[a];
                      return (
                        <div key={a} className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] border border-white/5 rounded-lg">
                          <Check className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                          <span className="text-[11px] text-slate-300 font-medium">{a}</span>
                          {score !== undefined && (
                            <div className="ml-auto flex items-center gap-1.5">
                              <div className="flex gap-0.5">
                                {Array.from({length:10}).map((_,i) => (
                                  <div key={i} className={`h-1.5 w-2 rounded-sm ${i < score ? "bg-emerald-400" : "bg-slate-700"}`} />
                                ))}
                              </div>
                              <span className="text-[10px] text-slate-500">{score}/10</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Recent worker events */}
              {workerEvents.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2 mt-3">Event Stream</p>
                  <div className="space-y-1">
                    {workerEvents.slice(-15).map((ev, i) => (
                      <div key={i} className="text-[10px] text-slate-500 flex items-center gap-1.5">
                        <span className="text-slate-700">›</span>
                        <span className={`${ev.type.includes("done") ? "text-emerald-500" : ev.type.includes("fail") ? "text-red-500" : ev.type.includes("eval") ? "text-amber-500" : "text-slate-500"}`}>
                          [{ev.agent || "system"}]
                        </span>
                        <span>{ev.type.replace("worker:", "").replace("parallel:", "parallel ")}</span>
                        {ev.score !== undefined && <span className="text-amber-500">{ev.score}/10</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeAgents.size === 0 && completedAgents.length === 0 && (
                <div className="flex items-center justify-center h-full text-slate-700 text-xs">
                  Agents will appear here during a build
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Bottom stats bar ─────────────────────────────────────────────── */}
      {(files.length > 0 || status !== "idle") && (
        <div className="flex items-center gap-4 px-3 py-1.5 border-t border-white/8 bg-[#0b1120] text-[10px] text-slate-600 flex-shrink-0">
          <span>{files.length} file{files.length !== 1 ? "s" : ""}</span>
          <span>{completedAgents.length} agent{completedAgents.length !== 1 ? "s" : ""} done</span>
          {Object.keys(agentScores).length > 0 && (
            <span>avg score: {(Object.values(agentScores).reduce((a,b)=>a+b,0)/Object.values(agentScores).length).toFixed(1)}/10</span>
          )}
          <span className="ml-auto font-mono">{buildLog.length} log entries</span>
        </div>
      )}
    </div>
  );
}

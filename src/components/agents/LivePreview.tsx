
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { GeneratedFile } from "@/lib/agents";
import { Monitor, Smartphone, Tablet, RefreshCw, AlertTriangle, ExternalLink, Loader2, Terminal, Eye, Zap, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface LivePreviewProps {
  files: GeneratedFile[];
  isBuilding?: boolean;
  buildLog?: string[];
  onError?: (error: string) => void;
}

type Viewport = "desktop" | "tablet" | "mobile";

const VIEWPORT_SIZES = {
  desktop: { width: "100%", height: "100%", label: "1280px" },
  tablet: { width: "768px", height: "100%", label: "768px" },
  mobile: { width: "390px", height: "100%", label: "390px" },
};

function buildPreviewDocument(files: GeneratedFile[]): string {
  const htmlFile = files.find(f => f.path.endsWith(".html"));
  if (htmlFile) return htmlFile.content;

  const cssFiles = files.filter(f => f.path.endsWith(".css"));
  const tsxFiles = files
    .filter(f => (f.path.endsWith(".tsx") || f.path.endsWith(".jsx") || f.path.endsWith(".js") || f.path.endsWith(".ts"))
      && !f.path.includes(".test.") && !f.path.includes(".spec.") && !f.path.includes("server/"))
    .sort((a, b) => {
      const p = (p: string) => p.includes("App.") ? 0 : p.includes("main.") ? 1 : p.includes("index.") ? 2 : 3;
      return p(a.path) - p(b.path);
    });

  const cssContent = cssFiles.map(f => `<style>${f.content}</style>`).join("\n");

  const jsxContent = tsxFiles.map(f => {
    const c = f.content
      .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, "")
      .replace(/^import\s+type\s+.*?from\s+['"].*?['"];?\s*$/gm, "")
      .replace(/^import\s+['"].*?['"];?\s*$/gm, "")
      .replace(/^export\s+default\s+/gm, "const _DefaultExport = ")
      .replace(/^export\s+\{[^}]*\};?\s*$/gm, "")
      .replace(/^export\s+(const|function|class|type|interface|enum)\s+/gm, "$1 ")
      .replace(/:\s*React\.FC[^=]*/g, "")
      .replace(/:\s*FC[^=]*/g, "")
      .replace(/<React\.Fragment>/g, "<>").replace(/<\/React\.Fragment>/g, "</>")
      .replace(/React\.useState/g, "useState")
      .replace(/React\.useEffect/g, "useEffect")
      .replace(/React\.useCallback/g, "useCallback")
      .replace(/React\.useMemo/g, "useMemo");
    return `// === ${f.path} ===\n${c}`;
  }).join("\n\n");

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Live Preview</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/framer-motion@11/dist/framer-motion.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; font-family: 'Inter', -apple-system, sans-serif; }
    body { background: #0f172a; color: #f1f5f9; overflow-x: hidden; }
    #root { min-height: 100vh; }
    #_error { position:fixed;inset:0;background:#0f172a;display:flex;align-items:center;justify-content:center;z-index:9999;display:none; }
    #_error .box { background:#1e293b;border:1px solid #ef4444;border-radius:12px;padding:24px;max-width:500px;width:90%; }
    #_error h3 { color:#ef4444;margin:0 0 8px;font-size:14px;font-weight:600; }
    #_error pre { color:#94a3b8;font-size:11px;overflow:auto;margin:0; }
    ::-webkit-scrollbar{width:6px;height:6px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}
    .preview-fade-in { animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
  </style>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: { extend: {
        colors: {
          primary: { DEFAULT: '#06b6d4', foreground: '#fff', 50:'#ecfeff', 100:'#cffafe', 200:'#a5f3fc', 300:'#67e8f9', 400:'#22d3ee', 500:'#06b6d4', 600:'#0891b2', 700:'#0e7490', 800:'#155e75', 900:'#164e63' },
          background: '#0f172a', foreground: '#f1f5f9',
          muted: { DEFAULT: '#1e293b', foreground: '#94a3b8' },
          border: '#334155', input: '#334155',
          card: { DEFAULT: '#1e293b', foreground: '#f1f5f9' },
          secondary: { DEFAULT: '#1e293b', foreground: '#f1f5f9' },
          destructive: { DEFAULT: '#ef4444', foreground: '#fff' },
          accent: { DEFAULT: '#1e293b', foreground: '#f1f5f9' },
        },
        fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
        animation: {
          'spin-slow': 'spin 3s linear infinite',
          'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
          'bounce-slow': 'bounce 2s infinite',
        }
      }}
    }
  </script>
  ${cssContent}
</head>
<body>
  <div id="_error"><div class="box"><h3>Preview Error</h3><pre id="_error_msg"></pre></div></div>
  <div id="root"></div>
  <script type="text/babel" data-presets="react,typescript">
    const { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext, useReducer, Fragment } = React;
    const { createRoot } = ReactDOM;

    // Mock hooks/utils that components might use
    const cn = (...classes) => classes.filter(Boolean).join(" ");
    const clsx = cn;

    window.onerror = (msg, src, line, col, err) => {
      document.getElementById("_error").style.display = "flex";
      document.getElementById("_error_msg").textContent = (err?.stack || msg || "Unknown error");
      window.parent?.postMessage({ type: "preview:error", error: String(msg) }, "*");
    };

    window.addEventListener("unhandledrejection", (e) => {
      const msg = e.reason?.message || String(e.reason) || "Promise rejected";
      document.getElementById("_error").style.display = "flex";
      document.getElementById("_error_msg").textContent = msg;
      window.parent?.postMessage({ type: "preview:error", error: msg }, "*");
    });

    ${jsxContent}

    // Mount the app
    try {
      const App = typeof _DefaultExport !== "undefined" ? _DefaultExport
        : typeof App !== "undefined" ? App
        : () => React.createElement("div", { style: { padding: 32, textAlign: "center", color: "#94a3b8" } },
            React.createElement("div", { style: { fontSize: 48, marginBottom: 16 } }, "⚡"),
            React.createElement("p", null, "Preview ready — components loaded"),
            React.createElement("p", { style: { fontSize: 12, opacity: 0.5 } }, "Add an App component to see it here")
          );
      const container = document.getElementById("root");
      const root = createRoot(container);
      root.render(React.createElement(App));
      window.parent?.postMessage({ type: "preview:ready" }, "*");
    } catch(e) {
      document.getElementById("_error").style.display = "flex";
      document.getElementById("_error_msg").textContent = e?.stack || e?.message || String(e);
      window.parent?.postMessage({ type: "preview:error", error: e?.message }, "*");
    }
  </script>
</body>
</html>`;
}

export default function LivePreview({ files, isBuilding, buildLog = [], onError }: LivePreviewProps) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [refreshKey, setRefreshKey] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "log">("preview");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevFilesRef = useRef<string>("");

  const doc = useMemo(() => buildPreviewDocument(files), [files]);

  // Auto-refresh when files change (hot reload)
  useEffect(() => {
    const docHash = doc.slice(0, 100);
    if (docHash !== prevFilesRef.current && files.length > 0) {
      prevFilesRef.current = docHash;
      setPreviewError(null);
      setIsReady(false);
      setRefreshKey(k => k + 1);
    }
  }, [doc, files.length]);

  // Listen for messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "preview:ready") setIsReady(true);
      if (e.data?.type === "preview:error") {
        setPreviewError(e.data.error);
        onError?.(e.data.error);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onError]);

  const vp = VIEWPORT_SIZES[viewport];

  return (
    <div className="flex flex-col h-full bg-[#0a0f1e] rounded-xl overflow-hidden border border-white/10">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-[#0f172a]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${activeTab === "preview" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Eye className="h-3 w-3" /> Preview
          </button>
          <button
            onClick={() => setActiveTab("log")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${activeTab === "log" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Terminal className="h-3 w-3" /> Build Log
            {buildLog.length > 0 && <span className="ml-1 bg-cyan-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]">{buildLog.length}</span>}
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Viewport toggles */}
          {activeTab === "preview" && (
            <div className="flex items-center gap-1 mr-2">
              {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([vp, Icon]) => (
                <button key={vp} onClick={() => setViewport(vp)}
                  className={`p-1 rounded transition-colors ${viewport === vp ? "text-cyan-400" : "text-slate-500 hover:text-slate-300"}`}
                  title={vp}>
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          )}

          {/* Status */}
          {isBuilding && (
            <div className="flex items-center gap-1 text-amber-400 text-[10px] mr-2">
              <Activity className="h-3 w-3 animate-pulse" /> Building…
            </div>
          )}
          {isReady && !isBuilding && (
            <div className="flex items-center gap-1 text-emerald-400 text-[10px] mr-2">
              <Zap className="h-3 w-3" /> Live
            </div>
          )}

          <button onClick={() => { setPreviewError(null); setIsReady(false); setRefreshKey(k => k + 1); }}
            className="p-1 rounded text-slate-400 hover:text-slate-200 transition-colors" title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === "preview" ? (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full flex items-start justify-center overflow-auto bg-slate-950/50 p-2">
              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
                  <div className="text-5xl">⚡</div>
                  <p className="text-sm font-medium">Live preview ready</p>
                  <p className="text-xs opacity-60">Files will appear here as agents build them</p>
                </div>
              ) : (
                <div className="relative h-full transition-all duration-300"
                  style={{ width: vp.width, maxWidth: "100%" }}>
                  {/* Loading overlay */}
                  {!isReady && (
                    <div className="absolute inset-0 bg-[#0f172a] flex items-center justify-center z-10 rounded-lg">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
                        <span className="text-xs">Rendering preview…</span>
                      </div>
                    </div>
                  )}
                  {/* Error overlay */}
                  {previewError && (
                    <div className="absolute inset-0 bg-[#0f172a] flex items-center justify-center z-20 rounded-lg p-4">
                      <div className="bg-red-950/50 border border-red-500/30 rounded-lg p-4 max-w-md w-full">
                        <div className="flex items-center gap-2 text-red-400 mb-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm font-medium">Preview Error</span>
                        </div>
                        <pre className="text-red-300 text-[10px] overflow-auto max-h-32 whitespace-pre-wrap">{previewError}</pre>
                        <button onClick={() => { setPreviewError(null); setRefreshKey(k => k + 1); }}
                          className="mt-3 text-xs text-red-400 hover:text-red-300 underline">Retry</button>
                      </div>
                    </div>
                  )}
                  <iframe
                    key={refreshKey}
                    ref={iframeRef}
                    srcDoc={doc}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    className="w-full h-full rounded-lg border border-white/5 preview-fade-in"
                    style={{ minHeight: "300px", background: "#0f172a" }}
                    title="Live Preview"
                    onLoad={() => setTimeout(() => setIsReady(true), 300)}
                  />
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="log" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full overflow-y-auto p-3 font-mono text-[11px] text-slate-300 space-y-0.5">
              {buildLog.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-600">
                  <p>No build activity yet…</p>
                </div>
              ) : (
                buildLog.map((line, i) => (
                  <div key={i} className={`leading-5 ${line.startsWith("✅") ? "text-emerald-400" : line.startsWith("❌") ? "text-red-400" : line.startsWith("⚡") ? "text-cyan-400" : line.startsWith("🔄") ? "text-amber-400" : line.startsWith("🧠") ? "text-purple-400" : "text-slate-400"}`}>
                    <span className="text-slate-600 mr-2">{String(i+1).padStart(3, "0")}</span>
                    {line}
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

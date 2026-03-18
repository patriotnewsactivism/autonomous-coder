import { useMemo, useState } from "react";
import { GeneratedFile } from "@/lib/agents";
import { Monitor, Smartphone, Tablet, RefreshCw, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface LivePreviewProps {
  files: GeneratedFile[];
}

function buildPreviewDocument(files: GeneratedFile[]): string {
  const htmlFile = files.find((f) => f.path.endsWith(".html"));
  const cssFiles = files.filter((f) => f.path.endsWith(".css"));
  const tsxFiles = files.filter(
    (f) => (f.path.endsWith(".tsx") || f.path.endsWith(".jsx")) &&
    !f.path.includes(".test.") && !f.path.includes(".spec.")
  );

  const cssContent = cssFiles.map((f) => `<style>${f.content}</style>`).join("\n");

  const sortedTsx = [...tsxFiles].sort((a, b) => {
    const priority = (p: string) => {
      if (p.includes("App.")) return 0;
      if (p.includes("main.")) return 1;
      if (p.includes("index.")) return 2;
      if (p.toLowerCase().includes("page")) return 3;
      return 4;
    };
    return priority(a.path) - priority(b.path);
  });

  const jsxContent = sortedTsx
    .map((f) => {
      let content = f.content
        .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, "")
        .replace(/^import\s+['"].*?['"];?\s*$/gm, "")
        .replace(/^export\s+default\s+/gm, "const _exported_default = ")
        .replace(/^export\s+\{[^}]*\};?\s*$/gm, "")
        .replace(/^export\s+/gm, "");
      return `// === ${f.path} ===\n${content}`;
    })
    .join("\n\n");

  if (htmlFile) return htmlFile.content;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; margin: 0; background: #0f172a; color: #f1f5f9; }
    #_preview_loading { display:flex;align-items:center;justify-content:center;height:100vh;gap:12px;font-size:14px;color:#64748b; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
  ${cssContent}
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: { extend: { colors: {
        primary: { DEFAULT: '#06b6d4', foreground: '#fff' },
        background: '#0f172a', foreground: '#f1f5f9',
        muted: { DEFAULT: '#1e293b', foreground: '#94a3b8' },
        border: '#334155',
        card: { DEFAULT: '#1e293b', foreground: '#f1f5f9' },
        destructive: { DEFAULT: '#ef4444' }, success: '#22c55e',
      }}}
    }
    document.documentElement.classList.add('dark');
  </script>
</head>
<body class="dark min-h-screen">
  <div id="_preview_loading">
    <svg class="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
    Compiling preview...
  </div>
  <div id="root" style="display:none"></div>
  <script type="text/babel" data-presets="react,typescript">
    const { useState, useEffect, useCallback, useMemo, useRef, useReducer } = React;
    const toast = { success: console.log, error: console.error, info: console.log };
    const cn = (...args) => args.filter(Boolean).join(' ');

    ${jsxContent}

    const componentNames = ['App', 'Dashboard', 'HomePage', 'LandingPage', 'MainPage', 'Index', 'Page'];
    let RootComponent = null;
    for (const name of componentNames) {
      try { if (typeof eval(name) === 'function') { RootComponent = eval(name); break; } } catch(e) {}
    }
    if (!RootComponent && typeof _exported_default === 'function') RootComponent = _exported_default;

    document.getElementById('_preview_loading').remove();
    document.getElementById('root').style.display = '';

    if (RootComponent) {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(RootComponent));
    } else {
      document.getElementById('root').innerHTML =
        '<div style="padding:2rem;text-align:center;color:#94a3b8"><p style="font-size:1.2rem">No root component found.</p><p style="font-size:0.875rem;margin-top:0.5rem">Looking for: App, Dashboard, HomePage, etc.</p></div>';
    }
  </script>
</body>
</html>`;
}

type ViewportSize = "desktop" | "tablet" | "mobile";

const viewportSizes: Record<ViewportSize, { width: string; label: string; icon: typeof Monitor }> = {
  desktop: { width: "100%", label: "Desktop", icon: Monitor },
  tablet:  { width: "768px", label: "Tablet",  icon: Tablet },
  mobile:  { width: "375px", label: "Mobile",  icon: Smartphone },
};

const LivePreview = ({ files }: LivePreviewProps) => {
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [key, setKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const hasPreviewableFiles = files.some(
    (f) => f.path.endsWith(".tsx") || f.path.endsWith(".jsx") || f.path.endsWith(".html")
  );

  const previewDoc = useMemo(() => buildPreviewDocument(files), [files, key]);

  const refresh = () => {
    setIsLoading(true);
    setKey((k) => k + 1);
  };

  const openInNewTab = () => {
    const blob = new Blob([previewDoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  if (!hasPreviewableFiles) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border/40 rounded-xl bg-muted/10">
        <Monitor className="h-10 w-10 mb-3 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Live preview available after code generation</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Supports React/JSX and HTML files</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1 border border-border/30">
          {(Object.entries(viewportSizes) as [ViewportSize, typeof viewportSizes[ViewportSize]][]).map(([key, val]) => {
            const Icon = val.icon;
            return (
              <button key={key} onClick={() => setViewport(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewport === key
                    ? "bg-background text-foreground shadow-sm border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`button-preview-${key}`}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{val.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refresh} className="h-7 px-2 text-xs gap-1">
            <RefreshCw className="h-3 w-3" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" size="sm" onClick={openInNewTab} className="h-7 px-2 text-xs gap-1">
            <ExternalLink className="h-3 w-3" />
            <span className="hidden sm:inline">Open</span>
          </Button>
        </div>
      </div>

      {/* Preview frame */}
      <div className="relative border border-border/50 rounded-xl overflow-hidden bg-background">
        <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/30 border-b border-border/30">
          <div className="h-2.5 w-2.5 rounded-full bg-rose-500/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
          <div className="flex-1 mx-2 h-5 bg-background/50 rounded text-[10px] text-muted-foreground flex items-center px-2">
            preview
          </div>
          {isLoading && <Loader2 className="h-3 w-3 text-primary animate-spin" />}
        </div>

        <motion.div
          animate={{ width: viewportSizes[viewport].width }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="mx-auto overflow-hidden relative"
          style={{ maxWidth: "100%" }}
        >
          {isLoading && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                Compiling...
              </div>
            </div>
          )}
          <iframe
            key={`${key}-${viewport}`}
            srcDoc={previewDoc}
            className="w-full border-0"
            style={{ height: "500px" }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
            title="Live Preview"
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
          />
        </motion.div>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <AlertTriangle className="h-3 w-3 text-amber-400/70" />
        Preview uses CDN dependencies. Some features may not work identically to the built app.
      </div>
    </div>
  );
};

export default LivePreview;

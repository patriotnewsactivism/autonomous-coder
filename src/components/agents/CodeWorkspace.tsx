import { GeneratedFile } from "@/lib/agents";
import {
  File, FileCode, FileJson, FileType, ChevronDown, ChevronRight,
  Copy, Check, Download, Archive, Eye, Code2, Terminal, Pencil,
  Save, X, Rocket, FolderOpen
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import LivePreview from "./LivePreview";

interface CodeWorkspaceProps {
  files: GeneratedFile[];
  onFilesUpdated?: (files: GeneratedFile[]) => void;
}

// ── Syntax highlight ──────────────────────────────────────────────────────────
function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

function highlightCode(code: string, ext: string): string {
  if (!["ts", "tsx", "js", "jsx"].includes(ext)) return escapeHtml(code);
  let r = escapeHtml(code);
  r = r.replace(/(\/\/[^\n]*)/g, '<span class="syn-comment">$1</span>');
  r = r.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="syn-comment">$1</span>');
  const kw = ["import","export","default","const","let","var","function","return","if","else","for","while","class","interface","type","extends","implements","async","await","from","of","in","new","this","true","false","null","undefined","void","string","number","boolean","any"].join("|");
  r = r.replace(new RegExp(`\\b(${kw})\\b`, "g"), '<span class="syn-keyword">$1</span>');
  r = r.replace(/&lt;(\/?[A-Z][a-zA-Z]*)/g, '&lt;<span class="syn-component">$1</span>');
  r = r.replace(/&lt;(\/?[a-z][a-z0-9-]*)/g, '&lt;<span class="syn-tag">$1</span>');
  r = r.replace(/\b(\d+\.?\d*)\b/g, '<span class="syn-number">$1</span>');
  return r;
}

// ── File icons ────────────────────────────────────────────────────────────────
const fileIcons: Record<string, typeof File> = {
  tsx: FileCode, ts: FileCode, jsx: FileCode, js: FileCode,
  json: FileJson, css: FileType, html: FileCode, md: File, default: File,
};
const getFileIcon = (path: string) => fileIcons[path.split(".").pop() || ""] || fileIcons.default;
const getFileName = (path: string) => path.split("/").pop() || path;
const getDir = (path: string) => path.split("/").slice(0, -1).join("/") || ".";

// ── Deploy config generator ───────────────────────────────────────────────────
function generateDeployFiles(files: GeneratedFile[]): { platform: string; files: { name: string; content: string }[]; command: string }[] {
  const hasReact = files.some((f) => f.path.endsWith(".tsx") || f.path.endsWith(".jsx"));
  const hasDocker = files.some((f) => f.path === "Dockerfile");

  const configs = [];

  // Vercel
  configs.push({
    platform: "Vercel",
    command: "npx vercel --prod",
    files: [
      {
        name: "vercel.json",
        content: JSON.stringify({
          buildCommand: "npm run build",
          outputDirectory: "dist",
          framework: hasReact ? "vite" : null,
          installCommand: "npm install",
        }, null, 2),
      },
      {
        name: "package.json (scripts)",
        content: JSON.stringify({
          scripts: { build: "vite build", dev: "vite", preview: "vite preview" },
          dependencies: { react: "^18", "react-dom": "^18" },
          devDependencies: { vite: "^5", "@vitejs/plugin-react": "^4", typescript: "^5" },
        }, null, 2),
      },
    ],
  });

  // Netlify
  configs.push({
    platform: "Netlify",
    command: "netlify deploy --prod",
    files: [
      {
        name: "netlify.toml",
        content: `[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200`,
      },
    ],
  });

  // Docker
  if (!hasDocker) {
    configs.push({
      platform: "Docker",
      command: "docker build -t myapp . && docker run -p 3000:3000 myapp",
      files: [
        {
          name: "Dockerfile",
          content: `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`,
        },
        {
          name: "nginx.conf",
          content: `events {}
http {
  server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    try_files $uri /index.html;
  }
}`,
        },
      ],
    });
  }

  return configs;
}

type WorkspaceTab = "code" | "preview" | "deploy";

const CodeWorkspace = ({ files, onFilesUpdated }: CodeWorkspaceProps) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("code");
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [syntaxEnabled, setSyntaxEnabled] = useState(true);
  const [fileTree, setFileTree] = useState(false);

  useEffect(() => {
    if (files.length > 0) setExpandedFiles(new Set([files[0].path]));
  }, [files.length > 0 && files[0]?.path]);

  // Group files by directory for tree view
  const filesByDir = useCallback(() => {
    const map = new Map<string, GeneratedFile[]>();
    for (const file of files) {
      const dir = getDir(file.path);
      if (!map.has(dir)) map.set(dir, []);
      map.get(dir)!.push(file);
    }
    return map;
  }, [files]);

  const toggleFile = (path: string) => {
    setEditingFile(null);
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const copyCode = async (path: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedFile(path);
    toast.success("Code copied!");
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const startEditing = (file: GeneratedFile) => {
    setEditingFile(file.path);
    setEditContent(file.content);
    if (!expandedFiles.has(file.path)) {
      setExpandedFiles((prev) => new Set([...prev, file.path]));
    }
  };

  const saveEdit = (path: string) => {
    if (!onFilesUpdated) return;
    const updated = files.map((f) => f.path === path ? { ...f, content: editContent, type: "update" as const } : f);
    onFilesUpdated(updated);
    setEditingFile(null);
    toast.success("File saved!");
  };

  const cancelEdit = () => {
    setEditingFile(null);
    setEditContent("");
  };

  const downloadAllFiles = () => {
    files.forEach((file) => {
      const blob = new Blob([file.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: getFileName(file.path) });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    toast.success(`Downloaded ${files.length} files`);
  };

  const exportAsZip = async () => {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      files.forEach((file) => zip.file(file.path, file.content));
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: "generated-project.zip" });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${files.length} files as ZIP!`);
    } catch {
      toast.error("ZIP failed, falling back to individual downloads");
      downloadAllFiles();
    }
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-8 sm:py-12 border border-dashed border-border/50 rounded-xl">
        <FileCode className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-muted-foreground/50" />
        <p className="text-xs sm:text-sm text-muted-foreground">Generated code will appear here</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground/50 mt-1">Describe what you want to build above</p>
      </div>
    );
  }

  const deployConfigs = generateDeployFiles(files);

  return (
    <div className="space-y-3">
      {/* Tab bar + Actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1 border border-border/30">
          {[
            { id: "code" as WorkspaceTab, icon: Code2, label: "Code" },
            { id: "preview" as WorkspaceTab, icon: Eye, label: "Preview" },
            { id: "deploy" as WorkspaceTab, icon: Rocket, label: "Deploy" },
          ].map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === id ? "bg-background text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"
              }`} data-testid={`tab-${id}`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground hidden sm:inline">{files.length} files</span>
          <Button variant="ghost" size="sm" onClick={downloadAllFiles} className="h-7 px-2 text-xs gap-1" data-testid="button-download-all">
            <Download className="h-3 w-3" /><span className="hidden sm:inline">Download</span>
          </Button>
          <Button variant="default" size="sm" onClick={exportAsZip} className="h-7 px-2 text-xs gap-1" data-testid="button-export-zip">
            <Archive className="h-3 w-3" /><span className="hidden sm:inline">ZIP</span>
          </Button>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* Preview tab */}
        {activeTab === "preview" && (
          <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LivePreview files={files} />
          </motion.div>
        )}

        {/* Deploy tab */}
        {activeTab === "deploy" && (
          <motion.div key="deploy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <p className="text-xs text-muted-foreground">Generated deployment configurations for your project:</p>
            {deployConfigs.map((config) => (
              <div key={config.platform} className="border border-border/50 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border/30">
                  <Rocket className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{config.platform}</span>
                  <code className="ml-auto text-[10px] px-2 py-0.5 bg-background/60 rounded font-mono text-muted-foreground border border-border/30">
                    {config.command}
                  </code>
                </div>
                <div className="divide-y divide-border/20">
                  {config.files.map((cf) => (
                    <div key={cf.name} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-muted-foreground">{cf.name}</span>
                        <button onClick={() => { navigator.clipboard.writeText(cf.content); toast.success("Copied!"); }}
                          className="text-[10px] text-primary hover:underline"
                        >Copy</button>
                      </div>
                      <pre className="text-[9px] sm:text-[10px] font-mono text-foreground/70 bg-background/50 rounded p-2 overflow-x-auto max-h-32 border border-border/20">
                        {cf.content}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="text-center pt-2">
              <button onClick={exportAsZip} className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto">
                <Archive className="h-3 w-3" /> Export all files + deploy configs as ZIP
              </button>
            </div>
          </motion.div>
        )}

        {/* Code tab */}
        {activeTab === "code" && (
          <motion.div key="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="h-3 w-3 text-muted-foreground" />
              <button onClick={() => setFileTree((p) => !p)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${fileTree ? "border-primary/30 bg-primary/10 text-primary" : "border-border/30 text-muted-foreground"}`}
              >
                <FolderOpen className="h-2.5 w-2.5 inline mr-1" />Tree
              </button>
              <button onClick={() => setSyntaxEnabled((p) => !p)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${syntaxEnabled ? "border-primary/30 bg-primary/10 text-primary" : "border-border/30 text-muted-foreground"}`}
              >
                Syntax {syntaxEnabled ? "On" : "Off"}
              </button>
              {onFilesUpdated && (
                <span className="text-[10px] text-muted-foreground ml-1">Click <Pencil className="h-2.5 w-2.5 inline" /> to edit files</span>
              )}
            </div>

            {/* File tree mode */}
            {fileTree ? (
              <div className="border border-border/50 rounded-xl overflow-hidden bg-muted/10">
                {Array.from(filesByDir().entries()).map(([dir, dirFiles]) => (
                  <div key={dir}>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/20 border-b border-border/20">
                      <FolderOpen className="h-3 w-3 text-amber-400" />
                      <span className="text-[10px] text-muted-foreground font-mono">{dir === "." ? "root" : dir}</span>
                    </div>
                    {dirFiles.map((file) => {
                      const Icon = getFileIcon(file.path);
                      const fileName = getFileName(file.path);
                      return (
                        <button key={file.path} onClick={() => toggleFile(file.path)}
                          className="w-full flex items-center gap-2 pl-6 pr-3 py-2 hover:bg-muted/20 transition-colors border-b border-border/20 last:border-b-0"
                          data-testid={`tree-file-${fileName}`}
                        >
                          <Icon className="h-3 w-3 text-primary flex-shrink-0" />
                          <span className="text-xs font-mono text-foreground">{fileName}</span>
                          <span className={`ml-auto text-[9px] px-1 py-0.5 rounded ${file.type === "create" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                            {file.type}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : null}

            {/* File list with inline editor */}
            <div className={`border border-border/50 rounded-xl overflow-hidden bg-muted/10 ${fileTree ? "mt-2" : ""}`}>
              {files.map((file) => {
                const Icon = getFileIcon(file.path);
                const isExpanded = expandedFiles.has(file.path);
                const isEditing = editingFile === file.path;
                const fileName = getFileName(file.path);
                const ext = file.path.split(".").pop() || "";

                return (
                  <div key={file.path} className="border-b border-border/30 last:border-b-0">
                    {/* File header */}
                    <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-muted/20 transition-colors">
                      <button onClick={() => toggleFile(file.path)} className="flex items-center gap-2 flex-1 min-w-0">
                        {isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        }
                        <Icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <span className="text-xs sm:text-sm font-mono text-foreground flex-1 text-left truncate" title={file.path}>
                          <span className="sm:hidden">{fileName}</span>
                          <span className="hidden sm:inline">{file.path}</span>
                        </span>
                      </button>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${file.type === "create" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                        {file.type}
                      </span>
                      {onFilesUpdated && !isEditing && (
                        <button onClick={() => startEditing(file)}
                          className="flex-shrink-0 p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          data-testid={`button-edit-${fileName}`} title="Edit file"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                      {isEditing ? (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => saveEdit(file.path)}
                            className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                            data-testid={`button-save-${fileName}`}
                          >
                            <Save className="h-3 w-3" />
                          </button>
                          <button onClick={cancelEdit} className="p-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => copyCode(file.path, file.content)} className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors"
                          data-testid={`button-copy-${fileName}`}
                        >
                          {copiedFile === file.path
                            ? <Check className="h-3 w-3 text-emerald-400" />
                            : <Copy className="h-3 w-3 text-muted-foreground" />
                          }
                        </button>
                      )}
                    </div>

                    {/* File content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-background/50">
                            {isEditing ? (
                              <div className="p-3">
                                <textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  className="w-full bg-background border border-border/50 rounded-lg p-3 text-[10px] sm:text-xs font-mono text-foreground/90 resize-none outline-none focus:border-primary/50 transition-colors"
                                  style={{ height: "300px" }}
                                  spellCheck={false}
                                  data-testid={`editor-${fileName}`}
                                />
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-[10px] text-muted-foreground">Editing {fileName}</span>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={cancelEdit} className="h-6 px-2 text-[10px]">Cancel</Button>
                                    <Button size="sm" onClick={() => saveEdit(file.path)} className="h-6 px-2 text-[10px] gap-1">
                                      <Save className="h-2.5 w-2.5" /> Save
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : syntaxEnabled ? (
                              <pre className="p-3 sm:p-4 text-[10px] sm:text-xs font-mono overflow-x-auto max-h-[300px] sm:max-h-[450px] leading-relaxed">
                                <code dangerouslySetInnerHTML={{ __html: highlightCode(file.content, ext) }} className="syn-code" />
                              </pre>
                            ) : (
                              <pre className="p-3 sm:p-4 text-[10px] sm:text-xs font-mono text-foreground/80 overflow-x-auto max-h-[300px] sm:max-h-[450px]">
                                <code>{file.content}</code>
                              </pre>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            <style>{`
              .syn-keyword { color: #c084fc; }
              .syn-string { color: #86efac; }
              .syn-comment { color: #6b7280; font-style: italic; }
              .syn-number { color: #fb923c; }
              .syn-component { color: #38bdf8; }
              .syn-tag { color: #94a3b8; }
              .syn-code { color: #e2e8f0; }
            `}</style>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CodeWorkspace;

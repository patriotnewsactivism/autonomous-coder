import { useState, useCallback } from "react";
import { GitBranch, Loader2, FileCode, AlertCircle, Check, Upload, FolderGit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { GeneratedFile } from "@/lib/agents";

interface ImportResult {
  fullName: string;
  name: string;
  description: string | null;
  language: string | null;
  defaultBranch: string;
  stars: number;
  totalFiles: number;
  loadedFiles: number;
  files: { path: string; content: string; size: number }[];
}

interface RepoImportProps {
  onFilesLoaded: (files: GeneratedFile[], repoName: string) => void;
}

const RepoImport = ({ onFilesLoaded }: RepoImportProps) => {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const importRepo = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/github/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: url.trim(),
          ...(token.trim() ? { token: token.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to import");

      setResult(data);
      const files: GeneratedFile[] = data.files.map((f: any) => ({
        path: f.path,
        content: f.content,
        type: "create" as const,
      }));
      onFilesLoaded(files, data.fullName);
      toast.success(`Imported ${data.loadedFiles} files from ${data.name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [url, token, onFilesLoaded]);

  const examples = [
    "https://github.com/owner/repo",
    "https://github.com/facebook/react",
    "https://github.com/vercel/next.js",
  ];

  return (
    <div className="glass-card rounded-xl border border-border/50 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <FolderGit2 className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
        <h3 className="text-sm sm:text-base font-semibold text-foreground">Import Repository</h3>
      </div>

      <p className="text-[11px] sm:text-xs text-muted-foreground mb-4">
        Paste any GitHub repo URL. Public repos import instantly — no token needed.
        The AI agents will analyze the codebase, then finish or debug it.
      </p>

      {/* URL input */}
      <div className="flex gap-2 mb-3">
        <Input
          type="text"
          placeholder="https://github.com/owner/repo"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && importRepo()}
          className="text-xs sm:text-sm font-mono flex-1"
          data-testid="input-repo-url"
        />
        <Button
          onClick={importRepo}
          disabled={!url.trim() || loading}
          size="sm"
          className="shrink-0"
          data-testid="button-import-repo"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span className="ml-1.5 hidden sm:inline">Import</span>
        </Button>
      </div>

      {/* Optional token for private repos */}
      <button
        onClick={() => setShowToken(!showToken)}
        className="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        {showToken ? "− Hide token" : "+ Private repo? Add GitHub token"}
      </button>
      <AnimatePresence>
        {showToken && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-3"
          >
            <Input
              type="password"
              placeholder="ghp_xxxxxxxxxxxx (optional, for private repos)"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="text-xs sm:text-sm font-mono"
              data-testid="input-repo-token"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Fetching repository files...
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{result.fullName}</span>
          </div>
          {result.description && (
            <p className="text-xs text-muted-foreground">{result.description}</p>
          )}
          <div className="flex flex-wrap gap-3 text-[10px] sm:text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileCode className="h-3 w-3" />
              {result.loadedFiles} / {result.totalFiles} files loaded
            </span>
            {result.language && <span>📊 {result.language}</span>}
            {result.stars > 0 && <span>⭐ {result.stars}</span>}
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {result.defaultBranch}
            </span>
          </div>
          <p className="text-[10px] text-primary/80 pt-1">
            Files loaded as build seed. Switch to the Build tab and describe what to finish or debug.
          </p>
        </motion.div>
      )}

      {/* Examples */}
      {!result && !loading && (
        <div className="pt-2">
          <p className="text-[10px] text-muted-foreground mb-2">Try:</p>
          <div className="flex flex-wrap gap-1.5">
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => setUrl(ex)}
                className="text-[10px] sm:text-xs px-2 py-1.5 rounded-md border border-border/30 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
              >
                {ex.replace("https://github.com/", "")}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RepoImport;

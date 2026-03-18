import { useState } from "react";
import { Github, Lock, ChevronRight, Star, GitBranch, AlertCircle, Loader2, FileCode, GitPullRequest, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { GeneratedFile } from "@/lib/agents";

interface Repo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  updatedAt: string;
  private: boolean;
  defaultBranch: string;
}

interface RepoFile {
  path: string;
  sha: string;
  size: number;
  type: string;
}

interface PRReview {
  pr: {
    title: string;
    description: string;
    author: string;
    files: any[];
  };
  review: {
    overallScore: number;
    issues: any[];
    strengths: string[];
    summary: string;
  };
}

interface GitHubConnectProps {
  onFilesLoaded: (files: GeneratedFile[], repoName: string) => void;
}

type View = "token" | "repos" | "repo-detail" | "pr-review";

const GitHubConnect = ({ onFilesLoaded }: GitHubConnectProps) => {
  const [token, setToken] = useState("");
  const [savedToken, setSavedToken] = useState("");
  const [view, setView] = useState<View>("token");
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [repoFiles, setRepoFiles] = useState<RepoFile[]>([]);
  const [prNumber, setPrNumber] = useState("");
  const [prReview, setPrReview] = useState<PRReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const connectGitHub = async () => {
    if (!token.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/github/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to connect");
      }
      const data = await res.json();
      setSavedToken(token.trim());
      setRepos(data);
      setView("repos");
      toast.success(`Connected! Found ${data.length} repositories`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to connect to GitHub");
    } finally {
      setLoading(false);
    }
  };

  const loadRepoFiles = async (repo: Repo) => {
    setSelectedRepo(repo);
    setLoadingFiles(true);
    setRepoFiles([]);
    setView("repo-detail");
    try {
      const res = await fetch("/api/github/repo-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: savedToken, fullName: repo.fullName, branch: repo.defaultBranch }),
      });
      if (!res.ok) throw new Error("Failed to fetch files");
      const files = await res.json();
      setRepoFiles(files);
    } catch (err) {
      toast.error("Failed to load repository files");
    } finally {
      setLoadingFiles(false);
    }
  };

  const analyzeRepo = async () => {
    if (!selectedRepo || repoFiles.length === 0) return;
    setLoading(true);
    try {
      // Fetch content of up to 10 files to analyze
      const filesToFetch = repoFiles.slice(0, 10);
      const fileContents = await Promise.allSettled(
        filesToFetch.map(async (f) => {
          const res = await fetch("/api/github/file-content", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: savedToken, fullName: selectedRepo.fullName, filePath: f.path, branch: selectedRepo.defaultBranch }),
          });
          if (!res.ok) return null;
          return res.json();
        })
      );

      const generatedFiles: GeneratedFile[] = fileContents
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && r.value !== null)
        .map((r) => ({
          path: r.value.path,
          content: r.value.content,
          type: "create" as const,
        }));

      if (generatedFiles.length === 0) throw new Error("Could not fetch file contents");

      onFilesLoaded(generatedFiles, selectedRepo.fullName);
      toast.success(`Loaded ${generatedFiles.length} files from ${selectedRepo.name} for analysis`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load repository");
    } finally {
      setLoading(false);
    }
  };

  const analyzePR = async () => {
    if (!selectedRepo || !prNumber.trim()) return;
    setLoading(true);
    setPrReview(null);
    try {
      const res = await fetch("/api/github/analyze-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: savedToken, fullName: selectedRepo.fullName, prNumber: parseInt(prNumber) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to analyze PR");
      }
      const data = await res.json();
      setPrReview(data);
      setView("pr-review");
      toast.success("PR analysis complete!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to analyze PR");
    } finally {
      setLoading(false);
    }
  };

  const filteredRepos = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="glass-card rounded-xl border border-border/50 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <Github className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
        <h3 className="text-sm sm:text-base font-semibold text-foreground">GitHub Integration</h3>
        {savedToken && (
          <button
            onClick={() => { setSavedToken(""); setToken(""); setView("token"); setRepos([]); setSelectedRepo(null); }}
            className="ml-auto text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-github-disconnect"
          >
            Disconnect
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* Token input */}
        {view === "token" && (
          <motion.div key="token" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 mb-4">
              <Lock className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Enter a GitHub Personal Access Token with <strong className="text-foreground">repo</strong> scope. Your token is never stored.{" "}
                <a href="https://github.com/settings/tokens/new?scopes=repo" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Create one here →
                </a>
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && connectGitHub()}
                className="text-xs sm:text-sm font-mono flex-1"
                data-testid="input-github-token"
              />
              <Button
                onClick={connectGitHub}
                disabled={!token.trim() || loading}
                size="sm"
                className="shrink-0"
                data-testid="button-github-connect"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect"}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Repos list */}
        {view === "repos" && (
          <motion.div key="repos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs sm:text-sm h-8"
                data-testid="input-github-search"
              />
            </div>
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
              {filteredRepos.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => loadRepoFiles(repo)}
                  className="w-full text-left p-3 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all group"
                  data-testid={`button-repo-${repo.name}`}
                >
                  <div className="flex items-center gap-2">
                    <FileCode className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0 transition-colors" />
                    <span className="text-xs sm:text-sm font-medium text-foreground truncate flex-1">{repo.name}</span>
                    {repo.private && (
                      <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
                  </div>
                  {repo.description && (
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate pl-5">{repo.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 pl-5">
                    {repo.language && <span className="text-[10px] text-muted-foreground">{repo.language}</span>}
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Star className="h-2.5 w-2.5" />
                      {repo.stars}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <GitBranch className="h-2.5 w-2.5" />
                      {repo.defaultBranch}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Repo detail */}
        {view === "repo-detail" && selectedRepo && (
          <motion.div key="repo-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView("repos")}
                className="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-github-back"
              >
                ← Back
              </button>
              <span className="text-[10px] sm:text-xs text-muted-foreground">/</span>
              <span className="text-[10px] sm:text-xs font-medium text-foreground">{selectedRepo.name}</span>
            </div>

            {loadingFiles ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Loading files...</span>
              </div>
            ) : (
              <>
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto border border-border/30 rounded-lg p-2 bg-muted/20">
                  {repoFiles.slice(0, 30).map((file) => (
                    <div key={file.path} className="flex items-center gap-1.5 px-2 py-1">
                      <FileCode className="h-3 w-3 text-primary flex-shrink-0" />
                      <span className="text-[10px] sm:text-xs font-mono text-foreground/80 truncate">{file.path}</span>
                    </div>
                  ))}
                  {repoFiles.length > 30 && (
                    <p className="text-[10px] text-muted-foreground text-center py-1">+{repoFiles.length - 30} more files</p>
                  )}
                </div>

                <Button
                  onClick={analyzeRepo}
                  disabled={loading || repoFiles.length === 0}
                  className="w-full gap-2"
                  data-testid="button-github-analyze-repo"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Analyze Codebase with AI
                </Button>

                <div className="border-t border-border/30 pt-4">
                  <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <GitPullRequest className="h-3.5 w-3.5" />
                    Review a Pull Request
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="PR number (e.g. 42)"
                      value={prNumber}
                      onChange={(e) => setPrNumber(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && analyzePR()}
                      className="text-xs sm:text-sm flex-1 h-8"
                      data-testid="input-pr-number"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={analyzePR}
                      disabled={!prNumber.trim() || loading}
                      className="h-8"
                      data-testid="button-analyze-pr"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Review PR"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* PR Review result */}
        {view === "pr-review" && prReview && (
          <motion.div key="pr-review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView("repo-detail")}
                className="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground"
                data-testid="button-pr-review-back"
              >
                ← Back
              </button>
              <span className="text-[10px] sm:text-xs font-medium text-foreground truncate">{prReview.pr.title}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className={`text-2xl font-bold ${
                prReview.review.overallScore >= 8 ? "text-success" :
                prReview.review.overallScore >= 5 ? "text-amber-400" : "text-destructive"
              }`}>
                {prReview.review.overallScore}/10
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">Quality Score</p>
                <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      prReview.review.overallScore >= 8 ? "bg-success" :
                      prReview.review.overallScore >= 5 ? "bg-amber-400" : "bg-destructive"
                    }`}
                    style={{ width: `${prReview.review.overallScore * 10}%` }}
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{prReview.review.summary}</p>

            {prReview.review.issues?.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] sm:text-xs font-medium text-foreground">Issues Found ({prReview.review.issues.length})</p>
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                  {prReview.review.issues.map((issue: any) => (
                    <div
                      key={issue.id}
                      className={`flex gap-2 p-2 rounded-lg text-[10px] sm:text-xs ${
                        issue.severity === "critical"
                          ? "bg-destructive/10 border border-destructive/20"
                          : issue.severity === "warning"
                          ? "bg-amber-500/10 border border-amber-500/20"
                          : "bg-muted/30 border border-border/30"
                      }`}
                      data-testid={`pr-issue-${issue.id}`}
                    >
                      <AlertCircle className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${
                        issue.severity === "critical" ? "text-destructive" :
                        issue.severity === "warning" ? "text-amber-400" : "text-muted-foreground"
                      }`} />
                      <div>
                        <p className="font-medium text-foreground">{issue.file}</p>
                        <p className="text-muted-foreground">{issue.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {prReview.review.strengths?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] sm:text-xs font-medium text-foreground">Strengths</p>
                {prReview.review.strengths.map((s: string, i: number) => (
                  <p key={i} className="text-[10px] sm:text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-success">✓</span> {s}
                  </p>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GitHubConnect;

import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, ArrowLeft, FileCode, Clock, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import CodeWorkspace from "@/components/agents/CodeWorkspace";
import { GeneratedFile } from "@/lib/agents";

interface SharedProjectData {
  id: number;
  goal: string;
  files: GeneratedFile[];
  fileCount: number;
  agentSequence: string;
  createdAt: string;
}

const SharedProject = () => {
  const { id } = useParams<{ id: string }>();

  const { data: project, isLoading, error } = useQuery<SharedProjectData>({
    queryKey: ["/api/projects", id],
    queryFn: () => fetch(`/api/projects/${id}`).then((r) => {
      if (!r.ok) throw new Error("Project not found");
      return r.json();
    }),
    enabled: !!id,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-background grid-pattern">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm text-foreground hidden sm:block">Autonomous Code Wizard</span>
          </Link>
          <div className="w-px h-5 bg-border/50" />
          <span className="text-xs text-muted-foreground">Shared Project</span>
          <div className="ml-auto">
            <Link to="/vibe">
              <Button variant="outline" size="sm" className="h-7 px-3 text-xs gap-1.5">
                <Sparkles className="h-3 w-3" /> Build Your Own
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 pt-20 pb-12">
        {isLoading && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Loading project...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive/60" />
            <div>
              <p className="text-sm font-medium text-foreground">Project not found</p>
              <p className="text-xs text-muted-foreground mt-1">This link may have expired or the project doesn't exist.</p>
            </div>
            <Link to="/vibe">
              <Button size="sm" className="gap-2">
                <Sparkles className="h-3.5 w-3.5" /> Build Something New
              </Button>
            </Link>
          </div>
        )}

        {project && (
          <div className="max-w-4xl mx-auto space-y-6 mt-4">
            {/* Project info */}
            <div className="glass-card rounded-xl border border-border/50 p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-base sm:text-lg font-semibold text-foreground leading-tight">{project.goal}</h1>
                  <div className="flex items-center gap-4 mt-1.5">
                    <span className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                      <FileCode className="h-3 w-3" /> {project.fileCount} files generated
                    </span>
                    <span className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(project.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                </div>
              </div>

              {project.agentSequence && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/30">
                  <span className="text-[10px] text-muted-foreground mr-1">Agents used:</span>
                  {(() => {
                    try {
                      const seq: string[] = JSON.parse(project.agentSequence);
                      return seq.map((a) => (
                        <span key={a} className="text-[10px] px-1.5 py-0.5 bg-muted/50 text-muted-foreground rounded capitalize">
                          {a}
                        </span>
                      ));
                    } catch { return null; }
                  })()}
                </div>
              )}
            </div>

            {/* Code workspace */}
            <div className="glass-card rounded-xl border border-border/50 p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileCode className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Generated Code</h2>
              </div>
              <CodeWorkspace files={project.files} />
            </div>

            {/* CTA */}
            <div className="text-center py-6 border border-dashed border-border/40 rounded-xl">
              <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary/60" />
              <p className="text-sm font-medium text-foreground">Want to build your own app with AI agents?</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Describe your idea and our 11-agent system will build it for you.</p>
              <Link to="/vibe">
                <Button className="gap-2">
                  <Sparkles className="h-4 w-4" /> Start Building Free
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SharedProject;

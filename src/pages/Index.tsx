import { useState } from "react";
import { Wand2, Code, Sparkles, CheckCircle, Clock, XCircle, AlertTriangle, Zap, Target, Shield } from "lucide-react";
import Header from "@/components/Header";
import FeatureCard from "@/components/FeatureCard";
import StatCard from "@/components/StatCard";
import RecentActivity from "@/components/RecentActivity";
import CodeEditor from "@/components/CodeEditor";
import GitHubInput from "@/components/GitHubInput";
import AnalysisResult from "@/components/AnalysisResult";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { analyzeCode, detectLanguage } from "@/lib/api";

type TabType = "manual" | "github";

interface Issue {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  line?: number;
  suggestion?: string;
  fixedCode?: string;
}

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>("manual");
  const [code, setCode] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<Issue[]>([]);
  const [analysisSummary, setAnalysisSummary] = useState<string>("");
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const [stats, setStats] = useState({
    fixed: 0,
    analyzed: 0,
    inProgress: 0,
    failed: 0,
  });

  const [activities, setActivities] = useState<any[]>([]);

  const features = [
    {
      icon: Target,
      title: "Precise Guidance",
      description: "Structured recommendations that respect your coding conventions.",
    },
    {
      icon: Code,
      title: "Seamless Analysis",
      description: "Inline diagnostics that surface risks before they reach production.",
    },
    {
      icon: Shield,
      title: "Confident Delivery",
      description: "Automated fixes paired with transparent reasoning for every change.",
    },
  ];

  const handleAnalyzeCode = async () => {
    if (!code.trim()) {
      toast.error("Please enter some code to analyze");
      return;
    }

    setIsAnalyzing(true);
    setStats((prev) => ({ ...prev, inProgress: prev.inProgress + 1 }));

    try {
      const language = detectLanguage(code);
      const result = await analyzeCode(code, language);

      setAnalysisResults(result.issues || []);
      setAnalysisSummary(result.summary || "");
      setHasAnalyzed(true);

      setStats((prev) => ({
        ...prev,
        analyzed: prev.analyzed + 1,
        inProgress: Math.max(0, prev.inProgress - 1),
      }));

      const issueCount = result.issues?.length || 0;
      setActivities((prev) => [
        {
          id: Date.now().toString(),
          type: issueCount === 0 ? "success" : "success",
          message: `Analyzed ${code.split("\n").length} lines - Found ${issueCount} issues`,
          time: "Just now",
        },
        ...prev.slice(0, 4),
      ]);

      if (issueCount === 0) {
        toast.success("Analysis complete! No issues found. 🎉");
      } else {
        toast.success(`Analysis complete! Found ${issueCount} issue${issueCount > 1 ? "s" : ""}.`);
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      
      setStats((prev) => ({
        ...prev,
        failed: prev.failed + 1,
        inProgress: Math.max(0, prev.inProgress - 1),
      }));

      setActivities((prev) => [
        {
          id: Date.now().toString(),
          type: "error",
          message: error instanceof Error ? error.message : "Analysis failed",
          time: "Just now",
        },
        ...prev.slice(0, 4),
      ]);

      toast.error(error instanceof Error ? error.message : "Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGitHubConnect = async (url: string) => {
    setIsAnalyzing(true);
    
    setActivities((prev) => [
      {
        id: Date.now().toString(),
        type: "pending",
        message: `Connecting to ${url.split("/").slice(-2).join("/")}...`,
        time: "Just now",
      },
      ...prev.slice(0, 4),
    ]);

    // Simulate connection - in a real implementation, this would fetch repo contents
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsAnalyzing(false);
    toast.info("GitHub integration coming soon! For now, paste your code manually.");
  };

  const handleApplyFix = (issueId: string) => {
    const issue = analysisResults.find((i) => i.id === issueId);
    
    if (issue?.fixedCode) {
      // In a real implementation, we'd replace the specific code segment
      // For now, show a success message
      setAnalysisResults((prev) => prev.filter((i) => i.id !== issueId));
      setStats((prev) => ({ ...prev, fixed: prev.fixed + 1 }));

      setActivities((prevActivities) => [
        {
          id: Date.now().toString(),
          type: "success",
          message: `Applied fix: ${issue.message.slice(0, 40)}...`,
          time: "Just now",
        },
        ...prevActivities.slice(0, 4),
      ]);

      toast.success("Fix applied! Code updated.");
    }
  };

  return (
    <div className="min-h-screen bg-background grid-pattern">
      <Header />

      <main className="container mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-12 sm:pb-16">
        {/* Hero Section */}
        <section className="text-center mb-10 sm:mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 sm:px-4 py-1.5 sm:py-2 mb-4 sm:mb-6">
            <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
            <span className="text-xs sm:text-sm font-medium text-primary uppercase tracking-wide">
              AI-Powered Analysis
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 sm:mb-6 leading-tight px-2">
            Elevate code quality with an AI{" "}
            <span className="gradient-text-primary">partner that reads, reasons, and repairs.</span>
          </h1>

          <p className="text-sm sm:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed px-2">
            Autonomous Code Wizard uses advanced AI to analyze your code, identify issues,
            and provide actionable fixes. Bring clarity to your development workflow with
            intelligent, real-time code review.
          </p>
        </section>

        {/* Feature Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-10 sm:mb-16 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </section>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Code Input Section */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-2 lg:order-1">
            <div className="glass-card rounded-xl border border-border/50 p-4 sm:p-6">
              <div className="mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
                  Start with your preferred workflow
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Paste a code sample for rapid AI-powered feedback or connect a repository
                  to synchronize automated reviews with your team.
                </p>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 sm:gap-2 p-1 rounded-lg bg-muted/50 mb-4 sm:mb-6">
                <button
                  onClick={() => setActiveTab("manual")}
                  data-testid="button-tab-manual"
                  className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                    activeTab === "manual" ? "tab-active" : "tab-inactive"
                  }`}
                >
                  <Code className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline">Manual</span> Code
                </button>
                <button
                  onClick={() => setActiveTab("github")}
                  data-testid="button-tab-github"
                  className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                    activeTab === "github" ? "tab-active" : "tab-inactive"
                  }`}
                >
                  <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline">GitHub</span> Repo
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === "manual" ? (
                <div className="space-y-4">
                  <CodeEditor value={code} onChange={setCode} />
                  <Button
                    onClick={handleAnalyzeCode}
                    disabled={isAnalyzing || !code.trim()}
                    size="lg"
                    className="w-full glow-button"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Analyzing with AI...
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Analyze & Fix Code
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <GitHubInput onSubmit={handleGitHubConnect} isLoading={isAnalyzing} />
              )}
            </div>

            {/* Analysis Results */}
            {hasAnalyzed && (
              <div className="animate-slide-up">
                {analysisSummary && (
                  <div className="mb-4 p-4 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-sm text-muted-foreground">{analysisSummary}</p>
                  </div>
                )}
                <AnalysisResult issues={analysisResults} onApplyFix={handleApplyFix} />
              </div>
            )}
          </div>

          {/* Sidebar - Shows first on mobile */}
          <div className="space-y-4 sm:space-y-6 order-1 lg:order-2">
            <StatCard
              stats={[
                { icon: CheckCircle, label: "Fixed", value: stats.fixed, color: "success" },
                { icon: Sparkles, label: "Analyzed", value: stats.analyzed, color: "primary" },
                { icon: Clock, label: "In Progress", value: stats.inProgress, color: "warning" },
                { icon: XCircle, label: "Failed", value: stats.failed, color: "destructive" },
              ]}
            />
            <RecentActivity activities={activities} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground">
            Powered by AI • Autonomous Code Wizard
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;

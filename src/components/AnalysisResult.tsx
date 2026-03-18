import { CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp, Code, Lightbulb } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Issue {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  line?: number;
  suggestion?: string;
  fixedCode?: string;
}

interface AnalysisResultProps {
  issues: Issue[];
  onApplyFix?: (issueId: string) => void;
}

const severityConfig = {
  error: {
    icon: XCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/30",
    label: "Error",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/30",
    label: "Warning",
  },
  info: {
    icon: Lightbulb,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
    label: "Suggestion",
  },
};

const IssueItem = ({
  issue,
  onApplyFix,
}: {
  issue: Issue;
  onApplyFix?: (issueId: string) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = severityConfig[issue.severity];
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border ${config.borderColor} ${config.bgColor} overflow-hidden`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-background/50"
      >
        <Icon className={`h-5 w-5 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium uppercase ${config.color}`}>
              {config.label}
            </span>
            {issue.line && (
              <span className="text-xs text-muted-foreground">Line {issue.line}</span>
            )}
          </div>
          <p className="text-sm text-foreground mt-1 truncate">{issue.message}</p>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-border/30 p-4 space-y-4">
          {issue.suggestion && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Suggestion</p>
              <p className="text-sm text-foreground">{issue.suggestion}</p>
            </div>
          )}

          {issue.fixedCode && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Fixed Code</p>
              <div className="rounded-lg bg-muted/50 p-3 font-mono text-sm overflow-x-auto">
                <code className="text-primary">{issue.fixedCode}</code>
              </div>
            </div>
          )}

          {issue.fixedCode && onApplyFix && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onApplyFix(issue.id)}
              className="w-full"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Apply Fix
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

const AnalysisResult = ({ issues, onApplyFix }: AnalysisResultProps) => {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  return (
    <div className="glass-card rounded-xl border border-border/50 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Analysis Results</h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-destructive">{errorCount} errors</span>
          <span className="text-warning">{warningCount} warnings</span>
          <span className="text-primary">{infoCount} suggestions</span>
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <CheckCircle className="h-12 w-12 text-success mb-4" />
          <p className="text-lg font-medium text-foreground">All Clear!</p>
          <p className="text-sm text-muted-foreground">No issues found in your code</p>
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <IssueItem key={issue.id} issue={issue} onApplyFix={onApplyFix} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AnalysisResult;

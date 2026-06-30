/**
 * ErrorIngestionPanel — paste a stack trace → agents diagnose + propose a patch
 * Backend: POST /api/errors/analyze
 * The panel streams back diagnosis, root cause, and proposed file edits.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle, AlertTriangle, Bug, Check, ChevronDown, ChevronRight,
  ClipboardPaste, Copy, FileCode, Loader2, RefreshCw, Wand2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { FileDiff } from "./DiffViewer";

const API_BASE = (import.meta as any).env?.VITE_API_URL || "";

export interface ErrorAnalysis {
  summary: string;
  rootCause: string;
  severity: "low" | "medium" | "high" | "critical";
  affectedFiles: string[];
  proposedFixes: ProposedFix[];
  confidence: number;
  agentName?: string;
}

export interface ProposedFix {
  id: string;
  filePath: string;
  description: string;
  diff: FileDiff;
  linesChanged: number;
  riskLevel: "safe" | "moderate" | "risky";
}

interface ErrorIngestionPanelProps {
  onApplyFix?: (fix: ProposedFix) => void;
  onOpenDiff?: (diff: FileDiff) => void;
}

const SEVERITY_STYLES: Record<string, string> = {
  low:      "text-slate-400  bg-slate-400/10  border-slate-400/20",
  medium:   "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  high:     "text-orange-400 bg-orange-400/10 border-orange-400/20",
  critical: "text-red-400    bg-red-400/10    border-red-400/20",
};

const RISK_COLORS: Record<string, string> = {
  safe:     "text-green-400",
  moderate: "text-yellow-400",
  risky:    "text-red-400",
};

export function ErrorIngestionPanel({ onApplyFix, onOpenDiff }: ErrorIngestionPanelProps) {
  const [stackTrace, setStackTrace] = useState("");
  const [analysis, setAnalysis] = useState<ErrorAnalysis | null>(null);
  const [expandedFix, setExpandedFix] = useState<string | null>(null);
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set());

  const analyze = useMutation({
    mutationFn: async (trace: string): Promise<ErrorAnalysis> => {
      const res = await fetch(`${API_BASE}/api/errors/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stackTrace: trace, context: { timestamp: Date.now() } }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      setAnalysis(data);
      toast.success(`Analysis complete — ${data.proposedFixes.length} fix(es) proposed`);
    },
    onError: (err: Error) => {
      toast.error(`Analysis failed: ${err.message}`);
    },
  });

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setStackTrace(text);
      toast.success("Pasted from clipboard");
    } catch {
      toast.error("Clipboard read failed — paste manually");
    }
  };

  const handleApply = (fix: ProposedFix) => {
    onApplyFix?.(fix);
    setAppliedFixes(prev => new Set(prev).add(fix.id));
    toast.success(`Applied fix to ${fix.filePath}`);
  };

  const handleCopyFix = async (fix: ProposedFix) => {
    try {
      await navigator.clipboard.writeText(fix.diff.newContent);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Clipboard write failed");
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#08090f]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] shrink-0">
        <Bug className="h-4 w-4 text-red-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex-1">
          Error Ingestion
        </span>
        {analysis && (
          <button
            type="button"
            onClick={() => { setAnalysis(null); setStackTrace(""); setAppliedFixes(new Set()); }}
            className="text-slate-600 hover:text-slate-400 transition-colors"
            title="Clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Input area */}
        {!analysis && (
          <div className="p-3 flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Paste a stack trace or error output</span>
              <button
                type="button"
                onClick={handlePaste}
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                <ClipboardPaste className="h-3 w-3" />Paste
              </button>
            </div>
            <textarea
              className={cn(
                "flex-1 min-h-[180px] w-full bg-black/30 border border-white/[0.08] rounded p-3",
                "text-[11px] font-mono text-red-300 placeholder:text-slate-700",
                "focus:outline-none focus:ring-1 focus:ring-red-500/30 resize-none leading-relaxed",
              )}
              placeholder={`Error: Cannot read properties of undefined (reading 'map')
    at VibeCoding (VibeCoding.tsx:482:22)
    at renderWithHooks (react-dom.development.js:14985)
    ...`}
              value={stackTrace}
              onChange={e => setStackTrace(e.target.value)}
            />
            <button
              type="button"
              disabled={!stackTrace.trim() || analyze.isPending}
              onClick={() => analyze.mutate(stackTrace)}
              className={cn(
                "flex items-center justify-center gap-2 py-2 rounded text-[12px] font-medium transition-colors",
                stackTrace.trim() && !analyze.isPending
                  ? "bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/20"
                  : "bg-white/[0.03] text-slate-600 border border-white/[0.06] cursor-not-allowed",
              )}
            >
              {analyze.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Analyzing...</>
              ) : (
                <><Wand2 className="h-3.5 w-3.5" />Analyze &amp; Generate Fix</>
              )}
            </button>
          </div>
        )}

        {/* Analysis results */}
        {analysis && (
          <div className="p-3 space-y-3">
            {/* Summary card */}
            <div className={cn("rounded border p-3 space-y-1", SEVERITY_STYLES[analysis.severity])}>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  {analysis.severity} severity
                </span>
                <span className="ml-auto text-[10px] opacity-60">
                  {Math.round(analysis.confidence * 100)}% confidence
                </span>
              </div>
              <p className="text-[11px] leading-relaxed">{analysis.summary}</p>
            </div>

            {/* Root cause */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Root Cause</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{analysis.rootCause}</p>
            </div>

            {/* Affected files */}
            {analysis.affectedFiles.length > 0 && (
              <div>
                <span className="text-[10px] text-slate-600 uppercase tracking-wider">Affected Files</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {analysis.affectedFiles.map(f => (
                    <span key={f} className="flex items-center gap-1 text-[9px] font-mono text-slate-500 bg-white/[0.04] rounded px-1.5 py-0.5 border border-white/[0.06]">
                      <FileCode className="h-2.5 w-2.5" />{f.split("/").pop()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Proposed fixes */}
            {analysis.proposedFixes.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] text-slate-600 uppercase tracking-wider">
                  Proposed Fixes ({analysis.proposedFixes.length})
                </span>
                {analysis.proposedFixes.map(fix => {
                  const applied = appliedFixes.has(fix.id);
                  const expanded = expandedFix === fix.id;
                  return (
                    <div
                      key={fix.id}
                      className={cn(
                        "rounded border overflow-hidden transition-colors",
                        applied
                          ? "border-green-500/20 bg-green-500/5"
                          : "border-white/[0.06] bg-white/[0.02]",
                      )}
                    >
                      {/* Fix header */}
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2 text-left"
                        onClick={() => setExpandedFix(expanded ? null : fix.id)}
                      >
                        <FileCode className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-slate-300 font-mono truncate">{fix.filePath}</p>
                          <p className="text-[10px] text-slate-500 truncate">{fix.description}</p>
                        </div>
                        <span className={cn("text-[9px] font-medium", RISK_COLORS[fix.riskLevel])}>
                          {fix.riskLevel}
                        </span>
                        <span className="text-[9px] text-slate-600">±{fix.linesChanged}</span>
                        {applied ? <Check className="h-3.5 w-3.5 text-green-400 shrink-0" /> : (
                          expanded ? <ChevronDown className="h-3 w-3 text-slate-600 shrink-0" /> : <ChevronRight className="h-3 w-3 text-slate-600 shrink-0" />
                        )}
                      </button>

                      {/* Fix detail */}
                      {expanded && !applied && (
                        <div className="border-t border-white/[0.04] px-3 pb-3 space-y-2">
                          {/* Diff preview */}
                          <div className="mt-2 max-h-40 overflow-y-auto rounded bg-black/30 border border-white/[0.06]">
                            {fix.diff.newContent.split("\n").slice(0, 30).map((line, i) => (
                              <div key={i} className="px-2 text-[10px] font-mono text-slate-400 leading-5">
                                <span className="text-slate-700 select-none w-6 inline-block text-right mr-2">{i + 1}</span>
                                {line}
                              </div>
                            ))}
                          </div>
                          {/* Actions */}
                          <div className="flex gap-2">
                            {onOpenDiff && (
                              <button
                                type="button"
                                onClick={() => onOpenDiff(fix.diff)}
                                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                              >
                                <RefreshCw className="h-3 w-3" />Diff View
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCopyFix(fix)}
                              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                            >
                              <Copy className="h-3 w-3" />Copy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApply(fix)}
                              className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-green-400 bg-green-400/10 hover:bg-green-400/20 transition-colors"
                            >
                              <Check className="h-3 w-3" />Apply Fix
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Re-analyze button */}
            <button
              type="button"
              onClick={() => setAnalysis(null)}
              className="flex items-center gap-1.5 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />Analyze a different error
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

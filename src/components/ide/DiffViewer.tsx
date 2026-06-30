/**
 * DiffViewer — shows what agents changed, file by file
 * Pure client-side: diffs are computed from before/after snapshots stored in state
 */

import { Check, ChevronLeft, ChevronRight, File, GitCompareArrows, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { GeneratedFile } from "@/lib/agents";

export interface FileDiff {
  path: string;
  previousContent: string;
  newContent: string;
  agentName?: string;
  action?: string;
  timestamp?: number;
}

interface DiffLine {
  type: "add" | "remove" | "unchanged";
  content: string;
  lineNum: number;
}

function computeDiff(original: string, modified: string): DiffLine[] {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");
  const lines: DiffLine[] = [];
  const maxLen = Math.max(origLines.length, modLines.length);
  let lineNum = 1;
  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i];
    const m = modLines[i];
    if (o === undefined) {
      lines.push({ type: "add", content: m, lineNum: lineNum++ });
    } else if (m === undefined) {
      lines.push({ type: "remove", content: o, lineNum: lineNum++ });
    } else if (o !== m) {
      lines.push({ type: "remove", content: o, lineNum: lineNum });
      lines.push({ type: "add", content: m, lineNum: lineNum++ });
    } else {
      lines.push({ type: "unchanged", content: o, lineNum: lineNum++ });
    }
  }
  return lines;
}

interface DiffViewerProps {
  diffs: FileDiff[];
  onRevert?: (diff: FileDiff) => void;
  onAccept?: (diff: FileDiff) => void;
}

export function DiffViewer({ diffs, onRevert, onAccept }: DiffViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<"step" | "cumulative">("step");

  const currentDiff = diffs[selectedIndex] ?? null;

  const diffLines = useMemo(() => {
    if (!currentDiff) return [];
    if (mode === "cumulative") {
      // Find oldest diff for this path to get the "original"
      const forPath = diffs.filter(d => d.path === currentDiff.path);
      const oldest = forPath[forPath.length - 1];
      return computeDiff(oldest?.previousContent ?? "", currentDiff.newContent);
    }
    return computeDiff(currentDiff.previousContent, currentDiff.newContent);
  }, [currentDiff, mode, diffs]);

  const addedCount = diffLines.filter(l => l.type === "add").length;
  const removedCount = diffLines.filter(l => l.type === "remove").length;

  // Unique file paths with changes
  const changedFiles = useMemo(() => {
    const seen = new Set<string>();
    return diffs.filter(d => {
      if (seen.has(d.path)) return false;
      seen.add(d.path);
      return true;
    });
  }, [diffs]);

  if (diffs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#07080f]">
        <GitCompareArrows className="h-8 w-8 text-slate-700" />
        <p className="text-[12px] text-slate-600">No changes yet</p>
        <p className="text-[10px] text-slate-700">Agent file changes will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#07080f]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2 bg-white/[0.01] shrink-0">
        <GitCompareArrows className="h-4 w-4 text-rose-400/60" />
        <span className="text-[11px] font-semibold text-slate-400 flex-1 uppercase tracking-wider">Diff Viewer</span>
        <div className="flex items-center gap-1">
          <button
            className={cn("px-1.5 py-0.5 rounded text-[10px] transition-colors", selectedIndex <= 0 ? "text-slate-700" : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]")}
            disabled={selectedIndex <= 0}
            onClick={() => setSelectedIndex(i => i - 1)}
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <span className="text-[10px] text-slate-600 tabular-nums min-w-[3ch] text-center">
            {selectedIndex + 1}/{diffs.length}
          </span>
          <button
            className={cn("px-1.5 py-0.5 rounded text-[10px] transition-colors", selectedIndex >= diffs.length - 1 ? "text-slate-700" : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]")}
            disabled={selectedIndex >= diffs.length - 1}
            onClick={() => setSelectedIndex(i => i + 1)}
          >
            <ChevronRight className="h-3 w-3" />
          </button>
          {onRevert && currentDiff && (
            <button
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-amber-400 hover:bg-amber-400/10 transition-colors"
              onClick={() => onRevert(currentDiff)}
            >
              <Undo2 className="h-3 w-3" />Reject
            </button>
          )}
          {onAccept && currentDiff && (
            <button
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-green-400 hover:bg-green-400/10 transition-colors"
              onClick={() => onAccept(currentDiff)}
            >
              <Check className="h-3 w-3" />Accept
            </button>
          )}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex border-b border-white/[0.06]">
        {(["step", "cumulative"] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 px-3 py-1 text-[10px] font-medium transition-colors",
              mode === m
                ? "text-rose-400 bg-rose-400/5 border-b border-rose-400"
                : "text-slate-600 hover:text-slate-400",
            )}
          >
            {m === "step" ? "Step-by-Step" : "Current vs Original"}
          </button>
        ))}
      </div>

      {/* File chips */}
      <div className="flex flex-wrap gap-1 border-b border-white/[0.06] px-3 py-2 shrink-0">
        {changedFiles.map(d => {
          const name = d.path.split("/").pop() ?? d.path;
          const isSelected = currentDiff?.path === d.path;
          return (
            <button
              key={d.path}
              type="button"
              onClick={() => {
                const idx = diffs.findIndex(x => x.path === d.path);
                if (idx >= 0) setSelectedIndex(idx);
              }}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors border",
                isSelected
                  ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
                  : "bg-white/[0.03] text-slate-500 border-white/[0.06] hover:text-slate-300",
              )}
            >
              <File className="h-2.5 w-2.5" />
              {name}
            </button>
          );
        })}
      </div>

      {/* Stats */}
      {currentDiff && (
        <div className="flex items-center gap-4 px-3 py-1 border-b border-white/[0.06] text-[10px] shrink-0">
          <span className="text-green-400">+{addedCount}</span>
          <span className="text-red-400">-{removedCount}</span>
          <span className="text-slate-600 font-mono truncate">{currentDiff.path}</span>
          {currentDiff.agentName && (
            <span className="text-indigo-400 ml-auto">by {currentDiff.agentName}</span>
          )}
        </div>
      )}

      {/* Diff lines */}
      <div className="flex-1 overflow-y-auto font-mono text-[11px]">
        {diffLines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "flex px-3 leading-5 min-h-[20px]",
              line.type === "add" && "bg-green-500/[0.08] text-green-300",
              line.type === "remove" && "bg-red-500/[0.08] text-red-300",
              line.type === "unchanged" && "text-slate-600",
            )}
          >
            <span className="w-8 shrink-0 text-slate-700 select-none text-right pr-2">{line.lineNum}</span>
            <span className="w-4 shrink-0 select-none font-bold">
              {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
            </span>
            <span className="flex-1 whitespace-pre-wrap break-all">{line.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

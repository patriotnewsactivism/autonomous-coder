/**
 * MissionControlBar — global status strip at the top of the IDE workspace
 * Shows run state, agent count, files modified, tokens used, and quick actions.
 * Pure local state — no backend queries.
 */

import {
  Activity, Bot, Clock, Cpu, FileCode, GitBranch, Loader2, Play, Square,
  Wifi, WifiOff, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface MissionControlState {
  isRunning: boolean;
  isPaused?: boolean;
  agentCount: number;
  activeAgents: string[];
  filesModified: number;
  tasksCompleted: number;
  tasksFailed: number;
  tokensUsed: number;
  elapsedSeconds: number;
  connected: boolean;
  mode: "manual" | "autonomous";
  branch?: string;
}

interface MissionControlBarProps {
  state: MissionControlState;
  onStop?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onModeToggle?: () => void;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export function MissionControlBar({ state, onStop, onPause, onResume, onModeToggle }: MissionControlBarProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-[#060710] border-b border-white/[0.06] text-[11px] shrink-0">
      {/* Run state */}
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 rounded font-medium",
        state.isRunning
          ? "text-green-400 bg-green-400/10"
          : "text-slate-600 bg-white/[0.04]",
      )}>
        {state.isRunning ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Activity className="h-3 w-3" />
        )}
        {state.isRunning ? (state.isPaused ? "PAUSED" : "RUNNING") : "IDLE"}
      </div>

      <div className="w-px h-4 bg-white/[0.06] mx-1" />

      {/* Mode toggle */}
      <button
        type="button"
        onClick={onModeToggle}
        className={cn(
          "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors border",
          state.mode === "autonomous"
            ? "text-indigo-300 border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20"
            : "text-slate-500 border-white/[0.08] hover:text-slate-300 hover:bg-white/[0.04]",
        )}
        title="Toggle autonomous mode"
      >
        <Zap className="h-3 w-3" />
        {state.mode === "autonomous" ? "Auto" : "Manual"}
      </button>

      <div className="w-px h-4 bg-white/[0.06] mx-1" />

      {/* Agents */}
      <div className="flex items-center gap-1 text-slate-500" title={state.activeAgents.join(", ")}>
        <Bot className="h-3.5 w-3.5" />
        <span className={cn("tabular-nums", state.agentCount > 0 && state.isRunning && "text-cyan-400")}>
          {state.agentCount}
        </span>
        {state.activeAgents.length > 0 && (
          <span className="text-slate-600 max-w-[120px] truncate text-[9px]">
            {state.activeAgents[0]}{state.activeAgents.length > 1 ? ` +${state.activeAgents.length - 1}` : ""}
          </span>
        )}
      </div>

      <div className="w-px h-4 bg-white/[0.06] mx-1" />

      {/* Files */}
      <div className="flex items-center gap-1 text-slate-500">
        <FileCode className="h-3.5 w-3.5" />
        <span className={cn("tabular-nums", state.filesModified > 0 && "text-green-400")}>
          {state.filesModified}
        </span>
        <span className="text-slate-700 text-[10px]">files</span>
      </div>

      <div className="w-px h-4 bg-white/[0.06] mx-1" />

      {/* Tasks */}
      <div className="flex items-center gap-1 text-slate-500">
        <Cpu className="h-3.5 w-3.5" />
        <span className="text-green-400 tabular-nums">{state.tasksCompleted}</span>
        {state.tasksFailed > 0 && (
          <><span className="text-slate-700">/</span><span className="text-red-400 tabular-nums">{state.tasksFailed}</span></>
        )}
        <span className="text-slate-700 text-[10px]">tasks</span>
      </div>

      <div className="w-px h-4 bg-white/[0.06] mx-1" />

      {/* Tokens */}
      <div className="flex items-center gap-1 text-slate-500" title={`${state.tokensUsed.toLocaleString()} tokens`}>
        <Zap className="h-3 w-3" />
        <span className="tabular-nums text-slate-400">{formatTokens(state.tokensUsed)}</span>
        <span className="text-slate-700 text-[10px]">tok</span>
      </div>

      <div className="w-px h-4 bg-white/[0.06] mx-1" />

      {/* Timer */}
      {state.isRunning && (
        <div className="flex items-center gap-1 text-slate-500">
          <Clock className="h-3 w-3" />
          <span className="font-mono tabular-nums text-slate-400">{formatTime(state.elapsedSeconds)}</span>
        </div>
      )}

      <div className="flex-1" />

      {/* Branch */}
      {state.branch && (
        <div className="flex items-center gap-1 text-slate-600 text-[10px]">
          <GitBranch className="h-3 w-3" />
          <span className="font-mono">{state.branch}</span>
        </div>
      )}

      {/* Connection indicator */}
      <div className="ml-2">
        {state.connected ? (
          <Wifi className="h-3.5 w-3.5 text-green-500/60" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-red-500/60" />
        )}
      </div>

      {/* Stop/Pause controls */}
      {state.isRunning && (
        <div className="flex items-center gap-1 ml-2">
          {onPause && onResume && (
            <button
              type="button"
              onClick={state.isPaused ? onResume : onPause}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-amber-400 hover:bg-amber-400/10 transition-colors"
            >
              {state.isPaused ? <Play className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
              {state.isPaused ? "Resume" : "Pause"}
            </button>
          )}
          {onStop && (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <Square className="h-3 w-3" />Stop
            </button>
          )}
        </div>
      )}
    </div>
  );
}

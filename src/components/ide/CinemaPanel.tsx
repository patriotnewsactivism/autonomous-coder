/**
 * CinemaPanel — records agent SSE events as scrubbable "frames"
 * Each agent action becomes a frame. Playback replays the timeline.
 * No backend needed — frames are stored in state and replayed client-side.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Circle, Film, Pause, Play, SkipBack, SkipForward,
  Square, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CinemaFrame {
  id: string;
  timestamp: number;
  agentName: string;
  eventType: "thinking" | "tool_call" | "file_write" | "error" | "complete" | "message";
  summary: string;
  content?: string;
  filePath?: string;
}

interface CinemaPanelProps {
  isRecording?: boolean;
  onRecordToggle?: () => void;
  /** External frames streamed from parent (VibeCoding SSE events) */
  externalFrames?: CinemaFrame[];
}

const EVENT_COLORS: Record<string, string> = {
  thinking:   "text-violet-400 bg-violet-400/10",
  tool_call:  "text-cyan-400 bg-cyan-400/10",
  file_write: "text-green-400 bg-green-400/10",
  error:      "text-red-400 bg-red-400/10",
  complete:   "text-emerald-400 bg-emerald-400/10",
  message:    "text-slate-400 bg-slate-400/10",
};

const EVENT_LABELS: Record<string, string> = {
  thinking:   "Thinking",
  tool_call:  "Tool",
  file_write: "Write",
  error:      "Error",
  complete:   "Done",
  message:    "Msg",
};

function formatTs(ts: number): string {
  const d = new Date(ts);
  const m = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  const ms = d.getMilliseconds().toString().padStart(3, "0");
  return `${m}:${s}.${ms}`;
}

export function CinemaPanel({ isRecording = false, onRecordToggle, externalFrames }: CinemaPanelProps) {
  const [frames, setFrames] = useState<CinemaFrame[]>([]);
  const [cursor, setCursor] = useState<number>(-1); // -1 = live
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<1 | 2 | 4>(1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync external frames
  useEffect(() => {
    if (externalFrames && externalFrames.length > 0) {
      setFrames(prev => {
        const existingIds = new Set(prev.map(f => f.id));
        const incoming = externalFrames.filter(f => !existingIds.has(f.id));
        return incoming.length ? [...prev, ...incoming] : prev;
      });
    }
  }, [externalFrames]);

  // Auto-scroll to bottom in live mode
  useEffect(() => {
    if (cursor === -1 && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [frames, cursor]);

  // Playback ticker
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setCursor(c => {
          if (c >= frames.length - 1) {
            setPlaying(false);
            return -1; // back to live
          }
          return c + 1;
        });
      }, 800 / playbackRate);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, playbackRate, frames.length]);

  const handlePlay = useCallback(() => {
    if (frames.length === 0) return;
    if (!playing) {
      if (cursor === -1 || cursor >= frames.length - 1) setCursor(0);
      setPlaying(true);
    } else {
      setPlaying(false);
    }
  }, [playing, cursor, frames.length]);

  const activeFrame = cursor >= 0 && cursor < frames.length ? frames[cursor] : null;
  const displayFrame = cursor === -1 ? frames[frames.length - 1] : activeFrame;

  return (
    <div className="h-full flex flex-col bg-[#08090f]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] shrink-0">
        <Film className="h-4 w-4 text-pink-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex-1">Cinema</span>
        {isRecording && (
          <span className="flex items-center gap-1 text-[10px] text-red-400">
            <Circle className="h-2.5 w-2.5 fill-red-400 animate-pulse" />REC
          </span>
        )}
        <span className="text-[10px] text-slate-600">{frames.length} frames</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/[0.06] bg-black/20 shrink-0">
        <button
          type="button"
          onClick={onRecordToggle}
          className={cn(
            "p-1.5 rounded transition-colors",
            isRecording
              ? "text-red-400 bg-red-400/10 hover:bg-red-400/20"
              : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]",
          )}
          title={isRecording ? "Stop Recording" : "Start Recording"}
        >
          {isRecording ? <Square className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
        </button>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        <button
          type="button"
          disabled={frames.length === 0}
          onClick={() => { setCursor(0); setPlaying(false); }}
          className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-colors disabled:opacity-30"
          title="Go to Start"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={frames.length === 0 || cursor <= 0}
          onClick={() => setCursor(c => Math.max(0, c - 1))}
          className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-colors disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={frames.length === 0}
          onClick={handlePlay}
          className="p-1.5 rounded text-pink-400 hover:bg-pink-400/10 transition-colors disabled:opacity-30"
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          disabled={frames.length === 0 || cursor >= frames.length - 1}
          onClick={() => setCursor(c => Math.min(frames.length - 1, c + 1))}
          className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-colors disabled:opacity-30"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={frames.length === 0}
          onClick={() => { setCursor(-1); setPlaying(false); }}
          className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-colors disabled:opacity-30"
          title="Jump to Live"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        {/* Playback rate */}
        {([1, 2, 4] as const).map(r => (
          <button
            key={r}
            type="button"
            onClick={() => setPlaybackRate(r)}
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded transition-colors",
              playbackRate === r ? "text-pink-400 bg-pink-400/10" : "text-slate-600 hover:text-slate-400",
            )}
          >
            {r}×
          </button>
        ))}

        <div className="flex-1" />

        {frames.length > 0 && (
          <button
            type="button"
            onClick={() => { setFrames([]); setCursor(-1); setPlaying(false); }}
            className="p-1.5 rounded text-slate-700 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="Clear"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Scrub bar */}
      {frames.length > 0 && (
        <div className="px-3 py-1 border-b border-white/[0.06] shrink-0">
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={cursor === -1 ? frames.length - 1 : cursor}
            onChange={e => { setCursor(Number(e.target.value)); setPlaying(false); }}
            className="w-full h-1 accent-pink-500 cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-slate-700 mt-0.5">
            <span>{frames.length > 0 ? formatTs(frames[0].timestamp) : "00:00.000"}</span>
            <span className="text-slate-500">
              {cursor === -1 ? "LIVE" : `${cursor + 1}/${frames.length}`}
            </span>
            <span>{frames.length > 0 ? formatTs(frames[frames.length - 1].timestamp) : "00:00.000"}</span>
          </div>
        </div>
      )}

      {/* Active frame detail */}
      {displayFrame && (
        <div className="px-3 py-2 border-b border-white/[0.06] bg-black/20 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded", EVENT_COLORS[displayFrame.eventType])}>
              {EVENT_LABELS[displayFrame.eventType]}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">{displayFrame.agentName}</span>
            <span className="text-[9px] text-slate-600 ml-auto font-mono">{formatTs(displayFrame.timestamp)}</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">{displayFrame.summary}</p>
          {displayFrame.filePath && (
            <p className="text-[9px] text-slate-600 font-mono mt-1">{displayFrame.filePath}</p>
          )}
          {displayFrame.content && (
            <pre className="mt-2 text-[10px] text-slate-500 bg-white/[0.02] rounded p-2 overflow-x-auto max-h-24 font-mono leading-relaxed">
              {displayFrame.content.slice(0, 500)}
              {displayFrame.content.length > 500 ? "\n…" : ""}
            </pre>
          )}
        </div>
      )}

      {/* Frame list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {frames.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Film className="h-8 w-8 text-slate-700" />
            <p className="text-[11px] text-slate-600">No frames recorded</p>
            <p className="text-[10px] text-slate-700">Hit record, then start a build</p>
          </div>
        ) : (
          <div className="py-1">
            {frames.map((frame, idx) => {
              const isActive = cursor === idx || (cursor === -1 && idx === frames.length - 1);
              return (
                <button
                  key={frame.id}
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-white/[0.03] transition-colors",
                    isActive && "bg-pink-500/10",
                  )}
                  onClick={() => { setCursor(idx); setPlaying(false); }}
                >
                  <span className={cn("text-[9px] font-medium px-1 py-0.5 rounded shrink-0 w-[38px] text-center", EVENT_COLORS[frame.eventType])}>
                    {EVENT_LABELS[frame.eventType]}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0 w-[48px] text-right font-mono">
                    {idx + 1}
                  </span>
                  <span className="text-[10px] text-slate-300 truncate flex-1">{frame.summary}</span>
                  <span className="text-[9px] text-slate-700 font-mono shrink-0">{formatTs(frame.timestamp)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Helper: convert a raw SSE event string to a CinemaFrame */
export function sseEventToFrame(raw: string, agentName: string): CinemaFrame | null {
  try {
    const parsed = JSON.parse(raw);
    const type = parsed.type ?? parsed.event ?? "message";
    const frameType = (
      type.includes("tool") ? "tool_call" :
      type.includes("think") ? "thinking" :
      type.includes("file") || type.includes("write") ? "file_write" :
      type.includes("error") ? "error" :
      type.includes("done") || type.includes("complete") ? "complete" : "message"
    ) as CinemaFrame["eventType"];

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      agentName: parsed.agent ?? agentName,
      eventType: frameType,
      summary: parsed.summary ?? parsed.content?.slice(0, 120) ?? parsed.message ?? type,
      content: parsed.content ?? parsed.code,
      filePath: parsed.path ?? parsed.filePath,
    };
  } catch {
    return null;
  }
}

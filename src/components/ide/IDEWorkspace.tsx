/**
 * IDEWorkspace — the full resizable IDE layout
 *
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │  MissionControlBar (fixed top)                                  │
 *  ├──────────┬──────────────────────────────────┬───────────────────┤
 *  │ FileTree │ EditorTabs + MonacoEditor         │  Right Panel      │
 *  │          │                                  │  [Agents / Memory │
 *  │  (left)  │        (center)                  │   Cinema / Diff]  │
 *  └──────────┴──────────────────────────────────┴───────────────────┘
 *
 * Uses react-resizable-panels for drag-to-resize splits.
 * Right panel has 4 tabs: Agents, Memory, Cinema, Diff.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Panel, PanelGroup, PanelResizeHandle,
} from "react-resizable-panels";
import { Bot, Brain, Film, GitCompareArrows, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

import { FileTree } from "./FileTree";
import { EditorTabs } from "./EditorTabs";
import { MonacoEditor } from "./MonacoEditor";
import { MemoryTab } from "./MemoryTab";
import { CinemaPanel, sseEventToFrame } from "./CinemaPanel";
import { DiffViewer } from "./DiffViewer";
import { MissionControlBar } from "./MissionControlBar";

import type { GeneratedFile } from "@/lib/agents";
import type { FileDiff } from "./DiffViewer";
import type { CinemaFrame } from "./CinemaPanel";
import type { MissionControlState } from "./MissionControlBar";

type RightTab = "agents" | "memory" | "cinema" | "diff";

interface IDEWorkspaceProps {
  /** Generated files from agent runs */
  files?: GeneratedFile[];
  /** File diffs to show in DiffViewer */
  diffs?: FileDiff[];
  /** Children to render in the Agents tab */
  agentPanel?: React.ReactNode;
  /** Mission control state — pass from VibeCoding */
  missionState?: Partial<MissionControlState>;
  onStop?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onModeToggle?: () => void;
  /** New files added to the workspace by the user */
  onCreateFile?: (name: string) => void;
  onDeleteFile?: (path: string) => void;
  onUpdateFile?: (path: string, content: string) => void;
  /** If provided, IDE will show file diffs when agent produces them */
  onAcceptDiff?: (diff: FileDiff) => void;
  onRejectDiff?: (diff: FileDiff) => void;
  /** Default right panel tab */
  defaultTab?: RightTab;
  /** Pass raw SSE event strings to auto-record into cinema */
  sseEvents?: string[];
}

const DEFAULT_MISSION: MissionControlState = {
  isRunning: false,
  agentCount: 0,
  activeAgents: [],
  filesModified: 0,
  tasksCompleted: 0,
  tasksFailed: 0,
  tokensUsed: 0,
  elapsedSeconds: 0,
  connected: true,
  mode: "manual",
};

const RIGHT_TABS: { id: RightTab; label: string; icon: React.ElementType }[] = [
  { id: "agents",  label: "Agents",  icon: Bot              },
  { id: "memory",  label: "Memory",  icon: Brain            },
  { id: "cinema",  label: "Cinema",  icon: Film             },
  { id: "diff",    label: "Diff",    icon: GitCompareArrows },
];

export function IDEWorkspace({
  files = [],
  diffs = [],
  agentPanel,
  missionState,
  onStop,
  onPause,
  onResume,
  onModeToggle,
  onCreateFile,
  onDeleteFile,
  onUpdateFile,
  onAcceptDiff,
  onRejectDiff,
  defaultTab = "agents",
  sseEvents = [],
}: IDEWorkspaceProps) {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<GeneratedFile[]>([]);
  const [unsavedPaths, setUnsavedPaths] = useState<Set<string>>(new Set());
  const [localEdits, setLocalEdits] = useState<Map<string, string>>(new Map());
  const [rightTab, setRightTab] = useState<RightTab>(defaultTab);
  const [cinemaRecording, setCinemaRecording] = useState(false);
  const [cinemaFrames, setCinemaFrames] = useState<CinemaFrame[]>([]);

  // Auto-open last file when files arrive
  useEffect(() => {
    if (files.length > 0 && !activeFilePath) {
      const latest = files[files.length - 1];
      setActiveFilePath(latest.path);
      setOpenFiles([latest]);
    }
  }, [files.length, activeFilePath]);

  // Open a file in the editor
  const handleFileSelect = useCallback((file: GeneratedFile) => {
    setActiveFilePath(file.path);
    setOpenFiles(prev => prev.find(f => f.path === file.path) ? prev : [...prev, file]);
  }, []);

  // Close a tab
  const handleTabClose = useCallback((path: string) => {
    setOpenFiles(prev => {
      const next = prev.filter(f => f.path !== path);
      if (activeFilePath === path) {
        setActiveFilePath(next[next.length - 1]?.path ?? null);
      }
      return next;
    });
    setUnsavedPaths(prev => { const n = new Set(prev); n.delete(path); return n; });
    setLocalEdits(prev => { const n = new Map(prev); n.delete(path); return n; });
  }, [activeFilePath]);

  // Edit in Monaco
  const handleEditorChange = useCallback((content: string) => {
    if (!activeFilePath) return;
    setLocalEdits(prev => new Map(prev).set(activeFilePath, content));
    setUnsavedPaths(prev => new Set(prev).add(activeFilePath));
  }, [activeFilePath]);

  // Ctrl+S save
  const handleSave = useCallback(() => {
    if (!activeFilePath) return;
    const content = localEdits.get(activeFilePath);
    if (content !== undefined && onUpdateFile) {
      onUpdateFile(activeFilePath, content);
      setUnsavedPaths(prev => { const n = new Set(prev); n.delete(activeFilePath); return n; });
    }
  }, [activeFilePath, localEdits, onUpdateFile]);

  // Resolve the active file (prefer local edits)
  const activeFile = (() => {
    const base = files.find(f => f.path === activeFilePath)
      ?? openFiles.find(f => f.path === activeFilePath)
      ?? null;
    if (!base) return null;
    const localContent = localEdits.get(base.path);
    return localContent !== undefined ? { ...base, content: localContent } : base;
  })();

  // Cinema: ingest SSE events
  useEffect(() => {
    if (!cinemaRecording || sseEvents.length === 0) return;
    const last = sseEvents[sseEvents.length - 1];
    const frame = sseEventToFrame(last, "Agent");
    if (frame) setCinemaFrames(prev => [...prev, frame]);
  }, [sseEvents, cinemaRecording]);

  // Cinema: switch to cinema tab automatically when recording starts
  useEffect(() => {
    if (cinemaRecording) setRightTab("cinema");
  }, [cinemaRecording]);

  // Switch to diff tab automatically when new diffs arrive
  useEffect(() => {
    if (diffs.length > 0) setRightTab("diff");
  }, [diffs.length]);

  const mergedState: MissionControlState = { ...DEFAULT_MISSION, ...missionState };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#07080f]">
      {/* Mission Control */}
      <MissionControlBar
        state={mergedState}
        onStop={onStop}
        onPause={onPause}
        onResume={onResume}
        onModeToggle={onModeToggle}
      />

      {/* Main Panels */}
      <PanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        {/* Left: File Tree */}
        <Panel defaultSize={16} minSize={10} maxSize={30} className="overflow-hidden">
          <FileTree
            files={files}
            activeFilePath={activeFilePath}
            onFileSelect={handleFileSelect}
            onCreateFile={onCreateFile}
            onDeleteFile={onDeleteFile}
          />
        </Panel>

        <PanelResizeHandle className="w-[3px] bg-white/[0.04] hover:bg-indigo-500/40 transition-colors cursor-col-resize flex items-center justify-center group">
          <GripVertical className="h-4 w-4 text-white/[0.08] group-hover:text-indigo-400/60" />
        </PanelResizeHandle>

        {/* Center: Editor */}
        <Panel defaultSize={54} minSize={30} className="flex flex-col overflow-hidden">
          <EditorTabs
            openFiles={openFiles}
            activeFilePath={activeFilePath}
            onSelect={handleFileSelect}
            onClose={handleTabClose}
            unsavedPaths={unsavedPaths}
          />
          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              file={activeFile}
              onChange={handleEditorChange}
              onSave={handleSave}
              readOnly={false}
            />
          </div>
        </Panel>

        <PanelResizeHandle className="w-[3px] bg-white/[0.04] hover:bg-indigo-500/40 transition-colors cursor-col-resize flex items-center justify-center group">
          <GripVertical className="h-4 w-4 text-white/[0.08] group-hover:text-indigo-400/60" />
        </PanelResizeHandle>

        {/* Right: Tabbed panel */}
        <Panel defaultSize={30} minSize={18} maxSize={50} className="flex flex-col overflow-hidden">
          {/* Right panel tabs */}
          <div className="flex border-b border-white/[0.06] bg-[#08090f] shrink-0">
            {RIGHT_TABS.map(t => {
              const Icon = t.icon;
              const hasBadge =
                (t.id === "diff" && diffs.length > 0) ||
                (t.id === "cinema" && cinemaRecording);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRightTab(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium flex-1 justify-center transition-colors relative",
                    rightTab === t.id
                      ? "text-indigo-400 border-b border-indigo-500 bg-indigo-500/5"
                      : "text-slate-600 hover:text-slate-400",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{t.label}</span>
                  {hasBadge && (
                    <span className={cn(
                      "absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full",
                      t.id === "cinema" ? "bg-red-400 animate-pulse" : "bg-green-400",
                    )} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right panel content */}
          <div className="flex-1 overflow-hidden">
            {rightTab === "agents" && (
              <div className="h-full overflow-y-auto">
                {agentPanel ?? (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <Bot className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                      <p className="text-[11px] text-slate-600">No agent activity yet</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {rightTab === "memory" && <MemoryTab />}
            {rightTab === "cinema" && (
              <CinemaPanel
                isRecording={cinemaRecording}
                onRecordToggle={() => setCinemaRecording(r => !r)}
                externalFrames={cinemaFrames}
              />
            )}
            {rightTab === "diff" && (
              <DiffViewer
                diffs={diffs}
                onAccept={onAcceptDiff}
                onRevert={onRejectDiff}
              />
            )}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

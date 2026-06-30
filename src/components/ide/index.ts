// IDE component barrel exports
export { MonacoEditor } from "./MonacoEditor";
export { FileTree } from "./FileTree";
export { EditorTabs } from "./EditorTabs";
export { DiffViewer } from "./DiffViewer";
export { MemoryTab } from "./MemoryTab";
export { CinemaPanel, sseEventToFrame } from "./CinemaPanel";
export { MissionControlBar } from "./MissionControlBar";
export { ErrorIngestionPanel } from "./ErrorIngestionPanel";
export { IDEWorkspace } from "./IDEWorkspace";

// Types
export type { FileDiff } from "./DiffViewer";
export type { AgentMemory, Retrospective } from "./MemoryTab";
export type { CinemaFrame } from "./CinemaPanel";
export type { MissionControlState } from "./MissionControlBar";
export type { ErrorAnalysis, ProposedFix } from "./ErrorIngestionPanel";

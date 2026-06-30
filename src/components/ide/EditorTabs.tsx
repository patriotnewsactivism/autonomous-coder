import { FileCode, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GeneratedFile } from "@/lib/agents";

interface EditorTabsProps {
  openFiles: GeneratedFile[];
  activeFilePath: string | null;
  onSelect: (file: GeneratedFile) => void;
  onClose: (path: string) => void;
  unsavedPaths?: Set<string>;
}

function getTabColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["ts", "tsx"].includes(ext)) return "text-blue-400";
  if (["js", "jsx"].includes(ext)) return "text-yellow-400";
  if (ext === "html") return "text-orange-400";
  if (["css", "scss"].includes(ext)) return "text-sky-400";
  if (ext === "json") return "text-green-400";
  if (ext === "py") return "text-green-300";
  if (ext === "sql") return "text-amber-400";
  return "text-slate-400";
}

export function EditorTabs({ openFiles, activeFilePath, onSelect, onClose, unsavedPaths = new Set() }: EditorTabsProps) {
  if (openFiles.length === 0) return null;

  return (
    <div className="flex items-center bg-[#07080f] border-b border-white/[0.06] overflow-x-auto scrollbar-none">
      {openFiles.map(file => {
        const isActive = activeFilePath === file.path;
        const isUnsaved = unsavedPaths.has(file.path);
        const fileName = file.path.split("/").pop() ?? file.path;

        return (
          <div
            key={file.path}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-white/[0.06] text-[12px] whitespace-nowrap group select-none transition-colors",
              isActive
                ? "bg-[#0d0f1a] text-slate-100 border-t-2 border-t-indigo-500"
                : "bg-transparent text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] border-t-2 border-t-transparent",
            )}
            onClick={() => onSelect(file)}
          >
            <FileCode className={cn("h-3.5 w-3.5 shrink-0", getTabColor(fileName))} />
            <span className="font-mono">{fileName}</span>
            {isUnsaved && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" title="Unsaved changes" />
            )}
            <button
              type="button"
              className="ml-0.5 p-0.5 opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] rounded transition-all"
              onClick={e => { e.stopPropagation(); onClose(file.path); }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

import {
  ChevronDown, ChevronRight, File, FileCode, FileJson,
  FileText, Folder, FolderOpen, Plus, Trash2, X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { GeneratedFile } from "@/lib/agents";

interface FileTreeProps {
  files: GeneratedFile[];
  activeFilePath: string | null;
  onFileSelect: (file: GeneratedFile) => void;
  onCreateFile?: (name: string) => void;
  onDeleteFile?: (path: string) => void;
  onUpdateFile?: (path: string, content: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  file?: GeneratedFile;
  children: TreeNode[];
}

function buildTree(files: GeneratedFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  const dirMap = new Map<string, TreeNode>();

  const sorted = [...files].sort((a, b) => {
    const aIsDir = !a.path.includes(".") || a.path.endsWith("/");
    const bIsDir = !b.path.includes(".") || b.path.endsWith("/");
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  for (const file of sorted) {
    const parts = file.path.split("/").filter(Boolean);

    if (parts.length === 1) {
      root.push({
        name: parts[0],
        path: file.path,
        isDirectory: false,
        file,
        children: [],
      });
      continue;
    }

    // Build nested directories
    let currentLevel = root;
    let currentPath = "";
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += (currentPath ? "/" : "") + parts[i];
      let dirNode = dirMap.get(currentPath);
      if (!dirNode) {
        dirNode = {
          name: parts[i],
          path: currentPath,
          isDirectory: true,
          children: [],
        };
        dirMap.set(currentPath, dirNode);
        currentLevel.push(dirNode);
      }
      currentLevel = dirNode.children;
    }
    currentLevel.push({
      name: parts[parts.length - 1],
      path: file.path,
      isDirectory: false,
      file,
      children: [],
    });
  }

  return root;
}

function getFileIcon(name: string): React.ReactNode {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const iconClass = "h-3.5 w-3.5 shrink-0";
  if (["ts", "tsx"].includes(ext)) return <FileCode className={cn(iconClass, "text-blue-400")} />;
  if (["js", "jsx"].includes(ext)) return <FileCode className={cn(iconClass, "text-yellow-400")} />;
  if (ext === "html") return <FileCode className={cn(iconClass, "text-orange-400")} />;
  if (ext === "css" || ext === "scss") return <FileCode className={cn(iconClass, "text-sky-400")} />;
  if (ext === "json") return <FileJson className={cn(iconClass, "text-green-400")} />;
  if (["md", "txt"].includes(ext)) return <FileText className={cn(iconClass, "text-gray-400")} />;
  if (ext === "py") return <FileCode className={cn(iconClass, "text-green-300")} />;
  if (["sh", "bash"].includes(ext)) return <FileCode className={cn(iconClass, "text-purple-400")} />;
  if (ext === "sql") return <FileCode className={cn(iconClass, "text-amber-400")} />;
  return <File className={cn(iconClass, "text-gray-400")} />;
}

function TreeItem({
  node, depth, activeFilePath, onFileSelect, onDeleteFile,
}: {
  node: TreeNode;
  depth: number;
  activeFilePath: string | null;
  onFileSelect: (file: GeneratedFile) => void;
  onDeleteFile?: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isActive = activeFilePath === node.path;

  return (
    <div role="treeitem" aria-expanded={node.isDirectory ? expanded : undefined}>
      <div
        className={cn(
          "flex items-center gap-1.5 py-[3px] cursor-pointer text-[12px] hover:bg-white/[0.04] rounded group transition-colors",
          isActive && "bg-indigo-500/10 text-indigo-300",
          !isActive && "text-slate-300",
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px`, paddingRight: "8px" }}
        onClick={() => {
          if (node.isDirectory) setExpanded(!expanded);
          else if (node.file) onFileSelect(node.file);
        }}
      >
        {node.isDirectory ? (
          expanded ? (
            <><ChevronDown className="h-3 w-3 shrink-0 text-slate-500" /><FolderOpen className="h-3.5 w-3.5 shrink-0 text-cyan-400" /></>
          ) : (
            <><ChevronRight className="h-3 w-3 shrink-0 text-slate-500" /><Folder className="h-3.5 w-3.5 shrink-0 text-cyan-400" /></>
          )
        ) : (
          <><span className="w-3" />{getFileIcon(node.name)}</>
        )}
        <span className="truncate flex-1 font-mono">{node.name}</span>
        {onDeleteFile && !node.isDirectory && (
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-all rounded"
            onClick={e => { e.stopPropagation(); onDeleteFile(node.path); }}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {node.isDirectory && expanded && node.children.map(child => (
        <TreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          activeFilePath={activeFilePath}
          onFileSelect={onFileSelect}
          onDeleteFile={onDeleteFile}
        />
      ))}
    </div>
  );
}

export function FileTree({
  files, activeFilePath, onFileSelect, onCreateFile, onDeleteFile,
}: FileTreeProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  const tree = buildTree(files);

  const handleCreate = () => {
    if (newFileName.trim() && onCreateFile) {
      onCreateFile(newFileName.trim());
      setNewFileName("");
      setIsCreating(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#08090f]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Files
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            className="p-1 hover:bg-white/[0.06] rounded transition-colors"
            onClick={() => setIsCreating(!isCreating)}
            title="New file"
          >
            <Plus className="h-3.5 w-3.5 text-slate-500 hover:text-slate-300" />
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="px-2 py-1.5 border-b border-white/[0.06]">
          <input
            autoFocus
            type="text"
            className="w-full bg-white/[0.06] border border-white/10 rounded px-2 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            placeholder="src/components/MyComponent.tsx"
            value={newFileName}
            onChange={e => setNewFileName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") { setIsCreating(false); setNewFileName(""); }
            }}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1 scrollbar-thin" role="tree">
        {tree.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[11px] text-slate-600">No files yet</p>
            <p className="text-[10px] text-slate-700 mt-1">Agents will populate this as they build</p>
          </div>
        ) : (
          tree.map(node => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              activeFilePath={activeFilePath}
              onFileSelect={onFileSelect}
              onDeleteFile={onDeleteFile}
            />
          ))
        )}
      </div>

      {files.length > 0 && (
        <div className="px-3 py-1.5 border-t border-white/[0.06] text-[10px] text-slate-600">
          {files.length} file{files.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

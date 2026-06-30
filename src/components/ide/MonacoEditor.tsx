import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef } from "react";
import type { GeneratedFile } from "@/lib/agents";

interface MonacoEditorProps {
  file: GeneratedFile | null;
  onChange: (content: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
}

function getLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    css: "css", scss: "scss", html: "html", json: "json", md: "markdown",
    py: "python", sh: "shell", bash: "shell", yml: "yaml", yaml: "yaml",
    sql: "sql", rs: "rust", go: "go", java: "java", cpp: "cpp", c: "c",
    rb: "ruby", php: "php", swift: "swift", kt: "kotlin", toml: "ini",
    env: "ini", gitignore: "plaintext", dockerfile: "dockerfile",
  };
  return map[ext] ?? "plaintext";
}

export function MonacoEditor({ file, onChange, onSave, readOnly = false }: MonacoEditorProps) {
  const editorRef = useRef<any>(null);
  const prevPathRef = useRef<string | null>(null);

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      if (onSave) {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          onSave();
        });
      }

      monaco.editor.defineTheme("autonomous-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "comment", foreground: "6A9955" },
          { token: "keyword", foreground: "C586C0" },
          { token: "string", foreground: "CE9178" },
          { token: "number", foreground: "B5CEA8" },
          { token: "type", foreground: "4EC9B0" },
          { token: "function", foreground: "DCDCAA" },
          { token: "variable", foreground: "9CDCFE" },
        ],
        colors: {
          "editor.background": "#07080f",
          "editor.foreground": "#e0e0e0",
          "editor.lineHighlightBackground": "#0d0f1a",
          "editor.selectionBackground": "#264f78",
          "editorCursor.foreground": "#818cf8",
          "editorLineNumber.foreground": "#374151",
          "editorLineNumber.activeForeground": "#818cf8",
          "editor.selectionHighlightBackground": "#1a3a5c",
          "editorIndentGuide.background1": "#1a1d2e",
          "editorIndentGuide.activeBackground1": "#2a2d3e",
          "editorWidget.background": "#0d0f1a",
          "editorWidget.border": "#1e2030",
          "editorSuggestWidget.background": "#0d0f1a",
          "editorSuggestWidget.border": "#1e2030",
          "editorSuggestWidget.selectedBackground": "#1e2030",
        },
      });
      monaco.editor.setTheme("autonomous-dark");

      const isMobile = window.innerWidth < 768;
      if (!isMobile) editor.focus();
    },
    [onSave],
  );

  // Sync content when file changes
  useEffect(() => {
    if (editorRef.current && file) {
      const currentValue = editorRef.current.getValue();
      // Only setValue if path changed or content diverged (avoids cursor jumps)
      if (prevPathRef.current !== file.path || currentValue !== file.content) {
        editorRef.current.setValue(file.content);
        prevPathRef.current = file.path;
      }
    }
  }, [file?.path, file?.content]);

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center bg-[#07080f]">
        <div className="text-center px-4 space-y-3">
          <div className="text-5xl opacity-10">{"</>"}</div>
          <p className="text-muted-foreground text-sm">Select a file to edit</p>
          <p className="text-muted-foreground/50 text-xs">
            Agents will write files here as they build
          </p>
        </div>
      </div>
    );
  }

  const isMobileScreen = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div className="h-full w-full overflow-hidden">
      <Editor
        height="100%"
        width="100%"
        language={getLanguage(file.path)}
        value={file.content}
        onChange={v => onChange(v ?? "")}
        onMount={handleEditorMount}
        theme="autonomous-dark"
        options={{
          readOnly,
          fontSize: isMobileScreen ? 12 : 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
          fontLigatures: !isMobileScreen,
          minimap: { enabled: !isMobileScreen },
          lineNumbers: isMobileScreen ? "off" : "on",
          renderLineHighlight: "line",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          wrappingStrategy: "advanced",
          tabSize: 2,
          insertSpaces: true,
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          smoothScrolling: true,
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: !isMobileScreen, indentation: !isMobileScreen },
          renderWhitespace: "none",
          occurrencesHighlight: isMobileScreen ? "off" : "singleFile",
          folding: !isMobileScreen,
          glyphMargin: false,
          lineDecorationsWidth: isMobileScreen ? 0 : 10,
          overviewRulerLanes: isMobileScreen ? 0 : 3,
          scrollbar: {
            vertical: "auto",
            horizontal: "hidden",
            useShadows: false,
          },
        }}
      />
    </div>
  );
}

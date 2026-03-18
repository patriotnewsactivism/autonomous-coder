import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, MessageSquare, Sparkles, GitCompare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GeneratedFile } from "@/lib/agents";
import AgentAvatar from "./AgentAvatar";
import { motion, AnimatePresence } from "framer-motion";
import { addSessionTokens } from "@/lib/agents";

const MEMORY_KEY = "acw_chat_history";
const MAX_MEMORY = 6; // Remember last 6 messages for context

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  changedFiles?: string[];
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
}

function computeDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const result: DiffLine[] = [];

  // Simple LCS-based diff (abbreviated for perf)
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  for (const line of oldLines) {
    if (!newSet.has(line)) result.push({ type: "removed", content: line });
  }
  for (const line of newLines) {
    if (!oldSet.has(line)) result.push({ type: "added", content: line });
    else result.push({ type: "unchanged", content: line });
  }

  // Compact: only show +/- lines
  return result.filter((l) => l.type !== "unchanged").slice(0, 30);
}

interface ChatIterationProps {
  files: GeneratedFile[];
  onFilesUpdated: (files: GeneratedFile[]) => void;
  isAgentRunning: boolean;
}

const ChatIteration = ({ files, onFilesUpdated, isAgentRunning }: ChatIterationProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(MEMORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [diffView, setDiffView] = useState<{ file: string; diff: DiffLine[] } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevFilesRef = useRef<GeneratedFile[]>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save memory to localStorage whenever messages change
  useEffect(() => {
    try {
      const toSave = messages.filter((m) => !m.streaming).slice(-MAX_MEMORY);
      localStorage.setItem(MEMORY_KEY, JSON.stringify(toSave));
    } catch { /* noop */ }
  }, [messages]);

  // Reset memory when new build starts (files change from empty to populated)
  useEffect(() => {
    if (files.length > 0 && prevFilesRef.current.length === 0) {
      setMessages([]);
      localStorage.removeItem(MEMORY_KEY);
    }
    prevFilesRef.current = files;
  }, [files]);

  const clearMemory = () => {
    setMessages([]);
    localStorage.removeItem(MEMORY_KEY);
  };

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isRefining || files.length === 0) return;

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: "user", content: trimmed };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsRefining(true);

    // Snapshot current files for diff
    const snapshotFiles = [...files];

    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", streaming: true }]);

    // Build memory context (last N non-streaming messages)
    const recentHistory = updatedMessages.slice(-MAX_MEMORY).map((m) => ({
      role: m.role, content: m.content,
    }));

    try {
      const response = await fetch("/api/ai-agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentType: "refiner",
          goal: `User refinement request: ${trimmed}`,
          context: { currentFiles: files, conversationHistory: recentHistory },
        }),
      });

      if (!response.ok) throw new Error("Refiner request failed");

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let rawText = "";
      let buffer = "";
      let finalResult: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content !== undefined) {
                rawText += data.content;
                setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: rawText } : m));
              } else if (data.result !== undefined) {
                finalResult = data.result;
                if (data.tokens) addSessionTokens(data.tokens);
              }
            } catch { /* skip */ }
          }
        }
      }

      if (finalResult?.files && Array.isArray(finalResult.files)) {
        const updatedFiles = [...files];
        const changedNames: string[] = [];

        for (const changedFile of finalResult.files) {
          const existingIdx = updatedFiles.findIndex((f) => f.path === changedFile.path);
          if (existingIdx >= 0) {
            // Compute diff before update
            const oldContent = updatedFiles[existingIdx].content;
            const newContent = changedFile.content;
            if (oldContent !== newContent) {
              changedNames.push(changedFile.path);
              // Store diff for first changed file
              if (changedNames.length === 1) {
                const diff = computeDiff(oldContent, newContent);
                if (diff.length > 0) setDiffView({ file: changedFile.path, diff });
              }
            }
            updatedFiles[existingIdx] = changedFile;
          } else {
            updatedFiles.push(changedFile);
            changedNames.push(changedFile.path);
          }
        }

        onFilesUpdated(updatedFiles);
        const summary = finalResult.summary || finalResult.explanation || `Updated ${changedNames.length} file(s)`;

        setMessages((prev) => prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: summary, streaming: false, changedFiles: changedNames }
            : m
        ));
      } else {
        setMessages((prev) => prev.map((m) =>
          m.id === assistantId ? { ...m, content: rawText || "Changes applied.", streaming: false } : m
        ));
      }
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId
          ? { ...m, content: "Sorry, something went wrong. Please try again.", streaming: false }
          : m
      ));
    } finally {
      setIsRefining(false);
    }
  }, [input, isRefining, files, messages, onFilesUpdated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  if (files.length === 0) return null;

  return (
    <div className="glass-card rounded-xl border border-border/50 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
        <h3 className="text-sm sm:text-base font-semibold text-foreground">Refine with AI</h3>
        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Chat to modify your code
          </span>
          {messages.length > 0 && (
            <button onClick={clearMemory} className="text-[10px] text-muted-foreground hover:text-destructive transition-colors" title="Clear chat history">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Diff view */}
      <AnimatePresence>
        {diffView && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 border border-border/40 rounded-lg overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/30">
              <div className="flex items-center gap-1.5">
                <GitCompare className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px]">{diffView.file}</span>
              </div>
              <button onClick={() => setDiffView(null)}>
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto bg-background/50 p-2 font-mono text-[9px] sm:text-[10px]">
              {diffView.diff.map((line, i) => (
                <div key={i} className={line.type === "added" ? "text-emerald-400 bg-emerald-500/5" : "text-rose-400 bg-rose-500/5"}>
                  {line.type === "added" ? "+" : "-"} {line.content || " "}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat messages */}
      <div className="space-y-3 max-h-[300px] overflow-y-auto mb-4 pr-1">
        {messages.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-border/40 rounded-lg">
            <Bot className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              Ask me to refine the generated code. E.g. "Make buttons rounded" or "Add dark mode toggle"
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                data-testid={`chat-message-${msg.id}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {msg.role === "assistant"
                    ? <AgentAvatar agent="refiner" size="sm" isActive={msg.streaming} />
                    : <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                      </div>
                  }
                </div>
                <div className={`max-w-[80%] space-y-1`}>
                  <div className={`px-3 py-2 rounded-xl text-xs sm:text-sm ${
                    msg.role === "user"
                      ? "bg-primary/10 text-foreground border border-primary/20 rounded-tr-none"
                      : "bg-muted/40 text-foreground/90 border border-border/30 rounded-tl-none"
                  }`}>
                    {msg.content}
                    {msg.streaming && <span className="inline-block w-1 h-3.5 ml-0.5 bg-primary animate-pulse rounded-sm" />}
                  </div>
                  {msg.changedFiles && msg.changedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-1">
                      {msg.changedFiles.map((f) => (
                        <span key={f} className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-mono">
                          {f.split("/").pop()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isAgentRunning ? "Wait for agents to finish..." : "Describe a change (e.g. 'add a loading spinner')"}
          disabled={isRefining || isAgentRunning}
          rows={2}
          className="resize-none text-xs sm:text-sm flex-1"
          data-testid="input-chat-refine"
        />
        <Button size="sm" onClick={handleSubmit}
          disabled={!input.trim() || isRefining || isAgentRunning || files.length === 0}
          className="h-[58px] px-3" data-testid="button-chat-submit"
        >
          {isRefining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5">Press Enter to send · Chat history is remembered across sessions</p>
    </div>
  );
};

export default ChatIteration;

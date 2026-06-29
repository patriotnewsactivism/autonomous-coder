import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { Send, StopCircle, Sparkles, Bot, Mic, MicOff, Loader2, ChevronDown } from "lucide-react";
import { BuildMode, ProjectType, PROJECT_TYPES } from "./VibeInput";

interface CompactInputProps {
  onSubmit: (goal: string, mode: BuildMode, projectType?: ProjectType) => void;
  isRunning: boolean;
  onStop?: () => void;
}

export default function CompactInput({ onSubmit, isRunning, onStop }: CompactInputProps) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<BuildMode>("vibe");
  const [showModeMenu, setShowModeMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = useCallback(() => {
    const val = input.trim();
    if (!val || isRunning) return;
    onSubmit(val, mode);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "36px";
  }, [input, isRunning, mode, onSubmit]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // auto-grow up to 3 lines
    const el = e.target;
    el.style.height = "36px";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  };

  return (
    <div className="flex items-end gap-2 flex-1 min-w-0">
      {/* Mode toggle */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setShowModeMenu(m => !m)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            mode === "superagent"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-muted/40 border-border/40 text-muted-foreground hover:text-foreground"
          }`}
        >
          {mode === "superagent" ? <Bot className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
          <span className="hidden sm:inline">{mode === "superagent" ? "Super" : "Vibe"}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
        {showModeMenu && (
          <div className="absolute top-full mt-1 left-0 z-50 bg-popover border border-border rounded-lg shadow-xl p-1 min-w-[160px]">
            {[
              { id: "vibe" as BuildMode, icon: Sparkles, label: "Vibe Build", desc: "Multi-agent pipeline" },
              { id: "superagent" as BuildMode, icon: Bot, label: "Superagent", desc: "Full autonomy" },
            ].map(({ id, icon: Icon, label, desc }) => (
              <button key={id} onClick={() => { setMode(id); setShowModeMenu(false); }}
                className={`w-full flex items-start gap-2 px-3 py-2 rounded-md text-left transition-colors ${mode === id ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"}`}>
                <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs font-medium">{label}</div>
                  <div className="text-[10px] text-muted-foreground">{desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Text input */}
      <div className={`flex-1 flex items-end gap-2 bg-muted/30 border rounded-xl px-3 py-2 transition-all ${
        isRunning ? "border-primary/40 shadow-[0_0_12px_rgba(99,102,241,0.1)]" : "border-border/40 focus-within:border-primary/50"
      }`}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={isRunning ? "Agents are working…" : mode === "superagent" ? "Give me any project, fully autonomous…" : "What do you want to build?"}
          disabled={isRunning}
          rows={1}
          style={{ height: "36px", minHeight: "36px" }}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 resize-none outline-none leading-5 py-1"
        />

        {isRunning ? (
          <button
            onClick={onStop}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/90 hover:bg-destructive text-destructive-foreground text-xs font-semibold transition-colors"
          >
            <StopCircle className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">Stop</span>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Build</span>
          </button>
        )}
      </div>
    </div>
  );
}

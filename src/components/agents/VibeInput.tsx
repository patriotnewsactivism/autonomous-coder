import { useState, useCallback, useEffect, useRef } from "react";
import { Send, Loader2, Sparkles, StopCircle, Lightbulb, ChevronDown, ChevronUp, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface VibeInputProps {
  onSubmit: (goal: string) => void;
  isRunning: boolean;
  onStop?: () => void;
}

const TEMPLATES = [
  { icon: "🛒", label: "E-commerce Store", desc: "Full product catalog with cart and checkout" },
  { icon: "📊", label: "Analytics Dashboard", desc: "Charts, KPIs, and data visualizations" },
  { icon: "✅", label: "Task Manager", desc: "Kanban board with drag-and-drop tasks" },
  { icon: "🌐", label: "Landing Page", desc: "Hero, features, pricing, and CTA sections" },
  { icon: "💬", label: "AI Chat Interface", desc: "Real-time streaming chat with AI responses" },
  { icon: "📱", label: "Social Feed", desc: "Posts, likes, comments, and infinite scroll" },
  { icon: "🔐", label: "Auth System", desc: "Login, signup, and protected routes with JWT" },
  { icon: "📰", label: "Blog CMS", desc: "Article editor, categories, and reader view" },
];

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const VibeInput = ({ onSubmit, isRunning, onStop }: VibeInputProps) => {
  const [input, setInput] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setVoiceSupported(true);
      const recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput((prev) => {
          const base = prev.replace(/\s*\[listening\.\.\.\]\s*$/, "").trim();
          return base ? `${base} ${transcript}` : transcript;
        });
      };

      recognition.onend = () => {
        setIsListening(false);
        setInput((prev) => prev.replace(/\s*\[listening\.\.\.\]\s*$/, "").trim());
      };

      recognition.onerror = () => {
        setIsListening(false);
        setInput((prev) => prev.replace(/\s*\[listening\.\.\.\]\s*$/, "").trim());
      };

      recognitionRef.current = recognition;
    }

    return () => {
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
    };
  }, []);

  const toggleVoice = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInput((prev) => prev + (prev ? " [listening...]" : "[listening...]"));
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const cleaned = input.replace(/\[listening\.\.\.\]/g, "").trim();
      if (cleaned && !isRunning) onSubmit(cleaned);
    },
    [input, isRunning, onSubmit]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    setInput(`Build a ${template.label}: ${template.desc}. Use React, TypeScript, and Tailwind CSS with a modern dark theme.`);
    setShowTemplates(false);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative glass-card rounded-xl sm:rounded-2xl border border-border/50 overflow-hidden transition-all focus-within:border-primary/50 focus-within:shadow-glow">
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border/30">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-foreground flex-1">
              What do you want to build?
            </span>
            <div className="flex items-center gap-1.5">
              {voiceSupported && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`flex items-center gap-1 text-[10px] sm:text-xs transition-colors ${isListening ? "text-rose-400 animate-pulse" : "text-muted-foreground hover:text-primary"}`}
                  data-testid="button-voice-input"
                  title={isListening ? "Stop listening" : "Speak your idea"}
                >
                  {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{isListening ? "Listening..." : "Voice"}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowTemplates((p) => !p)}
                className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground hover:text-primary transition-colors"
                data-testid="button-show-templates"
              >
                <Lightbulb className="h-3 w-3" />
                <span className="hidden sm:inline">Templates</span>
                {showTemplates ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your app in detail... (e.g. 'Build a task manager with kanban board, drag-and-drop, and dark mode')"
            disabled={isRunning}
            rows={4}
            data-testid="input-vibe-goal"
            className={`w-full px-3 sm:px-4 py-3 sm:py-4 bg-transparent text-foreground placeholder:text-muted-foreground/50 resize-none outline-none text-xs sm:text-sm ${isListening ? "border-l-2 border-l-rose-400" : ""}`}
          />

          <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-t border-border/30 bg-muted/20">
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
              {isRunning ? "AI agents are working autonomously..." : "Press Enter to start · Shift+Enter for new line"}
            </p>
            <p className="text-[10px] text-muted-foreground sm:hidden">
              {isRunning ? "Working..." : "Tap Build"}
            </p>

            {isRunning ? (
              <Button type="button" variant="destructive" size="sm" onClick={onStop} className="gap-2 h-8 px-3 text-xs" data-testid="button-stop">
                <StopCircle className="h-3.5 w-3.5" /> Stop
              </Button>
            ) : (
              <Button type="submit" disabled={!input.replace(/\[listening\.\.\.\]/g, "").trim()} size="sm" className="gap-2 glow-button h-8 px-3 text-xs" data-testid="button-start-building">
                <Send className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Start Building</span>
                <span className="sm:hidden">Build</span>
              </Button>
            )}
          </div>
        </div>

        {isRunning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl sm:rounded-2xl"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary animate-spin" />
              <span className="text-xs sm:text-sm font-medium text-foreground">Agents working autonomously...</span>
            </div>
          </motion.div>
        )}
      </form>

      {/* Templates */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2"
          >
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                onClick={() => applyTemplate(t)}
                className="text-left p-2.5 sm:p-3 rounded-xl border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                data-testid={`template-${t.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="text-base sm:text-lg mb-1">{t.icon}</div>
                <p className="text-[10px] sm:text-xs font-medium text-foreground group-hover:text-primary transition-colors">{t.label}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{t.desc}</p>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VibeInput;

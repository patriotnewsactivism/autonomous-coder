import { useState, useCallback, useEffect, useRef } from "react";
import { Send, Loader2, Sparkles, StopCircle, Lightbulb, ChevronDown, ChevronUp, Mic, MicOff, Bot, Hammer, Globe, Smartphone, Code2, Database, Layout, Cpu, Rocket, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export type BuildMode = "vibe" | "employee";

export interface ProjectType {
  id: string;
  icon: string;
  label: string;
  desc: string;
  techStack: string;
  agentHint: string;
}

export const PROJECT_TYPES: ProjectType[] = [
  { id: "website", icon: "🌐", label: "Website", desc: "Full website with pages, navigation, and responsive design", techStack: "React, TypeScript, Tailwind CSS", agentHint: "Focus on UI/UX, routing, responsive layouts" },
  { id: "webapp", icon: "📊", label: "Web App", desc: "Interactive application with state management and API integration", techStack: "React, TypeScript, Tailwind, REST API", agentHint: "Focus on state management, API calls, data flow" },
  { id: "pwa", icon: "📱", label: "Progressive Web App", desc: "Installable app with offline support and push notifications", techStack: "React, TypeScript, Service Workers, PWA manifest", agentHint: "Focus on service workers, offline caching, manifest, installability" },
  { id: "mobile", icon: "📲", label: "Mobile App", desc: "Cross-platform mobile application", techStack: "React Native, TypeScript, Expo", agentHint: "Focus on mobile UI patterns, navigation, native APIs" },
  { id: "api", icon: "🔌", label: "API / Backend", desc: "REST or GraphQL API with database and authentication", techStack: "Node.js, Express, PostgreSQL, JWT", agentHint: "Focus on routes, middleware, database schema, auth" },
  { id: "python", icon: "🐍", label: "Python App", desc: "Python application, script, or data pipeline", techStack: "Python, FastAPI, SQLAlchemy", agentHint: "Focus on Python best practices, type hints, async" },
  { id: "fullstack", icon: "🚀", label: "Full-Stack App", desc: "Complete app with frontend, backend, database, and auth", techStack: "React, Node.js, PostgreSQL, Supabase", agentHint: "Build complete stack with API, DB schema, frontend" },
  { id: "landing", icon: "✨", label: "Landing Page", desc: "High-converting page with hero, features, pricing, CTA", techStack: "React, Tailwind, Framer Motion", agentHint: "Focus on conversion, visual impact, animations" },
  { id: "dashboard", icon: "📈", label: "Dashboard", desc: "Data visualization with charts, KPIs, and real-time updates", techStack: "React, Recharts, Tailwind, WebSocket", agentHint: "Focus on charts, data tables, real-time updates" },
  { id: "automation", icon: "⚡", label: "Automation Script", desc: "Automated workflow, scraper, or data processing pipeline", techStack: "Python/Node.js, cron, webhooks", agentHint: "Focus on reliability, error handling, scheduling" },
];

const QUICK_TEMPLATES = [
  { icon: "🛒", label: "E-commerce Store", desc: "Full product catalog with cart and checkout" },
  { icon: "📊", label: "Analytics Dashboard", desc: "Charts, KPIs, and data visualizations" },
  { icon: "✅", label: "Task Manager", desc: "Kanban board with drag-and-drop tasks" },
  { icon: "💬", label: "AI Chat Interface", desc: "Real-time streaming chat with AI responses" },
  { icon: "📱", label: "Social Feed", desc: "Posts, likes, comments, and infinite scroll" },
  { icon: "🔐", label: "Auth System", desc: "Login, signup, and protected routes with JWT" },
  { icon: "📰", label: "Blog CMS", desc: "Article editor, categories, and reader view" },
  { icon: "🎨", label: "Portfolio Site", desc: "Creative portfolio with project showcase" },
];

interface VibeInputProps {
  onSubmit: (goal: string, mode: BuildMode, projectType?: ProjectType) => void;
  isRunning: boolean;
  onStop?: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const VibeInput = ({ onSubmit, isRunning, onStop }: VibeInputProps) => {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<BuildMode>("vibe");
  const [selectedProjectType, setSelectedProjectType] = useState<ProjectType | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showProjectTypes, setShowProjectTypes] = useState(false);
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
        for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
        setInput((prev) => {
          const base = prev.replace(/\s*\[listening\.\.\.\]\s*$/, "").trim();
          return base ? `${base} ${transcript}` : transcript;
        });
      };
      recognition.onend = () => { setIsListening(false); setInput((prev) => prev.replace(/\s*\[listening\.\.\.\]\s*$/, "").trim()); };
      recognition.onerror = () => { setIsListening(false); setInput((prev) => prev.replace(/\s*\[listening\.\.\.\]\s*$/, "").trim()); };
      recognitionRef.current = recognition;
    }
    return () => { try { recognitionRef.current?.stop(); } catch { /* noop */ } };
  }, []);

  const toggleVoice = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); }
    else { setInput((prev) => prev + (prev ? " [listening...]" : "[listening...]")); recognitionRef.current.start(); setIsListening(true); }
  }, [isListening]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = input.replace(/\[listening\.\.\.\]/g, "").trim();
    if (cleaned && !isRunning) onSubmit(cleaned, mode, selectedProjectType || undefined);
  }, [input, isRunning, onSubmit, mode, selectedProjectType]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); }
  };

  const applyTemplate = (t: typeof QUICK_TEMPLATES[0]) => {
    setInput(`Build a ${t.label}: ${t.desc}. Use React, TypeScript, and Tailwind CSS with a modern dark theme.`);
    setShowTemplates(false);
  };

  return (
    <div className="space-y-3">
      {/* Mode Selector */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setMode("vibe")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
            mode === "vibe"
              ? "border-primary bg-primary/10 text-primary shadow-glow"
              : "border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
          }`}
        >
          <Hammer className="h-4 w-4" />
          <span>Vibe Builder</span>
        </button>
        <button
          onClick={() => { setMode("employee"); setShowProjectTypes(true); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
            mode === "employee"
              ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
              : "border-border/40 text-muted-foreground hover:border-emerald-500/40 hover:text-foreground"
          }`}
        >
          <Bot className="h-4 w-4" />
          <span>AI Employee</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">NEW</span>
        </button>
      </div>

      {/* AI Employee - Project Type Selector */}
      <AnimatePresence>
        {mode === "employee" && showProjectTypes && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div className="mb-2 text-center">
              <p className="text-xs text-muted-foreground">Select a project type — your AI employee will work autonomously</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PROJECT_TYPES.map((pt) => (
                <button
                  key={pt.id}
                  onClick={() => { setSelectedProjectType(pt); setShowProjectTypes(false); }}
                  className={`text-left p-2.5 sm:p-3 rounded-xl border transition-all group ${
                    selectedProjectType?.id === pt.id
                      ? "border-emerald-500/60 bg-emerald-500/10"
                      : "border-border/40 hover:border-emerald-500/40 hover:bg-emerald-500/5"
                  }`}
                >
                  <div className="text-base sm:text-lg mb-1">{pt.icon}</div>
                  <p className="text-[10px] sm:text-xs font-medium text-foreground group-hover:text-emerald-400 transition-colors">{pt.label}</p>
                  <p className="text-[8px] sm:text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{pt.desc}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Project Type Badge */}
      {mode === "employee" && selectedProjectType && !showProjectTypes && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setShowProjectTypes(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <span>{selectedProjectType.icon}</span>
            <span className="font-medium">{selectedProjectType.label}</span>
            <span className="text-[10px] text-emerald-400/60">· {selectedProjectType.techStack.split(",")[0]}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="relative">
        <div className={`relative glass-card rounded-xl sm:rounded-2xl border overflow-hidden transition-all focus-within:shadow-glow ${
          mode === "employee" ? "border-emerald-500/30 focus-within:border-emerald-500/50" : "border-border/50 focus-within:border-primary/50"
        }`}>
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border/30">
            {mode === "employee" ? (
              <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-medium text-foreground flex-1">
              {mode === "employee"
                ? "Describe your project — AI will handle the rest"
                : "What do you want to build?"}
            </span>
            <div className="flex items-center gap-1.5">
              {voiceSupported && (
                <button type="button" onClick={toggleVoice}
                  className={`flex items-center gap-1 text-[10px] sm:text-xs transition-colors ${isListening ? "text-rose-400 animate-pulse" : "text-muted-foreground hover:text-primary"}`}
                  title={isListening ? "Stop listening" : "Speak your idea"}>
                  {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{isListening ? "Listening..." : "Voice"}</span>
                </button>
              )}
              {mode === "vibe" && (
                <button type="button" onClick={() => setShowTemplates((p) => !p)}
                  className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground hover:text-primary transition-colors">
                  <Lightbulb className="h-3 w-3" />
                  <span className="hidden sm:inline">Templates</span>
                  {showTemplates ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
            </div>
          </div>

          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={mode === "employee"
              ? "e.g. 'Build me a SaaS dashboard with user auth, Stripe billing, and admin panel'..."
              : "Describe your app in detail..."}
            disabled={isRunning} rows={4}
            className={`w-full px-3 sm:px-4 py-3 sm:py-4 bg-transparent text-foreground placeholder:text-muted-foreground/50 resize-none outline-none text-xs sm:text-sm ${isListening ? "border-l-2 border-l-rose-400" : ""}`}
          />

          <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-t border-border/30 bg-muted/20">
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
              {isRunning
                ? mode === "employee" ? "🤖 AI Employee working autonomously — you'll be notified on decisions..." : "AI agents are working autonomously..."
                : "Press Enter to start · Shift+Enter for new line"}
            </p>
            <p className="text-[10px] text-muted-foreground sm:hidden">
              {isRunning ? "Working..." : "Tap to start"}
            </p>

            {isRunning ? (
              <Button type="button" variant="destructive" size="sm" onClick={onStop} className="gap-2 h-8 px-3 text-xs">
                <StopCircle className="h-3.5 w-3.5" /> Stop
              </Button>
            ) : (
              <Button type="submit"
                disabled={!input.replace(/\[listening\.\.\.\]/g, "").trim() || (mode === "employee" && !selectedProjectType)}
                size="sm"
                className={`gap-2 h-8 px-3 text-xs ${mode === "employee" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "glow-button"}`}>
                {mode === "employee" ? <Bot className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{mode === "employee" ? "Deploy Employee" : "Start Building"}</span>
                <span className="sm:hidden">{mode === "employee" ? "Deploy" : "Build"}</span>
              </Button>
            )}
          </div>
        </div>

        {isRunning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl sm:rounded-2xl">
            <div className="flex items-center gap-2 sm:gap-3">
              <Loader2 className={`h-5 w-5 sm:h-6 sm:w-6 animate-spin ${mode === "employee" ? "text-emerald-400" : "text-primary"}`} />
              <span className="text-xs sm:text-sm font-medium text-foreground">
                {mode === "employee" ? "AI Employee working autonomously..." : "Agents working..."}
              </span>
            </div>
          </motion.div>
        )}
      </form>

      {/* Quick Templates (Vibe mode only) */}
      <AnimatePresence>
        {showTemplates && mode === "vibe" && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUICK_TEMPLATES.map((t) => (
              <button key={t.label} onClick={() => applyTemplate(t)}
                className="text-left p-2.5 sm:p-3 rounded-xl border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all group">
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

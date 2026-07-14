import { useState } from "react";
import { AgentType } from "@/lib/agents";
import {
  Brain, Code2, Database, Globe, Layers, Shield, Zap, Rocket,
  CheckCircle2, Search, Map, FileText, Smartphone, BarChart3,
  BookOpen, TrendingUp, FlaskConical, ChevronDown, Settings2,
  Sparkles, X, RotateCcw
} from "lucide-react";

export type AgentPreset = "auto" | "quick" | "full" | "research" | "bugfix" | "custom";

const AGENT_META: Record<string, { icon: any; label: string; color: string; category: string; desc: string }> = {
  orchestrator:  { icon: Brain,         label: "Orchestrator",   color: "text-purple-400",  category: "Core",     desc: "Master planner" },
  strategist:    { icon: Map,           label: "Strategist",     color: "text-blue-400",    category: "Core",     desc: "Architecture decisions" },
  researcher:    { icon: Search,        label: "Researcher",     color: "text-cyan-400",    category: "Research", desc: "Pre-build intelligence" },
  architect:     { icon: Layers,        label: "Architect",      color: "text-indigo-400",  category: "Research", desc: "System design" },
  analyst:       { icon: BarChart3,     label: "Analyst",        color: "text-sky-400",     category: "Research", desc: "Requirements & risks" },
  database:      { icon: Database,      label: "Database",       color: "text-amber-400",   category: "Build",    desc: "Data models & queries" },
  api:           { icon: Globe,         label: "API",            color: "text-green-400",   category: "Build",    desc: "REST/GraphQL design" },
  ui:            { icon: Layers,        label: "UI/UX",          color: "text-pink-400",    category: "Build",    desc: "Interface design" },
  builder:       { icon: Code2,         label: "Builder",        color: "text-violet-400",  category: "Build",    desc: "Core code generation" },
  mobile:        { icon: Smartphone,    label: "Mobile",         color: "text-fuchsia-400", category: "Build",    desc: "Responsive & PWA" },
  testing:       { icon: FlaskConical,  label: "Testing",        color: "text-yellow-400",  category: "Quality",  desc: "Unit & integration tests" },
  security:      { icon: Shield,        label: "Security",       color: "text-red-400",     category: "Quality",  desc: "Vulnerability audit" },
  performance:   { icon: Zap,           label: "Performance",    color: "text-orange-400",  category: "Quality",  desc: "Speed optimization" },
  seo:           { icon: TrendingUp,    label: "SEO",            color: "text-lime-400",    category: "Polish",   desc: "Search visibility" },
  a11y:          { icon: CheckCircle2,  label: "Accessibility",  color: "text-teal-400",    category: "Polish",   desc: "WCAG 2.2 compliance" },
  docs:          { icon: BookOpen,      label: "Docs",           color: "text-slate-400",   category: "Polish",   desc: "README & API docs" },
  optimizer:     { icon: TrendingUp,    label: "Optimizer",      color: "text-emerald-400", category: "Polish",   desc: "Bundle & runtime" },
  reviewer:      { icon: CheckCircle2,  label: "Reviewer",       color: "text-blue-400",    category: "Review",   desc: "Code quality audit" },
  fixer:         { icon: Zap,           label: "Fixer",          color: "text-orange-400",  category: "Review",   desc: "Auto-fix issues" },
  refiner:       { icon: FileText,      label: "Refiner",        color: "text-purple-300",  category: "Review",   desc: "Final polish" },
  deployer:      { icon: Rocket,        label: "Deployer",       color: "text-green-500",   category: "Deploy",   desc: "CI/CD & Docker" },
};

const CATEGORIES = ["Core", "Research", "Build", "Quality", "Polish", "Review", "Deploy"];

export const PRESETS: Record<AgentPreset, { label: string; icon: any; desc: string; agents: string[] }> = {
  auto:     { label: "Auto",      icon: Sparkles,   desc: "Orchestrator decides",       agents: [] },
  quick:    { label: "Quick",     icon: Zap,        desc: "Core build only ~3 agents",  agents: ["strategist", "builder", "reviewer", "fixer"] },
  full:     { label: "Full Stack",icon: Code2,      desc: "Complete web app pipeline",  agents: ["researcher", "architect", "strategist", "database", "api", "ui", "builder", "testing", "reviewer", "fixer"] },
  research: { label: "Research",  icon: Search,     desc: "Deep research before build", agents: ["researcher", "analyst", "architect", "strategist", "database", "api", "ui", "builder", "mobile", "testing", "security", "performance", "seo", "a11y", "docs", "reviewer", "fixer", "optimizer", "deployer"] },
  bugfix:   { label: "Bug Fix",   icon: Shield,     desc: "Diagnose & fix only",        agents: ["analyst", "fixer", "reviewer"] },
  custom:   { label: "Custom",    icon: Settings2,  desc: "Pick your agents",           agents: [] },
};

interface AgentSelectorProps {
  value: AgentPreset;
  customAgents: AgentType[];
  onChange: (preset: AgentPreset, agents: AgentType[]) => void;
}

export default function AgentSelector({ value, customAgents, onChange }: AgentSelectorProps) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<AgentPreset>(value);
  const [selected, setSelected] = useState<Set<string>>(new Set(customAgents));

  const currentPreset = PRESETS[activePreset];

  const selectPreset = (preset: AgentPreset) => {
    setActivePreset(preset);
    if (preset !== "custom") {
      const agents = PRESETS[preset].agents as AgentType[];
      setSelected(new Set(agents));
      onChange(preset, agents);
      if (preset !== "auto") setOpen(false);
    }
  };

  const toggleAgent = (agent: string) => {
    const next = new Set(selected);
    if (next.has(agent)) next.delete(agent);
    else next.add(agent);
    setSelected(next);
    onChange("custom", [...next] as AgentType[]);
  };

  const PresetIcon = currentPreset.icon;

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/40 text-xs text-muted-foreground hover:bg-muted/60 transition-colors"
      >
        <PresetIcon className="h-3.5 w-3.5 text-violet-400" />
        <span className="font-medium text-foreground">{currentPreset.label}</span>
        {activePreset === "custom" && selected.size > 0 && (
          <span className="text-[10px] bg-violet-500/20 text-violet-300 rounded-full px-1.5 py-0.5">{selected.size}</span>
        )}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-50 w-80 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
            {/* Presets row */}
            <div className="p-2 border-b border-border/50 bg-muted/20">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Pipeline Preset</p>
              <div className="grid grid-cols-3 gap-1">
                {(Object.entries(PRESETS) as [AgentPreset, typeof PRESETS[AgentPreset]][]).map(([key, preset]) => {
                  const Icon = preset.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => selectPreset(key)}
                      className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border text-center transition-all ${
                        activePreset === key
                          ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
                          : "border-border/40 hover:border-border hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium leading-tight">{preset.label}</span>
                      <span className="text-[9px] opacity-60 leading-tight">{preset.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom agent picker — only shown in custom mode */}
            {activePreset === "custom" && (
              <div className="p-2 max-h-72 overflow-y-auto">
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Select Agents</p>
                  <div className="flex gap-1">
                    <button onClick={() => { const all = new Set(Object.keys(AGENT_META)); setSelected(all); onChange("custom", [...all] as AgentType[]); }}
                      className="text-[10px] text-violet-400 hover:text-violet-300 px-1.5 py-0.5 rounded bg-violet-500/10">All</button>
                    <button onClick={() => { setSelected(new Set()); onChange("custom", []); }}
                      className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-muted/40">None</button>
                  </div>
                </div>
                {CATEGORIES.map(cat => {
                  const agents = Object.entries(AGENT_META).filter(([, m]) => m.category === cat);
                  if (!agents.length) return null;
                  return (
                    <div key={cat} className="mb-2">
                      <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1 px-0.5">{cat}</p>
                      <div className="space-y-0.5">
                        {agents.map(([agent, meta]) => {
                          const Icon = meta.icon;
                          const isOn = selected.has(agent);
                          return (
                            <button
                              key={agent}
                              onClick={() => toggleAgent(agent)}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all ${
                                isOn ? "bg-violet-500/10 border border-violet-500/30 text-foreground" : "hover:bg-muted/40 text-muted-foreground border border-transparent"
                              }`}
                            >
                              <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${isOn ? meta.color : "text-slate-600"}`} />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium">{meta.label}</span>
                                <span className="text-[10px] text-muted-foreground ml-1.5">{meta.desc}</span>
                              </div>
                              <div className={`h-4 w-4 rounded-sm border flex-shrink-0 flex items-center justify-center ${
                                isOn ? "bg-violet-500 border-violet-500" : "border-border/50"
                              }`}>
                                {isOn && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            {activePreset === "custom" && (
              <div className="p-2 border-t border-border/50 bg-muted/10 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{selected.size} agents selected</span>
                <button
                  onClick={() => setOpen(false)}
                  className="text-[11px] bg-violet-500 text-white px-3 py-1 rounded-lg hover:bg-violet-600 transition-colors font-medium"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

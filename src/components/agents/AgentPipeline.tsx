import { AgentType } from "@/lib/agents";
import {
  Brain, Code2, Database, Globe, Layers, Shield, Zap, Rocket,
  CheckCircle2, XCircle, Loader2, Clock, Search, Map, FileText,
  Smartphone, BarChart3, Accessibility, BookOpen, TrendingUp, FlaskConical
} from "lucide-react";

const AGENT_META: Record<AgentType, { icon: any; label: string; color: string; category: string; model?: string }> = {
  orchestrator:  { icon: Brain,         label: "Orchestrator",  color: "text-purple-400",  category: "Core",       model: "DeepSeek V4 Pro" },
  strategist:    { icon: Map,           label: "Strategist",    color: "text-blue-400",    category: "Core",       model: "DeepSeek Flash" },
  researcher:    { icon: Search,        label: "Researcher",    color: "text-cyan-400",    category: "Research",   model: "DeepSeek V4 Pro" },
  architect:     { icon: Layers,        label: "Architect",     color: "text-indigo-400",  category: "Research",   model: "DeepSeek V4 Pro" },
  analyst:       { icon: BarChart3,     label: "Analyst",       color: "text-sky-400",     category: "Research",   model: "DeepSeek V4 Pro" },
  database:      { icon: Database,      label: "Database",      color: "text-amber-400",   category: "Build",      model: "DeepSeek Flash" },
  api:           { icon: Globe,         label: "API",           color: "text-green-400",   category: "Build",      model: "DeepSeek Flash" },
  ui:            { icon: Layers,        label: "UI/UX",         color: "text-pink-400",    category: "Build",      model: "DeepSeek Flash" },
  builder:       { icon: Code2,         label: "Builder",       color: "text-violet-400",  category: "Build",      model: "DeepSeek Flash" },
  mobile:        { icon: Smartphone,    label: "Mobile",        color: "text-fuchsia-400", category: "Build",      model: "DeepSeek Flash" },
  testing:       { icon: FlaskConical,  label: "Testing",       color: "text-yellow-400",  category: "Quality",    model: "DeepSeek Flash" },
  security:      { icon: Shield,        label: "Security",      color: "text-red-400",     category: "Quality",    model: "DeepSeek V4 Pro" },
  performance:   { icon: Zap,           label: "Performance",   color: "text-orange-400",  category: "Quality",    model: "DeepSeek V4 Pro" },
  seo:           { icon: TrendingUp,    label: "SEO",           color: "text-lime-400",    category: "Polish",     model: "Kilo Auto" },
  a11y:          { icon: Accessibility, label: "Accessibility", color: "text-teal-400",    category: "Polish",     model: "Kilo Auto" },
  docs:          { icon: BookOpen,      label: "Docs",          color: "text-slate-400",   category: "Polish",     model: "Kilo Auto" },
  optimizer:     { icon: TrendingUp,    label: "Optimizer",     color: "text-emerald-400", category: "Polish",     model: "Kilo Auto" },
  reviewer:      { icon: CheckCircle2,  label: "Reviewer",      color: "text-blue-400",    category: "Review",     model: "DeepSeek V4 Pro" },
  fixer:         { icon: Zap,           label: "Fixer",         color: "text-orange-400",  category: "Review",     model: "DeepSeek Flash" },
  refiner:       { icon: FileText,      label: "Refiner",       color: "text-purple-300",  category: "Review",     model: "DeepSeek Flash" },
  deployer:      { icon: Rocket,        label: "Deployer",      color: "text-green-500",   category: "Deploy",     model: "DeepSeek Flash" },
};

const CATEGORY_ORDER = ["Core", "Research", "Build", "Quality", "Polish", "Review", "Deploy"];

interface AgentPipelineProps {
  currentAgent?: AgentType | null;
  completedAgents?: AgentType[];
  agentSequence?: AgentType[];
}

function AgentBadge({ agent, status }: { agent: AgentType; status: "waiting" | "running" | "done" | "failed" }) {
  const meta = AGENT_META[agent] || { icon: Brain, label: agent, color: "text-slate-400", category: "Other" };
  const Icon = meta.icon;

  const statusIcon =
    status === "running" ? <Loader2 className="w-3 h-3 animate-spin text-yellow-400" /> :
    status === "done"    ? <CheckCircle2 className="w-3 h-3 text-green-400" /> :
    status === "failed"  ? <XCircle className="w-3 h-3 text-red-400" /> :
                           <Clock className="w-3 h-3 text-slate-600" />;

  const ring =
    status === "running" ? "border-yellow-500/50 bg-yellow-500/5 shadow-yellow-500/20 shadow-sm" :
    status === "done"    ? "border-green-500/40 bg-green-500/5" :
    status === "failed"  ? "border-red-500/40 bg-red-500/5" :
                           "border-slate-700/50 bg-slate-800/30 opacity-50";

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${ring} transition-all`}>
      <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
      <span className="text-xs font-medium text-slate-300">{meta.label}</span>
      {statusIcon}
      {meta.model && status !== "waiting" && (
        <span className="text-[10px] text-slate-500 hidden md:inline">{meta.model}</span>
      )}
    </div>
  );
}

const AgentPipeline = ({ currentAgent, completedAgents = [], agentSequence = [] }: AgentPipelineProps) => {
  if (!agentSequence.length) return null;

  // Group agents by category for display
  const grouped = CATEGORY_ORDER.reduce<Record<string, AgentType[]>>((acc, cat) => {
    const inCategory = agentSequence.filter(a => (AGENT_META[a]?.category || "Other") === cat);
    if (inCategory.length) acc[cat] = inCategory;
    return acc;
  }, {});

  const getStatus = (agent: AgentType) => {
    if (completedAgents.includes(agent)) return "done" as const;
    if (currentAgent === agent) return "running" as const;
    return "waiting" as const;
  };

  return (
    <div className="space-y-2">
      {Object.entries(grouped).map(([category, agents]) => (
        <div key={category}>
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-1 px-0.5">{category}</p>
          <div className="flex flex-wrap gap-1.5">
            {agents.map(agent => (
              <AgentBadge key={agent} agent={agent} status={getStatus(agent)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AgentPipeline;

import { Bot, Brain, Hammer, Search, Wrench, Sparkles, Wand2, Database, Globe, TestTube, Shield, Zap, Rocket } from "lucide-react";
import { AgentType } from "@/lib/agents";

interface AgentAvatarProps {
  agent: AgentType;
  isActive?: boolean;
  size?: "sm" | "md" | "lg";
}

export const agentConfig: Record<AgentType, { icon: typeof Bot; color: string; label: string; bg: string }> = {
  orchestrator: { icon: Sparkles, color: "text-primary", label: "Orchestrator", bg: "bg-primary/10" },
  strategist:   { icon: Brain,    color: "text-violet-400", label: "Strategist",   bg: "bg-violet-500/10" },
  database:     { icon: Database, color: "text-blue-400",   label: "Database",     bg: "bg-blue-500/10" },
  api:          { icon: Globe,    color: "text-indigo-400", label: "API",          bg: "bg-indigo-500/10" },
  ui:           { icon: Wand2,    color: "text-pink-400",   label: "UI",           bg: "bg-pink-500/10" },
  builder:      { icon: Hammer,   color: "text-emerald-400",label: "Builder",      bg: "bg-emerald-500/10" },
  testing:      { icon: TestTube, color: "text-cyan-400",   label: "Testing",      bg: "bg-cyan-500/10" },
  security:     { icon: Shield,   color: "text-orange-400", label: "Security",     bg: "bg-orange-500/10" },
  performance:  { icon: Zap,      color: "text-yellow-400", label: "Performance",  bg: "bg-yellow-500/10" },
  reviewer:     { icon: Search,   color: "text-amber-400",  label: "Reviewer",     bg: "bg-amber-500/10" },
  fixer:        { icon: Wrench,   color: "text-rose-400",   label: "Fixer",        bg: "bg-rose-500/10" },
  refiner:      { icon: Wand2,    color: "text-sky-400",    label: "Refiner",      bg: "bg-sky-500/10" },
  deployer:     { icon: Rocket,   color: "text-teal-400",   label: "Deployer",     bg: "bg-teal-500/10" },
};

const sizeClasses = { sm: "h-7 w-7", md: "h-10 w-10", lg: "h-14 w-14" };
const iconSizes   = { sm: "h-3.5 w-3.5", md: "h-5 w-5", lg: "h-7 w-7" };

const AgentAvatar = ({ agent, isActive = false, size = "md" }: AgentAvatarProps) => {
  const config = agentConfig[agent] ?? agentConfig.orchestrator;
  const Icon = config.icon;

  return (
    <div
      className={`
        relative flex items-center justify-center rounded-xl border
        ${sizeClasses[size]}
        ${isActive
          ? "border-primary/50 bg-primary/10 animate-pulse"
          : `border-border/50 ${config.bg}`
        }
        transition-all duration-300
      `}
    >
      <Icon className={`${iconSizes[size]} ${config.color}`} />
      {isActive && (
        <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary animate-ping" />
      )}
    </div>
  );
};

export default AgentAvatar;

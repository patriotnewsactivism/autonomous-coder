import AgentAvatar, { agentConfig } from "./AgentAvatar";
import { AgentType } from "@/lib/agents";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";

interface AgentPipelineProps {
  currentAgent?: AgentType;
  completedAgents: AgentType[];
  agentSequence?: AgentType[];
}

const defaultSequence: AgentType[] = ["orchestrator", "strategist", "builder", "reviewer", "fixer"];

const AgentPipeline = ({ currentAgent, completedAgents, agentSequence }: AgentPipelineProps) => {
  const pipeline = agentSequence && agentSequence.length > 0 ? agentSequence : defaultSequence;

  const renderAgent = (agent: AgentType, index: number, isLast: boolean, compact: boolean) => {
    const isActive = currentAgent === agent;
    const isCompleted = completedAgents.includes(agent);
    const config = agentConfig[agent] ?? agentConfig.orchestrator;
    const size = compact ? "sm" : "md";

    return (
      <div key={`${agent}-${index}`} className={`flex items-center ${compact ? "gap-1" : "gap-2"}`}>
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: index * 0.06 }}
          className={`flex flex-col items-center ${compact ? "gap-0.5" : "gap-1 sm:gap-2"}`}
        >
          <div className={`relative ${isCompleted || isActive ? "opacity-100" : "opacity-35"}`}>
            <AgentAvatar agent={agent} isActive={isActive} size={size} />
            {isCompleted && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`absolute ${compact ? "-bottom-0.5 -right-0.5 h-2.5 w-2.5" : "-bottom-1 -right-1 h-3.5 w-3.5"} rounded-full bg-success flex items-center justify-center`}
              >
                <span className={compact ? "text-[6px]" : "text-[9px]"}>✓</span>
              </motion.div>
            )}
          </div>
          <span className={`font-medium text-center truncate ${compact ? "text-[8px] max-w-[40px]" : "text-[10px] sm:text-xs"} ${isActive ? config.color : "text-muted-foreground"}`}>
            {config.label}
          </span>
        </motion.div>

        {!isLast && (
          compact
            ? <ChevronRight className={`h-3 w-3 flex-shrink-0 ${completedAgents.includes(agent) ? "text-primary" : "text-muted-foreground/30"}`} />
            : <ArrowRight className={`h-3 w-3 sm:h-4 sm:w-4 mx-0.5 flex-shrink-0 ${completedAgents.includes(agent) ? "text-primary" : "text-muted-foreground/30"}`} />
        )}
      </div>
    );
  };

  return (
    <>
      {/* Desktop */}
      <div className="hidden sm:flex items-center justify-center flex-wrap gap-1 py-4 sm:py-6">
        {pipeline.map((agent, i) => renderAgent(agent, i, i === pipeline.length - 1, false))}
      </div>

      {/* Mobile - scrollable */}
      <div className="sm:hidden py-4 overflow-x-auto">
        <div className="flex items-center gap-1 px-2 w-max min-w-full justify-start">
          {pipeline.map((agent, i) => renderAgent(agent, i, i === pipeline.length - 1, true))}
        </div>
      </div>
    </>
  );
};

export default AgentPipeline;

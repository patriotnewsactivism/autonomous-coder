import { AgentMessage } from "@/lib/agents";
import AgentAvatar, { agentConfig } from "./AgentAvatar";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";

interface AgentActivityFeedProps {
  messages: AgentMessage[];
  currentAgent?: string;
  onRetry?: (agent: AgentMessage["agent"], goal?: string, context?: any) => void;
}

const typeIndicators = {
  thinking: "Thinking...",
  action: "Acting",
  result: "Complete",
  error: "Error",
  streaming: "Streaming",
};

const AgentActivityFeed = ({ messages, currentAgent, onRetry }: AgentActivityFeedProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="space-y-2 sm:space-y-3 max-h-[250px] sm:max-h-[500px] overflow-y-auto pr-1 sm:pr-2">
      {messages.length === 0 ? (
        <div className="text-center py-6 sm:py-8">
          <p className="text-muted-foreground text-xs sm:text-sm">
            Agent activity will appear here...
          </p>
        </div>
      ) : (
        <>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.02, 0.2) }}
              className={`
                flex gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border
                ${message.type === "error"
                  ? "border-destructive/30 bg-destructive/5"
                  : message.type === "streaming"
                  ? "border-primary/20 bg-primary/5"
                  : "border-border/30 bg-muted/20"
                }
              `}
              data-testid={`activity-message-${message.id}`}
            >
              <div className="flex-shrink-0">
                <AgentAvatar
                  agent={message.agent}
                  isActive={message.type === "streaming" || (currentAgent === message.agent && message.type === "thinking")}
                  size="sm"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1 flex-wrap">
                  <span className={`text-xs sm:text-sm font-medium ${agentConfig[message.agent]?.color || "text-foreground"}`}>
                    {agentConfig[message.agent]?.label || message.agent}
                  </span>
                  <span className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded ${
                    message.type === "thinking" ? "bg-primary/10 text-primary" :
                    message.type === "action" ? "bg-amber-500/10 text-amber-500" :
                    message.type === "result" ? "bg-success/10 text-success" :
                    message.type === "streaming" ? "bg-primary/10 text-primary" :
                    "bg-destructive/10 text-destructive"
                  }`}>
                    {typeIndicators[message.type] || message.type}
                  </span>
                  {message.type === "error" && onRetry && (
                    <button
                      onClick={() => onRetry(message.agent, message.retryGoal, message.retryContext)}
                      className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                      data-testid={`button-retry-${message.agent}`}
                    >
                      <RefreshCw className="h-2.5 w-2.5" /> Retry
                    </button>
                  )}
                </div>
                <p className="text-[10px] sm:text-sm text-foreground/80 break-words line-clamp-4 font-mono">
                  {message.content}
                  {message.type === "streaming" && (
                    <span className="inline-block w-1 h-3.5 ml-0.5 bg-primary animate-pulse rounded-sm align-middle" />
                  )}
                </p>
              </div>
            </motion.div>
          ))}
          <div ref={bottomRef} />
        </>
      )}
    </div>
  );
};

export default AgentActivityFeed;

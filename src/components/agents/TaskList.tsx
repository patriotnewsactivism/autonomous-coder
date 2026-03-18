import { AgentTask } from "@/lib/agents";
import { CheckCircle, Circle, Loader2, XCircle } from "lucide-react";
import { motion } from "framer-motion";

interface TaskListProps {
  tasks: AgentTask[];
  currentTaskId?: number;
}

const statusIcons = {
  pending: Circle,
  in_progress: Loader2,
  completed: CheckCircle,
  failed: XCircle,
};

const statusColors = {
  pending: "text-muted-foreground",
  in_progress: "text-primary",
  completed: "text-success",
  failed: "text-destructive",
};

const priorityColors = {
  high: "bg-destructive/20 text-destructive border-destructive/30",
  medium: "bg-warning/20 text-warning border-warning/30",
  low: "bg-muted text-muted-foreground border-border",
};

const TaskList = ({ tasks, currentTaskId }: TaskListProps) => {
  return (
    <div className="space-y-2 max-h-[300px] sm:max-h-[400px] overflow-y-auto pr-1">
      {tasks.map((task, index) => {
        const status = task.status || "pending";
        const StatusIcon = statusIcons[status];
        const isActive = task.id === currentTaskId;

        return (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`
              flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border transition-all
              ${isActive 
                ? "border-primary/50 bg-primary/5 shadow-glow" 
                : "border-border/30 bg-muted/10"
              }
            `}
            data-testid={`task-item-${task.id}`}
          >
            <StatusIcon 
              className={`
                h-4 w-4 sm:h-5 sm:w-5 mt-0.5 flex-shrink-0 ${statusColors[status]}
                ${status === "in_progress" ? "animate-spin" : ""}
              `}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start sm:items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1 flex-wrap">
                <span className="font-medium text-xs sm:text-sm text-foreground line-clamp-1">
                  {task.title}
                </span>
                <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full border flex-shrink-0 ${priorityColors[task.priority]}`}>
                  {task.priority}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">
                {task.description}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default TaskList;

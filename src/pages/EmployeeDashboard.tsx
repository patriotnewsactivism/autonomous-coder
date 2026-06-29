import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, Bot, Clock, CheckCircle2, XCircle, ArrowRight, PlayCircle } from "lucide-react";
import { EmployeeTask } from "@shared/schema";
import { Button } from "@/components/ui/button";

export default function EmployeeDashboard() {
  const queryClient = useQueryClient();
  const [newTaskGoal, setNewTaskGoal] = useState("");

  const { data: tasks, isLoading } = useQuery<EmployeeTask[]>({
    queryKey: ["employeeTasks"],
    queryFn: async () => {
      const res = await fetch("/api/employee/tasks");
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
    refetchInterval: 5000 // Poll every 5s for live updates
  });

  const createTaskMutation = useMutation({
    mutationFn: async (goal: string) => {
      const res = await fetch("/api/employee/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "dashboard", sourceId: "manual", goal }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employeeTasks"] });
      setNewTaskGoal("");
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskGoal.trim()) {
      createTaskMutation.mutate(newTaskGoal);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <header className="border-b border-zinc-800 bg-zinc-900/50 p-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-zinc-400 hover:text-white transition-colors">
            <ArrowRight className="h-5 w-5 rotate-180" />
          </Link>
          <Bot className="h-6 w-6 text-blue-500" />
          <h1 className="text-xl font-bold">AI Employee Dashboard</h1>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 space-y-8">
        {/* Enqueue Task Card */}
        <section className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
          <h2 className="text-lg font-semibold mb-4">Assign a New Task</h2>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder="E.g., Review the src/components folder for accessibility issues..."
              className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2 sm:py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newTaskGoal}
              onChange={(e) => setNewTaskGoal(e.target.value)}
              disabled={createTaskMutation.isPending}
            />
            <Button type="submit" disabled={!newTaskGoal.trim() || createTaskMutation.isPending}>
              {createTaskMutation.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Assign Task
            </Button>
          </form>
        </section>

        {/* Task Queue */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Live Task Queue</h2>
            {isLoading && <Loader2 className="animate-spin h-4 w-4 text-zinc-500" />}
          </div>
          
          <div className="space-y-4">
            {!tasks || tasks.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 bg-zinc-900/30 rounded-xl border border-zinc-800/50">
                No tasks in the queue. The employee is idle.
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <p className="font-medium text-zinc-200">{task.goal}</p>
                    <StatusBadge status={task.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {task.createdAt ? new Date(task.createdAt).toLocaleString() : "Unknown time"}
                    </span>
                    <span className="uppercase tracking-wider">
                      Source: {task.source}
                    </span>
                  </div>
                  {task.result && task.status === 'completed' && (
                    <div className="mt-2 text-sm bg-zinc-950 rounded border border-zinc-800 p-3 text-zinc-400">
                      <p className="font-semibold text-zinc-300 mb-1">Result Summary:</p>
                      {getSummary(task.result)}
                    </div>
                  )}
                  {task.status === 'failed' && (
                    <div className="mt-2 text-sm bg-red-950/20 rounded border border-red-900/50 p-3 text-red-400">
                      {getSummary(task.result)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 text-xs font-medium"><Clock className="h-3 w-3" /> Pending</span>;
    case 'running':
      return <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-900/30 text-blue-400 border border-blue-900/50 text-xs font-medium"><PlayCircle className="h-3 w-3" /> Running</span>;
    case 'completed':
      return <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-900/50 text-xs font-medium"><CheckCircle2 className="h-3 w-3" /> Completed</span>;
    case 'failed':
      return <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-900/30 text-red-400 border border-red-900/50 text-xs font-medium"><XCircle className="h-3 w-3" /> Failed</span>;
    default:
      return <span className="px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 text-xs font-medium">{status}</span>;
  }
}

function getSummary(result: any): string {
  if (!result) return "No detailed summary provided.";
  
  if (typeof result === "object") {
    return result.summary || result.error || JSON.stringify(result);
  }

  try {
    const data = JSON.parse(result);
    return data.summary || data.error || "No detailed summary provided.";
  } catch {
    return String(result);
  }
}

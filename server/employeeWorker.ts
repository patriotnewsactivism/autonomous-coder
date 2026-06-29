import { storage } from "./storage";
import { executeTask } from "./superagent";
import { deliverTaskResult } from "./delivery";

let isRunning = false;
let interval: NodeJS.Timeout | null = null;

export function startEmployeeWorker(pollIntervalMs = 15000) {
  if (interval) {
    console.log("[employeeWorker] Already running.");
    return;
  }
  
  console.log(`[employeeWorker] Starting background daemon (poll every ${pollIntervalMs}ms)`);
  interval = setInterval(pollAndExecute, pollIntervalMs);
  
  // Also run once immediately
  pollAndExecute();
}

export function stopEmployeeWorker() {
  if (interval) {
    clearInterval(interval);
    interval = null;
    console.log("[employeeWorker] Stopped.");
  }
}

async function pollAndExecute() {
  if (isRunning) return;
  isRunning = true;
  
  try {
    const pendingTasks = await storage.getPendingEmployeeTasks(1);
    if (pendingTasks.length === 0) {
      isRunning = false;
      return;
    }
    
    const task = pendingTasks[0];
    console.log(`[employeeWorker] Picked up task ${task.id}: ${task.goal}`);
    
    // Mark as running
    await storage.updateEmployeeTask(task.id, { status: "running" });
    
    try {
      // Execute via Superagent
      const result = await executeTask(task.goal, { 
        sessionId: `employee-task-${task.id}`,
        onProgress: (msg) => console.log(`[employeeWorker] [Task ${task.id}] ${msg}`)
      });
      
      // Deliver the results
      await deliverTaskResult(task, result);
      
      // Mark as completed
      await storage.updateEmployeeTask(task.id, { 
        status: "completed", 
        result: JSON.stringify(result)
      });
      
      console.log(`[employeeWorker] Task ${task.id} completed successfully.`);
    } catch (err: any) {
      console.error(`[employeeWorker] Task ${task.id} failed:`, err);
      // Mark as failed
      await storage.updateEmployeeTask(task.id, { 
        status: "failed", 
        result: JSON.stringify({ error: err?.message || String(err) })
      });
    }
    
  } catch (err) {
    console.error("[employeeWorker] Error in poll loop:", err);
  } finally {
    isRunning = false;
  }
}

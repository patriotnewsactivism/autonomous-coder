import cron from "node-cron";
import { storage } from "./storage.js";

export function setupCronJobs() {
  console.log("[cron] Setting up scheduled tasks...");

  // Example: Every day at 2 AM
  cron.schedule("0 2 * * *", async () => {
    try {
      console.log("[cron] Triggering daily code audit task");
      await storage.createEmployeeTask({
        source: "cron",
        goal: "Perform a routine code audit on the repository. Summarize any potential issues, outdated dependencies, or areas lacking test coverage.",
        status: "pending"
      });
    } catch (err) {
      console.error("[cron] Failed to schedule task:", err);
    }
  });
  
  // Example: Every Friday at 5 PM
  cron.schedule("0 17 * * 5", async () => {
    try {
      console.log("[cron] Triggering weekly review task");
      await storage.createEmployeeTask({
        source: "cron",
        goal: "Generate a weekly summary of all recent changes, identifying the most complex refactors and what to prioritize next week.",
        status: "pending"
      });
    } catch (err) {
      console.error("[cron] Failed to schedule task:", err);
    }
  });
}

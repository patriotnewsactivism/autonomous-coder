
import { callAI, parseJsonResponse } from "./aiCore";
import { systemPrompts } from "./agentPrompts";
import { storeMemory, retrieveMemory } from "./agentMemory";
import { EventEmitter } from "events";
import { getSmartContext } from "./autoLearn";
import { buildResearchQueries, multiSearch, isTavilyEnabled } from "./webSearch";

// ── Smart model routing — pick the best available model per agent role ────────
function getModelForAgent(agentType: string, requestedModel?: string): string | undefined {
  if (requestedModel) return requestedModel; // caller override wins

  const env = process.env;

  // Role → preferred model, in priority order
  // Heavy reasoning roles: use DeepSeek V4 Pro or Kilo auto if available
  const heavyRoles = ["orchestrator", "reviewer", "security", "performance"];
  // Speed roles: use DeepSeek V4 Flash or Gemini 2.5
  const speedRoles = ["strategist", "builder", "fixer", "database", "api", "ui", "testing", "refiner"];

  const hasDeepSeek = !!(env.DEEPSEEK_API_KEY);
  const hasKilo = !!(env.KILOCODE_API_KEY || env.KILO_API_KEY);
  const hasGemini = !!(env.GEMINI_API_KEY || env.GOOGLE_API_KEY);

  if (heavyRoles.includes(agentType)) {
    if (hasKilo) return "kilo/auto";           // Kilo smart-routes to best available
    if (hasDeepSeek) return "deepseek-v4-pro"; // DeepSeek V4 Pro for reasoning
    if (hasGemini) return "gemini-2.5-flash";
    return undefined; // let callAI pick default
  }

  if (speedRoles.includes(agentType)) {
    if (hasDeepSeek) return "deepseek-v4-flash"; // Fast + cheap
    if (hasKilo) return "kilo/auto";
    if (hasGemini) return "gemini-2.0-flash";
    return undefined;
  }

  return undefined;
}


export const workerBus = new EventEmitter();
workerBus.setMaxListeners(200);

export type WorkerStatus = "queued" | "running" | "done" | "failed" | "retrying";

export interface WorkerJob {
  id: string;
  sessionId: string;
  agent: string;
  goal: string;
  context: any;
  model?: string;
  maxRetries?: number;
  selfEvalThreshold?: number;
}

export interface WorkerResult {
  jobId: string;
  agent: string;
  status: WorkerStatus;
  output: any;
  score?: number;
  attempts: number;
  durationMs: number;
  error?: string;
}

const SELF_EVAL_PROMPT = `You are a strict quality evaluator.
Rate this agent output from 0-10. Return JSON: { "score": 7, "reason": "...", "issues": ["..."] }
Be harsh. A score below 7 means the agent should retry.`;

async function selfEvaluate(
  agent: string,
  output: string,
  goal: string,
  model?: string
): Promise<{ score: number; reason: string; issues: string[] }> {
  try {
    const { content } = await callAI(
      SELF_EVAL_PROMPT,
      `Agent: ${agent}\nGoal: ${goal}\nOutput:\n${output.slice(0, 3000)}`,
      model
    );
    return parseJsonResponse(content);
  } catch {
    return { score: 8, reason: "eval failed, assuming ok", issues: [] };
  }
}

// Emit files to the sandbox SSE stream so the preview updates in real-time
function emitSandboxUpdate(sessionId: string, parsed: any) {
  const fileAgents = ["builder", "fixer", "ui", "api", "database", "refiner", "deployer", "performance", "security", "testing"];
  const files = parsed?.files;
  if (Array.isArray(files) && files.length > 0) {
    workerBus.emit("sandbox:update", { sessionId, files });
  }
}

export async function runWorkerJob(job: WorkerJob): Promise<WorkerResult> {
  const start = Date.now();
  const maxRetries = job.maxRetries ?? 2;
  const threshold = job.selfEvalThreshold ?? 6;
  let attempts = 0;
  let lastError = "";
  let lastOutput: any = null;

  // Pull relevant memory
  const memories = await retrieveMemory(job.goal, 5);
  const memoryContext = memories.length > 0
    ? `\n\nRELEVANT MEMORY:\n${memories.map(m => `[${m.type}] ${m.content}`).join("\n")}`
    : "";

  workerBus.emit("worker:status", { jobId: job.id, agent: job.agent, status: "running", sessionId: job.sessionId });

  while (attempts <= maxRetries) {
    attempts++;
    try {
      const prompt = systemPrompts[job.agent as keyof typeof systemPrompts] || systemPrompts.builder;
      // Inject accumulated cross-session wisdom
      const smartCtx = await getSmartContext(job.goal, job.agent);

      // Live web search for research-heavy agents
      const searchAgents = ["researcher", "orchestrator", "fixer", "autohealer"];
      let liveSearchCtx = "";
      if (searchAgents.includes(job.agent)) {
        try {
          const queries = buildResearchQueries(job.goal, job.agent);
          liveSearchCtx = await multiSearch(queries, 4);
          if (liveSearchCtx) {
            workerBus.emit("worker:searching", { jobId: job.id, agent: job.agent, sessionId: job.sessionId, queries });
          }
        } catch { /* non-critical */ }
      }
      const userMsg = `GOAL: ${job.goal}\n\nCONTEXT: ${JSON.stringify(job.context, null, 2)}${memoryContext}${smartCtx}${liveSearchCtx}${
        attempts > 1 ? `\n\nPREVIOUS ATTEMPT FAILED EVAL. Issues: ${lastError}. Try harder.` : ""
      }`;

      workerBus.emit("worker:thinking", {
        jobId: job.id, agent: job.agent, sessionId: job.sessionId, attempt: attempts
      });

      const resolvedModel = getModelForAgent(job.agent, job.model);
      const { content } = await callAI(prompt, userMsg, resolvedModel);
      const parsed = parseJsonResponse(content);
      lastOutput = parsed;

      // 🔑 Emit files to sandbox preview as soon as they arrive
      emitSandboxUpdate(job.sessionId, parsed);

      // Self-evaluate
      const evaluation = await selfEvaluate(job.agent, content, job.goal, job.model);
      workerBus.emit("worker:eval", {
        jobId: job.id, agent: job.agent, sessionId: job.sessionId,
        score: evaluation.score, reason: evaluation.reason
      });

      if (evaluation.score >= threshold || attempts > maxRetries) {
        await storeMemory({
          session_id: job.sessionId,
          agent: job.agent,
          type: "success",
          content: `Goal: ${job.goal.slice(0, 200)} | Score: ${evaluation.score} | Attempt: ${attempts}`,
          tags: [job.agent, "success"],
          score: evaluation.score,
        });

        workerBus.emit("worker:done", {
          jobId: job.id, agent: job.agent, sessionId: job.sessionId, score: evaluation.score
        });

        return {
          jobId: job.id, agent: job.agent, status: "done",
          output: parsed, score: evaluation.score,
          attempts, durationMs: Date.now() - start,
        };
      } else {
        lastError = evaluation.issues.join(", ") || evaluation.reason;
        await storeMemory({
          session_id: job.sessionId,
          agent: job.agent,
          type: "failure",
          content: `Goal: ${job.goal.slice(0, 200)} | Score: ${evaluation.score} | Issues: ${lastError}`,
          tags: [job.agent, "retry"],
          score: -1,
        });
        workerBus.emit("worker:retrying", {
          jobId: job.id, agent: job.agent, sessionId: job.sessionId,
          attempt: attempts, reason: lastError
        });
      }
    } catch (err: any) {
      lastError = err?.message || "unknown error";
      if (attempts > maxRetries) break;
    }
  }

  workerBus.emit("worker:failed", {
    jobId: job.id, agent: job.agent, sessionId: job.sessionId, error: lastError
  });

  return {
    jobId: job.id, agent: job.agent, status: "failed",
    output: lastOutput, attempts,
    durationMs: Date.now() - start, error: lastError,
  };
}

export async function runParallelWorkers(jobs: WorkerJob[]): Promise<WorkerResult[]> {
  return Promise.all(jobs.map(job => runWorkerJob(job)));
}

export async function spawnSubWorkers(
  parentJob: WorkerJob,
  subTasks: Array<{ agent: string; goal: string; context: any }>
): Promise<WorkerResult[]> {
  const subJobs: WorkerJob[] = subTasks.map((task, i) => ({
    id: `${parentJob.id}-sub-${i}-${Date.now()}`,
    sessionId: parentJob.sessionId,
    agent: task.agent,
    goal: task.goal,
    context: task.context,
    model: parentJob.model,
    maxRetries: 1,
    selfEvalThreshold: 5,
  }));

  workerBus.emit("worker:spawned", {
    parentId: parentJob.id,
    sessionId: parentJob.sessionId,
    count: subJobs.length,
    agents: subJobs.map(j => j.agent),
  });

  return runParallelWorkers(subJobs);
}

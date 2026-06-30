
/**
 * Superagent — Universal Task Router
 * 
 * Classifies ANY input (simple or complex) and executes the right pipeline.
 * Simple tasks: answer, research, write, summarize — done in one pass.
 * Complex tasks: plan → decompose → spawn workers → observe → deliver.
 * 
 * This is the omnipresence layer. One agent, all tasks.
 */

import { callAI, callAIStream, parseJsonResponse } from "./aiCore";
import { storeMemory, retrieveMemory } from "./agentMemory";
import { runWorkerJob, runParallelWorkers, spawnSubWorkers, workerBus, WorkerJob } from "./agentWorker";
import { runDebate } from "./debate";
import { randomUUID } from "crypto";

// ── Task classification ───────────────────────────────────────────────────────

export type TaskCategory =
  | "code"          // Build software, fix bugs, write scripts
  | "research"      // Look up info, analyze, summarize documents
  | "write"         // Draft content, emails, reports, docs
  | "plan"          // Break down goals, make roadmaps, prioritize
  | "debug"         // Diagnose errors, trace issues, suggest fixes
  | "review"        // Audit code, review PRs, score quality
  | "design"        // Architecture decisions, system design
  | "automate"      // Create workflows, scripts, cron jobs
  | "data"          // Analyze data, write queries, transform data
  | "general";      // Anything else — handled by a smart generalist

export type TaskComplexity = "simple" | "moderate" | "complex" | "epic";

export interface TaskClassification {
  category: TaskCategory;
  complexity: TaskComplexity;
  title: string;
  reasoning: string;
  requiresAgentPipeline: boolean;
  suggestedAgents: string[];
  canAnswerDirectly: boolean;
  directAnswer?: string;
  subtasks?: string[];
  estimatedMinutes: number;
}

const CLASSIFIER_PROMPT = `You are an AI task classifier. Given any user request, classify it and determine the best execution strategy.

OUTPUT JSON:
{
  "category": "code"|"research"|"write"|"plan"|"debug"|"review"|"design"|"automate"|"data"|"general",
  "complexity": "simple"|"moderate"|"complex"|"epic",
  "title": "Short task title",
  "reasoning": "Why this category and complexity",
  "requiresAgentPipeline": true|false,
  "suggestedAgents": ["orchestrator", "strategist", "builder", ...],
  "canAnswerDirectly": true|false,
  "directAnswer": "If canAnswerDirectly=true, the full answer here",
  "subtasks": ["subtask 1", "subtask 2"],
  "estimatedMinutes": 2
}

RULES:
- simple: single-step, answerable in one pass (e.g. "what is X", "write a haiku", "fix this line")
- moderate: 2-5 steps, needs some planning (e.g. "build a login form", "write a blog post outline")
- complex: multi-agent, multiple files/components (e.g. "build a SaaS dashboard", "create a REST API")
- epic: massive scope, needs sub-agent spawning (e.g. "build a full e-commerce platform with auth, payments, admin")
- canAnswerDirectly=true only for simple tasks where you already know the answer
- requiresAgentPipeline=true for code/complex tasks that need the full builder pipeline
- For epic tasks, populate subtasks with independently-executable chunks`;

export async function classifyTask(
  goal: string,
  model?: string
): Promise<TaskClassification> {
  const { content } = await callAI(
    CLASSIFIER_PROMPT,
    `Task: ${goal}`,
    model
  );
  return parseJsonResponse(content);
}

// ── Execution strategies ──────────────────────────────────────────────────────

const GENERALIST_PROMPT = `You are an elite Superagent — highly capable, precise, and autonomous.
Complete the given task fully and perfectly. Think step by step.
For research: be thorough and cite specifics.
For writing: be polished and publication-ready.
For analysis: be rigorous and actionable.
For planning: be concrete with timelines and owners.
OUTPUT: A complete, high-quality response. No hedging. Just deliver.`;

const RESEARCHER_PROMPT = `You are an expert AI researcher and analyst.
Given a topic or question, produce a comprehensive, accurate, well-structured response.
Include: key findings, relevant context, concrete examples, actionable insights.
Format with clear sections. Be specific, not vague. Cite reasoning, not just conclusions.`;

const WRITER_PROMPT = `You are a world-class writer and content strategist.
Produce polished, engaging, publication-ready content.
Match the tone requested. If no tone specified: professional but human.
Deliver the complete piece, not an outline.`;

const PLANNER_PROMPT = `You are a strategic planning expert.
Break down any goal into a concrete, executable plan.
OUTPUT JSON:
{
  "goal": "restated goal",
  "phases": [
    {
      "phase": 1,
      "name": "Phase name",
      "duration": "2 days",
      "tasks": [
        { "task": "Task description", "owner": "AI|Human", "priority": "high|medium|low", "deps": [] }
      ]
    }
  ],
  "risks": ["Risk 1"],
  "successMetrics": ["Metric 1"],
  "recommendation": "One-line strategic recommendation"
}`;

// Simple: answer in one pass
async function executeSimple(
  goal: string,
  classification: TaskClassification,
  model?: string,
  onToken?: (t: string) => void
): Promise<{ output: string; type: "answer" | "plan" | "content" }> {
  if (classification.canAnswerDirectly && classification.directAnswer) {
    return { output: classification.directAnswer, type: "answer" };
  }

  const promptMap: Record<TaskCategory, string> = {
    research: RESEARCHER_PROMPT,
    write: WRITER_PROMPT,
    plan: PLANNER_PROMPT,
    code: GENERALIST_PROMPT,
    debug: GENERALIST_PROMPT,
    review: GENERALIST_PROMPT,
    design: GENERALIST_PROMPT,
    automate: GENERALIST_PROMPT,
    data: GENERALIST_PROMPT,
    general: GENERALIST_PROMPT,
  };

  const prompt = promptMap[classification.category] || GENERALIST_PROMPT;
  if (onToken) {
    const { content } = await callAIStream(prompt, goal, onToken, model);
    return { output: content, type: "answer" };
  }
  const { content } = await callAI(prompt, goal, model);
  return { output: content, type: "answer" };
}

// Complex: run the full agent pipeline
async function executeComplex(
  goal: string,
  classification: TaskClassification,
  sessionId: string,
  model?: string
): Promise<{ jobs: any[]; summary: string }> {
  const agents = classification.suggestedAgents.length > 0
    ? classification.suggestedAgents
    : ["orchestrator", "strategist", "builder", "reviewer", "fixer"];

  const jobs: WorkerJob[] = agents.map((agent, i) => ({
    id: randomUUID(),
    sessionId,
    agent,
    goal,
    context: { classification },
    model,
    maxRetries: 2,
    selfEvalThreshold: 7,
  }));

  // Run orchestrator + strategist serially, then parallel, then serial end
  const serialStart = jobs.filter(j => ["orchestrator", "strategist"].includes(j.agent));
  const parallelMid = jobs.filter(j => ["database", "api", "ui"].includes(j.agent));
  const builderJob = jobs.filter(j => j.agent === "builder");
  const parallelEnd = jobs.filter(j => ["testing", "security", "performance"].includes(j.agent));
  const serialEnd = jobs.filter(j => ["reviewer", "fixer"].includes(j.agent));

  const results: any[] = [];
  let ctx: any = { goal, classification };

  for (const job of serialStart) {
    const r = await runWorkerJob({ ...job, context: ctx });
    results.push(r);
    if (r.output) ctx = { ...ctx, [`${job.agent}Output`]: r.output };
  }

  // ── Debate Phase ──
  if (ctx.strategistOutput) {
    workerBus.emit("superagent:progress", { sessionId, msg: "⚖️ Debating the architectural plan..." });
    const proposal = typeof ctx.strategistOutput === "string" ? ctx.strategistOutput : JSON.stringify(ctx.strategistOutput, null, 2);
    const debate = await runDebate(sessionId, proposal, goal, "architectural", model);
    
    if (debate.verdict === "ESCALATE") {
      throw new Error(`Debate escalated to human review: ${debate.escalationReason || debate.moderatorReasoning}`);
    }
    if (debate.verdict === "REFINE") {
      ctx = { ...ctx, debateRefinements: debate.refinements };
      workerBus.emit("superagent:progress", { sessionId, msg: "🔧 Debate refined the plan. Proceeding with adjustments..." });
    } else {
      workerBus.emit("superagent:progress", { sessionId, msg: "✅ Debate approved the plan. Proceeding..." });
    }
  }

  if (parallelMid.length > 0) {
    const midResults = await runParallelWorkers(parallelMid.map(j => ({ ...j, context: ctx })));
    results.push(...midResults);
    midResults.forEach(r => { if (r.output) ctx = { ...ctx, [`${r.agent}Output`]: r.output }; });
  }

  for (const job of builderJob) {
    const r = await runWorkerJob({ ...job, context: ctx });
    results.push(r);
    if (r.output) ctx = { ...ctx, builderOutput: r.output };
  }

  if (parallelEnd.length > 0) {
    const endResults = await runParallelWorkers(parallelEnd.map(j => ({ ...j, context: ctx })));
    results.push(...endResults);
    endResults.forEach(r => { if (r.output) ctx = { ...ctx, [`${r.agent}Output`]: r.output }; });
  }

  for (const job of serialEnd) {
    const r = await runWorkerJob({ ...job, context: ctx });
    results.push(r);
    if (r.output) ctx = { ...ctx, [`${job.agent}Output`]: r.output };
  }

  const avgScore = results.reduce((s, r) => s + (r.score || 0), 0) / (results.length || 1);
  return {
    jobs: results,
    summary: `Completed ${results.length} agents | avg score: ${avgScore.toFixed(1)}/10`,
  };
}

// Epic: decompose into sub-tasks, spawn workers exponentially
async function executeEpic(
  goal: string,
  classification: TaskClassification,
  sessionId: string,
  model?: string
): Promise<{ results: any[]; summary: string }> {
  workerBus.emit("superagent:epic:start", { sessionId, goal, subtaskCount: classification.subtasks?.length });

  const subtasks = classification.subtasks || [goal];
  const allResults: any[] = [];

  // Spawn parallel jobs for each subtask
  const parentJob: WorkerJob = {
    id: randomUUID(),
    sessionId,
    agent: "orchestrator",
    goal,
    context: { classification },
    model,
  };

  const subTaskDefs = subtasks.map(task => ({
    agent: "builder",
    goal: task,
    context: { parentGoal: goal, classification },
  }));

  // First spawn: one builder per subtask in parallel
  const spawnResults = await spawnSubWorkers(parentJob, subTaskDefs);
  allResults.push(...spawnResults);

  // Each sub-result that scores < 7 gets a fixer spawned
  const needsFix = spawnResults.filter(r => (r.score || 0) < 7 && r.output);
  if (needsFix.length > 0) {
    const fixJobs = needsFix.map(r => ({
      agent: "fixer",
      goal: `Fix issues in: ${r.agent} output for ${r.jobId}`,
      context: { files: r.output?.files || [], parentScore: r.score },
    }));
    const fixResults = await spawnSubWorkers(parentJob, fixJobs);
    allResults.push(...fixResults);
  }

  workerBus.emit("superagent:epic:done", {
    sessionId,
    totalJobs: allResults.length,
    avgScore: allResults.reduce((s, r) => s + (r.score || 0), 0) / (allResults.length || 1),
  });

  return {
    results: allResults,
    summary: `Epic task: ${subtasks.length} subtasks, ${allResults.length} total jobs`,
  };
}

// ── Master entry point ────────────────────────────────────────────────────────

export interface SuperagentTaskResult {
  sessionId: string;
  classification: TaskClassification;
  output?: string;
  files?: any[];
  jobs?: any[];
  summary: string;
  durationMs: number;
}

export async function executeTask(
  goal: string,
  options: {
    model?: string;
    sessionId?: string;
    onToken?: (token: string) => void;
    onClassified?: (c: TaskClassification) => void;
    onProgress?: (msg: string) => void;
  } = {}
): Promise<SuperagentTaskResult> {
  const start = Date.now();
  const sessionId = options.sessionId || randomUUID();
  const { model, onToken, onClassified, onProgress } = options;

  const result: SuperagentTaskResult = {
    sessionId,
    classification: null as any,
    summary: "",
    durationMs: 0,
  };

  try {
    const memories = await retrieveMemory(goal, 8);
    const memCtx = memories.length > 0
      ? `\n\nPAST CONTEXT:\n${memories.map(m => `[${m.type}] ${m.content}`).join("\n")}`
      : "";

    const enrichedGoal = `${goal}${memCtx}`;

    onProgress?.("🧠 Classifying task…");
    workerBus.emit("superagent:classifying", { sessionId, goal });

    const classification = await classifyTask(enrichedGoal, model);
    result.classification = classification;
    onClassified?.(classification);

    onProgress?.(`📋 Task: ${classification.title} | ${classification.complexity} | ${classification.category}`);
    workerBus.emit("superagent:classified", { sessionId, classification });

    // Store intent in memory
    await storeMemory({
      session_id: sessionId,
      agent: "superagent",
      type: "context",
      content: `Task: ${classification.title} | Category: ${classification.category} | Complexity: ${classification.complexity}`,
      tags: [classification.category, classification.complexity],
    });
    if (classification.complexity === "simple" || !classification.requiresAgentPipeline) {
      onProgress?.("⚡ Executing directly…");
      const { output } = await executeSimple(goal, classification, model, onToken);
      result.output = output;
      result.summary = `Simple task completed in ${Math.round((Date.now() - start) / 1000)}s`;

      await storeMemory({
        session_id: sessionId,
        agent: "superagent",
        type: "success",
        content: `Simple: ${classification.title} — completed`,
        tags: [classification.category, "success"],
        score: 9,
      });

    } else if (classification.complexity === "epic") {
      onProgress?.("🌿 Spawning exponential workers for epic task…");
      const { results, summary } = await executeEpic(enrichedGoal, classification, sessionId, model);
      result.jobs = results;
      result.files = results.flatMap(r => r.output?.files || []);
      result.summary = summary;

    } else {
      // moderate or complex
      onProgress?.("🤖 Launching agent pipeline…");
      const { jobs, summary } = await executeComplex(enrichedGoal, classification, sessionId, model);
      result.jobs = jobs;
      result.files = jobs.flatMap(r => r.output?.files || []);
      result.summary = summary;
    }
  } catch (err: any) {
    result.summary = `Failed: ${err?.message || "unknown error"}`;
    await storeMemory({
      session_id: sessionId,
      agent: "superagent",
      type: "failure",
      content: `Task failed: ${result.classification?.title || "Unknown Task"} — ${result.summary}`,
      tags: [result.classification?.category || "general", "failure"],
      score: -2,
    });
  }

  result.durationMs = Date.now() - start;
  workerBus.emit("superagent:done", { sessionId, result });
  return result;
}

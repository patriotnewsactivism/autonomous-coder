import type { Express } from "express";
import { randomUUID } from "crypto";
import { runWorkerJob, runParallelWorkers, spawnSubWorkers, workerBus, WorkerJob } from "./agentWorker";
import { getSessionMemory, storeMemory } from "./agentMemory";

// Stream SSE events to client
function sendSSE(res: any, event: string, data: any) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function registerParallelRoutes(app: Express) {
  // ── POST: Universal AI Employee task endpoint ─────────────────────────────
  // Routes ANY task — simple or complex — to the right execution strategy
  app.post("/api/employee/task", async (req, res) => {
    try {
      const { goal, model, sessionId } = req.body;
      if (!goal) return res.status(400).json({ error: "goal required" });

      const { executeTask } = await import("./superagent");
      const sid = sessionId || randomUUID();

      // Stream progress events back via SSE bus
      const result = await executeTask(goal, {
        model,
        sessionId: sid,
        onProgress: (msg) => {
          workerBus.emit("employee:progress", { sessionId: sid, message: msg });
        },
        onClassified: (classification) => {
          workerBus.emit("employee:classified", { sessionId: sid, classification });
        },
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "employee task failed" });
    }
  });

  // ── GET: Classify a task without executing it ─────────────────────────────
  app.get("/api/employee/classify", async (req, res) => {
    try {
      const { goal, model } = req.query as Record<string, string>;
      if (!goal) return res.status(400).json({ error: "goal required" });
      const { classifyTask } = await import("./employeeAgent");
      const classification = await classifyTask(goal, model);
      res.json(classification);
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });

  // ── SSE: Real-time worker event stream ─────────────────────────────────────
  app.get("/api/agent/stream/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    const events = [
      "worker:status", "worker:thinking", "worker:eval",
      "worker:done", "worker:failed", "worker:retrying",
      "worker:spawned", "parallel:start", "parallel:done",
      "memory:stored", "sandbox:update",
      "superagent:progress", "superagent:classified", "superagent:classifying",
      "superagent:epic:start", "superagent:epic:done", "superagent:done"
    ];

    const handlers: Record<string, (data: any) => void> = {};
    events.forEach(event => {
      handlers[event] = (data: any) => {
        if (!sessionId || data?.sessionId === sessionId) {
          sendSSE(res, event, data);
        }
      };
      workerBus.on(event, handlers[event]);
    });

    // Keep-alive ping every 15s
    const ping = setInterval(() => {
      res.write(": ping\n\n");
    }, 15000);

    req.on("close", () => {
      clearInterval(ping);
      events.forEach(event => workerBus.off(event, handlers[event]));
    });
  });

  // ── POST: Run parallel agent build ─────────────────────────────────────────
  app.post("/api/agent/parallel-build", async (req, res) => {
    try {
      const { goal, agentSequence, context, model, sessionId } = req.body;
      if (!goal) return res.status(400).json({ error: "goal required" });

      const sid = sessionId || randomUUID();

      // Store goal in memory
      await storeMemory({
        session_id: sid,
        agent: "orchestrator",
        type: "context",
        content: `Goal: ${goal}`,
        tags: ["goal"],
      });

      // Identify which agents can run in parallel vs serial
      // Serial: orchestrator → strategist
      // Parallel group 1: database + api + ui (independent)
      // Serial: builder (needs group 1)
      // Parallel group 2: testing + security + performance (independent)
      // Serial: reviewer → fixer
      const sequence: string[] = agentSequence || ["orchestrator", "strategist", "builder", "reviewer", "fixer"];

      const parallelGroups: string[][] = [];
      const serialFirst: string[] = [];
      const serialLast: string[] = [];

      const parallelable = new Set(["database", "api", "ui", "testing", "security", "performance"]);
      let inParallel: string[] = [];

      for (const agent of sequence) {
        if (["orchestrator", "strategist"].includes(agent)) {
          serialFirst.push(agent);
        } else if (["reviewer", "fixer", "deployer"].includes(agent)) {
          if (inParallel.length > 0) { parallelGroups.push(inParallel); inParallel = []; }
          serialLast.push(agent);
        } else if (parallelable.has(agent)) {
          inParallel.push(agent);
        } else {
          if (inParallel.length > 0) { parallelGroups.push(inParallel); inParallel = []; }
          serialFirst.push(agent);
        }
      }
      if (inParallel.length > 0) parallelGroups.push(inParallel);

      workerBus.emit("parallel:start", {
        sessionId: sid, goal, serialFirst, parallelGroups, serialLast
      });

      // Phase 1: Serial (orchestrator, strategist)
      let sharedContext = { ...context, goal };
      const phase1Results: any[] = [];
      for (const agent of serialFirst) {
        const job: WorkerJob = {
          id: randomUUID(), sessionId: sid, agent, goal,
          context: sharedContext, model, maxRetries: 2, selfEvalThreshold: 6,
        };
        const result = await runWorkerJob(job);
        phase1Results.push(result);
        if (result.output) sharedContext = { ...sharedContext, [`${agent}Output`]: result.output };
      }

      // Phase 2: Parallel groups
      const parallelResults: any[] = [];
      for (const group of parallelGroups) {
        const groupJobs: WorkerJob[] = group.map(agent => ({
          id: randomUUID(), sessionId: sid, agent, goal,
          context: sharedContext, model, maxRetries: 1, selfEvalThreshold: 5,
        }));
        const groupResults = await runParallelWorkers(groupJobs);
        parallelResults.push(...groupResults);
        groupResults.forEach(r => {
          if (r.output) sharedContext = { ...sharedContext, [`${r.agent}Output`]: r.output };
        });
      }

      // Phase 3: Builder (needs all context)
      if (!sequence.includes("builder") || serialFirst.includes("builder")) {
        // already handled
      } else {
        const builderJob: WorkerJob = {
          id: randomUUID(), sessionId: sid, agent: "builder", goal,
          context: sharedContext, model, maxRetries: 2, selfEvalThreshold: 7,
        };
        const builderResult = await runWorkerJob(builderJob);
        phase1Results.push(builderResult);
        if (builderResult.output) sharedContext = { ...sharedContext, builderOutput: builderResult.output };
      }

      // Phase 4: Serial last (reviewer, fixer, deployer)
      const phase4Results: any[] = [];
      for (const agent of serialLast) {
        const job: WorkerJob = {
          id: randomUUID(), sessionId: sid, agent, goal,
          context: sharedContext, model, maxRetries: 1, selfEvalThreshold: 6,
        };
        const result = await runWorkerJob(job);
        phase4Results.push(result);
        if (result.output) sharedContext = { ...sharedContext, [`${agent}Output`]: result.output };
      }

      const allResults = [...phase1Results, ...parallelResults, ...phase4Results];

      workerBus.emit("parallel:done", {
        sessionId: sid,
        totalAgents: allResults.length,
        avgScore: allResults.reduce((s, r) => s + (r.score || 0), 0) / allResults.length,
      });

      res.json({ sessionId: sid, results: allResults, finalContext: sharedContext });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "parallel build failed" });
    }
  });

  // ── POST: Spawn sub-workers from a running agent ───────────────────────────
  app.post("/api/agent/spawn", async (req, res) => {
    try {
      const { parentJobId, sessionId, subTasks, model } = req.body;
      if (!subTasks?.length) return res.status(400).json({ error: "subTasks required" });

      const parentJob: WorkerJob = {
        id: parentJobId || randomUUID(),
        sessionId: sessionId || randomUUID(),
        agent: "orchestrator",
        goal: "spawn sub-workers",
        context: {},
        model,
      };

      const results = await spawnSubWorkers(parentJob, subTasks);
      res.json({ results });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "spawn failed" });
    }
  });

  // ── GET: Retrieve session memory ───────────────────────────────────────────
  app.get("/api/agent/memory/:sessionId", async (req, res) => {
    try {
      const memory = await getSessionMemory(req.params.sessionId);
      res.json(memory);
    } catch (err) {
      res.status(500).json({ error: "memory retrieval failed" });
    }
  });

  // ── POST: Sandbox code execution (safe eval) ───────────────────────────────
  app.post("/api/sandbox/execute", async (req, res) => {
    try {
      const { code, language } = req.body;
      if (!code) return res.status(400).json({ error: "code required" });

      // For JS/TS: return a sandboxed preview document
      if (language === "html" || language === "tsx" || language === "jsx" || !language) {
        // Return execution metadata — actual rendering is client-side in iframe
        res.json({
          status: "preview_ready",
          type: language || "tsx",
          previewable: true,
          message: "Code ready for live preview sandbox",
        });
        return;
      }

      res.json({ status: "ok", output: "Preview ready", previewable: false });
    } catch (err: any) {
      res.status(500).json({ error: err?.message });
    }
  });
}

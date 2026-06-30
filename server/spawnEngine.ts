/**
 * SpawnEngine — Sub-agent spawning system
 *
 * Breaks any epic-scale task into parallel worker trees.
 * The Orchestrator plans, then spawns independent sub-agents for each
 * slice, collects their outputs, and merges them.
 *
 * This is how the agent scales from "build a button" to
 * "build a full SaaS platform with auth, payments, and CI/CD".
 */

import { callAI, parseJsonResponse } from "./aiCore";
import { runParallelWorkers, spawnSubWorkers, workerBus, WorkerJob } from "./agentWorker";
import { getSmartContext } from "./autoLearn";
import { randomUUID } from "crypto";

export interface SpawnPlan {
  shards: Array<{
    name: string;
    description: string;
    agents: string[];
    files: string[];       // expected output files
    dependsOn: number[];   // indices of shards that must complete first
  }>;
  mergeStrategy: "concatenate" | "reconcile" | "layer";
}

const SPAWN_PLANNER_PROMPT = `You are a master orchestrator that decomposes epic software projects
into parallel execution shards, each handled by independent agent clusters.

For a given goal, create a parallel build plan where agents work simultaneously on
different slices of the system, then merge.

OUTPUT JSON:
{
  "shards": [
    {
      "name": "Data Layer",
      "description": "Database schema, models, migrations",
      "agents": ["database"],
      "files": ["src/lib/db/schema.ts", "src/lib/db/seed.ts"],
      "dependsOn": []
    },
    {
      "name": "API Layer",
      "description": "REST endpoints, auth middleware, server logic",
      "agents": ["api"],
      "files": ["server/routes.ts", "server/auth.ts"],
      "dependsOn": [0]
    },
    {
      "name": "UI Components",
      "description": "React components, design system, pages",
      "agents": ["ui", "builder"],
      "files": ["src/components/", "src/pages/"],
      "dependsOn": []
    }
  ],
  "mergeStrategy": "layer"
}`;

export async function planSpawn(goal: string, model?: string): Promise<SpawnPlan> {
  const smartCtx = await getSmartContext(goal, "orchestrator");
  const { content } = await callAI(
    SPAWN_PLANNER_PROMPT,
    `GOAL: ${goal}\n${smartCtx}`,
    model
  );
  return parseJsonResponse(content);
}

export async function executeSpawnPlan(
  plan: SpawnPlan,
  sessionId: string,
  goal: string,
  model?: string
): Promise<Array<{ path: string; content: string }>> {
  const allFiles: Array<{ path: string; content: string }> = [];
  const completedShards: Record<number, any> = {};

  workerBus.emit("spawn:plan", { sessionId, shardCount: plan.shards.length });

  // Topological execution — run independent shards in parallel, dependent shards after
  const executed = new Set<number>();
  let safetyLimit = 20; // prevent infinite loops

  while (executed.size < plan.shards.length && safetyLimit-- > 0) {
    // Find all shards ready to run (deps all completed)
    const ready = plan.shards
      .map((shard, i) => ({ shard, i }))
      .filter(({ i }) => !executed.has(i) && plan.shards[i].dependsOn.every(d => executed.has(d)));

    if (ready.length === 0) break;

    workerBus.emit("spawn:batch", {
      sessionId,
      batch: ready.map(r => r.shard.name),
    });

    // Run this batch in parallel
    const jobs: WorkerJob[] = ready.flatMap(({ shard, i }) =>
      shard.agents.map(agent => ({
        id: `spawn-${i}-${agent}-${randomUUID()}`,
        sessionId,
        agent,
        goal: `${shard.description}\n\nOverall goal: ${goal}\nExpected output files: ${shard.files.join(", ")}`,
        context: {
          shardName: shard.name,
          completedContext: Object.values(completedShards)
            .flat()
            .map((f: any) => `// ${f.path}`).join("\n"),
        },
        model,
        maxRetries: 2,
        selfEvalThreshold: 6,
      }))
    );

    const results = await runParallelWorkers(jobs);

    // Collect outputs
    results.forEach((r, ri) => {
      const shardIdx = ready[Math.floor(ri / ready[0].shard.agents.length)]?.i;
      const files = r.output?.files || [];
      files.forEach((f: any) => {
        const existing = allFiles.findIndex(x => x.path === f.path);
        if (existing >= 0) allFiles[existing] = f;
        else allFiles.push(f);
      });
      if (shardIdx !== undefined) {
        completedShards[shardIdx] = files;
        executed.add(shardIdx);
      }
    });

    // Emit live preview update
    workerBus.emit("sandbox:update", { sessionId, files: allFiles });
  }

  workerBus.emit("spawn:complete", { sessionId, fileCount: allFiles.length });
  return allFiles;
}

/**
 * Quick spawn — for moderate complexity tasks that need 2-3 parallel agents
 * without a full shard plan
 */
export async function quickSpawn(
  sessionId: string,
  parentGoal: string,
  tasks: Array<{ agent: string; goal: string; context?: any }>,
  model?: string
): Promise<Array<{ path: string; content: string }>> {
  const jobs: WorkerJob[] = tasks.map((t, i) => ({
    id: `quick-${i}-${randomUUID()}`,
    sessionId,
    agent: t.agent,
    goal: t.goal,
    context: t.context || {},
    model,
    maxRetries: 1,
    selfEvalThreshold: 6,
  }));

  workerBus.emit("spawn:quick", { sessionId, agents: tasks.map(t => t.agent) });
  const results = await runParallelWorkers(jobs);

  const allFiles: Array<{ path: string; content: string }> = [];
  results.forEach(r => {
    (r.output?.files || []).forEach((f: any) => {
      const idx = allFiles.findIndex(x => x.path === f.path);
      if (idx >= 0) allFiles[idx] = f;
      else allFiles.push(f);
    });
  });

  workerBus.emit("sandbox:update", { sessionId, files: allFiles });
  return allFiles;
}

/**
 * AutoHeal — Self-healing, self-correcting, auto-learning agent engine
 *
 * Three pillars:
 * 1. OBSERVE — watches preview errors, TypeScript errors, test failures in real-time
 * 2. HEAL    — spawns a Fixer agent to patch exactly what broke, up to N cycles
 * 3. LEARN   — writes every heal attempt + outcome to persistent memory so
 *              future builds avoid the same mistakes automatically
 */

import { callAI, parseJsonResponse } from "./aiCore";
import { storeMemory, retrieveMemory } from "./agentMemory";
import { webSearch, formatSearchResults } from "./webSearch";
import { runWorkerJob, workerBus, WorkerJob } from "./agentWorker";
import { randomUUID } from "crypto";

export interface HealContext {
  sessionId: string;
  goal: string;
  files: Array<{ path: string; content: string }>;
  errors: string[];
  model?: string;
  maxCycles?: number;       // default 3
  threshold?: number;       // score needed to stop, default 7
}

export interface HealResult {
  healed: boolean;
  cycles: number;
  patchedFiles: Array<{ path: string; content: string }>;
  remainingErrors: string[];
  learnings: string[];
}

// ── Diagnostic prompt ─────────────────────────────────────────────────────────
const DIAGNOSE_PROMPT = `You are a elite debugging AI. Given runtime errors and the current code, 
identify exactly which files need patching and why. Be surgical — only touch what's broken.

OUTPUT JSON:
{
  "rootCause": "Concise description of the real problem",
  "filesToPatch": ["src/App.tsx", "src/lib/utils.ts"],
  "diagnosis": "Why these files and not others",
  "canFix": true
}`;

// ── Patch prompt ──────────────────────────────────────────────────────────────
const PATCH_PROMPT = `You are an autonomous code surgeon. Fix EXACTLY the errors given. 
Do not refactor unrelated code. Do not change working functionality.
Every fix must be minimal and targeted.

OUTPUT JSON:
{
  "files": [
    {
      "path": "src/App.tsx",
      "content": "// COMPLETE file content with fix applied"
    }
  ],
  "explanation": "What was broken and how it was fixed",
  "confidence": 8
}`;

// ── Learn from a heal cycle ───────────────────────────────────────────────────
async function learnFromHeal(
  sessionId: string,
  errors: string[],
  rootCause: string,
  fix: string,
  success: boolean
) {
  const content = `ROOT_CAUSE: ${rootCause}\nFIX_APPLIED: ${fix}\nSUCCESS: ${success}`;
  await storeMemory({
    session_id: sessionId,
    agent: "autohealer",
    type: success ? "pattern" : "failure",
    content,
    tags: ["autoheal", success ? "success" : "failure"],
    score: success ? 9 : -1,
  });
}

// ── Main heal loop ────────────────────────────────────────────────────────────
export async function runAutoHeal(ctx: HealContext): Promise<HealResult> {
  const { sessionId, goal, model, maxCycles = 3, threshold = 7 } = ctx;
  let files = [...ctx.files];
  let errors = [...ctx.errors];
  let cycles = 0;
  const learnings: string[] = [];

  // Pull past healing patterns to help the fixer
  const pastPatterns = await retrieveMemory(goal, 8);
  const memCtx = pastPatterns.length > 0
    ? `\n\nPAST HEALING PATTERNS:\n${pastPatterns.map(p => `- ${p.content}`).join("\n")}`
    : "";

  workerBus.emit("autoheal:start", { sessionId, errorCount: errors.length });

  while (errors.length > 0 && cycles < maxCycles) {
    cycles++;
    workerBus.emit("autoheal:cycle", { sessionId, cycle: cycles, errors: errors.slice(0, 3) });

    // Step 0: Search for error solutions live
    let errorSearchCtx = "";
    try {
      const errorQuery = errors.slice(0, 2).join(" ").slice(0, 120);
      const searchBundle = await webSearch(`${errorQuery} fix solution`, 4);
      if (searchBundle.results.length > 0) {
        errorSearchCtx = formatSearchResults([searchBundle]);
        workerBus.emit("autoheal:searching", { sessionId, query: errorQuery });
      }
    } catch { /* non-critical */ }

    // Step 1: Diagnose
    let diagnosis: { rootCause: string; filesToPatch: string[]; canFix: boolean };
    try {
      const { content } = await callAI(
        DIAGNOSE_PROMPT,
        `GOAL: ${goal}\nERRORS:\n${errors.join("\n")}\nFILES:\n${files.map(f => `// ${f.path}`).join("\n")}${memCtx}${errorSearchCtx}`,
        model
      );
      diagnosis = parseJsonResponse(content);
    } catch {
      diagnosis = { rootCause: errors[0], filesToPatch: [], canFix: false };
    }

    if (!diagnosis.canFix) {
      workerBus.emit("autoheal:unfixable", { sessionId, reason: diagnosis.rootCause });
      break;
    }

    // Step 2: Patch via worker
    const targetFiles = files.filter(f => diagnosis.filesToPatch.includes(f.path));
    const job: WorkerJob = {
      id: `heal-${randomUUID()}`,
      sessionId,
      agent: "fixer",
      goal: `Fix these errors: ${errors.slice(0, 3).join("; ")}`,
      context: {
        errors,
        rootCause: diagnosis.rootCause,
        filesToPatch: targetFiles,
        allFilePaths: files.map(f => f.path),
        memoryContext: memCtx,
      },
      model,
      maxRetries: 1,
      selfEvalThreshold: threshold,
    };

    const result = await runWorkerJob(job);
    const patchedFiles: Array<{ path: string; content: string }> = result.output?.files || [];

    if (patchedFiles.length > 0) {
      // Merge patches into the file set
      const fileMap = new Map(files.map(f => [f.path, f]));
      patchedFiles.forEach(p => fileMap.set(p.path, p));
      files = Array.from(fileMap.values());

      // Emit sandbox update for live preview
      workerBus.emit("sandbox:update", { sessionId, files: patchedFiles });
      workerBus.emit("autoheal:patched", {
        sessionId, cycle: cycles,
        patchedPaths: patchedFiles.map(f => f.path),
        explanation: result.output?.explanation || "",
      });

      learnings.push(`Cycle ${cycles}: ${diagnosis.rootCause} → ${result.output?.explanation || "patched"}`);
      await learnFromHeal(sessionId, errors, diagnosis.rootCause, result.output?.explanation || "", result.status === "done");

      // Clear errors optimistically — let preview re-report if still broken
      errors = [];
    } else {
      workerBus.emit("autoheal:nopatch", { sessionId, cycle: cycles });
      break;
    }
  }

  const healed = errors.length === 0 && cycles > 0;
  workerBus.emit("autoheal:done", { sessionId, healed, cycles, learnings });

  return { healed, cycles, patchedFiles: files, remainingErrors: errors, learnings };
}

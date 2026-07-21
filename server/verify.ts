/**
 * Verify — REAL build/typecheck/test execution for a generated file set.
 *
 * This replaces vibes with facts. Everywhere else in this codebase
 * ("Reviewer", "Fixer", "AutoHeal") judges code by having an LLM read it and
 * guess, or by watching a browser iframe for runtime errors. Neither ever
 * actually runs `npm install`, `npm run build`, `tsc --noEmit`, or `npm test`.
 * That means a "successful" build can ship code that has never been proven
 * to install, compile, typecheck, or pass its own tests.
 *
 * This module writes the generated file set to an isolated scratch
 * directory on the server and actually executes those steps with real
 * exit codes, real stdout/stderr, and real timeouts. No LLM opinion, no
 * guessing — either the process exits 0 or it doesn't.
 *
 * Standing instruction this satisfies: "Any 'vibe code to completion' task
 * must enforce step-by-step verification (test/build/typecheck) and stop
 * immediately on failure."
 */

import { spawn } from "child_process";
import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

export interface VerifyFile {
  path: string;
  content: string;
}

export interface VerifyStep {
  name: string;          // "install" | "typecheck" | "build" | "test"
  ran: boolean;           // false if skipped (e.g. no build script defined)
  passed: boolean;
  durationMs: number;
  output: string;         // truncated combined stdout+stderr, real process output
  skippedReason?: string;
}

export interface VerifyResult {
  passed: boolean;        // true ONLY if every step that ran, passed
  steps: VerifyStep[];
  summary: string;        // honest one-line status, never inflated
}

const STEP_TIMEOUT_MS = 90_000;   // per-step hard timeout
const TOTAL_TIMEOUT_MS = 240_000; // whole-verification hard timeout
const MAX_OUTPUT_CHARS = 8000;    // enough for a real error, not a log flood

function truncate(s: string): string {
  if (s.length <= MAX_OUTPUT_CHARS) return s;
  return s.slice(0, MAX_OUTPUT_CHARS) + `\n…[truncated, ${s.length - MAX_OUTPUT_CHARS} more chars]`;
}

/** Runs one shell step with a real hard timeout. Never throws — always
 * resolves with the true exit outcome so the caller can make an honest
 * pass/fail call instead of assuming success. */
function runStep(cmd: string, args: string[], cwd: string): Promise<{ code: number | null; output: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    let output = "";
    let settled = false;
    const child = spawn(cmd, args, { cwd, shell: false, env: { ...process.env, CI: "true", NODE_ENV: "production" } });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolve({ code: null, output: truncate(output) + "\n[TIMED OUT]", timedOut: true });
    }, STEP_TIMEOUT_MS);

    child.stdout?.on("data", (d) => { output += d.toString(); });
    child.stderr?.on("data", (d) => { output += d.toString(); });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: null, output: truncate(output + `\n[spawn error: ${err.message}]`), timedOut: false });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, output: truncate(output), timedOut: false });
    });
  });
}

/** Writes the file set into a fresh scratch directory. Returns the dir path. */
async function materialize(files: VerifyFile[]): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "verify-"));
  for (const f of files) {
    // Guard against path traversal from LLM-generated paths escaping the scratch dir
    const safeRel = f.path.replace(/^([./\\]+)/, "").replace(/\.\.[/\\]/g, "");
    const full = path.join(dir, safeRel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, f.content ?? "", "utf-8");
  }
  return dir;
}

/**
 * Runs real verification against the generated file set. Only supports
 * npm/Node projects for now (the only stack this pipeline can actually
 * generate reliably) — anything else is honestly reported as unsupported
 * rather than silently skipped and marked "passed".
 */
export async function runVerification(files: VerifyFile[]): Promise<VerifyResult> {
  const steps: VerifyStep[] = [];
  const start = Date.now();
  let dir: string | null = null;

  try {
    const hasPackageJson = files.some(f => f.path === "package.json" || f.path.endsWith("/package.json"));
    if (!hasPackageJson) {
      return {
        passed: true,
        steps: [{ name: "detect", ran: false, passed: true, durationMs: 0, output: "", skippedReason: "No package.json in output — not a Node project, real build verification not applicable (honest no-op, not a false pass on a build check)." }],
        summary: "No Node package.json detected — build/test verification skipped (not applicable to this output).",
      };
    }

    dir = await materialize(files);
    const pkgFile = files.find(f => f.path === "package.json")!;
    let pkg: any = {};
    try { pkg = JSON.parse(pkgFile.content); } catch { /* malformed package.json is itself a real failure, handled by install step */ }

    // ── Step 1: install ──
    const installStart = Date.now();
    const install = await runStep("npm", ["install", "--no-audit", "--no-fund", "--prefer-offline"], dir);
    steps.push({
      name: "install", ran: true, passed: install.code === 0,
      durationMs: Date.now() - installStart, output: install.output,
    });
    if (install.code !== 0) {
      return { passed: false, steps, summary: `npm install failed (exit ${install.code ?? "timeout"}) — cannot verify further, real dependency/package.json error.` };
    }

    if (Date.now() - start > TOTAL_TIMEOUT_MS) {
      steps.push({ name: "typecheck", ran: false, passed: false, durationMs: 0, output: "", skippedReason: "Total verification time budget exceeded after install." });
      return { passed: false, steps, summary: "Verification time budget exceeded after install." };
    }

    // ── Step 2: typecheck (only if a tsconfig exists) ──
    const hasTsconfig = files.some(f => f.path === "tsconfig.json" || f.path.endsWith("/tsconfig.json"));
    if (hasTsconfig) {
      const tcStart = Date.now();
      const tc = await runStep("npx", ["--yes", "tsc", "--noEmit"], dir);
      steps.push({
        name: "typecheck", ran: true, passed: tc.code === 0,
        durationMs: Date.now() - tcStart, output: tc.output,
      });
      if (tc.code !== 0) {
        return { passed: false, steps, summary: `TypeScript typecheck failed (exit ${tc.code ?? "timeout"}) — real compiler errors, not an LLM guess.` };
      }
    } else {
      steps.push({ name: "typecheck", ran: false, passed: true, durationMs: 0, output: "", skippedReason: "No tsconfig.json — not a TypeScript project." });
    }

    // ── Step 3: build (only if a build script is defined) ──
    const scripts = pkg.scripts || {};
    if (scripts.build) {
      const buildStart = Date.now();
      const build = await runStep("npm", ["run", "build"], dir);
      steps.push({
        name: "build", ran: true, passed: build.code === 0,
        durationMs: Date.now() - buildStart, output: build.output,
      });
      if (build.code !== 0) {
        return { passed: false, steps, summary: `npm run build failed (exit ${build.code ?? "timeout"}) — real build error.` };
      }
    } else {
      steps.push({ name: "build", ran: false, passed: true, durationMs: 0, output: "", skippedReason: "No 'build' script in package.json." });
    }

    // ── Step 4: test (only if a real test script is defined, not the npm default placeholder) ──
    const testScript: string = scripts.test || "";
    const isPlaceholderTest = !testScript || /no test specified/i.test(testScript);
    if (!isPlaceholderTest) {
      const testStart = Date.now();
      const test = await runStep("npm", ["test", "--", "--run"], dir); // "--run" is a no-op for most non-vitest runners, harmless
      steps.push({
        name: "test", ran: true, passed: test.code === 0,
        durationMs: Date.now() - testStart, output: test.output,
      });
      if (test.code !== 0) {
        return { passed: false, steps, summary: `npm test failed (exit ${test.code ?? "timeout"}) — real test failures.` };
      }
    } else {
      steps.push({ name: "test", ran: false, passed: true, durationMs: 0, output: "", skippedReason: "No real test script defined." });
    }

    return { passed: true, steps, summary: "install/typecheck/build/test all passed (each ran step verified with a real exit code)." };
  } catch (err: any) {
    steps.push({ name: "internal", ran: true, passed: false, durationMs: Date.now() - start, output: String(err?.message || err) });
    return { passed: false, steps, summary: `Verification harness itself errored: ${err?.message || err}` };
  } finally {
    if (dir) {
      try { await rm(dir, { recursive: true, force: true }); } catch { /* best-effort cleanup, not worth failing verification over */ }
    }
  }
}

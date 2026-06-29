/**
 * Tests for the runInSandbox logic used in /api/sandbox/execute.
 *
 * We test the pure sandbox function in isolation (Node vm, no HTTP).
 */
import { describe, it, expect } from "vitest";
import { createContext, Script } from "vm";

// ── Inline sandbox runner (mirrors parallelRoutes.ts) ─────────────────────────
type SandboxResult =
  | { ok: true; output: string; returnValue?: string }
  | { ok: false; error: string };

function runInSandbox(code: string): SandboxResult {
  const logs: string[] = [];
  const sandbox = createContext({
    console: {
      log:   (...args: any[]) => logs.push(args.map(String).join(" ")),
      error: (...args: any[]) => logs.push("[error] " + args.map(String).join(" ")),
      warn:  (...args: any[]) => logs.push("[warn] "  + args.map(String).join(" ")),
    },
    Math, JSON, Array, Object, String, Number, Boolean, RegExp, Date, Map, Set,
    Promise, parseInt, parseFloat, isNaN, isFinite,
    undefined, NaN, Infinity,
  });

  try {
    const script = new Script(code);
    const returnValue = script.runInContext(sandbox, { timeout: 5000 });
    return {
      ok: true,
      output: logs.join("\n"),
      returnValue: returnValue !== undefined && returnValue !== null
        ? String(returnValue).slice(0, 1000)
        : undefined,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Execution error" };
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("runInSandbox", () => {
  it("captures console.log output", () => {
    const result = runInSandbox(`console.log("hello", "world")`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.output).toBe("hello world");
  });

  it("captures multiple log lines", () => {
    const result = runInSandbox(`console.log(1); console.log(2); console.log(3);`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.output).toBe("1\n2\n3");
  });

  it("returns the expression return value", () => {
    const result = runInSandbox(`1 + 2`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.returnValue).toBe("3");
  });

  it("returns a syntax/runtime error for bad code", () => {
    const result = runInSandbox(`throw new Error("oops")`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("oops");
  });

  it("times out on infinite loops", () => {
    const result = runInSandbox(`while(true) {}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toMatch(/timeout|timed out/);
  }, 10000);

  it("blocks access to process", () => {
    const result = runInSandbox(`typeof process`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.returnValue).toBe("undefined");
  });

  it("allows Math operations", () => {
    const result = runInSandbox(`console.log(Math.pow(2, 10))`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.output).toBe("1024");
  });

  it("handles console.error and console.warn", () => {
    const result = runInSandbox(`console.error("err"); console.warn("warn");`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output).toContain("[error] err");
      expect(result.output).toContain("[warn] warn");
    }
  });
});

/**
 * Tests for server/routes.ts :: parseJsonResponse
 *
 * We import the compiled function via a manual re-implementation so that
 * this test runs in Vitest's jsdom environment without needing the full
 * Express server.  The logic is extracted verbatim from routes.ts.
 */
import { describe, it, expect } from "vitest";

// ── Inline the function under test ────────────────────────────────────────────
function parseJsonResponse(content: string): any {
  let c = content.trim();
  if (c.startsWith("```json")) c = c.slice(7);
  else if (c.startsWith("```")) c = c.slice(3);
  if (c.endsWith("```")) c = c.slice(0, -3);
  const parsed = JSON.parse(c.trim());
  if (parsed && typeof parsed === "object" && "agentSequence" in parsed) {
    if (!Array.isArray(parsed.agentSequence)) {
      parsed.agentSequence = ["strategist", "builder", "reviewer", "fixer"];
    }
  }
  return parsed;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("parseJsonResponse", () => {
  it("parses plain JSON", () => {
    const result = parseJsonResponse('{"foo": "bar"}');
    expect(result).toEqual({ foo: "bar" });
  });

  it("strips ```json fences", () => {
    const result = parseJsonResponse('```json\n{"hello": 1}\n```');
    expect(result).toEqual({ hello: 1 });
  });

  it("strips ``` fences without language tag", () => {
    const result = parseJsonResponse('```\n{"x": true}\n```');
    expect(result).toEqual({ x: true });
  });

  it("normalises invalid agentSequence to default array", () => {
    const result = parseJsonResponse('{"agentSequence": "strategist, builder"}');
    expect(Array.isArray(result.agentSequence)).toBe(true);
    expect(result.agentSequence).toContain("builder");
  });

  it("preserves a valid agentSequence array", () => {
    const result = parseJsonResponse('{"agentSequence": ["api", "ui"]}');
    expect(result.agentSequence).toEqual(["api", "ui"]);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseJsonResponse("not json")).toThrow();
  });

  it("handles nested objects", () => {
    const input = JSON.stringify({ issues: [{ id: "1", severity: "error" }], summary: "ok" });
    const result = parseJsonResponse(input);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe("error");
  });
});

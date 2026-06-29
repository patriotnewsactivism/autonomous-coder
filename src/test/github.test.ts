/**
 * Tests for src/lib/github.ts
 *
 * Uses Vitest's built-in fetch mocking to avoid real network calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { connectToGitHub, listUserRepos, getFileContent } from "../lib/github";

// ── Mock global fetch ─────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function okJson(data: any) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as Response);
}

function errorResponse(status: number, body: any) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

beforeEach(() => {
  mockFetch.mockReset();
});

// ── connectToGitHub ───────────────────────────────────────────────────────────
describe("connectToGitHub", () => {
  it("calls /api/github/import and returns structured data", async () => {
    const payload = {
      fullName: "owner/repo", name: "repo", description: null,
      language: "TypeScript", defaultBranch: "main",
      stars: 10, totalFiles: 5, loadedFiles: 5, files: [],
    };
    mockFetch.mockReturnValueOnce(okJson(payload));

    const result = await connectToGitHub("https://github.com/owner/repo");
    expect(result.fullName).toBe("owner/repo");
    expect(result.defaultBranch).toBe("main");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/github/import",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("passes token in request body", async () => {
    mockFetch.mockReturnValueOnce(okJson({ fullName: "a/b", files: [] }));
    await connectToGitHub("https://github.com/a/b", "ghp_secret");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.token).toBe("ghp_secret");
  });

  it("throws when the server returns an error", async () => {
    mockFetch.mockReturnValueOnce(errorResponse(404, { error: "Repository not found" }));
    await expect(connectToGitHub("https://github.com/x/y")).rejects.toThrow("Repository not found");
  });
});

// ── listUserRepos ─────────────────────────────────────────────────────────────
describe("listUserRepos", () => {
  it("calls /api/github/repos and returns data", async () => {
    const repos = [{ id: 1, name: "myrepo" }];
    mockFetch.mockReturnValueOnce(okJson(repos));

    const result = await listUserRepos("ghp_token");
    expect(result).toEqual(repos);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/github/repos",
      expect.objectContaining({ method: "POST" })
    );
  });
});

// ── getFileContent ────────────────────────────────────────────────────────────
describe("getFileContent", () => {
  it("fetches a file and returns path + content", async () => {
    const file = { path: "src/index.ts", content: "console.log('hello')" };
    mockFetch.mockReturnValueOnce(okJson(file));

    const result = await getFileContent("ghp_token", "owner/repo", "src/index.ts");
    expect(result.path).toBe("src/index.ts");
    expect(result.content).toContain("console.log");
  });
});

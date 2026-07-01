import type { Express } from "express";
import { storage } from "./storage";
import {
  buildRequest, parseResponse, parseStreamChunk,
  getFallbackModel, getAvailableModels, getModelPricing,
  getDefaultModel, getProviderForModel, calcCost as _calcCost,
  isProviderActive, type ProviderName,
  getProvidersStatus, getFreeUnconfiguredProviders,
} from "./providers";
import { listMyKeys, saveKey, deleteKey, hasAnyKey } from "./apiKeys";

interface Issue {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  line?: number;
  suggestion?: string;
  fixedCode?: string;
}

interface AnalysisResponse {
  issues: Issue[];
  summary: string;
}

const systemPromptAnalyze = `You are an expert code analyzer and fixer. Analyze code for issues and return JSON:
{
  "issues": [
    {
      "id": "unique-id",
      "severity": "error" | "warning" | "info",
      "message": "Brief description",
      "line": line_number_or_null,
      "suggestion": "How to fix",
      "fixedCode": "Corrected code snippet"
    }
  ],
  "summary": "Overall summary"
}
IMPORTANT: Return ONLY valid JSON, no markdown.`;

import { systemPrompts } from "./agentPrompts";
export { systemPrompts };
// ── Multi-provider AI gateway ──────────────────────────────────────────────
// All provider logic is in server/providers.ts — supports DeepSeek, Groq,
// Google Gemini, Cerebras, GitHub Models, and Cohere with auto-fallback.
const DEFAULT_MODEL = getDefaultModel();

function buildNoProvidersError(): string {
  const free = getFreeUnconfiguredProviders();
  if (free.length === 0) {
    const active = getProvidersStatus().filter(p => p.active);
    if (active.length > 0) {
      return `AI providers are configured but none are responding. Active: ${active.map(p => p.label).join(", ")}. Check your API keys.`;
    }
    return "No AI providers are configured. Set one of: DEEPSEEK_API_KEY, GROQ_API_KEY (free), GEMINI_API_KEY (free), CEREBRAS_API_KEY (free), GITHUB_TOKEN (free), COHERE_API_KEY (free)";
  }
  const lines = free.map(p => `  - ${p.envVar} → ${p.signupUrl} (${p.label})`);
  return `No AI providers are configured. Set one of these free API keys:\n${lines.join("\n")}`;
}

interface AIUsage {
  content: string;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  model: string;
  costUsd: number;
}

function calcCost(model: string, promptTokens: number, completionTokens: number): number {
  return _calcCost(model, promptTokens, completionTokens);
}

export async function callAI(
  systemPrompt: string,
  userMessage: string,
  model?: string,
  triedModels: Set<string> = new Set(),
): Promise<AIUsage> {
  const deployment = model || DEFAULT_MODEL;
  if (!deployment) throw new Error(buildNoProvidersError());

  if (triedModels.has(deployment)) {
    const tried = Array.from(triedModels).join(", ");
    throw new Error(`All AI providers failed (tried: ${tried}). ${buildNoProvidersError()}`);
  }
  triedModels.add(deployment);

  const req = buildRequest(deployment, systemPrompt, userMessage, 4096, false);
  const providerName = getProviderForModel(deployment);

  if (!providerName) {
    const fallback = getFallbackModel(deployment);
    if (fallback && !triedModels.has(fallback)) {
      console.log(`[callAI] No provider for ${deployment}, falling back to ${fallback}`);
      return callAI(systemPrompt, userMessage, fallback, triedModels);
    }
    throw new Error(buildNoProvidersError());
  }

  const response = await fetch(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify(req.body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const fallback = getFallbackModel(deployment);
    if (fallback && !triedModels.has(fallback)) {
      console.log(`[callAI] ${deployment} failed (${response.status}), falling back to ${fallback}`);
      return callAI(systemPrompt, userMessage, fallback, triedModels);
    }
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again.");
    if (response.status === 401) throw new Error(`${deployment}: Invalid API key. Check that your key is valid and has not expired.\n\n${buildNoProvidersError()}`);
    throw new Error(`AI error (${deployment}): ${response.status} - ${errorText}`);
  }

  const aiResponse = await response.json();
  const parsed = parseResponse(providerName, aiResponse);

  if (!parsed.content) {
    const fallback = getFallbackModel(deployment);
    if (fallback && !triedModels.has(fallback)) {
      console.log(`[callAI] ${deployment} returned empty, falling back to ${fallback}`);
      return callAI(systemPrompt, userMessage, fallback, triedModels);
    }
    throw new Error(`No response from AI (${deployment}). All providers exhausted.`);
  }
  return {
    content: parsed.content,
    tokens: parsed.totalTokens,
    promptTokens: parsed.promptTokens,
    completionTokens: parsed.completionTokens,
    model: deployment,
    costUsd: calcCost(deployment, parsed.promptTokens, parsed.completionTokens),
  };
}

export async function callAIStream(
  systemPrompt: string,
  userMessage: string,
  onToken: (token: string) => void,
  model?: string,
  triedModels: Set<string> = new Set(),
): Promise<AIUsage> {
  const deployment = model || DEFAULT_MODEL;
  if (!deployment) throw new Error(buildNoProvidersError());

  if (triedModels.has(deployment)) {
    const tried = Array.from(triedModels).join(", ");
    throw new Error(`All AI providers failed (tried: ${tried}). ${buildNoProvidersError()}`);
  }
  triedModels.add(deployment);

  const req = buildRequest(deployment, systemPrompt, userMessage, 4096, true);
  const providerName = getProviderForModel(deployment);

  if (!providerName) {
    const fallback = getFallbackModel(deployment);
    if (fallback && !triedModels.has(fallback)) {
      console.log(`[callAIStream] No provider for ${deployment}, falling back to ${fallback}`);
      return callAIStream(systemPrompt, userMessage, onToken, fallback, triedModels);
    }
    throw new Error(buildNoProvidersError());
  }

  const response = await fetch(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify(req.body),
  });

  if (!response.ok) {
    const fallback = getFallbackModel(deployment);
    if (fallback && !triedModels.has(fallback)) {
      console.log(`[callAIStream] ${deployment} failed (${response.status}), falling back to ${fallback}`);
      return callAIStream(systemPrompt, userMessage, onToken, fallback, triedModels);
    }
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again.");
    if (response.status === 401) throw new Error(`${deployment}: Invalid API key. Check that your key is valid and has not expired.\n\n${buildNoProvidersError()}`);
    throw new Error(`AI error (${deployment}): ${response.status}`);
  }

  let fullContent = "";
  let tokens = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      const tokenText = parseStreamChunk(providerName, line);
      if (tokenText) {
        fullContent += tokenText;
        onToken(tokenText);
      }
      // Try to capture usage from final chunks (OpenAI format)
      if (line.startsWith("data: ")) {
        try {
          const d = JSON.parse(line.slice(6).trim());
          if (d.usage?.total_tokens) {
            tokens = d.usage.total_tokens;
            promptTokens = d.usage.prompt_tokens || 0;
            completionTokens = d.usage.completion_tokens || 0;
          }
        } catch { /* skip */ }
      }
    }
  }

  // Fallback: estimate tokens from content length
  if (tokens === 0 && fullContent.length > 0) {
    tokens = Math.round(fullContent.length / 4);
  }

  return {
    content: fullContent,
    tokens,
    promptTokens,
    completionTokens,
    model: deployment,
    costUsd: calcCost(deployment, promptTokens, completionTokens),
  };
}

export function parseJsonResponse(content: string): any {
  let c = content.trim();
  if (c.startsWith("```json")) c = c.slice(7);
  else if (c.startsWith("```")) c = c.slice(3);
  if (c.endsWith("```")) c = c.slice(0, -3);
  const parsed = JSON.parse(c.trim());
  // Ensure agentSequence is always a valid array when present
  if (parsed && typeof parsed === "object" && "agentSequence" in parsed) {
    if (!Array.isArray(parsed.agentSequence)) {
      parsed.agentSequence = ["strategist", "builder", "reviewer", "fixer"];
    }
  }
  return parsed;
}

function sendSSE(res: any, event: string, data: any) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function registerRoutes(app: Express): Promise<void> {

  // ─── BYOK: per-user AI provider API keys ──────────────────────────────────
  // Ported from codeforge-v2. Any user (identified by userId, e.g. a Supabase
  // auth UID or a client-generated UUID) can supply their own provider key.
  app.get("/api/keys/:userId", async (req, res) => {
    try {
      const keys = await listMyKeys(req.params.userId);
      res.json(keys);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/keys/:userId/has-any", async (req, res) => {
    try {
      res.json({ hasKey: await hasAnyKey(req.params.userId) });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/keys", async (req, res) => {
    try {
      const { userId, provider, apiKey } = req.body;
      if (!userId || !provider || !apiKey) {
        return res.status(400).json({ error: "userId, provider, and apiKey are required" });
      }
      const result = await saveKey(userId, provider, apiKey);
      if (!result.success) return res.status(400).json(result);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.delete("/api/keys/:userId/:provider", async (req, res) => {
    try {
      const result = await deleteKey(req.params.userId, req.params.provider);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/analyze-code", async (req, res) => {
    try {
      const { code, language } = req.body;
      if (!code || typeof code !== "string") return res.status(400).json({ error: "Code is required" });

      const { content } = await callAI(systemPromptAnalyze, `Analyze this ${language || "code"}:\n\n${code}`, req.body.model);
      let analysis: AnalysisResponse;
      try {
        analysis = parseJsonResponse(content);
      } catch {
        analysis = { issues: [], summary: "Analysis complete. Code may be valid." };
      }

      await storage.createAnalysisHistory({
        code, language: language || null,
        summary: analysis.summary, issueCount: analysis.issues?.length || 0,
      });

      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.get("/api/providers/status", (_req, res) => {
    const all = getProvidersStatus();
    const active = getProvidersStatus().filter(p => p.active);
    res.json({
      totalProviders: all.length,
      activeProviders: active.length,
      allConfigured: active.length === all.length,
      anyConfigured: active.length > 0,
      providers: all.map(p => ({
        name: p.name,
        label: p.label,
        isFree: p.isFree,
        active: p.active,
        envVar: p.envVar,
        signupUrl: p.signupUrl,
        models: p.models,
      })),
      freeUnconfigured: getFreeUnconfiguredProviders().map(p => ({
        name: p.name,
        label: p.label,
        envVar: p.envVar,
        signupUrl: p.signupUrl,
      })),
    });
  });

  app.get("/api/models", (_req, res) => {
    const modelList = getAvailableModels();
    const modelIds = modelList.map(m => m.id);
    const pricing = getModelPricing();
    res.json({
      models: modelIds,
      default: DEFAULT_MODEL || "deepseek-chat",
      pricing,
      providers: modelList.map(m => ({
        id: m.id,
        label: m.label,
        provider: m.provider,
        isFree: m.isFree,
        contextWindow: m.contextWindow,
      })),
    });
  });

  app.post("/api/ai-agent", async (req, res) => {
    try {
      const { goal, context, agentType, model } = req.body;
      const systemPrompt = systemPrompts[agentType] || systemPrompts.orchestrator;
      const result = await callAI(systemPrompt, `Goal: ${goal}\n\nContext: ${JSON.stringify(context || {})}`, model);
      let parsed;
      try { parsed = parseJsonResponse(result.content); } catch { parsed = { raw: result.content }; }
      res.json({ agent: agentType, result: parsed, tokens: result.tokens, promptTokens: result.promptTokens, completionTokens: result.completionTokens, costUsd: result.costUsd, model: result.model });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Agent failed" });
    }
  });

  app.post("/api/ai-agent/stream", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      const { goal, context, agentType, model } = req.body;
      const systemPrompt = systemPrompts[agentType] || systemPrompts.orchestrator;

      const result = await callAIStream(
        systemPrompt,
        `Goal: ${goal}\n\nContext: ${JSON.stringify(context || {})}`,
        (token) => {
          sendSSE(res, "token", { content: token });
        },
        model
      );

      let parsed;
      try { parsed = parseJsonResponse(result.content); } catch { parsed = { raw: result.content }; }
      sendSSE(res, "done", { agent: agentType, result: parsed, tokens: result.tokens, promptTokens: result.promptTokens, completionTokens: result.completionTokens, costUsd: result.costUsd, model: result.model });
      res.end();
    } catch (error) {
      sendSSE(res, "error", { message: error instanceof Error ? error.message : "Agent failed" });
      res.end();
    }
  });

  app.get("/api/analyses/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      res.json(await storage.getRecentAnalyses(limit));
    } catch (error) {
      res.status(500).json({ error: "Failed to get recent analyses" });
    }
  });

  // Project history
  app.post("/api/projects", async (req, res) => {
    try {
      const { goal, files, agentSequence } = req.body;
      if (!goal || !files) return res.status(400).json({ error: "Goal and files required" });
      const project = await storage.createProject({
        goal,
        files: JSON.stringify(files),
        agentSequence: JSON.stringify(agentSequence || []),
        fileCount: Array.isArray(files) ? files.length : 0,
      });
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to save project" });
    }
  });

  app.get("/api/projects/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const projects = await storage.getRecentProjects(limit);
      res.json(projects.map((p) => ({
        id: p.id,
        goal: p.goal,
        fileCount: p.fileCount,
        agentSequence: p.agentSequence,
        createdAt: p.createdAt,
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to get projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Project not found" });
      res.json({ ...project, files: JSON.parse(project.files) });
    } catch (error) {
      res.status(500).json({ error: "Failed to get project" });
    }
  });

  // GitHub routes
  app.post("/api/github/repos", async (req, res) => {
    try {
      const { token, username } = req.body;
      const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Autonomous-Code-Wizard",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      let url: string;
      if (token) {
        url = "https://api.github.com/user/repos?sort=updated&per_page=50";
      } else if (username) {
        url = `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=50`;
      } else {
        return res.status(400).json({ error: "Provide a GitHub token (for your repos) or a username (to browse public repos)." });
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        if (response.status === 401) {
          if (token) return res.status(401).json({ error: "Invalid GitHub token" });
          return res.status(401).json({ error: "GitHub API rate limit exceeded. Add a token to increase limit." });
        }
        return res.status(response.status).json({ error: "GitHub API error" });
      }

      const repos = await response.json();
      res.json(repos.map((r: any) => ({
        id: r.id, name: r.name, fullName: r.full_name,
        description: r.description, language: r.language,
        stars: r.stargazers_count, updatedAt: r.updated_at,
        private: r.private, defaultBranch: r.default_branch,
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch repositories" });
    }
  });

  app.post("/api/github/repo-files", async (req, res) => {
    try {
      const { token, fullName, branch = "main" } = req.body;
      if (!fullName) return res.status(400).json({ error: "Repo name required" });

      const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Autonomous-Code-Wizard",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const tryBranch = async (b: string) => {
        const r = await fetch(`https://api.github.com/repos/${fullName}/git/trees/${b}?recursive=1`, { headers });
        return r;
      };

      let treeResponse = await tryBranch(branch);
      if (!treeResponse.ok && branch === "main") treeResponse = await tryBranch("master");
      if (!treeResponse.ok) {
        if (treeResponse.status === 404) return res.status(404).json({ error: "Repository branch not found" });
        if (treeResponse.status === 401) return res.status(401).json({ error: "This repo may be private — add a GitHub token" });
        return res.status(treeResponse.status).json({ error: "GitHub API error" });
      }

      const tree = await treeResponse.json();
      const codeExts = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".css", ".json", ".md"];
      const files = tree.tree?.filter((f: any) => f.type === "blob" && codeExts.some((ext) => f.path.endsWith(ext))).slice(0, 80) || [];
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch repository files" });
    }
  });

  app.post("/api/github/file-content", async (req, res) => {
    try {
      const { token, fullName, filePath, branch = "main" } = req.body;
      if (!fullName || !filePath) return res.status(400).json({ error: "Missing parameters" });

      const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Autonomous-Code-Wizard",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`https://api.github.com/repos/${fullName}/contents/${filePath}?ref=${branch}`, { headers });

      if (!response.ok) return res.status(response.status).json({ error: "File not found" });
      const fileData = await response.json();
      const content = Buffer.from(fileData.content, "base64").toString("utf-8");
      res.json({ path: filePath, content });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch file content" });
    }
  });

  app.post("/api/github/analyze-pr", async (req, res) => {
    try {
      const { token, fullName, prNumber } = req.body;
      if (!token || !fullName || !prNumber) return res.status(400).json({ error: "Token, repo, and PR number required" });

      const [prResponse, filesResponse] = await Promise.all([
        fetch(`https://api.github.com/repos/${fullName}/pulls/${prNumber}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "Autonomous-Code-Wizard" },
        }),
        fetch(`https://api.github.com/repos/${fullName}/pulls/${prNumber}/files`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "Autonomous-Code-Wizard" },
        }),
      ]);

      if (!prResponse.ok) return res.status(404).json({ error: "PR not found" });

      const pr = await prResponse.json();
      const files = filesResponse.ok ? await filesResponse.json() : [];

      const prInfo = {
        number: pr.number,
        title: pr.title,
        description: pr.body,
        author: pr.user?.login,
        files: files.slice(0, 20).map((f: any) => ({
          filename: f.filename,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch?.slice(0, 2000),
        })),
      };

      const { content } = await callAI(
        systemPrompts.reviewer,
        `Review this Pull Request:\n\n${JSON.stringify(prInfo, null, 2)}`
      );

      let review;
      try { review = parseJsonResponse(content); } catch { review = { summary: content, overallScore: 7, issues: [] }; }
      res.json({ pr: prInfo, review });
    } catch (error) {
      res.status(500).json({ error: "Failed to analyze PR" });
    }
  });

  // ── Public repo import (no token required) ───────────────────────────────
  app.post("/api/github/import", async (req, res) => {
    try {
      const { repoUrl, token } = req.body;
      if (!repoUrl) return res.status(400).json({ error: "Repository URL is required" });

      // Parse the GitHub URL to extract owner/repo
      let owner: string, repo: string;
      const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:$|[/?#])/i);
      if (match) {
        owner = match[1];
        repo = match[2];
      } else {
        return res.status(400).json({ error: "Invalid GitHub URL. Use https://github.com/owner/repo" });
      }

      const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Autonomous-Coder",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Get repo metadata (also verifies it exists and is accessible)
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (!repoRes.ok) {
        if (repoRes.status === 404) return res.status(404).json({ error: "Repository not found (it may be private — provide a token)" });
        return res.status(repoRes.status).json({ error: "GitHub API error" });
      }
      const repoData = await repoRes.json();
      const defaultBranch = repoData.default_branch || "main";
      const fullName = `${owner}/${repo}`;

      // Get the file tree
      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
        { headers }
      );
      if (!treeRes.ok) return res.status(404).json({ error: "Could not fetch file tree" });
      const tree = await treeRes.json();

      // Filter to code files, skip node_modules, .git, dist, build, etc.
      const skipDirs = ["node_modules/", ".git/", "dist/", "build/", ".next/", "__pycache__/", ".venv/", "vendor/", "target/", ".cache/"];
      const codeExts = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".rb", ".php",
        ".css", ".scss", ".html", ".json", ".yaml", ".yml", ".toml", ".md", ".sql",
        ".sh", ".env.example", ".dockerfile", "Dockerfile", "Makefile", ".vue", ".svelte"];
      const isCodeFile = (path: string) => {
        if (skipDirs.some(d => path.startsWith(d) || path.includes("/" + d))) return false;
        return codeExts.some(ext => path.endsWith(ext)) || path === "Dockerfile" || path === "Makefile";
      };

      const allFiles = (tree.tree || []).filter((f: any) => f.type === "blob" && isCodeFile(f.path));
      // Sort by importance: package.json, README, config files first, then source
      const priority = (p: string) => {
        if (p === "package.json" || p === "Cargo.toml" || p === "go.mod" || p === "requirements.txt") return 0;
        if (p.endsWith("README.md")) return 1;
        if (p.includes(".config.") || p.endsWith("tsconfig.json") || p.endsWith("vite.config")) return 2;
        if (p.startsWith("server/") || p.startsWith("src/")) return 3;
        return 4;
      };
      allFiles.sort((a: any, b: any) => priority(a.path) - priority(b.path));

      // Fetch content for up to 40 files (covers most repos for AI context)
      const filesToFetch = allFiles.slice(0, 80);
      const fileResults = await Promise.allSettled(
        filesToFetch.map(async (f: any) => {
          const contentRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${f.path}?ref=${defaultBranch}`,
            { headers }
          );
          if (!contentRes.ok) return null;
          const fileData = await contentRes.json();
          // Skip files > 100KB (likely generated/binary)
          if (fileData.size > 200000) return null;
          const fileContent = Buffer.from(fileData.content, "base64").toString("utf-8");
          return { path: f.path, content: fileContent, size: fileData.size };
        })
      );

      const files = fileResults
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && r.value !== null)
        .map(r => r.value);

      res.json({
        fullName,
        name: repo,
        description: repoData.description,
        language: repoData.language,
        defaultBranch,
        stars: repoData.stargazers_count,
        totalFiles: allFiles.length,
        loadedFiles: files.length,
        files,
      });
    } catch (error) {
      console.error("[import]", error);
      res.status(500).json({ error: "Failed to import repository" });
    }
  });

  // /api/github/clone — legacy alias: delegates to /api/github/import logic
  app.post("/api/github/clone", async (req, res) => {
    try {
      const { repoUrl, token } = req.body;
      if (!repoUrl) return res.status(400).json({ error: "Repository URL is required" });

      // Parse owner/repo from URL
      const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:$|[/?#])/i);
      if (!match) return res.status(400).json({ error: "Invalid GitHub URL. Use https://github.com/owner/repo" });
      const [, owner, repo] = match;

      const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Autonomous-Coder",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Get default branch
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (!repoRes.ok) {
        if (repoRes.status === 404) return res.status(404).json({ error: "Repository not found" });
        return res.status(repoRes.status).json({ error: "GitHub API error" });
      }
      const repoData = await repoRes.json();
      const defaultBranch = repoData.default_branch || "main";

      // Get file tree
      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
        { headers }
      );
      if (!treeRes.ok) return res.status(404).json({ error: "Could not fetch file tree" });
      const tree = await treeRes.json();

      const skipDirs = ["node_modules/", ".git/", "dist/", "build/", ".next/", "__pycache__/", ".venv/", "vendor/"];
      const codeExts = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".rb", ".php",
        ".css", ".scss", ".html", ".json", ".yaml", ".yml", ".md", ".sql", ".sh", ".vue", ".svelte"];
      const allFiles = (tree.tree || []).filter((f: any) =>
        f.type === "blob" &&
        !skipDirs.some((d) => f.path.startsWith(d) || f.path.includes("/" + d)) &&
        codeExts.some((ext) => f.path.endsWith(ext))
      );

      const filesToFetch = allFiles.slice(0, 80);
      const fileResults = await Promise.allSettled(
        filesToFetch.map(async (f: any) => {
          const r = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${f.path}?ref=${defaultBranch}`,
            { headers }
          );
          if (!r.ok) return null;
          const data = await r.json();
          if (data.size > 100000) return null;
          return { path: f.path, content: Buffer.from(data.content, "base64").toString("utf-8"), size: data.size };
        })
      );

      const files = fileResults
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && r.value !== null)
        .map((r) => r.value);

      res.json({ fullName: `${owner}/${repo}`, name: repo, defaultBranch, totalFiles: allFiles.length, loadedFiles: files.length, files });
    } catch (error) {
      res.status(500).json({ error: "Failed to clone repository" });
    }
  });

  // ── Notification System ─────────────────────────────────────────────────────
  const SLACK_NOTIFY_WEBHOOK = process.env.SLACK_NOTIFY_WEBHOOK || "";
  const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
  const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "alerts@donmatthews.live";
  const NOTIFY_TO_EMAIL = process.env.NOTIFY_TO_EMAIL || "wtpjournalism@gmail.com";
  const SUPABASE_URL = process.env.SUPABASE_URL || "";
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  async function sendNotification(opts: {
    projectId?: number;
    agent: string;
    severity: "info" | "warning" | "critical";
    title: string;
    message: string;
    requiresDecision: boolean;
    decisionOptions?: string[];
  }) {
    const results = { supabase: false, slack: false, email: false };

    // 1. Store in Supabase
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/coder_notifications`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            project_id: opts.projectId || null,
            agent: opts.agent,
            severity: opts.severity,
            title: opts.title,
            message: opts.message,
            requires_decision: opts.requiresDecision,
            decision_options: opts.decisionOptions ? JSON.stringify(opts.decisionOptions) : null,
          }),
        });
        results.supabase = true;
      } catch (e) { console.error("[notify] Supabase error:", e); }
    }

    // 2. Slack notification
    if (SLACK_NOTIFY_WEBHOOK) {
      try {
        const emoji = opts.severity === "critical" ? "🚨" : opts.severity === "warning" ? "⚠️" : "ℹ️";
        const decisionText = opts.requiresDecision && opts.decisionOptions
          ? `\n\n*Options:* ${opts.decisionOptions.map((o, i) => `\n${i + 1}. ${o}`).join("")}`
          : "";
        await fetch(SLACK_NOTIFY_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `${emoji} *Superagent — ${opts.title}*\nAgent: \`${opts.agent}\` | Severity: ${opts.severity}\n\n${opts.message}${decisionText}`,
          }),
        });
        results.slack = true;
      } catch (e) { console.error("[notify] Slack error:", e); }
    }

    // 3. Email notification via Resend
    if (RESEND_API_KEY) {
      try {
        const emoji = opts.severity === "critical" ? "🚨" : opts.severity === "warning" ? "⚠️" : "ℹ️";
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: NOTIFY_EMAIL,
            to: [NOTIFY_TO_EMAIL],
            subject: `${emoji} Superagent: ${opts.title}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #0f172a; border-radius: 12px; padding: 24px; color: #e2e8f0;">
                  <h2 style="margin: 0 0 8px; color: ${opts.severity === 'critical' ? '#ef4444' : opts.severity === 'warning' ? '#f59e0b' : '#10b981'};">
                    ${emoji} ${opts.title}
                  </h2>
                  <p style="margin: 0 0 16px; color: #94a3b8; font-size: 14px;">Agent: ${opts.agent} · ${new Date().toLocaleString()}</p>
                  <div style="background: #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                    <p style="margin: 0; white-space: pre-wrap;">${opts.message}</p>
                  </div>
                  ${opts.requiresDecision ? `
                    <div style="background: #1e293b; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px;">
                      <p style="margin: 0 0 8px; font-weight: bold; color: #f59e0b;">Decision Required:</p>
                      ${(opts.decisionOptions || []).map((o, i) => `<p style="margin: 4px 0; color: #e2e8f0;">${i + 1}. ${o}</p>`).join("")}
                      <p style="margin: 12px 0 0; font-size: 12px; color: #64748b;">Reply to this email or respond in Slack/the app.</p>
                    </div>
                  ` : ""}
                </div>
              </div>
            `,
          }),
        });
        results.email = true;
      } catch (e) { console.error("[notify] Email error:", e); }
    }

    return results;
  }

  // Notification endpoint — agents call this when they need user attention
  app.post("/api/notify", async (req, res) => {
    try {
      const { projectId, agent, severity, title, message, requiresDecision, decisionOptions } = req.body;
      if (!title || !message) return res.status(400).json({ error: "title and message required" });

      const results = await sendNotification({
        projectId, agent: agent || "system",
        severity: severity || "info", title, message,
        requiresDecision: requiresDecision || false,
        decisionOptions,
      });

      res.json({ sent: results });
    } catch (error) {
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Get notifications (for in-app notification panel)
  app.get("/api/notifications", async (_req, res) => {
    try {
      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.json([]);
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/coder_notifications?order=created_at.desc&limit=50`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
      );
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.json([]);
    }
  });

  // Respond to a notification decision
  app.post("/api/notifications/:id/respond", async (req, res) => {
    try {
      const { response: userResponse } = req.body;
      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(500).json({ error: "No storage" });
      const result = await fetch(
        `${SUPABASE_URL}/rest/v1/coder_notifications?id=eq.${req.params.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({ user_response: userResponse, responded_at: new Date().toISOString() }),
        }
      );
      const data = await result.json();
      res.json(data[0] || {});
    } catch (error) {
      res.status(500).json({ error: "Failed to respond" });
    }
  });

  // ── GitHub push endpoint ────────────────────────────────────────────────────
  // Commits generated files directly to a GitHub repo
  app.post("/api/github/push", async (req, res) => {
    try {
      const { token, fullName, branch = "main", message: commitMsg, files } = req.body;
      if (!token || !fullName || !files?.length) {
        return res.status(400).json({ error: "token, fullName, and files are required" });
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Autonomous-Coder",
        "Content-Type": "application/json",
      };

      // Get default branch SHA
      const repoRes = await fetch(`https://api.github.com/repos/${fullName}`, { headers });
      if (!repoRes.ok) return res.status(404).json({ error: "Repo not found or no access" });
      const repo = await repoRes.json();
      const defaultBranch = repo.default_branch || branch;

      const refRes = await fetch(`https://api.github.com/repos/${fullName}/git/ref/heads/${defaultBranch}`, { headers });
      if (!refRes.ok) return res.status(404).json({ error: `Branch ${defaultBranch} not found` });
      const { object: { sha: latestSha } } = await refRes.json();

      // Create blobs for each file
      const blobPromises = (files as Array<{path: string; content: string}>).map(async (file) => {
        const blobRes = await fetch(`https://api.github.com/repos/${fullName}/git/blobs`, {
          method: "POST",
          headers,
          body: JSON.stringify({ content: file.content, encoding: "utf-8" }),
        });
        const blob = await blobRes.json();
        return { path: file.path, mode: "100644", type: "blob", sha: blob.sha };
      });
      const tree = await Promise.all(blobPromises);

      // Create tree
      const treeRes = await fetch(`https://api.github.com/repos/${fullName}/git/trees`, {
        method: "POST",
        headers,
        body: JSON.stringify({ base_tree: latestSha, tree }),
      });
      const newTree = await treeRes.json();

      // Create commit
      const commitRes = await fetch(`https://api.github.com/repos/${fullName}/git/commits`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: commitMsg || `feat: autonomous coder update — ${files.length} file(s)`,
          tree: newTree.sha,
          parents: [latestSha],
        }),
      });
      const commit = await commitRes.json();

      // Update branch ref
      await fetch(`https://api.github.com/repos/${fullName}/git/refs/heads/${defaultBranch}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ sha: commit.sha }),
      });

      res.json({ success: true, commitSha: commit.sha, branch: defaultBranch, url: commit.html_url });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Push failed" });
    }
  });

  // ── Auto-save history endpoint ──────────────────────────────────────────────
  // Persists a snapshot of generated files so users can restore any version
  app.post("/api/autosave", async (req, res) => {
    try {
      const { goal, files, agentSequence } = req.body;
      if (!files?.length) return res.status(400).json({ error: "files required" });
      const project = await storage.createProject({ goal: goal || "Untitled", files: JSON.stringify(files), agentSequence: JSON.stringify(agentSequence || []), fileCount: Array.isArray(files) ? files.length : 0 });
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Autosave failed" });
    }
  });

  // ── AutoHeal: fix preview/runtime errors autonomously ──────────────────────
  app.post("/api/autoheal", async (req, res) => {
    try {
      const { sessionId, goal, files, errors, model, maxCycles } = req.body;
      if (!files?.length || !errors?.length) {
        return res.status(400).json({ error: "files and errors required" });
      }
      const { runAutoHeal } = await import("./autoHeal.js");
      const result = await runAutoHeal({ sessionId, goal, files, errors, model, maxCycles });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "AutoHeal failed" });
    }
  });

  // ── AutoLearn: extract + store learnings after a build ─────────────────────
  app.post("/api/autolearn", async (req, res) => {
    try {
      const { summary, model } = req.body;
      const { extractAndStoreLearnigns } = await import("./autoLearn.js");
      await extractAndStoreLearnigns(summary, model);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "AutoLearn failed" });
    }
  });

  // ── SpawnEngine: decompose epic goals into parallel agent shards ────────────
  app.post("/api/spawn/plan", async (req, res) => {
    try {
      const { goal, model } = req.body;
      if (!goal) return res.status(400).json({ error: "goal required" });
      const { planSpawn } = await import("./spawnEngine.js");
      const plan = await planSpawn(goal, model);
      res.json(plan);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Spawn plan failed" });
    }
  });

  app.post("/api/spawn/execute", async (req, res) => {
    try {
      const { plan, sessionId, goal, model } = req.body;
      if (!plan || !sessionId) return res.status(400).json({ error: "plan and sessionId required" });
      const { executeSpawnPlan } = await import("./spawnEngine.js");
      const files = await executeSpawnPlan(plan, sessionId, goal, model);
      res.json({ files });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Spawn execute failed" });
    }
  });

  app.post("/api/spawn/quick", async (req, res) => {
    try {
      const { sessionId, goal, tasks, model } = req.body;
      const { quickSpawn } = await import("./spawnEngine.js");
      const files = await quickSpawn(sessionId, goal, tasks, model);
      res.json({ files });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Quick spawn failed" });
    }
  });


  // ── Live Web Search endpoint ────────────────────────────────────────────────
  app.post("/api/search", async (req, res) => {
    try {
      const { query, maxResults, agentType } = req.body;
      if (!query) return res.status(400).json({ error: "query required" });
      const { webSearch, buildResearchQueries, multiSearch } = await import("./webSearch.js");
      if (agentType) {
        const queries = buildResearchQueries(query, agentType);
        const combined = await multiSearch(queries, maxResults || 4);
        return res.json({ formatted: combined, queries });
      }
      const bundle = await webSearch(query, maxResults || 6);
      res.json(bundle);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Search failed" });
    }
  });

  app.get("/api/search/status", async (_req, res) => {
    const { isTavilyEnabled } = await import("./webSearch.js");
    res.json({ tavily: isTavilyEnabled(), ddg: true });
  });



}


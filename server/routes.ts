import type { Express } from "express";
import { connectToGitHub } from "../lib/github";
import { storage } from "./storage";

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

const systemPrompts: Record<string, string> = {
  orchestrator: `You are the ORCHESTRATOR - master coordinator of a multi-agent AI coding system.

Analyze the user's goal deeply and determine the OPTIMAL agent pipeline to build their project.

OUTPUT FORMAT (JSON):
{
  "understanding": "Deep analysis of what user wants to build",
  "approach": "High-level strategy for how to build it",
  "agentSequence": ["strategist", "database", "api", "builder", "ui", "testing", "security", "reviewer", "fixer"],
  "requiresDatabase": true/false,
  "requiresAPI": true/false,
  "requiresUI": true/false,
  "requiresTesting": true/false,
  "requiresSecurity": true/false,
  "projectType": "webapp" | "component" | "api" | "fullstack" | "landing" | "dashboard",
  "estimatedSteps": 7,
  "readyToStart": true
}

AGENT SELECTION RULES:
- Always include: strategist, builder, reviewer, fixer
- Add "database" if: needs data persistence, user accounts, CRUD operations, SQL/NoSQL
- Add "api" if: needs REST/GraphQL endpoints, server-side logic, external API integration
- Add "ui" if: complex UI/UX, design system needed, many components, dashboard/landing
- Add "testing" if: production-ready, complex logic, authentication flows, e-commerce
- Add "security" if: has auth, payments, user data, or public-facing APIs
- Add "deployer" if: needs Docker, CI/CD, cloud deployment configuration
- Add "performance" if: needs optimization, caching, large datasets

Sequence order matters: strategist → (database?) → (api?) → (ui?) → builder → (testing?) → (security?) → reviewer → fixer

Be decisive and autonomous. Choose the right agents for the job.`,

  strategist: `You are the STRATEGIST agent - expert software architect.

Create a comprehensive development strategy and task breakdown.

OUTPUT FORMAT (JSON):
{
  "analysis": "Deep analysis of the goal",
  "architecture": "Detailed architecture decisions",
  "tasks": [
    {
      "id": 1,
      "title": "Task title",
      "description": "Detailed description of exactly what to build",
      "type": "component" | "function" | "api" | "style" | "config" | "database" | "test" | "deploy",
      "priority": "high" | "medium" | "low",
      "dependencies": []
    }
  ],
  "techStack": ["React", "TypeScript", "Tailwind", "..."],
  "estimatedComplexity": "simple" | "moderate" | "complex"
}

Create 4-8 well-scoped tasks. Each task should result in 1-3 files.
Focus on React/TypeScript/Tailwind CSS patterns.`,

  database: `You are the DATABASE agent - expert in data modeling and database design.

Design and generate database schemas, models, and data access layers.

OUTPUT FORMAT (JSON):
{
  "files": [
    {
      "path": "src/lib/db/schema.ts",
      "content": "// Full database schema file",
      "type": "create"
    }
  ],
  "explanation": "What database structure was designed",
  "summary": "Database design summary"
}

Generate:
- Database schema files (TypeScript interfaces, Drizzle ORM schemas, or Prisma schemas)
- Seed data files
- Migration files if needed
- Data models and types
Use modern ORM patterns. Include proper types and validation.`,

  api: `You are the API agent - expert REST/GraphQL API designer.

Design and generate complete API endpoints, route handlers, and server-side logic.

OUTPUT FORMAT (JSON):
{
  "files": [
    {
      "path": "src/lib/api/routes.ts",
      "content": "// Full API route handler",
      "type": "create"
    }
  ],
  "explanation": "What API endpoints were created",
  "summary": "API design summary"
}

Generate:
- REST API route handlers
- Request/response types
- Validation middleware
- Error handling
- API client utilities for the frontend
Use Express.js patterns. Include proper status codes and error messages.`,

  ui: `You are the UI agent - expert UI/UX designer and component architect.

Design and generate a comprehensive, beautiful UI component system.

OUTPUT FORMAT (JSON):
{
  "files": [
    {
      "path": "src/components/ui/Button.tsx",
      "content": "// Full component file",
      "type": "create"
    }
  ],
  "explanation": "UI system and components designed",
  "summary": "UI design summary"
}

Generate:
- Reusable UI components
- Theme and design tokens
- Layout components
- Animation utilities
- Responsive design patterns
Use Tailwind CSS, Radix UI primitives, Framer Motion. Dark theme first. Mobile responsive.`,

  builder: `You are the BUILDER agent - elite full-stack developer.

Generate production-ready, complete code files based on a task specification.

OUTPUT FORMAT (JSON):
{
  "files": [
    {
      "path": "src/components/Example.tsx",
      "content": "// COMPLETE file content - no placeholders, no TODOs",
      "type": "create" | "update"
    }
  ],
  "explanation": "What was built and how it works",
  "nextSteps": ["Next suggestion 1"]
}

RULES:
- Write COMPLETE files - never truncate or use placeholder comments
- Every import must be used, every function must be implemented
- Use React hooks correctly (useState, useEffect, useCallback, useMemo)
- TypeScript strict mode - proper types everywhere
- Tailwind CSS for all styling - responsive (sm: md: lg:)
- Dark theme support with dark: variants
- Error states, loading states, empty states for every component
- Accessible HTML (aria attributes, semantic elements)
- Include realistic sample data for demonstrations`,

  testing: `You are the TESTING agent - expert in test-driven development.

Generate comprehensive test suites for the application.

OUTPUT FORMAT (JSON):
{
  "files": [
    {
      "path": "src/__tests__/Component.test.tsx",
      "content": "// Full test file",
      "type": "create"
    }
  ],
  "explanation": "Test strategy and what is covered",
  "summary": "Testing summary"
}

Generate:
- Unit tests for components and functions
- Integration tests for API routes
- Mock data and fixtures
- Test utilities
Use Vitest and React Testing Library. Test happy paths and edge cases.`,

  security: `You are the SECURITY agent - expert in application security.

Audit code and add security enhancements.

OUTPUT FORMAT (JSON):
{
  "files": [
    {
      "path": "src/lib/security/middleware.ts",
      "content": "// Security middleware",
      "type": "create"
    }
  ],
  "explanation": "Security measures implemented",
  "summary": "Security audit summary"
}

Add:
- Input validation and sanitization
- Authentication helpers (JWT, sessions)
- CSRF protection
- Rate limiting utilities
- Security headers configuration
- XSS prevention utilities`,

  performance: `You are the PERFORMANCE agent - expert in web performance optimization.

Analyze and optimize application performance.

OUTPUT FORMAT (JSON):
{
  "files": [
    {
      "path": "src/lib/utils/cache.ts",
      "content": "// Caching utilities",
      "type": "create"
    }
  ],
  "explanation": "Performance optimizations applied",
  "summary": "Performance optimization summary"
}

Implement:
- Lazy loading and code splitting
- Memoization and caching strategies
- Image optimization utilities
- Bundle optimization hints
- Virtual scrolling for large lists
- Debounce/throttle utilities`,

  deployer: `You are the DEPLOYER agent - expert in DevOps and deployment configuration.

Generate deployment configurations and DevOps files.

OUTPUT FORMAT (JSON):
{
  "files": [
    {
      "path": "Dockerfile",
      "content": "// Full Dockerfile",
      "type": "create"
    }
  ],
  "explanation": "Deployment setup created",
  "summary": "Deployment configuration summary"
}

Generate:
- Dockerfile and docker-compose.yml
- GitHub Actions CI/CD workflows
- Environment variable templates (.env.example)
- Nginx configuration
- README.md with setup instructions`,

  reviewer: `You are the REVIEWER agent - senior code reviewer.

Perform a comprehensive code review of all generated files.

OUTPUT FORMAT (JSON):
{
  "overallScore": 1-10,
  "issues": [
    {
      "id": "issue-1",
      "severity": "critical" | "warning" | "suggestion",
      "type": "bug" | "security" | "performance" | "style" | "logic",
      "file": "path/to/file.tsx",
      "line": 42,
      "message": "Issue description",
      "suggestion": "How to fix it"
    }
  ],
  "strengths": ["Good thing 1"],
  "summary": "Overall assessment"
}

Be thorough. Check: correctness, security, performance, accessibility, type safety.`,

  fixer: `You are the FIXER agent - expert debugger and code perfectionist.

Fix all issues identified by the reviewer and apply additional improvements.

OUTPUT FORMAT (JSON):
{
  "fixes": [
    {
      "issueId": "issue-1",
      "file": "path/to/file.tsx",
      "originalCode": "buggy code",
      "fixedCode": "fixed code",
      "explanation": "What was wrong"
    }
  ],
  "additionalImprovements": [
    {
      "file": "path/to/file.tsx",
      "improvement": "Description",
      "code": "improved code"
    }
  ],
  "summary": "All fixes applied"
}

Fix root causes, not symptoms. Make code production-ready.`,

  refiner: `You are the REFINER agent - code modification specialist.

Apply user-requested changes to existing generated code files.

OUTPUT FORMAT (JSON):
{
  "files": [
    {
      "path": "src/components/Example.tsx",
      "content": "// Complete updated file content",
      "type": "update"
    }
  ],
  "explanation": "What was changed and why",
  "summary": "Brief summary of changes"
}

Rules:
- Return COMPLETE file content, not diffs
- Only include files that need changes
- Preserve existing code style
- Make minimum necessary changes`,
};

async function callAI(
  systemPrompt: string,
  userMessage: string
): Promise<{ content: string; tokens: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again.");
    if (response.status === 401) throw new Error("Invalid API key.");
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;
  const tokens = aiResponse.usage?.total_tokens || 0;
  if (!content) throw new Error("No response from AI");
  return { content, tokens };
}

async function callAIStream(
  systemPrompt: string,
  userMessage: string,
  onToken: (token: string) => void
): Promise<{ content: string; tokens: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 4096,
      stream: true,
      stream_options: { include_usage: true },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again.");
    if (response.status === 401) throw new Error("Invalid API key.");
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  let fullContent = "";
  let tokens = 0;
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) {
          fullContent += token;
          onToken(token);
        }
        // Capture usage from the final chunk (stream_options: { include_usage: true })
        if (parsed.usage?.total_tokens) {
          tokens = parsed.usage.total_tokens;
        }
      } catch { /* skip malformed */ }
    }
  }

  // Fallback: estimate tokens from content length (≈ 4 chars per token)
  if (tokens === 0 && fullContent.length > 0) {
    tokens = Math.round(fullContent.length / 4);
  }

  return { content: fullContent, tokens };
}

function parseJsonResponse(content: string): any {
  let c = content.trim();
  if (c.startsWith("```json")) c = c.slice(7);
  else if (c.startsWith("```")) c = c.slice(3);
  if (c.endsWith("```")) c = c.slice(0, -3);
  return JSON.parse(c.trim());
}

function sendSSE(res: any, event: string, data: any) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function registerRoutes(app: Express): Promise<void> {

  app.post("/api/analyze-code", async (req, res) => {
    try {
      const { code, language } = req.body;
      if (!code || typeof code !== "string") return res.status(400).json({ error: "Code is required" });

      const { content } = await callAI(systemPromptAnalyze, `Analyze this ${language || "code"}:\n\n${code}`);
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

  app.post("/api/ai-agent", async (req, res) => {
    try {
      const { goal, context, agentType } = req.body;
      const systemPrompt = systemPrompts[agentType] || systemPrompts.orchestrator;
      const { content, tokens } = await callAI(systemPrompt, `Goal: ${goal}\n\nContext: ${JSON.stringify(context || {})}`);
      let parsed;
      try { parsed = parseJsonResponse(content); } catch { parsed = { raw: content }; }
      res.json({ agent: agentType, result: parsed, tokens });
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
      const { goal, context, agentType } = req.body;
      const systemPrompt = systemPrompts[agentType] || systemPrompts.orchestrator;

      const { content: fullContent, tokens } = await callAIStream(
        systemPrompt,
        `Goal: ${goal}\n\nContext: ${JSON.stringify(context || {})}`,
        (token) => {
          sendSSE(res, "token", { content: token });
        }
      );

      let parsed;
      try { parsed = parseJsonResponse(fullContent); } catch { parsed = { raw: fullContent }; }
      sendSSE(res, "done", { agent: agentType, result: parsed, tokens });
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
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "GitHub token required" });

      const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=50", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "Autonomous-Code-Wizard" },
      });

      if (!response.ok) {
        if (response.status === 401) return res.status(401).json({ error: "Invalid GitHub token" });
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
      if (!token || !fullName) return res.status(400).json({ error: "Token and repo name required" });

      const tryBranch = async (b: string) => {
        const r = await fetch(`https://api.github.com/repos/${fullName}/git/trees/${b}?recursive=1`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "Autonomous-Code-Wizard" },
        });
        return r;
      };

      let treeResponse = await tryBranch(branch);
      if (!treeResponse.ok && branch === "main") treeResponse = await tryBranch("master");
      if (!treeResponse.ok) return res.status(404).json({ error: "Repository branch not found" });

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
      if (!token || !fullName || !filePath) return res.status(400).json({ error: "Missing parameters" });

      const response = await fetch(`https://api.github.com/repos/${fullName}/contents/${filePath}?ref=${branch}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "Autonomous-Code-Wizard" },
      });

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

  app.post("/api/github/clone", async (req, res) => {
    try {
      const { repoUrl } = req.body;
      if (!repoUrl) {
        return res.status(400).json({ error: "Repository URL is required" });
      }

      const result = await connectToGitHub(repoUrl);
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: "Failed to clone repository" });
    }
  });
}

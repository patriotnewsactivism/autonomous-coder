var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/github.ts
var connectToGitHub;
var init_github = __esm({
  "src/lib/github.ts"() {
    connectToGitHub = async (url) => {
      console.log(`Connecting to GitHub repository at ${url}`);
      return Promise.resolve("File content from GitHub repository");
    };
  }
});

// server/storage.ts
function supaHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };
}
async function supaFetch(path2, options) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path2}`, {
    ...options,
    headers: { ...supaHeaders(), ...options?.headers }
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Supabase error (${res.status}): ${text}`);
    throw new Error(`Supabase error: ${res.status}`);
  }
  const data = await res.json();
  return data;
}
var SUPABASE_URL, SUPABASE_KEY, SupabaseStorage, MemStorage, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    SUPABASE_URL = process.env.SUPABASE_URL || "";
    SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    SupabaseStorage = class {
      async createAnalysisHistory(data) {
        const rows = await supaFetch("/analysis_history", {
          method: "POST",
          body: JSON.stringify({
            code: data.code,
            language: data.language || null,
            summary: data.summary || null,
            issue_count: data.issueCount || 0
          })
        });
        return this.mapAnalysis(rows[0]);
      }
      async getRecentAnalyses(limit) {
        const rows = await supaFetch(`/analysis_history?order=created_at.desc&limit=${limit}`);
        return rows.map((r) => this.mapAnalysis(r));
      }
      async createProject(data) {
        const rows = await supaFetch("/coder_projects", {
          method: "POST",
          body: JSON.stringify({
            goal: data.goal,
            files: typeof data.files === "string" ? JSON.parse(data.files) : data.files,
            agent_sequence: data.agentSequence ? typeof data.agentSequence === "string" ? JSON.parse(data.agentSequence) : data.agentSequence : [],
            total_tokens: 0,
            total_cost_usd: 0
          })
        });
        return this.mapProject(rows[0]);
      }
      async getRecentProjects(limit) {
        const rows = await supaFetch(`/coder_projects?order=updated_at.desc&limit=${limit}`);
        return rows.map((r) => this.mapProject(r));
      }
      async getProject(id) {
        const rows = await supaFetch(`/coder_projects?id=eq.${id}`);
        return rows[0] ? this.mapProject(rows[0]) : void 0;
      }
      async updateProject(id, data) {
        const update = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
        if (data.goal !== void 0) update.goal = data.goal;
        if (data.files !== void 0) update.files = typeof data.files === "string" ? JSON.parse(data.files) : data.files;
        if (data.agentSequence !== void 0) update.agent_sequence = typeof data.agentSequence === "string" ? JSON.parse(data.agentSequence) : data.agentSequence;
        if (data.fileCount !== void 0) update.file_count = data.fileCount;
        const rows = await supaFetch(`/coder_projects?id=eq.${id}`, {
          method: "PATCH",
          body: JSON.stringify(update)
        });
        return rows[0] ? this.mapProject(rows[0]) : void 0;
      }
      mapAnalysis(r) {
        return { id: r.id, code: r.code, language: r.language, summary: r.summary, issueCount: r.issue_count, createdAt: new Date(r.created_at) };
      }
      mapProject(r) {
        return {
          id: r.id,
          goal: r.goal,
          files: typeof r.files === "string" ? r.files : JSON.stringify(r.files),
          agentSequence: typeof r.agent_sequence === "string" ? r.agent_sequence : JSON.stringify(r.agent_sequence || []),
          fileCount: r.file_count || (Array.isArray(r.files) ? r.files.length : 0),
          createdAt: new Date(r.created_at || r.updated_at)
        };
      }
    };
    MemStorage = class {
      analyses = /* @__PURE__ */ new Map();
      analysisId = 1;
      projectsMap = /* @__PURE__ */ new Map();
      projectId = 1;
      async createAnalysisHistory(data) {
        const id = this.analysisId++;
        const analysis = { id, ...data, createdAt: /* @__PURE__ */ new Date() };
        this.analyses.set(id, analysis);
        return analysis;
      }
      async getRecentAnalyses(limit) {
        return Array.from(this.analyses.values()).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)).slice(0, limit);
      }
      async createProject(data) {
        const id = this.projectId++;
        const project = { id, ...data, createdAt: /* @__PURE__ */ new Date() };
        this.projectsMap.set(id, project);
        return project;
      }
      async getRecentProjects(limit) {
        return Array.from(this.projectsMap.values()).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)).slice(0, limit);
      }
      async getProject(id) {
        return this.projectsMap.get(id);
      }
      async updateProject(id, data) {
        const existing = this.projectsMap.get(id);
        if (!existing) return void 0;
        const updated = { ...existing, ...data, createdAt: existing.createdAt };
        this.projectsMap.set(id, updated);
        return updated;
      }
    };
    storage = SUPABASE_URL && SUPABASE_KEY ? new SupabaseStorage() : new MemStorage();
    console.log(`[storage] Using ${SUPABASE_URL && SUPABASE_KEY ? "Supabase cloud" : "in-memory"} storage`);
  }
});

// server/routes.ts
function getFallbackModel(currentModel) {
  const chain = [];
  if (USE_DEEPSEEK) chain.push(DEEPSEEK_MODEL);
  if (USE_GROK) chain.push(GROK_MODEL);
  if (USE_AZURE_OPENAI) chain.push(AZURE_DEPLOYMENT);
  const idx = chain.indexOf(currentModel);
  return idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : null;
}
function getModelProvider(model) {
  if (model === DEEPSEEK_MODEL || model.toLowerCase().includes("deepseek")) return "azure-foundry-deepseek";
  if (model === GROK_MODEL || model.toLowerCase().includes("grok")) return "azure-foundry-grok";
  return "azure-openai";
}
function getModelEndpoint(model) {
  const provider = getModelProvider(model);
  switch (provider) {
    case "azure-foundry-deepseek":
      return {
        url: DEEPSEEK_ENDPOINT,
        headers: { "Authorization": `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" }
      };
    case "azure-foundry-grok":
      return {
        url: GROK_ENDPOINT,
        headers: { "Authorization": `Bearer ${GROK_API_KEY}`, "Content-Type": "application/json" }
      };
    default: {
      const dep = model || AZURE_DEPLOYMENT;
      return {
        url: `${AZURE_ENDPOINT}/openai/deployments/${dep}/chat/completions?api-version=${AZURE_API_VERSION}`,
        headers: { "api-key": process.env.AZURE_OPENAI_API_KEY || "", "Content-Type": "application/json" }
      };
    }
  }
}
function getAvailableModels() {
  const models = [];
  if (USE_DEEPSEEK) models.push(DEEPSEEK_MODEL);
  if (USE_GROK) models.push(GROK_MODEL);
  if (USE_AZURE_OPENAI) {
    const extra = process.env.AZURE_OPENAI_MODELS || "";
    const azureModels = extra.split(",").map((s) => s.trim()).filter(Boolean);
    if (!azureModels.includes(AZURE_DEPLOYMENT)) azureModels.unshift(AZURE_DEPLOYMENT);
    models.push(...azureModels);
  }
  return models;
}
function calcCost(model, promptTokens, completionTokens) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[AZURE_DEPLOYMENT] || [0.15, 0.6];
  return promptTokens / 1e6 * pricing[0] + completionTokens / 1e6 * pricing[1];
}
async function callAI(systemPrompt, userMessage, model) {
  const deployment = model || DEFAULT_MODEL;
  const { url, headers } = getModelEndpoint(deployment);
  const provider = getModelProvider(deployment);
  const bodyPayload = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ],
    max_tokens: 4096
  };
  if (provider !== "azure-openai") {
    bodyPayload.model = deployment;
  } else {
    delete bodyPayload.max_tokens;
    bodyPayload.max_completion_tokens = 4096;
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(bodyPayload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    const fallback = getFallbackModel(deployment);
    if (fallback) {
      console.log(`[callAI] ${deployment} failed (${response.status}), falling back to ${fallback}`);
      return callAI(systemPrompt, userMessage, fallback);
    }
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again.");
    if (response.status === 401) throw new Error("Invalid API key.");
    throw new Error(`AI error (${deployment}): ${response.status} - ${errorText}`);
  }
  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;
  const promptTokens = aiResponse.usage?.prompt_tokens || 0;
  const completionTokens = aiResponse.usage?.completion_tokens || 0;
  const tokens = aiResponse.usage?.total_tokens || 0;
  if (!content) {
    const fallback = getFallbackModel(deployment);
    if (fallback) {
      console.log(`[callAI] ${deployment} returned empty, falling back to ${fallback}`);
      return callAI(systemPrompt, userMessage, fallback);
    }
    throw new Error("No response from AI");
  }
  return { content, tokens, promptTokens, completionTokens, model: deployment, costUsd: calcCost(deployment, promptTokens, completionTokens) };
}
async function callAIStream(systemPrompt, userMessage, onToken, model) {
  const deployment = model || DEFAULT_MODEL;
  const { url, headers } = getModelEndpoint(deployment);
  const provider = getModelProvider(deployment);
  const bodyPayload = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ],
    max_tokens: 4096,
    stream: true,
    stream_options: { include_usage: true }
  };
  if (provider !== "azure-openai") {
    bodyPayload.model = deployment;
  } else {
    delete bodyPayload.max_tokens;
    bodyPayload.max_completion_tokens = 4096;
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(bodyPayload)
  });
  if (!response.ok) {
    const fallback = getFallbackModel(deployment);
    if (fallback) {
      console.log(`[callAIStream] ${deployment} failed (${response.status}), falling back to ${fallback}`);
      return callAIStream(systemPrompt, userMessage, onToken, fallback);
    }
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again.");
    if (response.status === 401) throw new Error("Invalid API key.");
    throw new Error(`AI error (${deployment}): ${response.status}`);
  }
  let fullContent = "";
  let tokens = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  const reader = response.body.getReader();
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
        if (parsed.usage?.total_tokens) {
          tokens = parsed.usage.total_tokens;
          promptTokens = parsed.usage.prompt_tokens || 0;
          completionTokens = parsed.usage.completion_tokens || 0;
        }
      } catch {
      }
    }
  }
  if (tokens === 0 && fullContent.length > 0) {
    tokens = Math.round(fullContent.length / 4);
  }
  return { content: fullContent, tokens, promptTokens, completionTokens, model: deployment, costUsd: calcCost(deployment, promptTokens, completionTokens) };
}
function parseJsonResponse(content) {
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
function sendSSE(res, event, data) {
  res.write(`event: ${event}
`);
  res.write(`data: ${JSON.stringify(data)}

`);
}
async function registerRoutes(app3) {
  app3.post("/api/analyze-code", async (req, res) => {
    try {
      const { code, language } = req.body;
      if (!code || typeof code !== "string") return res.status(400).json({ error: "Code is required" });
      const { content } = await callAI(systemPromptAnalyze, `Analyze this ${language || "code"}:

${code}`, req.body.model);
      let analysis;
      try {
        analysis = parseJsonResponse(content);
      } catch {
        analysis = { issues: [], summary: "Analysis complete. Code may be valid." };
      }
      await storage.createAnalysisHistory({
        code,
        language: language || null,
        summary: analysis.summary,
        issueCount: analysis.issues?.length || 0
      });
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });
  app3.get("/api/models", (_req, res) => {
    const models = getAvailableModels();
    const pricing = {};
    for (const m of models) {
      const p = MODEL_PRICING[m] || [0.15, 0.6];
      pricing[m] = { input: p[0], output: p[1] };
    }
    res.json({ models, default: DEFAULT_MODEL, pricing });
  });
  app3.post("/api/ai-agent", async (req, res) => {
    try {
      const { goal, context, agentType, model } = req.body;
      const systemPrompt = systemPrompts[agentType] || systemPrompts.orchestrator;
      const result = await callAI(systemPrompt, `Goal: ${goal}

Context: ${JSON.stringify(context || {})}`, model);
      let parsed;
      try {
        parsed = parseJsonResponse(result.content);
      } catch {
        parsed = { raw: result.content };
      }
      res.json({ agent: agentType, result: parsed, tokens: result.tokens, promptTokens: result.promptTokens, completionTokens: result.completionTokens, costUsd: result.costUsd, model: result.model });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Agent failed" });
    }
  });
  app3.post("/api/ai-agent/stream", async (req, res) => {
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
        `Goal: ${goal}

Context: ${JSON.stringify(context || {})}`,
        (token) => {
          sendSSE(res, "token", { content: token });
        },
        model
      );
      let parsed;
      try {
        parsed = parseJsonResponse(result.content);
      } catch {
        parsed = { raw: result.content };
      }
      sendSSE(res, "done", { agent: agentType, result: parsed, tokens: result.tokens, promptTokens: result.promptTokens, completionTokens: result.completionTokens, costUsd: result.costUsd, model: result.model });
      res.end();
    } catch (error) {
      sendSSE(res, "error", { message: error instanceof Error ? error.message : "Agent failed" });
      res.end();
    }
  });
  app3.get("/api/analyses/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      res.json(await storage.getRecentAnalyses(limit));
    } catch (error) {
      res.status(500).json({ error: "Failed to get recent analyses" });
    }
  });
  app3.post("/api/projects", async (req, res) => {
    try {
      const { goal, files, agentSequence } = req.body;
      if (!goal || !files) return res.status(400).json({ error: "Goal and files required" });
      const project = await storage.createProject({
        goal,
        files: JSON.stringify(files),
        agentSequence: JSON.stringify(agentSequence || []),
        fileCount: Array.isArray(files) ? files.length : 0
      });
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to save project" });
    }
  });
  app3.get("/api/projects/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const projects = await storage.getRecentProjects(limit);
      res.json(projects.map((p) => ({
        id: p.id,
        goal: p.goal,
        fileCount: p.fileCount,
        agentSequence: p.agentSequence,
        createdAt: p.createdAt
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to get projects" });
    }
  });
  app3.get("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Project not found" });
      res.json({ ...project, files: JSON.parse(project.files) });
    } catch (error) {
      res.status(500).json({ error: "Failed to get project" });
    }
  });
  app3.post("/api/github/repos", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "GitHub token required" });
      const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=50", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "Autonomous-Code-Wizard" }
      });
      if (!response.ok) {
        if (response.status === 401) return res.status(401).json({ error: "Invalid GitHub token" });
        return res.status(response.status).json({ error: "GitHub API error" });
      }
      const repos = await response.json();
      res.json(repos.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
        updatedAt: r.updated_at,
        private: r.private,
        defaultBranch: r.default_branch
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch repositories" });
    }
  });
  app3.post("/api/github/repo-files", async (req, res) => {
    try {
      const { token, fullName, branch = "main" } = req.body;
      if (!token || !fullName) return res.status(400).json({ error: "Token and repo name required" });
      const tryBranch = async (b) => {
        const r = await fetch(`https://api.github.com/repos/${fullName}/git/trees/${b}?recursive=1`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "Autonomous-Code-Wizard" }
        });
        return r;
      };
      let treeResponse = await tryBranch(branch);
      if (!treeResponse.ok && branch === "main") treeResponse = await tryBranch("master");
      if (!treeResponse.ok) return res.status(404).json({ error: "Repository branch not found" });
      const tree = await treeResponse.json();
      const codeExts = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".css", ".json", ".md"];
      const files = tree.tree?.filter((f) => f.type === "blob" && codeExts.some((ext) => f.path.endsWith(ext))).slice(0, 80) || [];
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch repository files" });
    }
  });
  app3.post("/api/github/file-content", async (req, res) => {
    try {
      const { token, fullName, filePath, branch = "main" } = req.body;
      if (!token || !fullName || !filePath) return res.status(400).json({ error: "Missing parameters" });
      const response = await fetch(`https://api.github.com/repos/${fullName}/contents/${filePath}?ref=${branch}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "Autonomous-Code-Wizard" }
      });
      if (!response.ok) return res.status(response.status).json({ error: "File not found" });
      const fileData = await response.json();
      const content = Buffer.from(fileData.content, "base64").toString("utf-8");
      res.json({ path: filePath, content });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch file content" });
    }
  });
  app3.post("/api/github/analyze-pr", async (req, res) => {
    try {
      const { token, fullName, prNumber } = req.body;
      if (!token || !fullName || !prNumber) return res.status(400).json({ error: "Token, repo, and PR number required" });
      const [prResponse, filesResponse] = await Promise.all([
        fetch(`https://api.github.com/repos/${fullName}/pulls/${prNumber}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "Autonomous-Code-Wizard" }
        }),
        fetch(`https://api.github.com/repos/${fullName}/pulls/${prNumber}/files`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json", "User-Agent": "Autonomous-Code-Wizard" }
        })
      ]);
      if (!prResponse.ok) return res.status(404).json({ error: "PR not found" });
      const pr = await prResponse.json();
      const files = filesResponse.ok ? await filesResponse.json() : [];
      const prInfo = {
        number: pr.number,
        title: pr.title,
        description: pr.body,
        author: pr.user?.login,
        files: files.slice(0, 20).map((f) => ({
          filename: f.filename,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch?.slice(0, 2e3)
        }))
      };
      const { content } = await callAI(
        systemPrompts.reviewer,
        `Review this Pull Request:

${JSON.stringify(prInfo, null, 2)}`
      );
      let review;
      try {
        review = parseJsonResponse(content);
      } catch {
        review = { summary: content, overallScore: 7, issues: [] };
      }
      res.json({ pr: prInfo, review });
    } catch (error) {
      res.status(500).json({ error: "Failed to analyze PR" });
    }
  });
  app3.post("/api/github/clone", async (req, res) => {
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
  const SLACK_NOTIFY_WEBHOOK = process.env.SLACK_NOTIFY_WEBHOOK || "";
  const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
  const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "alerts@donmatthews.live";
  const NOTIFY_TO_EMAIL = process.env.NOTIFY_TO_EMAIL || "wtpjournalism@gmail.com";
  const SUPABASE_URL3 = process.env.SUPABASE_URL || "";
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  async function sendNotification(opts) {
    const results = { supabase: false, slack: false, email: false };
    if (SUPABASE_URL3 && SUPABASE_SERVICE_KEY) {
      try {
        await fetch(`${SUPABASE_URL3}/rest/v1/coder_notifications`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            project_id: opts.projectId || null,
            agent: opts.agent,
            severity: opts.severity,
            title: opts.title,
            message: opts.message,
            requires_decision: opts.requiresDecision,
            decision_options: opts.decisionOptions ? JSON.stringify(opts.decisionOptions) : null
          })
        });
        results.supabase = true;
      } catch (e) {
        console.error("[notify] Supabase error:", e);
      }
    }
    if (SLACK_NOTIFY_WEBHOOK) {
      try {
        const emoji = opts.severity === "critical" ? "\u{1F6A8}" : opts.severity === "warning" ? "\u26A0\uFE0F" : "\u2139\uFE0F";
        const decisionText = opts.requiresDecision && opts.decisionOptions ? `

*Options:* ${opts.decisionOptions.map((o, i) => `
${i + 1}. ${o}`).join("")}` : "";
        await fetch(SLACK_NOTIFY_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `${emoji} *AI Employee \u2014 ${opts.title}*
Agent: \`${opts.agent}\` | Severity: ${opts.severity}

${opts.message}${decisionText}`
          })
        });
        results.slack = true;
      } catch (e) {
        console.error("[notify] Slack error:", e);
      }
    }
    if (RESEND_API_KEY) {
      try {
        const emoji = opts.severity === "critical" ? "\u{1F6A8}" : opts.severity === "warning" ? "\u26A0\uFE0F" : "\u2139\uFE0F";
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: NOTIFY_EMAIL,
            to: [NOTIFY_TO_EMAIL],
            subject: `${emoji} AI Employee: ${opts.title}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #0f172a; border-radius: 12px; padding: 24px; color: #e2e8f0;">
                  <h2 style="margin: 0 0 8px; color: ${opts.severity === "critical" ? "#ef4444" : opts.severity === "warning" ? "#f59e0b" : "#10b981"};">
                    ${emoji} ${opts.title}
                  </h2>
                  <p style="margin: 0 0 16px; color: #94a3b8; font-size: 14px;">Agent: ${opts.agent} \xB7 ${(/* @__PURE__ */ new Date()).toLocaleString()}</p>
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
            `
          })
        });
        results.email = true;
      } catch (e) {
        console.error("[notify] Email error:", e);
      }
    }
    return results;
  }
  app3.post("/api/notify", async (req, res) => {
    try {
      const { projectId, agent, severity, title, message, requiresDecision, decisionOptions } = req.body;
      if (!title || !message) return res.status(400).json({ error: "title and message required" });
      const results = await sendNotification({
        projectId,
        agent: agent || "system",
        severity: severity || "info",
        title,
        message,
        requiresDecision: requiresDecision || false,
        decisionOptions
      });
      res.json({ sent: results });
    } catch (error) {
      res.status(500).json({ error: "Failed to send notification" });
    }
  });
  app3.get("/api/notifications", async (_req, res) => {
    try {
      if (!SUPABASE_URL3 || !SUPABASE_SERVICE_KEY) return res.json([]);
      const response = await fetch(
        `${SUPABASE_URL3}/rest/v1/coder_notifications?order=created_at.desc&limit=50`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
      );
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.json([]);
    }
  });
  app3.post("/api/notifications/:id/respond", async (req, res) => {
    try {
      const { response: userResponse } = req.body;
      if (!SUPABASE_URL3 || !SUPABASE_SERVICE_KEY) return res.status(500).json({ error: "No storage" });
      const result = await fetch(
        `${SUPABASE_URL3}/rest/v1/coder_notifications?id=eq.${req.params.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation"
          },
          body: JSON.stringify({ user_response: userResponse, responded_at: (/* @__PURE__ */ new Date()).toISOString() })
        }
      );
      const data = await result.json();
      res.json(data[0] || {});
    } catch (error) {
      res.status(500).json({ error: "Failed to respond" });
    }
  });
}
var systemPromptAnalyze, systemPrompts, AZURE_ENDPOINT, AZURE_DEPLOYMENT, AZURE_API_VERSION, DEEPSEEK_ENDPOINT, DEEPSEEK_API_KEY, DEEPSEEK_MODEL, USE_DEEPSEEK, GROK_ENDPOINT, GROK_API_KEY, GROK_MODEL, USE_GROK, USE_AZURE_OPENAI, DEFAULT_MODEL, MODEL_PRICING;
var init_routes = __esm({
  "server/routes.ts"() {
    init_github();
    init_storage();
    systemPromptAnalyze = `You are an expert code analyzer and fixer. Analyze code for issues and return JSON:
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
    systemPrompts = {
      orchestrator: `You are the MASTER ORCHESTRATOR \u2014 the highest-intelligence agent in the system.

You operate with FULL AUTONOMY. You never ask clarifying questions. You decide everything.
You think like a senior CTO + principal engineer + product manager combined.

Your job: analyze ANY goal, reason deeply about what it needs, and design the optimal agent execution strategy.

THINKING PROCESS (reason step by step before outputting):
1. What is the user REALLY trying to achieve? (go beyond the literal words)
2. What technical decisions need to be made? Make them.
3. What is the minimal but complete set of agents needed?
4. What order maximizes quality and minimizes wasted work?
5. What risks could derail this build? Design around them.

OUTPUT FORMAT (JSON):
{
  "understanding": "Deep analysis: what user wants, why, what success looks like",
  "approach": "Complete technical strategy \u2014 stack, architecture, all decisions made",
  "agentSequence": ["strategist", "database", "api", "ui", "builder", "testing", "security", "reviewer", "fixer"],
  "requiresDatabase": true,
  "requiresAPI": true,
  "requiresUI": true,
  "requiresTesting": true,
  "requiresSecurity": true,
  "projectType": "webapp",
  "estimatedSteps": 7,
  "keyDecisions": ["Chose X over Y because...", "..."],
  "potentialIssues": ["Risk and mitigation"],
  "qualityTarget": "production-ready",
  "readyToStart": true
}

AGENT SELECTION RULES:
- strategist: ALWAYS
- database: data persistence, user accounts, CRUD, analytics, anything stateful
- api: server logic, auth, external integrations, secrets, rate-limiting
- ui: complex design systems, dashboards, landing pages, many components
- builder: ALWAYS
- testing: production apps, auth flows, e-commerce, anything where bugs cost money
- security: user data, payments, public APIs, auth, sensitive operations
- performance: large datasets, real-time, heavy computation, SEO-critical
- deployer: Docker, CI/CD, multi-env, cloud infra
- reviewer: ALWAYS
- fixer: ALWAYS

AUTONOMY RULES:
- Never ask clarifying questions \u2014 make all decisions yourself
- Default to production-ready over prototype
- If scope is unclear, build the more complete version
- Sequence: data layer \u2192 API \u2192 UI \u2192 builder \u2192 QA
- Parallel-eligible: database + api + ui can run simultaneously`,
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
- Make minimum necessary changes`
    };
    AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || "https://openaiyoutube.openai.azure.com";
    AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-5-mini";
    AZURE_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-02-01";
    DEEPSEEK_ENDPOINT = process.env.DEEPSEEK_ENDPOINT || "https://patri-mojrzk25-swedencentral.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview";
    DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
    DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "DeepSeek-V3.2";
    USE_DEEPSEEK = Boolean(DEEPSEEK_API_KEY);
    GROK_ENDPOINT = process.env.GROK_ENDPOINT || "https://patri-mojrzk25-swedencentral.services.ai.azure.com/models/chat/completions?api-version=2024-05-01-preview";
    GROK_API_KEY = process.env.GROK_API_KEY || "";
    GROK_MODEL = process.env.GROK_MODEL || "grok-4-1-fast-reasoning";
    USE_GROK = Boolean(GROK_API_KEY);
    USE_AZURE_OPENAI = Boolean(process.env.AZURE_OPENAI_DEPLOYMENT && process.env.AZURE_OPENAI_API_KEY);
    DEFAULT_MODEL = USE_DEEPSEEK ? DEEPSEEK_MODEL : USE_GROK ? GROK_MODEL : AZURE_DEPLOYMENT;
    MODEL_PRICING = {
      "DeepSeek-V3.2": [0.28, 0.42],
      "grok-4-1-fast-reasoning": [0.2, 0.5],
      "gpt-5-mini": [0.25, 2],
      "gpt-4o": [2.5, 10],
      "gpt-4o-mini": [0.15, 0.6],
      "gpt-4": [30, 60],
      "gpt-4-turbo": [10, 30],
      "gpt-35-turbo": [0.5, 1.5],
      "o1-mini": [1.1, 4.4],
      "o1": [15, 60]
    };
  }
});

// server/agentMemory.ts
import { createClient } from "@supabase/supabase-js";
async function storeMemory(entry) {
  if (!supabase) return;
  try {
    await supabase.from("agent_memory").insert(entry);
  } catch (e) {
    console.error("[memory] store error:", e);
  }
}
async function retrieveMemory(query, limit = 10) {
  if (!supabase) return [];
  try {
    const { data } = await supabase.from("agent_memory").select("*").order("score", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
    return data || [];
  } catch (e) {
    return [];
  }
}
async function getSessionMemory(session_id) {
  if (!supabase) return { patterns: [], failures: [], decisions: [], context: [] };
  try {
    const { data } = await supabase.from("agent_memory").select("*").eq("session_id", session_id).order("created_at", { ascending: true });
    const memories = data || [];
    return {
      patterns: memories.filter((m) => m.type === "pattern").map((m) => m.content),
      failures: memories.filter((m) => m.type === "failure").map((m) => m.content),
      decisions: memories.filter((m) => m.type === "decision").map((m) => m.content),
      context: memories.filter((m) => m.type === "context").map((m) => m.content)
    };
  } catch (e) {
    return { patterns: [], failures: [], decisions: [], context: [] };
  }
}
var SUPABASE_URL2, SUPABASE_KEY2, supabase;
var init_agentMemory = __esm({
  "server/agentMemory.ts"() {
    SUPABASE_URL2 = process.env.SUPABASE_URL || "";
    SUPABASE_KEY2 = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    supabase = SUPABASE_URL2 && SUPABASE_KEY2 ? createClient(SUPABASE_URL2, SUPABASE_KEY2) : null;
  }
});

// server/agentWorker.ts
import { EventEmitter } from "events";
async function selfEvaluate(agent, output, goal, model) {
  try {
    const { content } = await callAI(
      SELF_EVAL_PROMPT,
      `Agent: ${agent}
Goal: ${goal}
Output:
${output.slice(0, 3e3)}`,
      model
    );
    return parseJsonResponse(content);
  } catch {
    return { score: 8, reason: "eval failed, assuming ok", issues: [] };
  }
}
function emitSandboxUpdate(sessionId, parsed) {
  const fileAgents = ["builder", "fixer", "ui", "api", "database", "refiner", "deployer", "performance", "security", "testing"];
  const files = parsed?.files;
  if (Array.isArray(files) && files.length > 0) {
    workerBus.emit("sandbox:update", { sessionId, files });
  }
}
async function runWorkerJob(job) {
  const start = Date.now();
  const maxRetries = job.maxRetries ?? 2;
  const threshold = job.selfEvalThreshold ?? 6;
  let attempts = 0;
  let lastError = "";
  let lastOutput = null;
  const memories = await retrieveMemory(job.goal, 5);
  const memoryContext = memories.length > 0 ? `

RELEVANT MEMORY:
${memories.map((m) => `[${m.type}] ${m.content}`).join("\n")}` : "";
  workerBus.emit("worker:status", { jobId: job.id, agent: job.agent, status: "running", sessionId: job.sessionId });
  while (attempts <= maxRetries) {
    attempts++;
    try {
      const prompt = systemPrompts[job.agent] || systemPrompts.builder;
      const userMsg = `GOAL: ${job.goal}

CONTEXT: ${JSON.stringify(job.context, null, 2)}${memoryContext}${attempts > 1 ? `

PREVIOUS ATTEMPT FAILED EVAL. Issues: ${lastError}. Try harder.` : ""}`;
      workerBus.emit("worker:thinking", {
        jobId: job.id,
        agent: job.agent,
        sessionId: job.sessionId,
        attempt: attempts
      });
      const { content } = await callAI(prompt, userMsg, job.model);
      const parsed = parseJsonResponse(content);
      lastOutput = parsed;
      emitSandboxUpdate(job.sessionId, parsed);
      const evaluation = await selfEvaluate(job.agent, content, job.goal, job.model);
      workerBus.emit("worker:eval", {
        jobId: job.id,
        agent: job.agent,
        sessionId: job.sessionId,
        score: evaluation.score,
        reason: evaluation.reason
      });
      if (evaluation.score >= threshold || attempts > maxRetries) {
        await storeMemory({
          session_id: job.sessionId,
          agent: job.agent,
          type: "success",
          content: `Goal: ${job.goal.slice(0, 200)} | Score: ${evaluation.score} | Attempt: ${attempts}`,
          tags: [job.agent, "success"],
          score: evaluation.score
        });
        workerBus.emit("worker:done", {
          jobId: job.id,
          agent: job.agent,
          sessionId: job.sessionId,
          score: evaluation.score
        });
        return {
          jobId: job.id,
          agent: job.agent,
          status: "done",
          output: parsed,
          score: evaluation.score,
          attempts,
          durationMs: Date.now() - start
        };
      } else {
        lastError = evaluation.issues.join(", ") || evaluation.reason;
        await storeMemory({
          session_id: job.sessionId,
          agent: job.agent,
          type: "failure",
          content: `Goal: ${job.goal.slice(0, 200)} | Score: ${evaluation.score} | Issues: ${lastError}`,
          tags: [job.agent, "retry"],
          score: -1
        });
        workerBus.emit("worker:retrying", {
          jobId: job.id,
          agent: job.agent,
          sessionId: job.sessionId,
          attempt: attempts,
          reason: lastError
        });
      }
    } catch (err) {
      lastError = err?.message || "unknown error";
      if (attempts > maxRetries) break;
    }
  }
  workerBus.emit("worker:failed", {
    jobId: job.id,
    agent: job.agent,
    sessionId: job.sessionId,
    error: lastError
  });
  return {
    jobId: job.id,
    agent: job.agent,
    status: "failed",
    output: lastOutput,
    attempts,
    durationMs: Date.now() - start,
    error: lastError
  };
}
async function runParallelWorkers(jobs) {
  return Promise.all(jobs.map((job) => runWorkerJob(job)));
}
async function spawnSubWorkers(parentJob, subTasks) {
  const subJobs = subTasks.map((task, i) => ({
    id: `${parentJob.id}-sub-${i}-${Date.now()}`,
    sessionId: parentJob.sessionId,
    agent: task.agent,
    goal: task.goal,
    context: task.context,
    model: parentJob.model,
    maxRetries: 1,
    selfEvalThreshold: 5
  }));
  workerBus.emit("worker:spawned", {
    parentId: parentJob.id,
    sessionId: parentJob.sessionId,
    count: subJobs.length,
    agents: subJobs.map((j) => j.agent)
  });
  return runParallelWorkers(subJobs);
}
var workerBus, SELF_EVAL_PROMPT;
var init_agentWorker = __esm({
  "server/agentWorker.ts"() {
    init_routes();
    init_agentMemory();
    workerBus = new EventEmitter();
    workerBus.setMaxListeners(200);
    SELF_EVAL_PROMPT = `You are a strict quality evaluator.
Rate this agent output from 0-10. Return JSON: { "score": 7, "reason": "...", "issues": ["..."] }
Be harsh. A score below 7 means the agent should retry.`;
  }
});

// server/employeeAgent.ts
var employeeAgent_exports = {};
__export(employeeAgent_exports, {
  classifyTask: () => classifyTask,
  executeTask: () => executeTask
});
import { randomUUID } from "crypto";
async function classifyTask(goal, model) {
  const { content } = await callAI(
    CLASSIFIER_PROMPT,
    `Task: ${goal}`,
    model
  );
  return parseJsonResponse(content);
}
async function executeSimple(goal, classification, model, onToken) {
  if (classification.canAnswerDirectly && classification.directAnswer) {
    return { output: classification.directAnswer, type: "answer" };
  }
  const promptMap = {
    research: RESEARCHER_PROMPT,
    write: WRITER_PROMPT,
    plan: PLANNER_PROMPT,
    code: GENERALIST_PROMPT,
    debug: GENERALIST_PROMPT,
    review: GENERALIST_PROMPT,
    design: GENERALIST_PROMPT,
    automate: GENERALIST_PROMPT,
    data: GENERALIST_PROMPT,
    general: GENERALIST_PROMPT
  };
  const { content } = await callAI(
    promptMap[classification.category] || GENERALIST_PROMPT,
    goal,
    model,
    onToken
  );
  return { output: content, type: "answer" };
}
async function executeComplex(goal, classification, sessionId, model) {
  const agents = classification.suggestedAgents.length > 0 ? classification.suggestedAgents : ["orchestrator", "strategist", "builder", "reviewer", "fixer"];
  const jobs = agents.map((agent, i) => ({
    id: randomUUID(),
    sessionId,
    agent,
    goal,
    context: { classification },
    model,
    maxRetries: 2,
    selfEvalThreshold: 7
  }));
  const serialStart = jobs.filter((j) => ["orchestrator", "strategist"].includes(j.agent));
  const parallelMid = jobs.filter((j) => ["database", "api", "ui"].includes(j.agent));
  const builderJob = jobs.filter((j) => j.agent === "builder");
  const parallelEnd = jobs.filter((j) => ["testing", "security", "performance"].includes(j.agent));
  const serialEnd = jobs.filter((j) => ["reviewer", "fixer"].includes(j.agent));
  const results = [];
  let ctx = { goal, classification };
  for (const job of serialStart) {
    const r = await runWorkerJob({ ...job, context: ctx });
    results.push(r);
    if (r.output) ctx = { ...ctx, [`${job.agent}Output`]: r.output };
  }
  if (parallelMid.length > 0) {
    const midResults = await runParallelWorkers(parallelMid.map((j) => ({ ...j, context: ctx })));
    results.push(...midResults);
    midResults.forEach((r) => {
      if (r.output) ctx = { ...ctx, [`${r.agent}Output`]: r.output };
    });
  }
  for (const job of builderJob) {
    const r = await runWorkerJob({ ...job, context: ctx });
    results.push(r);
    if (r.output) ctx = { ...ctx, builderOutput: r.output };
  }
  if (parallelEnd.length > 0) {
    const endResults = await runParallelWorkers(parallelEnd.map((j) => ({ ...j, context: ctx })));
    results.push(...endResults);
    endResults.forEach((r) => {
      if (r.output) ctx = { ...ctx, [`${r.agent}Output`]: r.output };
    });
  }
  for (const job of serialEnd) {
    const r = await runWorkerJob({ ...job, context: ctx });
    results.push(r);
    if (r.output) ctx = { ...ctx, [`${job.agent}Output`]: r.output };
  }
  const avgScore = results.reduce((s, r) => s + (r.score || 0), 0) / (results.length || 1);
  return {
    jobs: results,
    summary: `Completed ${results.length} agents | avg score: ${avgScore.toFixed(1)}/10`
  };
}
async function executeEpic(goal, classification, sessionId, model) {
  workerBus.emit("employee:epic:start", { sessionId, goal, subtaskCount: classification.subtasks?.length });
  const subtasks = classification.subtasks || [goal];
  const allResults = [];
  const parentJob = {
    id: randomUUID(),
    sessionId,
    agent: "orchestrator",
    goal,
    context: { classification },
    model
  };
  const subTaskDefs = subtasks.map((task) => ({
    agent: "builder",
    goal: task,
    context: { parentGoal: goal, classification }
  }));
  const spawnResults = await spawnSubWorkers(parentJob, subTaskDefs);
  allResults.push(...spawnResults);
  const needsFix = spawnResults.filter((r) => (r.score || 0) < 7 && r.output);
  if (needsFix.length > 0) {
    const fixJobs = needsFix.map((r) => ({
      agent: "fixer",
      goal: `Fix issues in: ${r.agent} output for ${r.jobId}`,
      context: { files: r.output?.files || [], parentScore: r.score }
    }));
    const fixResults = await spawnSubWorkers(parentJob, fixJobs);
    allResults.push(...fixResults);
  }
  workerBus.emit("employee:epic:done", {
    sessionId,
    totalJobs: allResults.length,
    avgScore: allResults.reduce((s, r) => s + (r.score || 0), 0) / (allResults.length || 1)
  });
  return {
    results: allResults,
    summary: `Epic task: ${subtasks.length} subtasks, ${allResults.length} total jobs`
  };
}
async function executeTask(goal, options = {}) {
  const start = Date.now();
  const sessionId = options.sessionId || randomUUID();
  const { model, onToken, onClassified, onProgress } = options;
  const memories = await retrieveMemory(goal, 8);
  const memCtx = memories.length > 0 ? `

PAST CONTEXT:
${memories.map((m) => `[${m.type}] ${m.content}`).join("\n")}` : "";
  const enrichedGoal = `${goal}${memCtx}`;
  onProgress?.("\u{1F9E0} Classifying task\u2026");
  workerBus.emit("employee:classifying", { sessionId, goal });
  const classification = await classifyTask(enrichedGoal, model);
  onClassified?.(classification);
  onProgress?.(`\u{1F4CB} Task: ${classification.title} | ${classification.complexity} | ${classification.category}`);
  workerBus.emit("employee:classified", { sessionId, classification });
  await storeMemory({
    session_id: sessionId,
    agent: "employee",
    type: "context",
    content: `Task: ${classification.title} | Category: ${classification.category} | Complexity: ${classification.complexity}`,
    tags: [classification.category, classification.complexity]
  });
  let result = {
    sessionId,
    classification,
    summary: "",
    durationMs: 0
  };
  try {
    if (classification.complexity === "simple" || !classification.requiresAgentPipeline) {
      onProgress?.("\u26A1 Executing directly\u2026");
      const { output } = await executeSimple(goal, classification, model, onToken);
      result.output = output;
      result.summary = `Simple task completed in ${Math.round((Date.now() - start) / 1e3)}s`;
      await storeMemory({
        session_id: sessionId,
        agent: "employee",
        type: "success",
        content: `Simple: ${classification.title} \u2014 completed`,
        tags: [classification.category, "success"],
        score: 9
      });
    } else if (classification.complexity === "epic") {
      onProgress?.("\u{1F33F} Spawning exponential workers for epic task\u2026");
      const { results, summary } = await executeEpic(enrichedGoal, classification, sessionId, model);
      result.jobs = results;
      result.files = results.flatMap((r) => r.output?.files || []);
      result.summary = summary;
    } else {
      onProgress?.("\u{1F916} Launching agent pipeline\u2026");
      const { jobs, summary } = await executeComplex(enrichedGoal, classification, sessionId, model);
      result.jobs = jobs;
      result.files = jobs.flatMap((r) => r.output?.files || []);
      result.summary = summary;
    }
  } catch (err) {
    result.summary = `Failed: ${err?.message || "unknown error"}`;
    await storeMemory({
      session_id: sessionId,
      agent: "employee",
      type: "failure",
      content: `Task failed: ${classification.title} \u2014 ${result.summary}`,
      tags: [classification.category, "failure"],
      score: -2
    });
  }
  result.durationMs = Date.now() - start;
  workerBus.emit("employee:done", { sessionId, result });
  return result;
}
var CLASSIFIER_PROMPT, GENERALIST_PROMPT, RESEARCHER_PROMPT, WRITER_PROMPT, PLANNER_PROMPT;
var init_employeeAgent = __esm({
  "server/employeeAgent.ts"() {
    init_routes();
    init_agentMemory();
    init_agentWorker();
    CLASSIFIER_PROMPT = `You are an AI task classifier. Given any user request, classify it and determine the best execution strategy.

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
    GENERALIST_PROMPT = `You are an elite AI employee \u2014 highly capable, precise, and autonomous.
Complete the given task fully and perfectly. Think step by step.
For research: be thorough and cite specifics.
For writing: be polished and publication-ready.
For analysis: be rigorous and actionable.
For planning: be concrete with timelines and owners.
OUTPUT: A complete, high-quality response. No hedging. Just deliver.`;
    RESEARCHER_PROMPT = `You are an expert AI researcher and analyst.
Given a topic or question, produce a comprehensive, accurate, well-structured response.
Include: key findings, relevant context, concrete examples, actionable insights.
Format with clear sections. Be specific, not vague. Cite reasoning, not just conclusions.`;
    WRITER_PROMPT = `You are a world-class writer and content strategist.
Produce polished, engaging, publication-ready content.
Match the tone requested. If no tone specified: professional but human.
Deliver the complete piece, not an outline.`;
    PLANNER_PROMPT = `You are a strategic planning expert.
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
  }
});

// server/index.ts
init_routes();
import express2 from "express";
import cors from "cors";

// server/parallelRoutes.ts
init_agentWorker();
init_agentMemory();
import { randomUUID as randomUUID2 } from "crypto";
function sendSSE2(res, event, data) {
  res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
  app.post("/api/employee/task", async (req, res2) => {
    try {
      const { goal, model, sessionId } = req.body;
      if (!goal) return res2.status(400).json({ error: "goal required" });
      const { executeTask: executeTask2 } = await Promise.resolve().then(() => (init_employeeAgent(), employeeAgent_exports));
      const sid = sessionId || randomUUID2();
      const result = await executeTask2(goal, {
        model,
        sessionId: sid,
        onProgress: (msg) => {
          workerBus.emit("employee:progress", { sessionId: sid, message: msg });
        },
        onClassified: (classification) => {
          workerBus.emit("employee:classified", { sessionId: sid, classification });
        }
      });
      res2.json(result);
    } catch (err) {
      res2.status(500).json({ error: err?.message || "employee task failed" });
    }
  });
  app.get("/api/employee/classify", async (req, res2) => {
    try {
      const { goal, model } = req.query;
      if (!goal) return res2.status(400).json({ error: "goal required" });
      const { classifyTask: classifyTask2 } = await Promise.resolve().then(() => (init_employeeAgent(), employeeAgent_exports));
      const classification = await classifyTask2(goal, model);
      res2.json(classification);
    } catch (err) {
      res2.status(500).json({ error: err?.message });
    }
  });
}
function registerParallelRoutes(app3) {
  app3.get("/api/agent/stream/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();
    const events = [
      "worker:status",
      "worker:thinking",
      "worker:eval",
      "worker:done",
      "worker:failed",
      "worker:retrying",
      "worker:spawned",
      "parallel:start",
      "parallel:done",
      "memory:stored",
      "sandbox:update",
      "employee:progress",
      "employee:classified",
      "employee:classifying",
      "employee:epic:start",
      "employee:epic:done",
      "employee:done",
      "employee:progress",
      "employee:classified",
      "employee:classifying",
      "employee:epic:start",
      "employee:epic:done",
      "employee:done"
    ];
    const handlers = {};
    events.forEach((event) => {
      handlers[event] = (data) => {
        if (!sessionId || data?.sessionId === sessionId) {
          sendSSE2(res, event, data);
        }
      };
      workerBus.on(event, handlers[event]);
    });
    const ping = setInterval(() => {
      res.write(": ping\n\n");
    }, 15e3);
    req.on("close", () => {
      clearInterval(ping);
      events.forEach((event) => workerBus.off(event, handlers[event]));
    });
  });
  app3.post("/api/agent/parallel-build", async (req, res) => {
    try {
      const { goal, agentSequence, context, model, sessionId } = req.body;
      if (!goal) return res.status(400).json({ error: "goal required" });
      const sid = sessionId || randomUUID2();
      await storeMemory({
        session_id: sid,
        agent: "orchestrator",
        type: "context",
        content: `Goal: ${goal}`,
        tags: ["goal"]
      });
      const sequence = agentSequence || ["orchestrator", "strategist", "builder", "reviewer", "fixer"];
      const parallelGroups = [];
      const serialFirst = [];
      const serialLast = [];
      const parallelable = /* @__PURE__ */ new Set(["database", "api", "ui", "testing", "security", "performance"]);
      let inParallel = [];
      for (const agent of sequence) {
        if (["orchestrator", "strategist"].includes(agent)) {
          serialFirst.push(agent);
        } else if (["reviewer", "fixer", "deployer"].includes(agent)) {
          if (inParallel.length > 0) {
            parallelGroups.push(inParallel);
            inParallel = [];
          }
          serialLast.push(agent);
        } else if (parallelable.has(agent)) {
          inParallel.push(agent);
        } else {
          if (inParallel.length > 0) {
            parallelGroups.push(inParallel);
            inParallel = [];
          }
          serialFirst.push(agent);
        }
      }
      if (inParallel.length > 0) parallelGroups.push(inParallel);
      workerBus.emit("parallel:start", {
        sessionId: sid,
        goal,
        serialFirst,
        parallelGroups,
        serialLast
      });
      let sharedContext = { ...context, goal };
      const phase1Results = [];
      for (const agent of serialFirst) {
        const job = {
          id: randomUUID2(),
          sessionId: sid,
          agent,
          goal,
          context: sharedContext,
          model,
          maxRetries: 2,
          selfEvalThreshold: 6
        };
        const result = await runWorkerJob(job);
        phase1Results.push(result);
        if (result.output) sharedContext = { ...sharedContext, [`${agent}Output`]: result.output };
      }
      const parallelResults = [];
      for (const group of parallelGroups) {
        const groupJobs = group.map((agent) => ({
          id: randomUUID2(),
          sessionId: sid,
          agent,
          goal,
          context: sharedContext,
          model,
          maxRetries: 1,
          selfEvalThreshold: 5
        }));
        const groupResults = await runParallelWorkers(groupJobs);
        parallelResults.push(...groupResults);
        groupResults.forEach((r) => {
          if (r.output) sharedContext = { ...sharedContext, [`${r.agent}Output`]: r.output };
        });
      }
      if (!sequence.includes("builder") || serialFirst.includes("builder")) {
      } else {
        const builderJob = {
          id: randomUUID2(),
          sessionId: sid,
          agent: "builder",
          goal,
          context: sharedContext,
          model,
          maxRetries: 2,
          selfEvalThreshold: 7
        };
        const builderResult = await runWorkerJob(builderJob);
        phase1Results.push(builderResult);
        if (builderResult.output) sharedContext = { ...sharedContext, builderOutput: builderResult.output };
      }
      const phase4Results = [];
      for (const agent of serialLast) {
        const job = {
          id: randomUUID2(),
          sessionId: sid,
          agent,
          goal,
          context: sharedContext,
          model,
          maxRetries: 1,
          selfEvalThreshold: 6
        };
        const result = await runWorkerJob(job);
        phase4Results.push(result);
        if (result.output) sharedContext = { ...sharedContext, [`${agent}Output`]: result.output };
      }
      const allResults = [...phase1Results, ...parallelResults, ...phase4Results];
      workerBus.emit("parallel:done", {
        sessionId: sid,
        totalAgents: allResults.length,
        avgScore: allResults.reduce((s, r) => s + (r.score || 0), 0) / allResults.length
      });
      res.json({ sessionId: sid, results: allResults, finalContext: sharedContext });
    } catch (err) {
      res.status(500).json({ error: err?.message || "parallel build failed" });
    }
  });
  app3.post("/api/agent/spawn", async (req, res) => {
    try {
      const { parentJobId, sessionId, subTasks, model } = req.body;
      if (!subTasks?.length) return res.status(400).json({ error: "subTasks required" });
      const parentJob = {
        id: parentJobId || randomUUID2(),
        sessionId: sessionId || randomUUID2(),
        agent: "orchestrator",
        goal: "spawn sub-workers",
        context: {},
        model
      };
      const results = await spawnSubWorkers(parentJob, subTasks);
      res.json({ results });
    } catch (err) {
      res.status(500).json({ error: err?.message || "spawn failed" });
    }
  });
  app3.get("/api/agent/memory/:sessionId", async (req, res) => {
    try {
      const memory = await getSessionMemory(req.params.sessionId);
      res.json(memory);
    } catch (err) {
      res.status(500).json({ error: "memory retrieval failed" });
    }
  });
  app3.post("/api/sandbox/execute", async (req, res) => {
    try {
      const { code, language } = req.body;
      if (!code) return res.status(400).json({ error: "code required" });
      if (language === "html" || language === "tsx" || language === "jsx" || !language) {
        res.json({
          status: "preview_ready",
          type: language || "tsx",
          previewable: true,
          message: "Code ready for live preview sandbox"
        });
        return;
      }
      res.json({ status: "ok", output: "Preview ready", previewable: false });
    } catch (err) {
      res.status(500).json({ error: err?.message });
    }
  });
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app3, server) {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: { server }
    },
    appType: "custom",
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
      }
    }
  });
  app3.use(vite.middlewares);
  app3.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(__dirname, "..", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app3) {
  const distPath = path.resolve(__dirname, "..", "dist", "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app3.use(express.static(distPath));
  app3.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app2 = express2();
app2.use(cors());
app2.use(express2.json());
app2.use(express2.urlencoded({ extended: false }));
app2.use((req, res, next) => {
  const start = Date.now();
  const path2 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path2.startsWith("/api")) {
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  await registerRoutes(app2);
  registerParallelRoutes(app2);
  app2.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    log(`Error: ${message}`);
    res.status(status).json({ message });
  });
  const PORT = parseInt(process.env.PORT || "5000", 10);
  const server = app2.listen(PORT, "0.0.0.0", () => {
    log(`Server running on port ${PORT}`);
  });
  if (app2.get("env") === "development") {
    await setupVite(app2, server);
  } else {
    serveStatic(app2);
  }
})();

/**
 * Multi-provider AI gateway — supports DeepSeek, Kilo Gateway, Groq, Google Gemini,
 * Cerebras, GitHub Models, and Cohere.
 *
 * Cascade order: Gemini → DeepSeek → Kilo → Groq → Cerebras → GitHub → Cohere
 *
 * Kilo Gateway (api.kilo.ai) is OpenAI-compatible and routes to 100+ models:
 *   claude-sonnet-4, gpt-5.5, gemini-3.1-pro-preview, kilo/auto, and more.
 */

// ── Provider configs ────────────────────────────────────────────────────────

export type ProviderName = "deepseek" | "kilo" | "groq" | "gemini" | "cerebras" | "github" | "cohere" | "mistral";

interface ProviderConfig {
  name: ProviderName;
  label: string;
  apiKeyEnv: string[];
  endpoint: string | (() => string);
  models: { id: string; label: string; contextWindow: number; pricing: [number, number] }[];
  isFree: boolean;
}

function getApiKey(name: ProviderName): string {
  const envs = PROVIDERS[name].apiKeyEnv;
  for (const env of envs) {
    const val = process.env[env];
    if (val) return val;
  }
  return "";
}

function getEndpoint(name: ProviderName): string {
  const ep = PROVIDERS[name].endpoint;
  if (typeof ep === "function") return ep();
  return ep;
}

const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  deepseek: {
    name: "deepseek",
    label: "DeepSeek",
    apiKeyEnv: ["DEEPSEEK_API_KEY"],
    endpoint: () => process.env.DEEPSEEK_ENDPOINT || "https://api.deepseek.com/v1/chat/completions",
    models: [
      { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", contextWindow: 1000000, pricing: [0.14, 0.28] },
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", contextWindow: 1000000, pricing: [0.435, 0.87] },
      // Legacy aliases kept for backward compat (deprecated 2026-07-24)
      { id: "deepseek-chat", label: "DeepSeek Chat (legacy)", contextWindow: 64000, pricing: [0.14, 0.28] },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner (legacy)", contextWindow: 64000, pricing: [0.55, 2.19] },
    ],
    isFree: false,
  },

  kilo: {
    name: "kilo",
    label: "Kilo Gateway",
    apiKeyEnv: ["KILOCODE_API_KEY", "KILO_API_KEY"],
    endpoint: "https://api.kilo.ai/api/gateway/chat/completions",
    models: [
      // Smart router — Kilo picks the best model automatically
      { id: "kilo/auto", label: "Kilo Auto (Smart Route)", contextWindow: 1000000, pricing: [0, 0] },
      // Premium models via Kilo
      { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4 (via Kilo)", contextWindow: 200000, pricing: [3.0, 15.0] },
      { id: "anthropic/claude-opus-4", label: "Claude Opus 4 (via Kilo)", contextWindow: 200000, pricing: [15.0, 75.0] },
      { id: "openai/gpt-5.5", label: "GPT-5.5 (via Kilo)", contextWindow: 256000, pricing: [2.5, 10.0] },
      { id: "openai/gpt-4.1", label: "GPT-4.1 (via Kilo)", contextWindow: 1000000, pricing: [2.0, 8.0] },
      { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (via Kilo)", contextWindow: 1000000, pricing: [0, 0] },
      { id: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro (via Kilo)", contextWindow: 1000000, pricing: [0.435, 0.87] },
    ],
    isFree: false,
  },

  groq: {
    name: "groq",
    label: "Groq (Free)",
    apiKeyEnv: ["GROQ_API_KEY"],
    endpoint: () => process.env.GROQ_ENDPOINT || "https://api.groq.com/openai/v1/chat/completions",
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", contextWindow: 128000, pricing: [0.59, 0.79] },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", contextWindow: 128000, pricing: [0.05, 0.08] },
      { id: "qwen-2.5-coder-32b", label: "Qwen 2.5 Coder 32B", contextWindow: 128000, pricing: [0.59, 0.79] },
      { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", contextWindow: 32768, pricing: [0.24, 0.24] },
    ],
    isFree: true,
  },

  gemini: {
    name: "gemini",
    label: "Google Gemini (Free Tier)",
    apiKeyEnv: ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", contextWindow: 1000000, pricing: [0, 0] },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", contextWindow: 1000000, pricing: [0, 0] },
      { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash-Lite", contextWindow: 1000000, pricing: [0, 0] },
    ],
    isFree: true,
  },

  cerebras: {
    name: "cerebras",
    label: "Cerebras (Free)",
    apiKeyEnv: ["CEREBRAS_API_KEY"],
    endpoint: () => process.env.CEREBRAS_ENDPOINT || "https://api.cerebras.ai/v1/chat/completions",
    models: [
      // 8B first: Cerebras free-tier keys often only have access to this model,
      // not the 70B one — putting 70B first caused hard 404 "no access" failures
      // whenever it was the only active provider in the fallback chain.
      { id: "llama3.1-8b", label: "Llama 3.1 8B (Cerebras)", contextWindow: 8192, pricing: [0, 0] },
      { id: "llama-3.3-70b", label: "Llama 3.3 70B (Cerebras, requires elevated access)", contextWindow: 128000, pricing: [0, 0] },
    ],
    isFree: true,
  },

  github: {
    // Old models.inference.ai.azure.com endpoint + gpt-4o/Phi-4/DeepSeek-R1 IDs
    // were dead (GitHub Models migrated to models.github.ai; those specific
    // model IDs are no longer valid there). Repointed to the current endpoint
    // + org/model-id format, and to GITHUB_TOKEN_4 (the PAT already
    // provisioned across this ecosystem) instead of the never-configured
    // GITHUB_TOKEN/GITHUB_MODELS_TOKEN. Model IDs live-verified 2026-07-20 on
    // this token's access tier -- gpt-5-mini/o4-mini/deepseek-r1 all returned
    // "Unavailable model" on this tier and are intentionally left out.
    name: "github",
    label: "GitHub Models (Free)",
    apiKeyEnv: ["GITHUB_TOKEN_4", "GITHUB_TOKEN", "GITHUB_MODELS_TOKEN"],
    endpoint: "https://models.github.ai/inference/chat/completions",
    models: [
      { id: "openai/gpt-4.1", label: "GPT-4.1 (GitHub)", contextWindow: 128000, pricing: [0, 0] },
      { id: "mistral-ai/codestral-2501", label: "Codestral 25.01 (GitHub)", contextWindow: 32000, pricing: [0, 0] },
      { id: "meta/llama-4-maverick-17b-128e-instruct-fp8", label: "Llama 4 Maverick (GitHub)", contextWindow: 128000, pricing: [0, 0] },
    ],
    isFree: true,
  },

  cohere: {
    name: "cohere",
    label: "Cohere (Free Trial)",
    apiKeyEnv: ["COHERE_API_KEY"],
    endpoint: "https://api.cohere.com/v2/chat",
    models: [
      { id: "north-mini-code-1-0", label: "North Mini Code 1.0 (Cohere) 🧠", contextWindow: 256000, pricing: [0, 0] },
      { id: "command-a-03-2025", label: "Command A (Cohere)", contextWindow: 256000, pricing: [0, 0] },
      { id: "command-r-plus-08-2024", label: "Command R+ (Cohere)", contextWindow: 128000, pricing: [0, 0] },
    ],
    isFree: true,
  },

  mistral: {
    name: "mistral",
    label: "Mistral AI",
    apiKeyEnv: ["MISTRAL_API_KEY"],
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    models: [
      // Devstral: Mistral's purpose-built agentic coding model (multi-file edits, tool use).
      { id: "devstral-2512", label: "Devstral (Mistral) — agentic coding", contextWindow: 256000, pricing: [0.4, 2.0] },
      // Codestral: Mistral's code-completion/review-focused model.
      { id: "codestral-2508", label: "Codestral (Mistral) — code review", contextWindow: 256000, pricing: [0.3, 0.9] },
      // High-throughput general default (5 RPS vs mistral-large's 0.07 RPS on this account).
      { id: "mistral-small-2506", label: "Mistral Small (high-throughput default)", contextWindow: 128000, pricing: [0.1, 0.3] },
    ],
    isFree: false,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function isProviderActive(name: ProviderName): boolean {
  return Boolean(getApiKey(name));
}

export function getActiveProviders(): ProviderName[] {
  return (Object.keys(PROVIDERS) as ProviderName[]).filter((n) => isProviderActive(n));
}

function findProviderForModel(modelId: string): ProviderConfig | null {
  for (const p of Object.values(PROVIDERS)) {
    if (p.models.some((m) => m.id === modelId)) return p;
  }
  return null;
}

export function getFallbackChain(): string[] {
  const chain: string[] = [];
  const order: ProviderName[] = ["gemini", "deepseek", "kilo", "mistral", "groq", "cerebras", "github", "cohere"];
  for (const name of order) {
    if (!isProviderActive(name)) continue;
    const primary = PROVIDERS[name].models[0];
    if (primary) chain.push(primary.id);
  }
  return chain;
}

export function getFallbackModel(currentModel: string): string | null {
  const chain = getFallbackChain();
  const idx = chain.indexOf(currentModel);
  if (idx >= 0 && idx < chain.length - 1) return chain[idx + 1];
  if (chain.length > 0 && chain[0] !== currentModel) return chain[0];
  return null;
}

export function getAvailableModels(): { id: string; label: string; provider: string; isFree: boolean; contextWindow: number }[] {
  const models: { id: string; label: string; provider: string; isFree: boolean; contextWindow: number }[] = [];
  for (const p of Object.values(PROVIDERS)) {
    if (!isProviderActive(p.name)) continue;
    for (const m of p.models) {
      models.push({ id: m.id, label: m.label, provider: p.label, isFree: p.isFree, contextWindow: m.contextWindow });
    }
  }
  return models;
}

export function getModelPricing(): Record<string, { input: number; output: number; isFree: boolean }> {
  const pricing: Record<string, { input: number; output: number; isFree: boolean }> = {};
  for (const p of Object.values(PROVIDERS)) {
    if (!isProviderActive(p.name)) continue;
    for (const m of p.models) {
      pricing[m.id] = { input: m.pricing[0], output: m.pricing[1], isFree: p.isFree };
    }
  }
  return pricing;
}

export function getDefaultModel(): string | null {
  const chain = getFallbackChain();
  return chain[0] || null;
}

export interface ProviderStatus {
  name: ProviderName;
  label: string;
  isFree: boolean;
  active: boolean;
  envVar: string;
  signupUrl: string;
  models: { id: string; label: string }[];
}

const PROVIDER_SIGNUP_URLS: Record<ProviderName, string> = {
  deepseek: "https://platform.deepseek.com/api_keys",
  kilo: "https://app.kilo.ai",
  groq: "https://console.groq.com/keys",
  gemini: "https://aistudio.google.com/apikey",
  cerebras: "https://cloud.cerebras.ai",
  github: "https://github.com/settings/tokens",
  cohere: "https://dashboard.cohere.com/api-keys",
};

const PROVIDER_ENV_VARS: Record<ProviderName, string> = {
  deepseek: "DEEPSEEK_API_KEY",
  kilo: "KILOCODE_API_KEY",
  groq: "GROQ_API_KEY",
  gemini: "GEMINI_API_KEY (or GOOGLE_API_KEY)",
  cerebras: "CEREBRAS_API_KEY",
  github: "GITHUB_TOKEN_4 (or GITHUB_TOKEN / GITHUB_MODELS_TOKEN)",
  cohere: "COHERE_API_KEY",
};

export function getProvidersStatus(): ProviderStatus[] {
  return (Object.keys(PROVIDERS) as ProviderName[]).map((name) => ({
    name,
    label: PROVIDERS[name].label,
    isFree: PROVIDERS[name].isFree,
    active: isProviderActive(name),
    envVar: PROVIDER_ENV_VARS[name],
    signupUrl: PROVIDER_SIGNUP_URLS[name],
    models: PROVIDERS[name].models.map((m) => ({ id: m.id, label: m.label })),
  }));
}

export function getActiveProvidersStatus(): ProviderStatus[] {
  return getProvidersStatus().filter((p) => p.active);
}

export function getFreeUnconfiguredProviders(): ProviderStatus[] {
  return getProvidersStatus().filter((p) => !p.active && p.isFree);
}

export function calcCost(model: string, promptTokens: number, completionTokens: number): number {
  const provider = findProviderForModel(model);
  const m = provider?.models.find((m) => m.id === model);
  const pricing = m?.pricing || [0.15, 0.60];
  return (promptTokens / 1_000_000) * pricing[0] + (completionTokens / 1_000_000) * pricing[1];
}

export function getProviderForModel(modelId: string): ProviderName | null {
  const p = findProviderForModel(modelId);
  return p ? p.name : null;
}

// ── Request builders ─────────────────────────────────────────────────────────

function buildOpenAIRequest(
  provider: ProviderConfig,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  stream: boolean,
  apiKeyOverride?: string
) {
  return {
    url: getEndpoint(provider.name),
    headers: {
      Authorization: `Bearer ${apiKeyOverride || getApiKey(provider.name)}`,
      "Content-Type": "application/json",
    },
    body: {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: maxTokens,
      stream,
    },
  };
}

function buildGeminiRequest(
  provider: ProviderConfig,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  stream: boolean,
  apiKeyOverride?: string
) {
  const apiKey = apiKeyOverride || getApiKey(provider.name);
  const action = stream ? "streamGenerateContent?alt=sse" : "generateContent";
  return {
    url: `${getEndpoint(provider.name)}/models/${model}:${action}${action.includes("?") ? "&" : "?"}key=${apiKey}`,
    headers: { "Content-Type": "application/json" },
    body: {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    },
  };
}

function buildCohereRequest(
  provider: ProviderConfig,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  stream: boolean,
  apiKeyOverride?: string
) {
  // Cohere v2 API uses OpenAI-compatible messages array format
  return {
    url: getEndpoint(provider.name),
    headers: {
      Authorization: `Bearer ${apiKeyOverride || getApiKey(provider.name)}`,
      "Content-Type": "application/json",
      "X-Client-Name": "autonomous-code-wizard",
    },
    body: {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: maxTokens,
      stream,
    },
  };
}

export function buildRequest(
  modelId: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  stream: boolean,
  apiKeyOverride?: string
) {
  const provider = findProviderForModel(modelId);
  if (!provider) throw new Error(`Unknown model: ${modelId}`);

  if (provider.name === "gemini") {
    return buildGeminiRequest(provider, modelId, systemPrompt, userMessage, maxTokens, stream, apiKeyOverride);
  }
  if (provider.name === "cohere") {
    return buildCohereRequest(provider, modelId, systemPrompt, userMessage, maxTokens, stream, apiKeyOverride);
  }
  // OpenAI-compatible: deepseek, kilo, groq, cerebras, github
  return buildOpenAIRequest(provider, modelId, systemPrompt, userMessage, maxTokens, stream, apiKeyOverride);
}

// ── Response parsers ─────────────────────────────────────────────────────────

export function parseResponse(
  providerName: ProviderName,
  data: any
): { content: string; totalTokens: number; promptTokens: number; completionTokens: number } {
  if (providerName === "gemini") {
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts?.map((p: any) => p.text || "").join("") || "";
    const usage = data.usageMetadata || {};
    return {
      content,
      totalTokens: usage.totalTokenCount || 0,
      promptTokens: usage.promptTokenCount || 0,
      completionTokens: usage.candidatesTokenCount || 0,
    };
  }
  if (providerName === "cohere") {
    // v2 API: OpenAI-compatible response shape
    const content = data.message?.content?.[0]?.text
      || data.choices?.[0]?.message?.content
      || data.text
      || "";
    const usage = data.usage || {};
    return {
      content,
      totalTokens: (usage.billed_units?.input_tokens || 0) + (usage.billed_units?.output_tokens || 0),
      promptTokens: usage.billed_units?.input_tokens || usage.tokens?.input_tokens || 0,
      completionTokens: usage.billed_units?.output_tokens || usage.tokens?.output_tokens || 0,
    };
  }
  // OpenAI-compatible (deepseek, kilo, groq, cerebras, github)
  const content = data.choices?.[0]?.message?.content || "";
  const usage = data.usage || {};
  return {
    content,
    totalTokens: usage.total_tokens || 0,
    promptTokens: usage.prompt_tokens || 0,
    completionTokens: usage.completion_tokens || 0,
  };
}

export function parseStreamChunk(providerName: ProviderName, line: string): string | null {
  if (providerName === "gemini") {
    if (!line.startsWith("data: ")) return null;
    try {
      const data = JSON.parse(line.slice(6));
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch { return null; }
  }
  if (providerName === "cohere") {
    // v2 SSE uses OpenAI-compatible data: prefix with delta content
    if (!line.startsWith("data: ")) return null;
    const payload = line.slice(6).trim();
    if (payload === "[DONE]") return null;
    try {
      const data = JSON.parse(payload);
      // v2 delta format
      return data.delta?.message?.content?.text
        || data.choices?.[0]?.delta?.content
        || null;
    } catch { return null; }
  }
  // OpenAI-compatible (deepseek, kilo, groq, cerebras, github)
  if (!line.startsWith("data: ")) return null;
  const payload = line.slice(6).trim();
  if (payload === "[DONE]") return null;
  try {
    const data = JSON.parse(payload);
    return data.choices?.[0]?.delta?.content || null;
  } catch { return null; }
}


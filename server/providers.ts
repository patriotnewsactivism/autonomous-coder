/**
 * Multi-provider AI gateway — supports DeepSeek, Groq, Google Gemini,
 * Cerebras, GitHub Models, and Cohere. All use OpenAI-compatible APIs
 * except Gemini (which has its own format) and Cohere.
 *
 * Every provider has a free tier. The gateway auto-cascades on failure
 * following the pattern: DeepSeek → Groq → Gemini → Cerebras → GitHub → Cohere
 */

// ── Provider configs ────────────────────────────────────────────────────────

export type ProviderName = "deepseek" | "groq" | "gemini" | "cerebras" | "github" | "cohere";

interface ProviderConfig {
  name: ProviderName;
  label: string;
  apiKey: string;
  endpoint: string;
  models: { id: string; label: string; contextWindow: number; pricing: [number, number] }[];
  isFree: boolean;
}

const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  deepseek: {
    name: "deepseek",
    label: "DeepSeek",
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    endpoint: process.env.DEEPSEEK_ENDPOINT || "https://api.deepseek.com/v1/chat/completions",
    models: [
      { id: "deepseek-chat", label: "DeepSeek Chat", contextWindow: 64000, pricing: [0.14, 0.28] },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner", contextWindow: 64000, pricing: [0.55, 2.19] },
    ],
    isFree: false,
  },
  groq: {
    name: "groq",
    label: "Groq (Free)",
    apiKey: process.env.GROQ_API_KEY || "",
    endpoint: process.env.GROQ_ENDPOINT || "https://api.groq.com/openai/v1/chat/completions",
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
    apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", contextWindow: 1000000, pricing: [0, 0] },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", contextWindow: 1000000, pricing: [0, 0] },
      { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash-Lite", contextWindow: 1000000, pricing: [0, 0] },
      { id: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview", contextWindow: 1000000, pricing: [0, 0] },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", contextWindow: 1000000, pricing: [0, 0] },
    ],
    isFree: true,
  },
  cerebras: {
    name: "cerebras",
    label: "Cerebras (Free)",
    apiKey: process.env.CEREBRAS_API_KEY || "",
    endpoint: process.env.CEREBRAS_ENDPOINT || "https://api.cerebras.ai/v1/chat/completions",
    models: [
      { id: "llama-3.3-70b", label: "Llama 3.3 70B (Cerebras)", contextWindow: 128000, pricing: [0, 0] },
      { id: "llama3.1-8b-8192", label: "Llama 3.1 8B (Cerebras)", contextWindow: 8192, pricing: [0, 0] },
    ],
    isFree: true,
  },
  github: {
    name: "github",
    label: "GitHub Models (Free)",
    apiKey: process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN || "",
    endpoint: "https://models.inference.ai.azure.com/chat/completions",
    models: [
      { id: "gpt-4o", label: "GPT-4o (GitHub)", contextWindow: 128000, pricing: [0, 0] },
      { id: "gpt-4o-mini", label: "GPT-4o Mini (GitHub)", contextWindow: 128000, pricing: [0, 0] },
      { id: "Phi-4", label: "Phi-4 (GitHub)", contextWindow: 16000, pricing: [0, 0] },
      { id: "DeepSeek-R1", label: "DeepSeek-R1 (GitHub)", contextWindow: 64000, pricing: [0, 0] },
    ],
    isFree: true,
  },
  cohere: {
    name: "cohere",
    label: "Cohere (Free Trial)",
    apiKey: process.env.COHERE_API_KEY || "",
    endpoint: "https://api.cohere.ai/v1/chat",
    models: [
      { id: "command-r-plus", label: "Command R+ (Cohere)", contextWindow: 128000, pricing: [0, 0] },
      { id: "command-a", label: "Command A (Cohere)", contextWindow: 256000, pricing: [0, 0] },
    ],
    isFree: true,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function isProviderActive(name: ProviderName): boolean {
  return Boolean(PROVIDERS[name].apiKey);
}

export function getActiveProviders(): ProviderName[] {
  return (Object.keys(PROVIDERS) as ProviderName[]).filter((n) => isProviderActive(n));
}

/** Model → provider lookup */
function findProviderForModel(modelId: string): ProviderConfig | null {
  for (const p of Object.values(PROVIDERS)) {
    if (p.models.some((m) => m.id === modelId)) return p;
  }
  return null;
}

/** Get the fallback chain — models from active providers, ordered by preference */
export function getFallbackChain(): string[] {
  const chain: string[] = [];
  const order: ProviderName[] = ["gemini", "deepseek", "groq", "cerebras", "github", "cohere"];
  for (const name of order) {
    if (!isProviderActive(name)) continue;
    // Add the first (primary) model from each provider
    const primary = PROVIDERS[name].models[0];
    if (primary) chain.push(primary.id);
  }
  return chain;
}

export function getFallbackModel(currentModel: string): string | null {
  const chain = getFallbackChain();
  const idx = chain.indexOf(currentModel);
  if (idx >= 0 && idx < chain.length - 1) return chain[idx + 1];
  // If model not in chain, try the first available
  if (chain.length > 0 && chain[0] !== currentModel) return chain[0];
  return null;
}

/** All available models from active providers */
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

/** Pricing lookup */
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

/** Default model — first available from the preferred order */
export function getDefaultModel(): string {
  const chain = getFallbackChain();
  return chain[0] || "deepseek-chat";
}

export function calcCost(model: string, promptTokens: number, completionTokens: number): number {
  const provider = findProviderForModel(model);
  const m = provider?.models.find((m) => m.id === model);
  const pricing = m?.pricing || [0.15, 0.60];
  return (promptTokens / 1_000_000) * pricing[0] + (completionTokens / 1_000_000) * pricing[1];
}

// ── Request builders per provider ────────────────────────────────────────────

function buildOpenAIRequest(provider: ProviderConfig, model: string, systemPrompt: string, userMessage: string, maxTokens: number, stream: boolean) {
  return {
    url: provider.endpoint,
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
      ...(stream ? {} : {}),
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

function buildGeminiRequest(provider: ProviderConfig, model: string, systemPrompt: string, userMessage: string, maxTokens: number, stream: boolean) {
  const action = stream ? "streamGenerateContent" : "generateContent";
  const url = `${provider.endpoint}/models/${model}:${action}${stream ? "?alt=sse" : ""}`;
  return {
    url,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": provider.apiKey,
    },
    body: {
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
    },
  };
}

function buildCohereRequest(provider: ProviderConfig, model: string, systemPrompt: string, userMessage: string, maxTokens: number, stream: boolean) {
  return {
    url: provider.endpoint,
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: {
      model,
      preamble: systemPrompt,
      message: userMessage,
      max_tokens: maxTokens,
      stream,
    },
  };
}

/** Build the request for a specific model, auto-detecting provider format */
export function buildRequest(model: string, systemPrompt: string, userMessage: string, maxTokens = 4096, stream = false) {
  const provider = findProviderForModel(model);
  if (!provider) throw new Error(`No provider configured for model: ${model}`);

  switch (provider.name) {
    case "gemini":
      return buildGeminiRequest(provider, model, systemPrompt, userMessage, maxTokens, stream);
    case "cohere":
      return buildCohereRequest(provider, model, systemPrompt, userMessage, maxTokens, stream);
    default:
      return buildOpenAIRequest(provider, model, systemPrompt, userMessage, maxTokens, stream);
  }
}

// ── Response parsers per provider ────────────────────────────────────────────

export function parseResponse(providerName: ProviderName, data: any): { content: string; promptTokens: number; completionTokens: number; totalTokens: number } {
  switch (providerName) {
    case "gemini":
      return {
        content: data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "",
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      };
    case "cohere":
      return {
        content: data.text || data.message || "",
        promptTokens: data.meta?.billed_units?.input_tokens || 0,
        completionTokens: data.meta?.billed_units?.output_tokens || 0,
        totalTokens: (data.meta?.billed_units?.input_tokens || 0) + (data.meta?.billed_units?.output_tokens || 0),
      };
    default:
      // OpenAI-compatible format (deepseek, groq, cerebras, github)
      return {
        content: data.choices?.[0]?.message?.content || "",
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      };
  }
}

/** Parse a streaming line from a provider */
export function parseStreamChunk(providerName: ProviderName, line: string): string | null {
  if (!line.startsWith("data: ")) return null;
  const data = line.slice(6).trim();
  if (data === "[DONE]") return null;

  try {
    const json = JSON.parse(data);
    switch (providerName) {
      case "gemini":
        return json.candidates?.[0]?.content?.parts?.[0]?.text || null;
      case "cohere":
        return json.text || json.delta?.message || null;
      default:
        return json.choices?.[0]?.delta?.content || null;
    }
  } catch {
    return null;
  }
}

/** Get the provider name for a model */
export function getProviderForModel(model: string): ProviderName | null {
  const p = findProviderForModel(model);
  return p?.name || null;
}

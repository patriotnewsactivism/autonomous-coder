/**
 * AI gateway — standardized on OpenRouter only, 2026-09-04, per Don's explicit
 * direction: "run off of openrouter models. a proven llm that works. get rid
 * of all old unverified models that are not openrouter."
 *
 * Root cause of prior instability: this service's dedicated OpenRouter key
 * shared an OpenRouter ACCOUNT with codeforge-v2's key — that account's
 * $16.45 balance was fully drained ($16.65 used), so every other provider in
 * the old 10-provider cascade (Cerebras/Mistral/DeepSeek/Kilo/Qwen/xAI/GitHub
 * Models/Cohere/Groq/Gemini free tiers) was being leaned on as a patchwork of
 * flaky, rate-limited, or billing-dead fallbacks. Switched to a SEPARATE,
 * healthy OpenRouter account (~$9.71 of $20 remaining as of 2026-09-04) and
 * removed every other provider entirely — no more fallback chain, no more
 * whack-a-mole across a dozen free tiers.
 *
 * Model: anthropic/claude-sonnet-4.5 — live-tested 2026-09-04 with a real
 * completion call against this exact key/account before shipping this file
 * (confirmed 200, real billed cost). Well-established, strong at coding
 * tasks, reasonably priced ($3/$15 per M tokens) relative to Opus.
 *
 * NOTE: server/apiKeys.ts (end-user BYOK feature) is a SEPARATE, unrelated
 * system for customers who supply their own third-party keys — intentionally
 * NOT touched by this change, which only concerns THIS service's own default
 * serving infrastructure.
 */

export type ProviderName = "openrouter";

interface ModelConfig {
  id: string;
  label: string;
  contextWindow: number;
  pricing: [number, number]; // [inputPer1M, outputPer1M] USD
}

interface ProviderConfig {
  name: ProviderName;
  label: string;
  apiKeyEnv: string[];
  endpoint: string;
  models: ModelConfig[];
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
  return PROVIDERS[name].endpoint;
}

const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  openrouter: {
    name: "openrouter",
    label: "OpenRouter",
    apiKeyEnv: ["OPENROUTER_API_KEY"],
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    models: [
      { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5 (OpenRouter) — default", contextWindow: 200000, pricing: [3.0, 15.0] },
      { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5 (OpenRouter) — fast/cheap", contextWindow: 200000, pricing: [1.0, 5.0] },
      { id: "qwen/qwen3-coder-plus", label: "Qwen3 Coder Plus (OpenRouter) — coding specialist", contextWindow: 262000, pricing: [0.65, 3.25] },
    ],
    isFree: false,
  },
};

const PROVIDER_ORDER: ProviderName[] = ["openrouter"];

// ── Helpers ──────────────────────────────────────────────────────────────────

export function isProviderActive(name: ProviderName): boolean {
  return Boolean(getApiKey(name));
}

export function getActiveProviders(): ProviderName[] {
  return (Object.keys(PROVIDERS) as ProviderName[]).filter((n) => isProviderActive(n));
}

function findProviderForModel(modelId: string): ProviderConfig | null {
  for (const name of PROVIDER_ORDER) {
    const p = PROVIDERS[name];
    if (p.models.some((m) => m.id === modelId)) return p;
  }
  return null;
}

export function getFallbackChain(): string[] {
  const chain: string[] = [];
  for (const name of PROVIDER_ORDER) {
    if (!isProviderActive(name)) continue;
    for (const m of PROVIDERS[name].models) chain.push(m.id);
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
  for (const name of PROVIDER_ORDER) {
    const p = PROVIDERS[name];
    if (!isProviderActive(p.name)) continue;
    for (const m of p.models) {
      models.push({ id: m.id, label: m.label, provider: p.label, isFree: p.isFree, contextWindow: m.contextWindow });
    }
  }
  return models;
}

export function getModelPricing(): Record<string, { input: number; output: number; isFree: boolean }> {
  const pricing: Record<string, { input: number; output: number; isFree: boolean }> = {};
  for (const name of PROVIDER_ORDER) {
    const p = PROVIDERS[name];
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
  openrouter: "https://openrouter.ai/keys",
};

const PROVIDER_ENV_VARS: Record<ProviderName, string> = {
  openrouter: "OPENROUTER_API_KEY",
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
  const pricing = m?.pricing || [3.0, 15.0];
  return (promptTokens / 1_000_000) * pricing[0] + (completionTokens / 1_000_000) * pricing[1];
}

export function getProviderForModel(modelId: string): ProviderName | null {
  const p = findProviderForModel(modelId);
  return p ? p.name : null;
}

// ── Request builder / response parsers ──────────────────────────────────────
// OpenRouter is fully OpenAI-compatible — a single code path covers it.

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
  return buildOpenAIRequest(provider, modelId, systemPrompt, userMessage, maxTokens, stream, apiKeyOverride);
}

export function parseResponse(
  providerName: ProviderName,
  data: any
): { content: string; totalTokens: number; promptTokens: number; completionTokens: number } {
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
  if (!line.startsWith("data: ")) return null;
  const payload = line.slice(6).trim();
  if (payload === "[DONE]") return null;
  try {
    const data = JSON.parse(payload);
    return data.choices?.[0]?.delta?.content || null;
  } catch {
    return null;
  }
}

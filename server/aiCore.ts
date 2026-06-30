/**
 * aiCore.ts — Standalone AI call primitives
 *
 * Extracted from routes.ts to break circular dependency:
 *   routes.ts → autoHeal/autoLearn/spawnEngine → routes.ts (CIRCULAR ❌)
 *
 * All server modules that need callAI import from here, NOT from routes.ts.
 * routes.ts re-exports from here for backward compatibility.
 */

import {
  buildRequest, parseResponse, parseStreamChunk,
  getFallbackModel, getDefaultModel, getProviderForModel,
  getFreeUnconfiguredProviders, getProvidersStatus,
  calcCost as _calcCost,
} from "./providers.js";

const DEFAULT_MODEL = getDefaultModel();

export interface AIUsage {
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

function buildNoProvidersError(): string {
  const free = getFreeUnconfiguredProviders();
  if (free.length === 0) {
    const active = getProvidersStatus().filter(p => p.active);
    if (active.length > 0) {
      return `AI providers are configured but none are responding. Active: ${active.map(p => p.label).join(", ")}. Check your API keys.`;
    }
    return "No AI providers are configured. Set one of: GEMINI_API_KEY (free), GROQ_API_KEY (free), CEREBRAS_API_KEY (free), GITHUB_TOKEN (free), COHERE_API_KEY (free)";
  }
  const lines = free.map(p => `  - ${p.envVar} → ${p.signupUrl} (${p.label})`);
  return `No AI providers are configured. Set one of these free API keys:\n${lines.join("\n")}`;
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
      return callAI(systemPrompt, userMessage, fallback, triedModels);
    }
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again.");
    if (response.status === 401) throw new Error(`${deployment}: Invalid API key.\n\n${buildNoProvidersError()}`);
    throw new Error(`AI error (${deployment}): ${response.status} - ${errorText}`);
  }

  const aiResponse = await response.json();
  const parsed = parseResponse(providerName, aiResponse);

  if (!parsed.content) {
    const fallback = getFallbackModel(deployment);
    if (fallback && !triedModels.has(fallback)) {
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
      return callAIStream(systemPrompt, userMessage, onToken, fallback, triedModels);
    }
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again.");
    if (response.status === 401) throw new Error(`${deployment}: Invalid API key.\n\n${buildNoProvidersError()}`);
    throw new Error(`AI error (${deployment}): ${response.status}`);
  }

  let fullContent = "";
  let tokens = 0, promptTokens = 0, completionTokens = 0;
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      const tokenText = parseStreamChunk(providerName, line);
      if (tokenText) { fullContent += tokenText; onToken(tokenText); }
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

  if (tokens === 0 && fullContent.length > 0) tokens = Math.round(fullContent.length / 4);

  return { content: fullContent, tokens, promptTokens, completionTokens, model: deployment, costUsd: calcCost(deployment, promptTokens, completionTokens) };
}

export function parseJsonResponse(content: string): any {
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

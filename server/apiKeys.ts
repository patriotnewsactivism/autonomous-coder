/**
 * apiKeys.ts — Per-user BYOK API key management
 * Ported from codeforge-v2 (Convex) to autonomous-coder (Supabase REST + Express).
 *
 * Any user can supply their own AI provider key instead of using the
 * platform's shared env-configured keys. Keys are stored obfuscated
 * (XOR + base64) — never returned in plaintext after save.
 *
 * Supported providers (matches server/providers.ts):
 *   deepseek, kilo, groq, gemini, cerebras, github, cohere
 */

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function supaHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function supaFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: { ...supaHeaders(), ...options?.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error (${res.status}): ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// ─── OBFUSCATION ─────────────────────────────────────────────────────────────
// XOR obfuscation — prevents plaintext at rest in Postgres. Rotate the env
// var periodically; for stronger guarantees swap for AES via a KMS action.

const OBFUSCATION_KEY = process.env.BYOK_OBFUSCATION_KEY || "ac_byok_key_2026";

function obfuscate(text: string): string {
  const key = OBFUSCATION_KEY;
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(result, "binary").toString("base64");
}

function deobfuscate(encoded: string): string {
  const key = OBFUSCATION_KEY;
  const text = Buffer.from(encoded, "base64").toString("binary");
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 6).replace(/./g, "*")}...${key.slice(-4)}`;
}

// ─── PROVIDER VALIDATION ──────────────────────────────────────────────────────
// Matches the provider set in server/providers.ts

export type ByokProvider = "deepseek" | "kilo" | "groq" | "gemini" | "cerebras" | "github" | "cohere";

const VALID_PROVIDERS: ByokProvider[] = ["deepseek", "kilo", "groq", "gemini", "cerebras", "github", "cohere"];

const PROVIDER_VALIDATION_ENDPOINTS: Record<ByokProvider, { url: string; model: string; kind: "openai" | "gemini" | "cohere" }> = {
  deepseek: { url: "https://api.deepseek.com/v1/chat/completions", model: "deepseek-chat", kind: "openai" },
  kilo: { url: "https://api.kilo.ai/api/gateway/chat/completions", model: "kilo/auto", kind: "openai" },
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", kind: "openai" },
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", model: "gemini-2.0-flash", kind: "gemini" },
  cerebras: { url: "https://api.cerebras.ai/v1/chat/completions", model: "llama3.1-8b", kind: "openai" },
  github: { url: "https://models.inference.ai.azure.com/chat/completions", model: "gpt-4o-mini", kind: "openai" },
  cohere: { url: "https://api.cohere.com/v2/chat", model: "command-r", kind: "cohere" },
};

async function validateKeyWithProvider(provider: ByokProvider, apiKey: string): Promise<{ valid: boolean; error?: string }> {
  const cfg = PROVIDER_VALIDATION_ENDPOINTS[provider];
  if (!cfg) return { valid: false, error: "Unknown provider" };

  try {
    let res: Response;
    if (cfg.kind === "gemini") {
      res = await fetch(`${cfg.url}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "hi" }] }], generationConfig: { maxOutputTokens: 1 } }),
      });
    } else {
      res = await fetch(cfg.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: cfg.model, messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
      });
    }

    if (res.ok || res.status === 400) return { valid: true };
    if (res.status === 401) return { valid: false, error: "Invalid API key — authentication failed" };
    if (res.status === 403) return { valid: false, error: "API key lacks required permissions" };
    if (res.status === 429) return { valid: true }; // rate limited = key exists and works

    const body = await res.text().catch(() => "");
    return { valid: false, error: `Provider returned ${res.status}: ${body.slice(0, 100)}` };
  } catch (err) {
    return { valid: false, error: `Network error: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export interface MaskedKeyInfo {
  id: number;
  provider: ByokProvider;
  maskedKey: string;
  isValid: boolean;
  validatedAt: string | null;
  createdAt: string;
}

/** Masked key list for a user — never exposes the real key. */
export async function listMyKeys(userId: string): Promise<MaskedKeyInfo[]> {
  const rows = await supaFetch(`/user_api_keys?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`);
  return rows.map((r: any) => ({
    id: r.id,
    provider: r.provider,
    maskedKey: r.masked_key,
    isValid: r.is_valid,
    validatedAt: r.validated_at,
    createdAt: r.created_at,
  }));
}

/** Decrypted key for a specific provider — internal use only (AI router). */
export async function getKeyForProvider(userId: string, provider: ByokProvider): Promise<string | null> {
  const rows = await supaFetch(
    `/user_api_keys?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${provider}&limit=1`
  );
  if (!rows.length) return null;
  return deobfuscate(rows[0].encrypted_key);
}

/** All decrypted keys for a user, keyed by provider — used by the AI gateway. */
export async function getAllKeysForUser(userId: string): Promise<Partial<Record<ByokProvider, string>>> {
  const rows = await supaFetch(`/user_api_keys?user_id=eq.${encodeURIComponent(userId)}`);
  const result: Partial<Record<ByokProvider, string>> = {};
  for (const r of rows) {
    result[r.provider as ByokProvider] = deobfuscate(r.encrypted_key);
  }
  return result;
}

export async function hasAnyKey(userId: string): Promise<boolean> {
  const rows = await supaFetch(`/user_api_keys?user_id=eq.${encodeURIComponent(userId)}&limit=1`);
  return rows.length > 0;
}

/** Validate then store obfuscated. Upserts on (user_id, provider). */
export async function saveKey(
  userId: string,
  provider: string,
  apiKey: string
): Promise<{ success: boolean; error?: string; maskedKey?: string }> {
  if (!VALID_PROVIDERS.includes(provider as ByokProvider)) {
    return { success: false, error: `Unsupported provider: ${provider}` };
  }
  const trimmed = apiKey.trim();
  if (trimmed.length < 16) {
    return { success: false, error: "API key is too short — please check and try again" };
  }

  const validation = await validateKeyWithProvider(provider as ByokProvider, trimmed);
  if (!validation.valid) {
    return { success: false, error: validation.error ?? "Key validation failed" };
  }

  const encryptedKey = obfuscate(trimmed);
  const maskedKey = maskKey(trimmed);
  const now = new Date().toISOString();

  const existing = await supaFetch(
    `/user_api_keys?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${provider}&limit=1`
  );

  if (existing.length) {
    await supaFetch(`/user_api_keys?id=eq.${existing[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({
        encrypted_key: encryptedKey,
        masked_key: maskedKey,
        is_valid: true,
        validated_at: now,
        updated_at: now,
      }),
    });
  } else {
    await supaFetch(`/user_api_keys`, {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        provider,
        encrypted_key: encryptedKey,
        masked_key: maskedKey,
        is_valid: true,
        validated_at: now,
      }),
    });
  }

  return { success: true, maskedKey };
}

export async function deleteKey(userId: string, provider: string): Promise<{ success: boolean }> {
  await supaFetch(`/user_api_keys?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${provider}`, {
    method: "DELETE",
  });
  return { success: true };
}

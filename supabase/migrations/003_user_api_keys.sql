-- BYOK (Bring Your Own Key) — per-user AI provider API keys
-- Ported from codeforge-v2 (Convex) to autonomous-coder (Supabase/Postgres)

CREATE TABLE IF NOT EXISTS user_api_keys (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'deepseek' | 'kilo' | 'groq' | 'gemini' | 'cerebras' | 'github' | 'cohere'
  encrypted_key TEXT NOT NULL,
  masked_key TEXT NOT NULL,
  is_valid BOOLEAN DEFAULT true,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS user_api_keys_user_idx ON user_api_keys(user_id);

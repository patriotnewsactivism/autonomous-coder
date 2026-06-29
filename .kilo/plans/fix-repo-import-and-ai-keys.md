# Fix: Repo Import + AI Provider Fallback Debugging

## Problem Summary

**Symptom:** On the Fix Code screen (Index) and other screens, repo import says "api key is no good" even though the user has several free model API keys configured.

## Root Causes Identified (2 distinct bugs)

### Bug 1: GitHubConnect always requires a GitHub token
- **File:** `server/routes.ts:712-736` (`/api/github/repos`)
- **Issue:** The endpoint REQUIRES `token` in the request body. Without it, returns 400. If a bad token is sent, returns 401 with "Invalid GitHub token".
- **Impact:** The "Fix Code" screen (Index page) uses `GitHubConnect` which sends a token to this endpoint. Public repos should work without a token.
- **Contrast:** The `RepoImport` component (VibeCoding page) uses `/api/github/import` which correctly makes token optional and works for public repos without one.

### Bug 2: "Invalid API key" error is unhelpful when no AI providers are configured
- **File:** `server/routes.ts:412-446` (`callAI` function) and `server/providers.ts`
- **Issue:** When NO AI API keys are set in `.env`, `getDefaultModel()` returns `"deepseek-chat"` as hardcoded fallback. The call then fails with 401, and the error message is `"Invalid API key."` — but it doesn't tell the user WHICH key they need to set, or that multiple free options exist.
- **Impact:** The user has "several free models" they believe are configured, but they may not have the right env var names set, or the keys may be invalid silently.

## Plan

### Phase 1: Fix GitHub token requirement for public repos

1. **`server/routes.ts` — `/api/github/repos` (line 712-736)**
   - Don't require `token` — if no token, still call GitHub API (public repos are accessible unauthenticated)
   - GitHub API has stricter rate limits without auth (60 req/hr) but that's fine for browsing
   - If 401 comes back from GitHub AND a token was provided, show "Invalid GitHub token"
   - If 401 comes back from GitHub WITHOUT a token, show "This repo may be private — add a GitHub token"

2. **`src/components/GitHubConnect.tsx`**
   - Make the token input clearly optional
   - Add a "Skip — browse public repos" option
   - Show the GitHub API error message verbatim to the user (not a generic toast)

### Phase 2: Better AI provider error messages and diagnostics

3. **`server/routes.ts` — `callAI` function**
   - When ALL providers fail, instead of "Invalid API key.", return:
     - Which providers were tried and why they failed
     - A list of env vars the user can set to enable free providers
   - Example error: `"No AI providers are configured. Set one of: GEMINI_API_KEY (free), GROQ_API_KEY (free), CEREBRAS_API_KEY (free), GITHUB_TOKEN (free), COHERE_API_KEY (free)"`

4. **New endpoint: `GET /api/providers/status`**
   - Returns which providers are active, which models are available, and which env vars are set/missing
   - Helps the user debug their configuration without digging through server logs

5. **`src/lib/agents.ts` or new utility**
   - Add a `fetchProviderStatus()` call that the UI can use to show a warning banner when no AI providers are configured
   - Show on the Index page and VibeCoding page

### Phase 3: Fix hardcoded default fallback

6. **`server/providers.ts` — `getDefaultModel()`**
   - If NO providers are active, return `null` or throw early with "No AI providers configured"
   - Don't hardcode `"deepseek-chat"` as the fallback — it creates a misleading error

### Phase 4: Test and verify

7. **Manual test checklist:**
   - Public repo import without token → works (via `/api/github/import` already works; fix `/api/github/repos`)
   - Private repo import with valid token → works
   - AI analysis with zero configured providers → shows helpful error
   - AI analysis with one provider configured → uses that provider
   - AI analysis with multiple providers → uses primary, falls back on failure
   - `/api/providers/status` → returns accurate status

## Files Changed

| File | Change |
|------|--------|
| `server/routes.ts` | Make `/api/github/repos` token optional; improve `callAI` error messages; add `/api/providers/status` |
| `server/providers.ts` | Fix `getDefaultModel()` to return null when no providers active; export active provider list |
| `src/components/GitHubConnect.tsx` | Make token optional; show better error messages |
| `src/lib/agents.ts` | Add `fetchProviderStatus()` helper |
| `src/pages/Index.tsx` | Add warning banner when no AI providers configured |
| `src/pages/VibeCoding.tsx` | Add warning banner when no AI providers configured |

## Free Provider Setup Guide (for user .env)

Since no API keys are configured yet, the error message in Phase 2 will include these instructions
so the user knows exactly where to get free keys:

| Provider | Free Tier | Sign-up URL | Env Var |
|----------|-----------|-------------|---------|
| Google Gemini | 1,000-1,500 req/day, 1M context | https://aistudio.google.com/apikey | `GEMINI_API_KEY` |
| Groq | 30 req/min, 1,000 req/day | https://console.groq.com/keys | `GROQ_API_KEY` |
| Cerebras | ~1M tokens/day, 30 req/min | https://cloud.cerebras.ai | `CEREBRAS_API_KEY` |
| GitHub Models | 10-15 req/min, 50-150 req/day | https://github.com/settings/tokens (classic PAT, no scopes needed) | `GITHUB_TOKEN` |
| Cohere | 1,000 calls/month trial | https://dashboard.cohere.com/api-keys | `COHERE_API_KEY` |

Note: `GITHUB_TOKEN` serves double duty — it powers both GitHub Models AI AND
the GitHub Connect/Import features for private repos.

## Risk Assessment

- **Low risk:** Changes are additive or improve error messages. No existing functionality is removed.
- **Backward compatible:** The import endpoint still accepts tokens for private repos; existing callers of `callAI` still work identically.
- **No DB changes.**

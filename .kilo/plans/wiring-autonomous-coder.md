# Plan: Wiring Autonomous Coder End-to-End

## Goal

Get every subsystem operational — vibe coding pipeline, superagent, code analysis, GitHub integration, sandbox preview, memory, and persistence. The app should respond on all three UI pages (`/`, `/vibe`, `/superagent`) with working AI calls.

---

## Completed (Session Progress)

| # | Item | Status |
|---|---|---|
| 1 | `.gitignore` created (excludes `dist/`, `node_modules/`, `.env`, IDE files, temp dirs) | ✅ |
| 2 | `tailwind.config.ts:113` — `require("tailwindcss-animate")` → ESM `import` | ✅ |
| 3 | `.env` — added `SUPABASE_URL` from existing `VITE_SUPABASE_URL` value | ✅ |
| 4 | API keys filled (DEEPSEEK_API_KEY, GROQ_API_KEY, both models) | ✅ |
| 5 | Build verified — `npm run build` passes cleanly (Vite + esbuild) | ✅ |
| 6 | All API routes verified — 20+ endpoints match between frontend and backend | ✅ |
| 7 | Server boots on port 5000, `/` returns HTML | ✅ |
| 8 | `GET /api/analyses/recent` → `[]` (MemStorage fallback, no SUPABASE_SERVICE_ROLE_KEY) | ✅ |

## Critical Blocker: `.env` Not Loaded at Runtime

### Root Cause

The project uses ESM (`"type": "module"` in `package.json`). The `dotenv` package's `config.js` uses CommonJS `require()` which fails silently in ESM mode:

```js
// node_modules/dotenv/config.js — CJS only
(function () {
  require('./lib/main').config(...) // require() is undefined in ESM
})()
```

Attempted fix `tsx --env-file=.env server/index.ts` also didn't work — models still empty.

### Fix Plan

**Option A (recommended):** Create an ESM preload script at `server/load-env.ts`:

```ts
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });
```

Then update `server/index.ts` to import it as the **very first** side-effect import:

```ts
import "./load-env.js"; // MUST be first — loads env before other modules evaluate
```

**Option B:** Use Node 22's native `--env-file` flag directly (bypass tsx):
```
node --env-file=.env --import tsx/esm server/index.ts
```

**Option C:** Drop dotenv entirely. Use Node 22's built-in `process.loadEnvFile()` if available, or pass env vars via `cross-env` in the dev script.

### Stopgap

Until fixed, the `dev` script in `package.json` has been updated to:
```
"dev": "cross-env NODE_ENV=development npx tsx --env-file=.env server/index.ts"
```
But this is unverified — testing showed models still empty. May need the preload script approach.

---

## Phase 1 — Environment & Secrets

### 1.1 `.env` Configuration

| Variable | Status | Notes |
|---|---|---|
| `DEEPSEEK_API_KEY` | ✅ Set | |
| `DEEPSEEK_MODEL` | ✅ Set | |
| `GROQ_API_KEY` | ✅ Set | |
| `GROQ_MODEL` | ✅ Set | |
| `SUPABASE_URL` | ✅ Set | Copied from VITE_SUPABASE_URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ⬜ Missing | Needed for persistent storage/memory |
| `DATABASE_URL` | ⬜ Placeholder | `postgresql://user:password@host:5432/dbname` |
| `VITE_SUPABASE_*` | ✅ Set | Client-side values present |

### 1.2 `.env` Loading Fix (see Critical Blocker above)

After fixing, verify:
```
GET /api/models → {"models":["deepseek-chat","deepseek-reasoner","llama-3.3-70b-versatile",...],...}
```

---

## Phase 2 — Database & Persistence

### 2.1 Run raw SQL migrations

Files at `supabase/migrations/`:
- `001_agent_memory.sql` — `agent_memory` + `coder_notifications` tables
- `002_storage_tables.sql` — `analysis_history` + `coder_projects` tables

Run against PostgreSQL:
```bash
psql "$DATABASE_URL" -f supabase/migrations/001_agent_memory.sql
psql "$DATABASE_URL" -f supabase/migrations/002_storage_tables.sql
```

### 2.2 Configure `SUPABASE_SERVICE_ROLE_KEY`

Without this, `server/storage.ts` falls back to `MemStorage` (ephemeral) and `server/agentMemory.ts` silently no-ops.

---

## Phase 3 — Frontend Wiring (Verified Structurally)

| Page | Component | API Endpoint | Match |
|---|---|---|---|
| `/` | `src/pages/Index.tsx` | `POST /api/analyze-code` (via `src/lib/api.ts:analyzeCode`) | ✅ |
| `/vibe` | `src/pages/VibeCoding.tsx` | `POST /api/ai-agent`, `POST /api/ai-agent/stream`, `GET /api/agent/stream/:sessionId` | ✅ |
| `/superagent` | `src/pages/Superagent.tsx` | `POST /api/superagent/task`, `GET /api/agent/stream/:sessionId` | ✅ |

---

## Phase 4 — Agent Pipeline (Code Verified)

- 13 agent system prompts in `server/routes.ts:35-385`
- Self-evaluation threshold 6, max retries 2 in `server/agentWorker.ts`
- Model fallback: DeepSeek → Groq in `server/routes.ts:403-408`
- SSE event bus (`workerBus`) is session-scoped via `sessionId` in event data

---

## Phase 5 — Known Gaps

| Gap | Status |
|---|---|
| No `.gitignore` | ✅ Fixed |
| No `.env` loading | 🔴 Critical — see blocker above |
| No auth / rate limiting | ⬜ Deferred |
| `src/lib/github.ts` dead placeholder | ⚠️ Known — real GitHub integration in `server/routes.ts:759-885` |
| `wouter` unused dependency | ⚠️ Known — benign |
| `vercel.json` partial (needs external backend) | ⚠️ Known |
| `SUPABASE_SERVICE_ROLE_KEY` missing | ⬜ User action needed |

---

## Phase 6 — Remaining Verification

After `.env` loading is fixed:

| # | Action | Expected Result |
|---|---|---|
| 1 | `GET /api/models` | Returns available models + pricing | 
| 2 | `/` — paste code, click Analyze | Issues + summary returned |
| 3 | `/vibe` — "create a counter component" | Pipeline runs, files in sandbox |
| 4 | `/vibe` — token/cost counter | Increments with each call |
| 5 | `/superagent` — "what is react" | Classified, answered directly |
| 6 | `/superagent` — "build a REST API" | Classified, spawns pipeline |
| 7 | `npm run lint && npm run build` | No new errors (302 pre-existing `no-explicit-any`) |

---

## Implementation Order (Remaining)

1. 🔴 **Fix `.env` loading** (Option A: ESM preload script)
2. Verify `GET /api/models` returns models
3. Run SQL migrations (if PostgreSQL available)
4. Set `SUPABASE_SERVICE_ROLE_KEY` (if Supabase available)
5. Verify all three UI pages with real AI calls
6. Run `npm run lint && npm run build`

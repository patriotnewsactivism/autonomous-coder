# AGENTS.md — Autonomous Coder

This file contains project-specific guidance for AI coding agents. Read this before modifying code. The project language is English, including comments, documentation, and UI copy.

## Project Overview

Autonomous Coder is an AI-powered multi-agent coding platform. It exposes a web UI where users can:

- Analyze code snippets for issues and fixes (`/`).
- Run a "vibe coding" pipeline (`/vibe`) that orchestrates specialized AI agents to plan, build, review, and fix code.
- Use a universal "Superagent" (`/superagent`) that classifies arbitrary tasks and either answers directly or spawns the multi-agent pipeline.
- Connect to GitHub repositories, browse files, and analyze pull requests.
- View a live sandbox preview of generated files as agents produce them.

The app ships 13 specialized agent roles: orchestrator, strategist, database, api, ui, builder, testing, security, performance, reviewer, fixer, refiner, and deployer.

## Technology Stack

- **Runtime / package manager**: Node.js (target Node 22 in Docker), npm.
- **Language**: TypeScript with ESM (`"type": "module"`).
- **Frontend**: React 18, Vite, React Router, TailwindCSS, shadcn/ui (Radix primitives), Framer Motion, Recharts, TanStack Query, Sonner/Toast, React Hook Form + Zod.
- **Backend**: Express 5, bundled with esbuild.
- **Database**: PostgreSQL via Supabase; Drizzle ORM (`shared/schema.ts`) and drizzle-kit for migrations. The app also uses Supabase REST API directly for storage of analyses/projects/notifications/memories.
- **AI providers**: OpenAI-compatible chat completions. DeepSeek is primary, Groq is fallback. Streaming and non-streaming APIs are supported.
- **Build tool chain**: Vite (client), esbuild (server), tsx (dev server runner).
- **Deployment**: Docker container; Railway config provided; also a `vercel.json` is present.

## Directory Layout

```
├── src/                     # React client application
│   ├── components/          # Top-level components (Header, GitHubConnect, CodeEditor, AnalysisResult, etc.)
│   ├── components/agents/   # Vibe/Superagent pipeline UI (AgentPipeline, CodeWorkspace, LivePreview, SandboxPanel, VibeInput, etc.)
│   ├── components/ui/       # shadcn/ui primitive components (Button, Dialog, etc.)
│   ├── hooks/               # React hooks (useSandbox, use-toast, use-mobile)
│   ├── lib/                 # Shared frontend utilities and API clients
│   │   ├── agents.ts        # Agent types, result types, token/cost helpers, agent API wrappers
│   │   ├── agentParallel.ts # Parallel build + SSE types/runner
│   │   ├── api.ts           # Code analysis API + simple language detection
│   │   ├── github.ts        # Placeholder for repository cloning
│   │   ├── queryClient.ts   # TanStack Query client
│   │   └── utils.ts         # Tailwind class merging (`cn`)
│   ├── pages/               # React Router pages (Index, VibeCoding, Superagent, SharedProject, NotFound)
│   ├── App.tsx              # Router + providers
│   ├── main.tsx             # React root entry
│   └── index.css            # Tailwind + CSS variables (dark theme)
├── server/                  # Express backend
│   ├── index.ts             # Express bootstrap, middleware, error handler, Vite/static setup
│   ├── routes.ts            # Core REST routes + AI provider clients + system prompts
│   ├── parallelRoutes.ts    # Parallel build, SSE stream, sandbox execute, superagent task, memory routes
│   ├── agentWorker.ts       # Individual worker job runner with self-evaluation and retry logic
│   ├── superagent.ts        # Universal task classifier and execution router
│   ├── agentMemory.ts       # Supabase-backed memory store/retrieve
│   ├── storage.ts           # IStorage abstraction (Supabase cloud or in-memory fallback)
│   └── vite.ts              # Vite dev middleware and static production serving
├── shared/                  # Code shared between client and server
│   └── schema.ts            # Drizzle ORM table definitions for analysis_history and projects
├── supabase/migrations/     # Raw SQL migration files (run these manually against Postgres)
├── drizzle.config.ts        # Drizzle Kit config (schema path: `./shared/schema.ts`)
├── tailwind.config.ts       # Tailwind + design tokens
├── vite.config.ts           # Vite config: port 5000, host 0.0.0.0, aliases `@/` and `@shared/`
├── eslint.config.js         # ESLint flat config (typescript-eslint + react-hooks + react-refresh)
├── Dockerfile               # Multi-stage build: npm install -> build -> prune -> npm start
├── railway.json             # Railway deployment metadata
└── package.json             # Scripts and dependencies
```

## Build and Run Commands

All commands are defined in `package.json`:

```bash
npm install          # install dependencies
npm run dev          # start development server (tsx + Vite middleware on port 5000)
npm run build        # build production client into dist/public and bundle server to dist/index.js
npm start            # run bundled server from dist/index.js (production, port 5000)
npm run lint         # run ESLint over the project
npm run db:push      # push Drizzle schema changes (requires DATABASE_URL)
npm run db:studio    # open Drizzle Kit studio
```

- Development uses `server/index.ts` executed by `tsx`. In development, `setupVite` attaches Vite's HMR middleware and serves `index.html` for all routes.
- Production uses `dist/index.js` and serves pre-built static assets from `dist/public`.
- The server listens on `0.0.0.0` and uses `process.env.PORT` (default `5000`).

## Environment Variables

Copy `.env.example` to `.env` and fill in values.

Required for AI features:

- `DEEPSEEK_API_KEY` — primary provider.
- `GROQ_API_KEY` — fallback provider.
- `DEEPSEEK_MODEL` / `GROQ_MODEL` — defaults are `deepseek-chat` and `llama-3.3-70b-versatile`.

Required for persistence (otherwise in-memory fallback is used):

- `DATABASE_URL` — PostgreSQL connection string (used by Drizzle Kit).
- `SUPABASE_URL` — Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — service role key for server-side storage and memory.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY` — client-side Supabase values.

Optional:

- `SLACK_NOTIFY_WEBHOOK`, `RESEND_API_KEY`, `NOTIFY_EMAIL`, `NOTIFY_TO_EMAIL` — notification channels.

## Database and Migrations

- Drizzle schema is in `shared/schema.ts` and configured in `drizzle.config.ts`.
- Raw SQL migrations live in `supabase/migrations/`:
  - `001_agent_memory.sql` — creates `agent_memory` and `coder_notifications`.
  - `002_storage_tables.sql` — creates `analysis_history` and `coder_projects`.
- The README instructs users to run these migrations against their database.
- `server/storage.ts` selects `SupabaseStorage` when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present; otherwise it falls back to `MemStorage` (ephemeral). Note that the Supabase storage layer uses the Supabase REST API directly rather than Drizzle.

## Code Style Guidelines

- Use TypeScript. Strict mode is **off** in `tsconfig.app.json` and `tsconfig.json` (`strict: false`, `noImplicitAny: false`, etc.). The server config (`tsconfig.node.json`) has `strict: true`.
- Prefer functional React components and hooks.
- Use `@/` alias for `src/` and `@shared/` for `shared/`.
- Tailwind CSS is the only styling system; dark theme is default. Use `class-variance-authority` + `tailwind-merge` via the `cn()` helper for conditional classes.
- shadcn/ui components live in `src/components/ui/` and should not be edited unless necessary; prefer composition over modification.
- UI copy and comments are in English.
- Agent prompts return JSON; helpers in `server/routes.ts` parse and sanitize that JSON.
- Avoid placeholder comments like `// TODO` in generated agent file content; the system expects complete files.

## Linting

ESLint uses the flat config in `eslint.config.js`:

- `typescript-eslint` recommended rules.
- `react-hooks` recommended rules.
- `react-refresh/only-export-components` with `allowConstantExport: true`.
- `@typescript-eslint/no-unused-vars` is turned off.

Run `npm run lint` before committing changes.

## Testing

There is **no test runner currently configured**. The project has no test scripts or test files. If you add tests, prefer Vitest + React Testing Library to match the existing stack and the agent prompt conventions.

## Architecture Notes

- The backend is a monolithic Express app. Routes are split into `routes.ts` (core AI calls, code analysis, GitHub, notifications) and `parallelRoutes.ts` (SSE streams, parallel builds, superagent tasks, sandbox, memory).
- `server/agentWorker.ts` runs a single AI agent job, performs self-evaluation, retries up to `maxRetries`, stores memory, and emits events on `workerBus`.
- `server/superagent.ts` classifies tasks into categories and complexities, then dispatches to `executeSimple`, `executeComplex`, or `executeEpic`.
- `src/hooks/useSandbox.ts` subscribes to the SSE stream and maintains generated-file state, worker status, and preview error observations.
- `server/vite.ts` bridges Vite in development and static file serving in production.

## Security Considerations

- API keys live in environment variables only. Do not commit `.env`.
- GitHub tokens are sent from the client to the server on request bodies and forwarded to GitHub API; they are not persisted.
- Supabase service role key is server-only. Client-side uses the anon/publishable key.
- The `/api/sandbox/execute` endpoint does not actually execute arbitrary code; it returns preview metadata. Live preview rendering is client-side inside an iframe.
- Agent prompts instruct models to return JSON, but the server gracefully degrades on parse failures.
- No rate-limiting or authentication middleware is currently implemented; add these before exposing the app to untrusted users.

## Deployment

- Docker: `docker build -t autonomous-coder . && docker run -p 5000:5000 --env-file .env autonomous-coder`.
- Railway: `railway.json` points to the Dockerfile and runs `npm start`.
- Vercel: `vercel.json` exists but the app is primarily designed for container deployment because it runs a persistent Express server.

## Common Agent Tasks

- Adding a new UI component: place it under `src/components/`, import via `@/components/...`, and use Tailwind classes.
- Adding a new API endpoint: add the route in `server/routes.ts` or `server/parallelRoutes.ts`, then add a corresponding helper in `src/lib/agents.ts` or `src/lib/agentParallel.ts` if the UI calls it.
- Changing database tables: update `shared/schema.ts`, run `npm run db:push`, and consider adding a raw migration in `supabase/migrations/` for production.
- Adding a new agent role: extend `AgentType` in `src/lib/agents.ts`, add a system prompt in `server/routes.ts`, and include it in execution logic where appropriate.

## Notes for AI Agents

- Always work within the repository root. Do not access files outside the working directory.
- Do not run `git commit`, `git push`, or other git mutations unless explicitly asked.
- Verify changes by running `npm run lint` and `npm run build` when you modify code.
- There is **no `.gitignore`** at the project root. Before committing, ensure `dist/`, `node_modules/`, and `.env` are excluded.
- Keep changes minimal and consistent with the existing dark-themed, Tailwind-first style.
- `wouter` is listed as a dependency but is **unused** by `src/` or `server/`; do not import it.

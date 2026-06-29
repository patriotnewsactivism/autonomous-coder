# Plan: Feature Cross-Pollination Between codeforge-v2 and autonomous-coder

## Goal
Both repos survive independently. Selectively merge the best features from each into the other, maximizing value while minimizing duplication and drift.

## Repo Profiles

| Dimension | codeforge-v2 | autonomous-coder |
|-----------|-------------|-----------------|
| Backend | Convex (serverless) | Express 5 (monolithic server) |
| React | v19 | v18 |
| Tailwind | v4 | v3 |
| Package mgr | Bun | npm |
| Linting | Biome | ESLint |
| Auth | Convex Auth (email OTP) | None |
| Editor | Monaco Editor | Simple textarea |
| Monetization | Stripe subscriptions | None |
| AI models | DeepSeek, Grok, GPT | DeepSeek, Groq, Gemini, Cerebras, Cohere, GitHub |
| Deployment | Vercel + Railway (Nixpacks) | Render + Vercel + Railway (Docker) |

---

## Phase 1: Autonomous Coder Enhancements (Pull FROM codeforge-v2)

### 1.1 Upgrade React 18 → 19
- **Impact**: High. Access to React 19 features (Server Components, improved hooks, better error handling).
- **Effort**: Medium. Breaking changes in React 19 are minimal for client components. shadcn/ui supports both.
- **Files affected**: `package.json`, all `.tsx` files (minor type updates).

### 1.2 Add Monaco Editor
- **Impact**: High. Professional code editing with syntax highlighting, autocomplete, VS Code keybindings.
- **Effort**: Low. CFV2 already has a polished `CodeEditor.tsx` with Monaco. Port directly.
- **Files to port**: `src/components/ide/CodeEditor.tsx`, `@monaco-editor/react` dep.
- **Replaces**: Current basic textarea in CodeEditor component.

### 1.3 Add Authentication (Convex Auth or JWT)
- **Impact**: Critical. No auth currently. Every deployment needs user management.
- **Effort**: High. Requires adding Convex or implementing JWT/session middleware in Express.
- **Option A**: Add Convex Auth (requires Convex project). More robust, real-time ready.
- **Option B**: Add simple JWT + bcrypt auth middleware to Express. Simpler, self-contained.

### 1.4 Add Stripe Monetization
- **Impact**: High. Enables revenue generation.
- **Effort**: Medium-High. Port the Stripe integration from CFV2 (`convex/stripe.ts`, `src/pages/PricingPage.tsx`).
- **Files to port**: Pricing page, checkout flow, webhook handler, subscription model.

### 1.5 Add Multi-Model Chat UI (Session Sidebar + Per-Message Model Switching)
- **Impact**: Medium. Better UX for AI interactions.
- **Effort**: Low-Medium. Port `SessionSidebar.tsx` and model selector from `ChatPanel.tsx`.
- **Files to port**: `src/components/ide/SessionSidebar.tsx`, model selector logic.

### 1.6 Add Panel-based Error Boundaries
- **Impact**: Medium. CFV2's `PanelErrorBoundary.tsx` prevents one panel crash from killing the whole IDE.
- **Effort**: Low. Single component port.
- **Files to port**: `src/components/ide/PanelErrorBoundary.tsx`, `src/components/ide/PanelSkeleton.tsx`.

### 1.7 Add Change History & Undo
- **Impact**: Medium. Users can roll back AI-generated changes.
- **Effort**: Medium. Port `convex/changeHistory.ts` and wire into the existing file management.
- **Files to port**: `convex/changeHistory.ts`, change history UI.

---

## Phase 2: CodeForge V2 Enhancements (Pull FROM autonomous-coder)

### 2.1 Port the 13-Agent Pipeline (Orchestrator → Strategist → Builder → Reviewer → Fixer)
- **Impact**: Highest. AC's core unique feature — the specialized multi-agent build pipeline.
- **Effort**: High. AC's agents are Express-based. Need to port to Convex actions:
  - `server/routes.ts` agent system prompts → Convex agent configs
  - `server/agentWorker.ts` with self-evaluation + retry → Convex action with streaming
  - `server/agentMemory.ts` → `convex/memory.ts` (already partially exists)
  - `server/parallelRoutes.ts` SSE streaming → Convex real-time subscriptions
- **Files to create**: `convex/orchestrator.ts`, `convex/agents/*.ts`, `convex/parallelBuild.ts`
- **Files to port**: `server/routes.ts` (system prompts section), `server/agentWorker.ts` (job runner logic)
- **Key differentiator**: AC's self-evaluating agents with retry logic + parallel agent groups.

### 2.2 Port the Superagent (Universal Task Classifier)
- **Impact**: High. Classifies arbitrary user tasks and routes to simple/complex/epic execution.
- **Effort**: Medium. `server/superagent.ts` → `convex/superagent.ts`
- **Files to port**: `server/superagent.ts` (task classification + execution router)
- **Dependency**: 2.1 (needs agent pipeline to execute complex tasks)

### 2.3 Port Multi-Provider AI Gateway
- **Impact**: High. AC supports 6 providers (DeepSeek, Groq, Gemini, Cerebras, GitHub, Cohere) with auto-fallback.
- **Effort**: Low-Medium. Port `server/providers.ts` and wire into CFV2's chat/agent systems.
- **Files to port**: `server/providers.ts` (provider configs, request builders, response parsers, fallback chain)
- **CFV2 currently**: Only 3 models, hardcoded in `convex/chat.ts`.

### 2.4 Port Notification System (Slack + Email via Resend)
- **Impact**: Medium. Agents can notify users when they need decisions.
- **Effort**: Low. Port notification logic from `server/routes.ts` (lines 1074-1236).
- **Files to create**: `convex/notifications.ts`

### 2.5 Port Rate Limiting
- **Impact**: Medium. Protect AI endpoints from abuse.
- **Effort**: Low. Port `express-rate-limit` config to Convex HTTP route middleware.
- **Files to port**: Rate limit config from `server/index.ts` (lines 15-38).

---

## Phase 3: Shared Infrastructure (Both Repos)

### 3.1 Create a Shared AI Providers Package
- **Impact**: High. Eliminates duplicate provider configs, model definitions, pricing, and fallback logic.
- **Effort**: Medium. Extract `server/providers.ts` into a standalone npm package or git submodule.
- **Package**: `@patriotnewsactivism/ai-providers` (or similar)
- **Contents**: Provider configs, OpenAI-compatible request builders, response parsers, streaming parsers, fallback chain, pricing calculator, model registry.

### 3.2 Create a Shared shadcn/ui Custom Component Library
- **Impact**: Medium. Both projects have custom shadcn extensions (AgentPipeline, CodeWorkspace, SandboxPanel, etc.).
- **Effort**: Medium. Extract shared custom components, handle Tailwind v3 vs v4 compatibility.
- **Components to share**: Agent-related UI (thinking stream, agent status, pipeline progress), sandbox panels, file trees.

### 3.3 Unify Deployment Strategy
- **Impact**: Low-Medium. Both projects deploy to Vercel + Railway. Consolidate configs.
- **Effort**: Low. Align `vercel.json`, `railway.json`, and `render.yaml` patterns.

---

## Phase 4: Future-Proofing (Longer Term)

### 4.1 React 19 + Tailwind v4 for Both
- Once AC upgrades to React 19 and Tailwind v4, component sharing becomes seamless.

### 4.2 Unified Agent System
- Both projects have agent systems. Consider converging on a shared agent framework:
  - AC: specialized role-based agents (orchestrator, strategist, builder, reviewer, fixer)
  - CFV2: role-based agents (UI, Logic, Debug, Feature) with tool calling
  - Shared: agent definitions, system prompts, evaluation logic, memory patterns

### 4.3 Cross-Repo GitHub Actions
- CI that tests both repos together when shared package changes.

---

## Recommended Priority Order

### Immediate (this week):
1. **AC ← CFV2**: Monaco Editor (low effort, high impact)
2. **AC ← CFV2**: Panel Error Boundaries (low effort, medium impact)
3. **CFV2 ← AC**: Multi-Provider AI Gateway (low effort, high impact)

### Short-term (1-2 weeks):
4. **CFV2 ← AC**: 13-Agent Pipeline + Superagent (high effort, highest impact)
5. **AC ← CFV2**: Authentication (high effort, critical)
6. **Shared**: AI Providers package (medium effort, high impact)

### Medium-term (2-4 weeks):
7. **AC ← CFV2**: Stripe Monetization (medium effort, high impact)
8. **CFV2 ← AC**: Notification System (low effort, medium impact)
9. **AC ← CFV2**: Multi-Model Chat UI (low effort, medium impact)

### Long-term (1-2 months):
10. **Both**: React 19 + Tailwind v4 alignment
11. **Both**: Unified agent system
12. **Both**: Cross-repo CI

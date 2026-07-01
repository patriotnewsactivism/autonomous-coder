# AI Employee — build plan (separate from Superagent)

## Split
- **Superagent** (existing, real, keep as-is): one-shot task router wired only into
  VibeCoding's task box. Coding/build-flavored. No changes needed.
- **AI Employee** (new): recurring + event-triggered background work. "Set it and
  forget it." Runs without a human re-prompting. New subsystem — nothing to repurpose
  besides the dead `employeeAgent.ts` classifier prompts (can reuse those prompts only).

## Schema (new tables, Drizzle — mirrors shared_schema_full.ts patterns)
```
employee_jobs
  id, name, description, goal (text — what to do each run)
  trigger_type: "schedule" | "webhook"
  schedule_cron (nullable)         -- for trigger_type=schedule
  integration_type (nullable)      -- github | slack | email | none
  webhook_event (nullable)         -- e.g. "issues.opened", "pull_request.opened"
  repo_or_channel (nullable)       -- scoping filter, e.g. "owner/repo" or "#channel"
  model, is_active, last_run_at, next_run_at, created_at

employee_job_runs
  id, job_id, started_at, finished_at
  status: "running" | "success" | "failed"
  output (json), error (text)
```

## Endpoints
- `POST /api/employee/jobs` — create (schedule or webhook job)
- `GET /api/employee/jobs` — list + status
- `PATCH /api/employee/jobs/:id` — pause/resume/edit
- `DELETE /api/employee/jobs/:id`
- `GET /api/employee/jobs/:id/runs` — history
- `POST /api/webhooks/github` — receiver; matches active webhook jobs by repo+event, runs them
- `POST /api/webhooks/slack` — receiver (Slack Events API); matches jobs by channel/mention

## Runner
- Reuses existing real pieces — no new AI logic needed:
  - `callAI` (aiCore.ts) to execute the job's goal with trigger payload as context
  - `storeMemory`/`retrieveMemory` (agentMemory.ts) so recurring jobs learn across runs
  - existing GitHub push/comment calls, new minimal Slack `chat.postMessage` call
- A lightweight poller (setInterval, e.g. every 60s) checks `next_run_at <= now` for
  schedule-type jobs and fires them — no need for a heavy cron library.

## Phased rollout (build in this order, test each before moving on)
1. **Schedule-only jobs** — cron table + poller + runner using `callAI`. Lowest risk.
   Example: "every morning at 8am, summarize open GitHub issues and post to Slack."
2. **GitHub webhook receiver** — trigger on issue/PR events (auto-triage, auto-comment).
3. **Slack webhook receiver** — respond to mentions, post scheduled digests.
4. **UI** — new "AI Employee" page (separate from VibeCoding) listing jobs + run
   history + active/paused toggle. Not folded into the coding UI.

## Integrations, priority order
1. GitHub (already have a working token/OAuth path from existing GitHub integration)
2. Slack (needs new OAuth + bot token)
3. Email (defer — no email sending wired into this repo yet)

## Not doing yet
- No visual workflow builder — jobs are defined by a goal string + trigger, same
  pattern as Superagent tasks, just recurring/event-driven instead of one-shot.

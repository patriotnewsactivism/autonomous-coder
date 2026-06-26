# Autonomous Coder

AI-powered multi-agent coding platform with 13 specialized agents for autonomous software development.

## Agents

| Agent | Role |
|-------|------|
| **Orchestrator** | Coordinates the pipeline, delegates tasks |
| **Strategist** | Plans architecture and approach |
| **Database** | Designs schemas, writes migrations |
| **API** | Builds endpoints and integrations |
| **UI** | Creates frontend components and layouts |
| **Builder** | Implements core logic and features |
| **Testing** | Writes and runs test suites |
| **Security** | Audits for vulnerabilities |
| **Performance** | Optimizes speed and resource usage |
| **Reviewer** | Code review and quality checks |
| **Fixer** | Resolves bugs and issues |
| **Refiner** | Polishes code style and readability |
| **Deployer** | Handles build and deployment |

## Stack

- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js + Drizzle ORM + PostgreSQL (Supabase)
- **AI**: DeepSeek (primary) + Groq (fallback) — both OpenAI-compatible
- **Features**: Streaming responses, code workspace, live preview, GitHub integration, project history, token tracking

## Setup

```bash
npm install
```

Create a `.env` file:

```env
# AI Providers
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_MODEL=deepseek-chat
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile

# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
VITE_SUPABASE_PROJECT_ID=your_project_id
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
VITE_SUPABASE_URL=https://your-project.supabase.co
```

Run the SQL migrations in `supabase/migrations/` against your database to create the required tables.

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

Server runs on port 5000.

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
- **Backend**: Express.js + Drizzle ORM + PostgreSQL
- **AI**: Azure OpenAI (gpt-5-mini)
- **Features**: Streaming responses, code workspace, live preview, GitHub integration, project history, token tracking

## Setup

```bash
npm install
```

Create a `.env` file:

```env
AZURE_OPENAI_API_KEY=your_azure_openai_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-5-mini
AZURE_OPENAI_API_VERSION=2024-02-01
DATABASE_URL=postgresql://...
```

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

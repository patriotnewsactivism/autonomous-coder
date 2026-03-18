# Autonomous Code Wizard

## Overview
An AI-powered code analysis and autonomous coding tool that helps developers analyze code for issues, identify bugs, and receive actionable fixes. Originally built with Lovable/Supabase, now migrated to Replit with Express backend.

## Recent Changes
- **March 2026**: 10-Feature Perfection Update
  - **Inline Code Editor**: Click any generated file to edit it directly in the workspace — textarea-based editor with Save/Cancel
  - **One-Click Deploy**: Deploy tab generates Vercel/Netlify/Docker configs; copy commands to deploy instantly
  - **Agent Memory**: Chat history persisted to localStorage — Refiner remembers previous conversations across sessions
  - **Code Diff View**: When Refiner modifies files, shows +/- diff lines of exactly what changed
  - **Voice Input**: Web Speech API mic button — speak your app idea instead of typing it
  - **Retry Failed Agents**: Error messages in Activity Feed have a Retry button to re-run that agent step
  - **Shareable Project Links**: Every build gets a /project/:id URL that shows code + live preview publicly
  - **Token & Cost Display**: Live token counter + estimated $ cost (GPT-4o pricing) resets each build
  - **File Tree View**: Toggle between accordion and directory-grouped file tree in code workspace
  - **Better Live Preview**: Loading spinner while Babel compiles + iframe onLoad state management

- **March 2026**: Autonomous Build Upgrade + UI Overhaul
  - **Dynamic Orchestration**: Orchestrator dynamically assembles a pipeline of up to 11 agents (Database, API, UI, Builder, Testing, Security, Deployer, Reviewer, Fixer) based on the project's needs
  - **Live Code Preview**: Sandboxed iframe preview using CDN React/Babel/Tailwind with desktop/tablet/mobile viewport switching and open-in-new-tab support
  - **Syntax Highlighting**: Built-in keyword/string/comment highlighting for TS/TSX/JS/JSX files with on/off toggle
  - **8 Project Templates**: One-click templates for E-commerce, Dashboard, Kanban, Landing Page, Chat, Social Feed, Auth, and Blog
  - **Project History Tab**: Builds saved to PostgreSQL, load any previous project to continue working
  - **3-Tab UI**: Vibe Build / GitHub / History tabs with project count badge
  - **Agent Progress Streaming**: All agents stream responses token-by-token via SSE. Activity feed shows live typing animation
  - **Chat-style Iteration**: After code generation, users can chat with the Refiner agent to modify code
  - **Export as ZIP**: Export all generated files as a proper ZIP archive preserving directory structure (uses jszip)
  - **GitHub Integration**: Connect with a Personal Access Token to browse repos, load codebases into workspace, and review Pull Requests with AI

- **January 2026**: Mobile Responsive UI Update
  - Made entire app fully mobile responsive with hamburger menu navigation
  - Responsive hero sections, feature cards, and content grids
  - Mobile-optimized agent pipeline with compact horizontal scroll
  - Enhanced code workspace with download functionality
  - Improved touch-friendly inputs and buttons for mobile devices

- **January 2026**: Migrated from Lovable/Supabase to Replit environment
  - Replaced Supabase Edge Functions with Express server routes
  - Updated frontend API calls to use local endpoints
  - Configured for Replit's port 5000 with proper CORS and host settings
  - Added OpenAI API integration for code analysis

## User Preferences
- Uses React with TypeScript
- Tailwind CSS for styling
- Shadcn/ui component library
- Prefers dark theme

## Project Architecture

### Frontend (src/)
- **Framework**: React 18 with TypeScript
- **Routing**: react-router-dom (can migrate to wouter)
- **State Management**: TanStack Query for server state
- **UI Components**: Shadcn/ui (Radix primitives + Tailwind)
- **Styling**: Tailwind CSS with custom animations

### Backend (server/)
- **Framework**: Express 5
- **Language**: TypeScript (via tsx)
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: OpenAI API (GPT-4o) with streaming support

### Key Files
- `server/index.ts` - Express server entry point
- `server/routes.ts` - API routes including /api/analyze-code, /api/ai-agent, /api/ai-agent/stream, and /api/github/* routes
- `server/storage.ts` - In-memory storage implementation
- `server/vite.ts` - Vite middleware for development
- `shared/schema.ts` - Drizzle database schema
- `src/lib/api.ts` - Frontend API utilities for code analysis
- `src/lib/agents.ts` - AI agent orchestration utilities with streaming support
- `src/components/agents/ChatIteration.tsx` - Chat interface for refining generated code
- `src/components/GitHubConnect.tsx` - GitHub integration UI

### API Endpoints
- `POST /api/analyze-code` - Analyze code for issues and suggest fixes
- `POST /api/ai-agent` - Run AI agents (orchestrator, strategist, builder, reviewer, fixer, refiner)
- `POST /api/ai-agent/stream` - Streaming SSE endpoint for real-time agent token output
- `GET /api/analyses/recent` - Get recent analysis history
- `POST /api/github/repos` - Fetch user repos from GitHub
- `POST /api/github/repo-files` - Fetch file tree for a repo
- `POST /api/github/file-content` - Fetch individual file content
- `POST /api/github/analyze-pr` - Analyze a PR with the reviewer agent

### Environment Variables Required
- `OPENAI_API_KEY` - OpenAI API key for AI features
- `DATABASE_URL` - PostgreSQL connection string (auto-provisioned by Replit)

### Running the Project
```bash
npm run dev         # Development server with hot reload
npm run build       # Build for production
npm run start       # Run production build
npm run db:push     # Push schema changes to database
```

## Features
1. **Code Analysis**: Paste code and get AI-powered analysis with issue detection
2. **Vibe Coding**: Describe what you want to build and AI agents will strategize, build, review, and fix autonomously
3. **Real-time Streaming**: Watch agents generate code token-by-token with live activity feed
4. **Chat Iteration**: Refine generated code via natural language chat with the Refiner agent
5. **ZIP Export**: Export generated project as a zip file with proper directory structure
6. **GitHub Integration**: Connect to GitHub to analyze repos and review PRs with AI agents

## Structure
```
├── src/                    # Frontend React application
│   ├── components/         # React components
│   │   ├── agents/         # Vibe coding agent components
│   │   │   ├── AgentActivityFeed.tsx  # Real-time streaming activity feed
│   │   │   ├── AgentAvatar.tsx        # Agent avatar with refiner support
│   │   │   ├── AgentPipeline.tsx      # Pipeline visualization
│   │   │   ├── ChatIteration.tsx      # Chat-based code refinement
│   │   │   ├── CodeWorkspace.tsx      # File viewer with ZIP export
│   │   │   ├── TaskList.tsx           # Task progress list
│   │   │   └── VibeInput.tsx          # Goal input component
│   │   ├── GitHubConnect.tsx          # GitHub integration UI
│   │   └── ui/                        # Shadcn UI components
│   ├── lib/                # Utilities and API functions
│   │   ├── agents.ts       # Agent orchestration with streaming support
│   │   └── api.ts          # General API utilities
│   ├── pages/              # Page components
│   └── hooks/              # Custom React hooks
├── server/                 # Express backend
│   ├── index.ts            # Server entry point
│   ├── routes.ts           # API routes
│   ├── storage.ts          # Storage interface
│   └── vite.ts             # Vite middleware
├── shared/                 # Shared types and schemas
│   └── schema.ts           # Drizzle schema
└── public/                 # Static assets
```

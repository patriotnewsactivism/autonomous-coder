-- Storage tables used by the application
-- (agent_memory and coder_notifications are in 001_agent_memory.sql)

CREATE TABLE IF NOT EXISTS analysis_history (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  language TEXT,
  summary TEXT,
  issue_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coder_projects (
  id SERIAL PRIMARY KEY,
  goal TEXT NOT NULL,
  files JSONB NOT NULL DEFAULT '[]',
  agent_sequence JSONB DEFAULT '[]',
  file_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost_usd FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coder_projects_updated_idx ON coder_projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS analysis_history_created_idx ON analysis_history(created_at DESC);

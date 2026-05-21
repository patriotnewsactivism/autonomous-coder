-- Agent memory table for persistent AI knowledge graph
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('decision', 'pattern', 'failure', 'success', 'context')),
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  score FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_memory_session_idx ON agent_memory(session_id);
CREATE INDEX IF NOT EXISTS agent_memory_score_idx ON agent_memory(score DESC);
CREATE INDEX IF NOT EXISTS agent_memory_agent_idx ON agent_memory(agent);

-- Notifications table (if not exists)
CREATE TABLE IF NOT EXISTS coder_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id INTEGER,
  agent TEXT NOT NULL DEFAULT 'system',
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  requires_decision BOOLEAN DEFAULT false,
  decision_options JSONB,
  user_response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coder_notifications_created_idx ON coder_notifications(created_at DESC);

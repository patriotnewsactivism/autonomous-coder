
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

export interface MemoryEntry {
  id?: string;
  session_id: string;
  agent: string;
  type: "decision" | "pattern" | "failure" | "success" | "context";
  content: string;
  tags: string[];
  score?: number;
  created_at?: string;
}

export interface AgentKnowledge {
  patterns: string[];
  failures: string[];
  decisions: string[];
  context: string[];
}

// Store a memory entry
export async function storeMemory(entry: MemoryEntry): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("agent_memory").insert(entry);
  } catch (e) {
    console.error("[memory] store error:", e);
  }
}

// Retrieve relevant memories for a given goal/context
export async function retrieveMemory(query: string, limit = 10): Promise<MemoryEntry[]> {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("agent_memory")
      .select("*")
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    return data || [];
  } catch (e) {
    return [];
  }
}

// Get all memories for a session
export async function getSessionMemory(session_id: string): Promise<AgentKnowledge> {
  if (!supabase) return { patterns: [], failures: [], decisions: [], context: [] };
  try {
    const { data } = await supabase
      .from("agent_memory")
      .select("*")
      .eq("session_id", session_id)
      .order("created_at", { ascending: true });

    const memories = data || [];
    return {
      patterns: memories.filter(m => m.type === "pattern").map(m => m.content),
      failures: memories.filter(m => m.type === "failure").map(m => m.content),
      decisions: memories.filter(m => m.type === "decision").map(m => m.content),
      context: memories.filter(m => m.type === "context").map(m => m.content),
    };
  } catch (e) {
    return { patterns: [], failures: [], decisions: [], context: [] };
  }
}

// Score a memory (positive = good, negative = bad)
export async function scoreMemory(id: string, delta: number): Promise<void> {
  if (!supabase) return;
  try {
    const { data } = await supabase.from("agent_memory").select("score").eq("id", id).single();
    const current = data?.score || 0;
    await supabase.from("agent_memory").update({ score: current + delta }).eq("id", id);
  } catch (e) {}
}

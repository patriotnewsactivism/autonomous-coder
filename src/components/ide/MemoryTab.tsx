/**
 * MemoryTab — persistent agent memory across sessions
 * Stores patterns, anti-patterns, lessons, skills, and retrospectives
 * Backend: /api/memory (Express + Supabase)
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, BookOpen, Brain, Bug, CheckCircle, ChevronDown, ChevronUp,
  Heart, Layers, Lightbulb, Package, RefreshCw, Sparkles, Star, Trash2, Wrench, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const API_BASE = (import.meta as any).env?.VITE_API_URL || "";

export interface AgentMemory {
  id: string;
  category: "pattern" | "anti_pattern" | "preference" | "architecture" | "dependency" | "bugfix" | "convention" | "tool" | "insight" | "skill";
  title: string;
  content: string;
  confidence: number; // 0–1
  source?: string;    // agent name that discovered it
  createdAt: number;
  approved?: boolean;
}

export interface Retrospective {
  id: string;
  goal: string;
  summary: string;
  lessonsLearned: string[];
  agentsUsed: string[];
  filesChanged: number;
  tokensUsed: number;
  success: boolean;
  createdAt: number;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pattern:      { label: "Patterns",     icon: Sparkles,      color: "text-blue-400"   },
  anti_pattern: { label: "Anti-Patterns",icon: AlertTriangle,  color: "text-red-400"    },
  preference:   { label: "Preferences",  icon: Heart,          color: "text-pink-400"   },
  architecture: { label: "Architecture", icon: Layers,         color: "text-purple-400" },
  dependency:   { label: "Dependencies", icon: Package,        color: "text-orange-400" },
  bugfix:       { label: "Bug Fixes",    icon: Bug,            color: "text-yellow-400" },
  convention:   { label: "Conventions",  icon: BookOpen,       color: "text-green-400"  },
  tool:         { label: "Tools",        icon: Wrench,         color: "text-cyan-400"   },
  insight:      { label: "Insights",     icon: Lightbulb,      color: "text-amber-400"  },
  skill:        { label: "Skills",       icon: Star,           color: "text-yellow-300" },
};

type Section = "lessons" | "skills" | "retros";

export function MemoryTab() {
  const [activeSection, setActiveSection] = useState<Section>("lessons");
  const [expandedRetro, setExpandedRetro] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: memories = [], isLoading: memoriesLoading } = useQuery<AgentMemory[]>({
    queryKey: ["/api/memory/memories"],
    queryFn: () => fetch(`${API_BASE}/api/memory/memories?limit=80`).then(r => r.ok ? r.json() : []).catch(() => []),
    refetchInterval: 30000,
  });

  const { data: retros = [], isLoading: retrosLoading } = useQuery<Retrospective[]>({
    queryKey: ["/api/memory/retros"],
    queryFn: () => fetch(`${API_BASE}/api/memory/retros?limit=20`).then(r => r.ok ? r.json() : []).catch(() => []),
    refetchInterval: 30000,
  });

  const deleteMemory = useMutation({
    mutationFn: (id: string) => fetch(`${API_BASE}/api/memory/memories/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/memory/memories"] }); toast.success("Memory deleted"); },
  });

  const approveMemory = useMutation({
    mutationFn: (id: string) => fetch(`${API_BASE}/api/memory/memories/${id}/approve`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/memory/memories"] }); toast.success("Memory approved"); },
  });

  // Group by category
  const grouped: Record<string, AgentMemory[]> = {};
  const skills: AgentMemory[] = [];
  for (const m of memories) {
    if (m.category === "skill") { skills.push(m); continue; }
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m);
  }

  const tabs: { id: Section; label: string; icon: React.ElementType; count: number }[] = [
    { id: "lessons", label: "Lessons",       icon: Brain,  count: memories.filter(m => m.category !== "skill").length },
    { id: "skills",  label: "Skills",        icon: Star,   count: skills.length },
    { id: "retros",  label: "Retrospectives",icon: RefreshCw, count: retros.length },
  ];

  return (
    <div className="h-full flex flex-col bg-[#08090f]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] shrink-0">
        <Brain className="h-4 w-4 text-violet-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex-1">Agent Memory</span>
        <span className="text-[10px] text-slate-600">{memories.length} memories</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06] shrink-0">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveSection(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium transition-colors flex-1 justify-center",
                activeSection === t.id
                  ? "text-violet-400 border-b border-violet-400 bg-violet-400/5"
                  : "text-slate-600 hover:text-slate-400",
              )}
            >
              <Icon className="h-3 w-3" />
              {t.label}
              {t.count > 0 && (
                <span className="bg-white/[0.06] text-slate-500 rounded px-1 text-[9px]">{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Lessons */}
        {activeSection === "lessons" && (
          <div className="space-y-1 p-2">
            {memoriesLoading && (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-5 w-5 text-slate-600 animate-spin" />
              </div>
            )}
            {!memoriesLoading && Object.keys(grouped).length === 0 && (
              <div className="text-center py-8">
                <Brain className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                <p className="text-[11px] text-slate-600">No lessons yet</p>
                <p className="text-[10px] text-slate-700 mt-1">Agents learn from every build and store insights here</p>
              </div>
            )}
            {Object.entries(grouped).map(([category, mems]) => {
              const meta = CATEGORY_META[category];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <div key={category} className="mb-3">
                  <div className={cn("flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider", meta.color)}>
                    <Icon className="h-3 w-3" />
                    {meta.label} ({mems.length})
                  </div>
                  {mems.map(m => (
                    <div
                      key={m.id}
                      className={cn(
                        "mx-1 mb-1 px-3 py-2 rounded bg-white/[0.02] border border-white/[0.05] group",
                        !m.approved && "border-dashed opacity-60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-slate-200 font-medium">{m.title}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{m.content}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {!m.approved && (
                            <button type="button" onClick={() => approveMemory.mutate(m.id)} title="Approve">
                              <CheckCircle className="h-3 w-3 text-green-400 hover:text-green-300" />
                            </button>
                          )}
                          <button type="button" onClick={() => deleteMemory.mutate(m.id)} title="Delete">
                            <XCircle className="h-3 w-3 text-red-400 hover:text-red-300" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {m.source && (
                          <span className="text-[9px] text-slate-600">from {m.source}</span>
                        )}
                        <div className="flex-1 h-1 bg-white/[0.05] rounded-full">
                          <div
                            className={cn("h-full rounded-full", meta.color.replace("text-", "bg-"))}
                            style={{ width: `${m.confidence * 100}%`, opacity: 0.5 }}
                          />
                        </div>
                        <span className="text-[9px] text-slate-600">{Math.round(m.confidence * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Skills */}
        {activeSection === "skills" && (
          <div className="p-2 space-y-1">
            {skills.length === 0 && (
              <div className="text-center py-8">
                <Star className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                <p className="text-[11px] text-slate-600">No skills yet</p>
                <p className="text-[10px] text-slate-700 mt-1">Skills are generalizable techniques agents master</p>
              </div>
            )}
            {skills.map(s => (
              <div key={s.id} className="px-3 py-2 rounded bg-white/[0.02] border border-yellow-400/10 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-[11px] text-yellow-300 font-medium flex items-center gap-1">
                      <Star className="h-3 w-3" />{s.title}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{s.content}</p>
                  </div>
                  <button type="button" onClick={() => deleteMemory.mutate(s.id)} className="opacity-0 group-hover:opacity-100">
                    <Trash2 className="h-3 w-3 text-slate-600 hover:text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Retrospectives */}
        {activeSection === "retros" && (
          <div className="p-2 space-y-1">
            {retrosLoading && <div className="flex justify-center py-8"><RefreshCw className="h-5 w-5 text-slate-600 animate-spin" /></div>}
            {!retrosLoading && retros.length === 0 && (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                <p className="text-[11px] text-slate-600">No retrospectives yet</p>
                <p className="text-[10px] text-slate-700 mt-1">AutoLearn generates these after every build</p>
              </div>
            )}
            {retros.map(r => (
              <div
                key={r.id}
                className={cn("rounded border bg-white/[0.02] overflow-hidden", r.success ? "border-green-500/10" : "border-red-500/10")}
              >
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedRetro(expandedRetro === r.id ? null : r.id)}
                >
                  {r.success
                    ? <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                  <span className="text-[11px] text-slate-300 flex-1 truncate">{r.goal}</span>
                  <span className="text-[9px] text-slate-600">{r.filesChanged} files</span>
                  {expandedRetro === r.id ? <ChevronUp className="h-3 w-3 text-slate-600" /> : <ChevronDown className="h-3 w-3 text-slate-600" />}
                </button>
                {expandedRetro === r.id && (
                  <div className="px-3 pb-3 space-y-2 border-t border-white/[0.04]">
                    <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">{r.summary}</p>
                    {r.lessonsLearned.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 mb-1">Lessons:</p>
                        {r.lessonsLearned.map((l, i) => (
                          <p key={i} className="text-[10px] text-slate-500 pl-2">• {l}</p>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-3 text-[9px] text-slate-600">
                      <span>Agents: {r.agentsUsed.join(", ")}</span>
                      <span>Tokens: {r.tokensUsed.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

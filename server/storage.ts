import { InsertAnalysisHistory, AnalysisHistory, InsertProject, Project, InsertEmployeeTask, EmployeeTask } from "@shared/schema";

export interface IStorage {
  createAnalysisHistory(data: InsertAnalysisHistory): Promise<AnalysisHistory>;
  getRecentAnalyses(limit: number): Promise<AnalysisHistory[]>;
  createProject(data: InsertProject): Promise<Project>;
  getRecentProjects(limit: number): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined>;
  createEmployeeTask(data: InsertEmployeeTask): Promise<EmployeeTask>;
  getPendingEmployeeTasks(limit?: number): Promise<EmployeeTask[]>;
  getAllEmployeeTasks(limit?: number): Promise<EmployeeTask[]>;
  updateEmployeeTask(id: number, data: Partial<InsertEmployeeTask>): Promise<EmployeeTask | undefined>;
}

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function supaHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function supaFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: { ...supaHeaders(), ...options?.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Supabase error (${res.status}): ${text}`);
    throw new Error(`Supabase error: ${res.status}`);
  }
  const data = await res.json();
  return data;
}

// ── Supabase-backed storage ────────────────────────────────────────────────
export class SupabaseStorage implements IStorage {
  async createAnalysisHistory(data: InsertAnalysisHistory): Promise<AnalysisHistory> {
    const rows = await supaFetch("/analysis_history", {
      method: "POST",
      body: JSON.stringify({
        code: data.code,
        language: data.language || null,
        summary: data.summary || null,
        issue_count: data.issueCount || 0,
      }),
    });
    return this.mapAnalysis(rows[0]);
  }

  async getRecentAnalyses(limit: number): Promise<AnalysisHistory[]> {
    const rows = await supaFetch(`/analysis_history?order=created_at.desc&limit=${limit}`);
    return rows.map((r: any) => this.mapAnalysis(r));
  }

  async createProject(data: InsertProject): Promise<Project> {
    const rows = await supaFetch("/coder_projects", {
      method: "POST",
      body: JSON.stringify({
        goal: data.goal,
        files: typeof data.files === "string" ? JSON.parse(data.files) : data.files,
        agent_sequence: data.agentSequence
          ? typeof data.agentSequence === "string" ? JSON.parse(data.agentSequence) : data.agentSequence
          : [],
        total_tokens: 0,
        total_cost_usd: 0,
      }),
    });
    return this.mapProject(rows[0]);
  }

  async getRecentProjects(limit: number): Promise<Project[]> {
    const rows = await supaFetch(`/coder_projects?order=updated_at.desc&limit=${limit}`);
    return rows.map((r: any) => this.mapProject(r));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const rows = await supaFetch(`/coder_projects?id=eq.${id}`);
    return rows[0] ? this.mapProject(rows[0]) : undefined;
  }

  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> {
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.goal !== undefined) update.goal = data.goal;
    if (data.files !== undefined) update.files = typeof data.files === "string" ? JSON.parse(data.files) : data.files;
    if (data.agentSequence !== undefined) update.agent_sequence = typeof data.agentSequence === "string" ? JSON.parse(data.agentSequence) : data.agentSequence;
    if (data.fileCount !== undefined) update.file_count = data.fileCount;
    const rows = await supaFetch(`/coder_projects?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    });
    return rows[0] ? this.mapProject(rows[0]) : undefined;
  }

  async createEmployeeTask(data: InsertEmployeeTask): Promise<EmployeeTask> {
    const rows = await supaFetch("/employee_tasks", {
      method: "POST",
      body: JSON.stringify({
        source: data.source,
        source_id: data.sourceId,
        goal: data.goal,
        status: data.status || "pending",
      }),
    });
    return this.mapEmployeeTask(rows[0]);
  }

  async getPendingEmployeeTasks(limit: number = 10): Promise<EmployeeTask[]> {
    const rows = await supaFetch(`/employee_tasks?status=eq.pending&order=created_at.asc&limit=${limit}`);
    return rows.map((r: any) => this.mapEmployeeTask(r));
  }

  async getAllEmployeeTasks(limit: number = 50): Promise<EmployeeTask[]> {
    const rows = await supaFetch(`/employee_tasks?order=created_at.desc&limit=${limit}`);
    return rows.map((r: any) => this.mapEmployeeTask(r));
  }

  async updateEmployeeTask(id: number, data: Partial<InsertEmployeeTask>): Promise<EmployeeTask | undefined> {
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.status !== undefined) update.status = data.status;
    if (data.result !== undefined) update.result = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
    
    const rows = await supaFetch(`/employee_tasks?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    });
    return rows[0] ? this.mapEmployeeTask(rows[0]) : undefined;
  }

  private mapAnalysis(r: any): AnalysisHistory {
    return { id: r.id, code: r.code, language: r.language, summary: r.summary, issueCount: r.issue_count, createdAt: new Date(r.created_at) };
  }

  private mapProject(r: any): Project {
    return {
      id: r.id,
      goal: r.goal,
      files: typeof r.files === "string" ? r.files : JSON.stringify(r.files),
      agentSequence: typeof r.agent_sequence === "string" ? r.agent_sequence : JSON.stringify(r.agent_sequence || []),
      fileCount: r.file_count || (Array.isArray(r.files) ? r.files.length : 0),
      createdAt: new Date(r.created_at || r.updated_at),
    };
  }

  private mapEmployeeTask(r: any): EmployeeTask {
    return {
      id: r.id,
      source: r.source,
      sourceId: r.source_id,
      goal: r.goal,
      status: r.status,
      result: typeof r.result === "string" ? r.result : JSON.stringify(r.result || null),
      createdAt: new Date(r.created_at || r.updated_at),
      updatedAt: new Date(r.updated_at || r.created_at),
    };
  }
}

// ── Fallback in-memory storage (if no Supabase configured) ─────────────────
export class MemStorage implements IStorage {
  private analyses: Map<number, AnalysisHistory> = new Map();
  private analysisId = 1;
  private projectsMap: Map<number, Project> = new Map();
  private projectId = 1;

  async createAnalysisHistory(data: InsertAnalysisHistory): Promise<AnalysisHistory> {
    const id = this.analysisId++;
    const analysis: AnalysisHistory = { id, ...data, createdAt: new Date() };
    this.analyses.set(id, analysis);
    return analysis;
  }
  async getRecentAnalyses(limit: number): Promise<AnalysisHistory[]> {
    return Array.from(this.analyses.values()).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)).slice(0, limit);
  }
  async createProject(data: InsertProject): Promise<Project> {
    const id = this.projectId++;
    const project: Project = { id, ...data, createdAt: new Date() };
    this.projectsMap.set(id, project);
    return project;
  }
  async getRecentProjects(limit: number): Promise<Project[]> {
    return Array.from(this.projectsMap.values()).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)).slice(0, limit);
  }
  async getProject(id: number): Promise<Project | undefined> { return this.projectsMap.get(id); }
  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> {
    const existing = this.projectsMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, createdAt: existing.createdAt };
    this.projectsMap.set(id, updated);
    return updated;
  }

  private employeeTasksMap: Map<number, EmployeeTask> = new Map();
  private employeeTaskId = 1;

  async createEmployeeTask(data: InsertEmployeeTask): Promise<EmployeeTask> {
    const id = this.employeeTaskId++;
    const task: EmployeeTask = { 
      id, 
      sourceId: data.sourceId || null, 
      result: null, 
      ...data, 
      status: data.status || "pending", 
      createdAt: new Date(), 
      updatedAt: new Date() 
    };
    this.employeeTasksMap.set(id, task);
    return task;
  }
  
  async getPendingEmployeeTasks(limit: number = 10): Promise<EmployeeTask[]> {
    return Array.from(this.employeeTasksMap.values())
      .filter(t => t.status === "pending")
      .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0))
      .slice(0, limit);
  }

  async getAllEmployeeTasks(limit: number = 50): Promise<EmployeeTask[]> {
    return Array.from(this.employeeTasksMap.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }
  
  async updateEmployeeTask(id: number, data: Partial<InsertEmployeeTask>): Promise<EmployeeTask | undefined> {
    const existing = this.employeeTasksMap.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, updatedAt: new Date() } as EmployeeTask;
    this.employeeTasksMap.set(id, updated);
    return updated;
  }
}

// Auto-select: Supabase if configured, else in-memory
export const storage: IStorage = SUPABASE_URL && SUPABASE_KEY
  ? new SupabaseStorage()
  : new MemStorage();

console.log(`[storage] Using ${SUPABASE_URL && SUPABASE_KEY ? "Supabase cloud" : "in-memory"} storage`);

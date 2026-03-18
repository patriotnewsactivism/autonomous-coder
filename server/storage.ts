import { analysisHistory, InsertAnalysisHistory, AnalysisHistory, projects, InsertProject, Project } from "@shared/schema";

export interface IStorage {
  createAnalysisHistory(data: InsertAnalysisHistory): Promise<AnalysisHistory>;
  getRecentAnalyses(limit: number): Promise<AnalysisHistory[]>;
  createProject(data: InsertProject): Promise<Project>;
  getRecentProjects(limit: number): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
}

export class MemStorage implements IStorage {
  private analyses: Map<number, AnalysisHistory>;
  private analysisId: number;
  private projectsMap: Map<number, Project>;
  private projectId: number;

  constructor() {
    this.analyses = new Map();
    this.analysisId = 1;
    this.projectsMap = new Map();
    this.projectId = 1;
  }

  async createAnalysisHistory(data: InsertAnalysisHistory): Promise<AnalysisHistory> {
    const id = this.analysisId++;
    const analysis: AnalysisHistory = { id, ...data, createdAt: new Date() };
    this.analyses.set(id, analysis);
    return analysis;
  }

  async getRecentAnalyses(limit: number): Promise<AnalysisHistory[]> {
    return Array.from(this.analyses.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }

  async createProject(data: InsertProject): Promise<Project> {
    const id = this.projectId++;
    const project: Project = { id, ...data, createdAt: new Date() };
    this.projectsMap.set(id, project);
    return project;
  }

  async getRecentProjects(limit: number): Promise<Project[]> {
    return Array.from(this.projectsMap.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }

  async getProject(id: number): Promise<Project | undefined> {
    return this.projectsMap.get(id);
  }
}

export const storage = new MemStorage();

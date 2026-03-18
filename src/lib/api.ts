interface Issue {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  line?: number;
  suggestion?: string;
  fixedCode?: string;
}

interface AnalysisResult {
  issues: Issue[];
  summary: string;
}

async function apiRequest(endpoint: string, options?: RequestInit) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

export async function analyzeCode(code: string, language?: string): Promise<AnalysisResult> {
  const data = await apiRequest("/api/analyze-code", {
    method: "POST",
    body: JSON.stringify({ code, language }),
  });

  if (data.error) {
    throw new Error(data.error);
  }

  return data as AnalysisResult;
}

export function detectLanguage(code: string): string {
  const lines = code.trim().split("\n");
  const firstLine = lines[0]?.toLowerCase() || "";
  const content = code.toLowerCase();

  if (content.includes("import react") || content.includes("from 'react'") || content.includes("jsx")) {
    return "TypeScript/React";
  }
  if (content.includes("interface ") || content.includes(": string") || content.includes(": number")) {
    return "TypeScript";
  }
  if (firstLine.startsWith("#!/usr/bin/python") || content.includes("def ") || content.includes("import ")) {
    if (content.includes("def ") && !content.includes("function ")) {
      return "Python";
    }
  }
  if (content.includes("func ") && content.includes("package ")) {
    return "Go";
  }
  if (content.includes("public class") || content.includes("private void")) {
    return "Java";
  }
  if (content.includes("fn ") && content.includes("let mut")) {
    return "Rust";
  }
  if (content.includes("<html") || content.includes("<!doctype")) {
    return "HTML";
  }
  if (content.includes("@media") || content.includes("color:") || content.includes("{") && content.includes(":") && content.includes(";")) {
    if (!content.includes("function") && !content.includes("const ")) {
      return "CSS";
    }
  }
  if (content.includes("function ") || content.includes("const ") || content.includes("let ") || content.includes("var ")) {
    return "JavaScript";
  }

  return "code";
}

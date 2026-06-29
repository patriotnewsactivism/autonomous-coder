/**
 * GitHub repository utilities — client-side helpers that call the server's
 * /api/github/* endpoints, which proxy requests to the GitHub API so tokens
 * never leave the server.
 */

export interface GitHubFile {
  path: string;
  content: string;
  size: number;
}

export interface ImportedRepo {
  fullName: string;
  name: string;
  description: string | null;
  language: string | null;
  defaultBranch: string;
  stars: number;
  totalFiles: number;
  loadedFiles: number;
  files: GitHubFile[];
}

/**
 * Import a public (or token-gated) GitHub repository's source files.
 * Calls POST /api/github/import, which fetches up to 40 code files via
 * the GitHub Contents API and returns them as structured JSON.
 *
 * @param repoUrl  Full HTTPS URL, e.g. "https://github.com/owner/repo"
 * @param token    Optional PAT for private repos
 */
export async function connectToGitHub(
  repoUrl: string,
  token?: string
): Promise<ImportedRepo> {
  const response = await fetch("/api/github/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl, token }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || `GitHub import failed (${response.status})`);
  }

  return response.json() as Promise<ImportedRepo>;
}

/**
 * List repositories for the authenticated GitHub user.
 */
export async function listUserRepos(token: string) {
  const response = await fetch("/api/github/repos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) throw new Error("Failed to list repositories");
  return response.json();
}

/**
 * Fetch the file tree for a specific repo + branch.
 */
export async function getRepoFiles(token: string, fullName: string, branch = "main") {
  const response = await fetch("/api/github/repo-files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, fullName, branch }),
  });
  if (!response.ok) throw new Error("Failed to fetch repository files");
  return response.json();
}

/**
 * Fetch the raw content of a single file from a repo.
 */
export async function getFileContent(
  token: string,
  fullName: string,
  filePath: string,
  branch = "main"
): Promise<{ path: string; content: string }> {
  const response = await fetch("/api/github/file-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, fullName, filePath, branch }),
  });
  if (!response.ok) throw new Error(`Failed to fetch ${filePath}`);
  return response.json();
}

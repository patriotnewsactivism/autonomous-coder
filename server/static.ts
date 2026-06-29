import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export function serveStatic(app: Express) {
  // Try dist/public first (production build), then dist (fallback)
  const candidates = [
    path.resolve(__dirname, "..", "dist", "public"),
    path.resolve(__dirname, "..", "dist"),
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(process.cwd(), "dist"),
  ];

  const distPath = candidates.find(p => fs.existsSync(p) && fs.existsSync(path.join(p, "index.html")));

  if (!distPath) {
    log(`⚠️  No frontend build found. Checked: ${candidates.join(", ")}. Running in API-only mode.`);
    app.get("/", (_req, res) => res.json({ status: "api-only", message: "Frontend not built. See /api/health." }));
    return;
  }

  log(`Serving frontend from: ${distPath}`);
  app.use(express.static(distPath));

  // SPA fallback — all non-API routes serve index.html
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

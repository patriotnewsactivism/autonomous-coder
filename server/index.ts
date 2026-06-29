import "./load-env.js";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { registerParallelRoutes } from "./parallelRoutes";
import { serveStatic, log } from "./static";

const app = express();

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(cors());

// ── Rate limiting ──────────────────────────────────────────────────────────────
// AI routes are expensive — cap to 30 req/min per IP
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please wait before sending more." },
  skip: (req) => req.path.startsWith("/api/agent/stream"), // SSE keeps-alive don't count
});

// General API — 200 req/min per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests." },
  skip: (req) => req.path === "/api/providers/status" || req.path === "/api/health",
});

app.use("/api/analyze", aiLimiter);
app.use("/api/agent", aiLimiter);
app.use("/api/superagent", aiLimiter);
app.use("/api/sandbox", aiLimiter);
app.use("/api/github", generalLimiter);
app.use("/api", generalLimiter);

// ── Optional API-key auth ──────────────────────────────────────────────────────
// Activate by setting AUTH_REQUIRED=true and API_SECRET_KEY=<your-key> in .env.
// Clients must send: Authorization: Bearer <key>  -or-  X-API-Key: <key>
if (process.env.AUTH_REQUIRED === "true") {
  const SECRET = process.env.API_SECRET_KEY || "";
  if (!SECRET) {
    console.error("[auth] AUTH_REQUIRED is true but API_SECRET_KEY is not set — refusing to start.");
    process.exit(1);
  }

  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    // Health check bypass
    if (req.path === "/health") return next();

    const authHeader = req.headers["authorization"];
    const apiKeyHeader = req.headers["x-api-key"] as string | undefined;

    const provided =
      (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined) ??
      apiKeyHeader;

    if (!provided || provided !== SECRET) {
      res.status(401).json({ error: "Unauthorized — valid API key required." });
      return;
    }
    next();
  });

  log("[auth] API key authentication enabled");
}

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false }));

// ── Request logging ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });

  next();
});

// ── Health check ───────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── App routes ─────────────────────────────────────────────────────────────────
(async () => {
  const routesModule = await import("./routes.js");
  const { registerRoutes } = routesModule;
  await registerRoutes(app);
  registerParallelRoutes(app);

  const PORT = parseInt(process.env.PORT || "5000", 10);
  const server = app.listen(PORT, "0.0.0.0", () => {
    log(`Server running on port ${PORT}`);
  });

  // ── Start background workers ───────────────────────────────────────────────────
  const { startEmployeeWorker } = await import("./employeeWorker.js");
  const { setupCronJobs } = await import("./cronJobs.js");
  startEmployeeWorker(10000); // Poll every 10 seconds
  setupCronJobs();

  if (app.get("env") === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ── Global error handler ─────────────────────────────────────────────────────
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    log(`Error: ${message}`);
    res.status(status).json({ message });
  });
})();

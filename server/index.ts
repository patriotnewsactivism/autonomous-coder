import "./load-env.js";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { registerParallelRoutes } from "./parallelRoutes";
import { serveStatic, log } from "./static";

const app = express();

// ── CORS ───────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "https://ai.donmatthews.live",
  "http://localhost:5000",
  "http://localhost:3000",
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    // Allow any origin in dev
    if (process.env.NODE_ENV !== "production") return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Rate limiting ──────────────────────────────────────────────────────────────
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many requests, please wait." },
  skip: (req) => req.path.startsWith("/api/agent/stream"),
});
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false,
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
if (process.env.AUTH_REQUIRED === "true") {
  const SECRET = process.env.API_SECRET_KEY || "";
  if (!SECRET) {
    console.error("[auth] AUTH_REQUIRED=true but API_SECRET_KEY is not set — refusing to start.");
    process.exit(1);
  }
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/health") return next();
    const authHeader = req.headers["authorization"];
    const apiKeyHeader = req.headers["x-api-key"] as string | undefined;
    const provided = (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined) ?? apiKeyHeader;
    if (!provided || provided !== SECRET) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }
    next();
  });
  log("[auth] API key authentication enabled");
}

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false }));

// ── Request logging ────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  if (!req.path.startsWith("/api/agent/stream")) {
    log(`${req.method} ${req.path}`);
  }
  next();
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

app.post("/api/client-error", (req, res) => {
  const { error, stack, componentStack } = req.body || {};
  console.error("🔴 CLIENT CRASH:", error);
  if (stack) console.error(stack);
  if (componentStack) console.error("Component stack:", componentStack?.slice(0, 500));
  res.json({ logged: true });
});

// ── Routes ────────────────────────────────────────────────────────────────────
await registerRoutes(app);
registerParallelRoutes(app);

// ── Static / SPA ──────────────────────────────────────────────────────────────
serveStatic(app);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[error]", err.message);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "10000", 10);
app.listen(PORT, "0.0.0.0", () => {
  log(`🚀 Autonomous Coder running on port ${PORT}`);
  log(`   NODE_ENV: ${process.env.NODE_ENV || "development"}`);
});

import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

// Only load .env in development — in production, env vars are injected by the platform
if (process.env.NODE_ENV !== "production") {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(__dirname, "..", ".env");
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log("[load-env] Loaded .env from", envPath);
  }
}

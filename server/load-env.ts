import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

// Always attempt to load .env — in production vars are injected by platform,
// but if a .env file exists (e.g. on Render with a secrets file), load it too.
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env");
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
  if (process.env.NODE_ENV !== "production") {
    console.log("[load-env] Loaded .env from", envPath);
  }
}

// Alias: GEMINI_API_KEY → GOOGLE_API_KEY so both names work interchangeably
if (!process.env.GOOGLE_API_KEY && process.env.GEMINI_API_KEY) {
  process.env.GOOGLE_API_KEY = process.env.GEMINI_API_KEY;
}
if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_API_KEY) {
  process.env.GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
}

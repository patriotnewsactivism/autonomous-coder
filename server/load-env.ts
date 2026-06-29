import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env");
const result = dotenv.config({ path: envPath });
console.log("[load-env] .env path:", envPath);
console.log("[load-env] parsed keys:", Object.keys(result.parsed || {}));
console.log("[load-env] DEEPSEEK_API_KEY loaded:", Boolean(process.env.DEEPSEEK_API_KEY));

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });
// Tests never call OpenAI unless explicitly opted in.
if (!process.env.LIA_TEST_USE_OPENAI) process.env.OPENAI_API_KEY = "";

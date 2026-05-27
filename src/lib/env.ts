import { z } from "zod";
import { getLocalEnv } from "@/lib/local-env";

const envSchema = z.object({
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().default("deepseek-v4-flash"),
  DEEPSEEK_HIGH_QUALITY_MODEL: z.string().default("deepseek-v4-pro"),
  SEARXNG_URL: z.string().url().default("http://localhost:8080"),
  DATABASE_URL: z.string().default("file:./data/youlong.sqlite"),
  APP_ACCESS_PASSWORD_HASH: z.string().optional(),
});

export const env = envSchema.parse({
  DEEPSEEK_API_KEY: getLocalEnv("DEEPSEEK_API_KEY"),
  DEEPSEEK_BASE_URL: getLocalEnv("DEEPSEEK_BASE_URL"),
  DEEPSEEK_MODEL: getLocalEnv("DEEPSEEK_MODEL") ?? getLocalEnv("DEEPSEEK_TEXT_MODEL"),
  DEEPSEEK_HIGH_QUALITY_MODEL: getLocalEnv("DEEPSEEK_HIGH_QUALITY_MODEL"),
  SEARXNG_URL: getLocalEnv("SEARXNG_URL"),
  DATABASE_URL: getLocalEnv("DATABASE_URL"),
  APP_ACCESS_PASSWORD_HASH: getLocalEnv("APP_ACCESS_PASSWORD_HASH"),
});

import { fail, ok } from "@/lib/api/responses";
import { env } from "@/lib/env";

export async function GET() {
  try {
    return ok({
      deepseekConfigured: Boolean(env.DEEPSEEK_API_KEY),
      deepseekModel: env.DEEPSEEK_MODEL,
      highQualityModel: env.DEEPSEEK_HIGH_QUALITY_MODEL,
      searxngUrl: env.SEARXNG_URL,
      databaseUrl: env.DATABASE_URL.replace(/[^/\\]+$/, "youlong.sqlite"),
    });
  } catch (error) {
    return fail(error);
  }
}


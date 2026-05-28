import { fail, ok } from "@/lib/api/responses";
import { getAppSettings, saveAppSettings } from "@/lib/db/queries";
import { appSettingsSchema } from "@/lib/schemas";
import { env } from "@/lib/env";

export async function GET() {
  try {
    const appSettings = getAppSettings();
    return ok({
      deepseekConfigured: Boolean(env.DEEPSEEK_API_KEY),
      deepseekModel: env.DEEPSEEK_MODEL,
      highQualityModel: env.DEEPSEEK_HIGH_QUALITY_MODEL,
      searxngUrl: env.SEARXNG_URL,
      databaseUrl: env.DATABASE_URL.replace(/[^/\\]+$/, "youlong.sqlite"),
      ...appSettings,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = appSettingsSchema.parse(await request.json());
    const saved = saveAppSettings({
      defaultEnableSearch: body.defaultEnableSearch,
      defaultQualityMode: body.defaultQualityMode,
    });
    return ok(saved);
  } catch (error) {
    return fail(error);
  }
}

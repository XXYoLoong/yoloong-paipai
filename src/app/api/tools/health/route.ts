import { access, constants } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fail, ok } from "@/lib/api/responses";
import { createSessionToken, isAuthEnabledFromHash } from "@/lib/auth-core";
import { initDb, sqlite } from "@/lib/db";
import { env } from "@/lib/env";

type HealthItem = {
  key: string;
  label: string;
  status: "ok" | "warn" | "error";
  message: string;
};

export async function GET() {
  try {
    const checks = await Promise.all([checkDeepSeek(), checkSearxng(), checkSqlite(), checkExport(), checkAuth()]);
    return ok({
      generatedAt: new Date().toISOString(),
      checks,
      summary: summarize(checks),
    });
  } catch (error) {
    return fail(error);
  }
}

async function checkDeepSeek(): Promise<HealthItem> {
  if (!env.DEEPSEEK_API_KEY) {
    return {
      key: "deepseek",
      label: "DeepSeek API",
      status: "warn",
      message: "未配置 DEEPSEEK_API_KEY，系统会使用本地基础拆解。",
    };
  }

  return {
    key: "deepseek",
    label: "DeepSeek API",
    status: "ok",
    message: `已配置模型：${env.DEEPSEEK_MODEL}；高质量模型：${env.DEEPSEEK_HIGH_QUALITY_MODEL}。`,
  };
}

async function checkSearxng(): Promise<HealthItem> {
  const url = new URL("/search", env.SEARXNG_URL);
  url.searchParams.set("q", "游龙排排 健康检查");
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "zh-CN");

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return {
        key: "searxng",
        label: "本地 SearXNG",
        status: response.status === 403 ? "error" : "warn",
        message:
          response.status === 403
            ? "SearXNG 拒绝 JSON 请求，请确认 settings.yml 启用了 json format。"
            : `SearXNG 返回 HTTP ${response.status}，联网搜索会自动降级。`,
      };
    }

    return {
      key: "searxng",
      label: "本地 SearXNG",
      status: "ok",
      message: `搜索服务可访问：${env.SEARXNG_URL}`,
    };
  } catch (error) {
    return {
      key: "searxng",
      label: "本地 SearXNG",
      status: "warn",
      message: formatSearxngError(error),
    };
  }
}

function formatSearxngError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("fetch failed") || message.includes("econnrefused") || message.includes("connect")) {
    return "本地 SearXNG 未连接。请先打开 Docker Desktop，再双击 start-youlong-paipai.bat 启动 searxng 容器（http://localhost:8080）。";
  }
  if (message.includes("timeout") || message.includes("aborted")) {
    return "SearXNG 响应超时。请确认 Docker 容器 youlong-paipai-searxng-1 正在运行。";
  }
  return error instanceof Error ? `搜索服务暂不可用：${error.message}` : "搜索服务暂不可用。";
}

async function checkSqlite(): Promise<HealthItem> {
  try {
    initDb();
    const value = sqlite.prepare("SELECT 1 AS ok").get() as { ok?: number };
    return {
      key: "sqlite",
      label: "SQLite 数据库",
      status: value.ok === 1 ? "ok" : "error",
      message: value.ok === 1 ? "数据库连接和基础查询正常。" : "数据库基础查询异常。",
    };
  } catch (error) {
    return {
      key: "sqlite",
      label: "SQLite 数据库",
      status: "error",
      message: error instanceof Error ? error.message : "数据库连接失败。",
    };
  }
}

async function checkExport(): Promise<HealthItem> {
  const databasePath = resolveSqlitePath(env.DATABASE_URL);
  const outputDir = resolve(dirname(databasePath), "..", "output");
  try {
    await access(resolve(outputDir, ".."), constants.R_OK | constants.W_OK);
    return {
      key: "export",
      label: "导出目录",
      status: "ok",
      message: "当前运行目录可读写，Markdown 导出可用。",
    };
  } catch {
    return {
      key: "export",
      label: "导出目录",
      status: "warn",
      message: "未能确认运行目录写入权限，导出前建议检查部署卷挂载。",
    };
  }
}

async function checkAuth(): Promise<HealthItem> {
  if (!isAuthEnabledFromHash(env.APP_ACCESS_PASSWORD_HASH)) {
    return {
      key: "auth",
      label: "访问密码",
      status: "warn",
      message: "未配置有效 APP_ACCESS_PASSWORD_HASH，本地开发免登录；公网部署前建议启用。",
    };
  }

  const token = await createSessionToken(env.APP_ACCESS_PASSWORD_HASH);
  return {
    key: "auth",
    label: "访问密码",
    status: token ? "ok" : "error",
    message: token ? "访问密码保护已启用。" : "访问密码配置无法生成会话令牌。",
  };
}

function summarize(checks: HealthItem[]) {
  if (checks.some((item) => item.status === "error")) {
    return "存在阻断项，请先处理错误状态。";
  }

  if (checks.some((item) => item.status === "warn")) {
    return "核心功能可运行，但存在建议处理的警告项。";
  }

  return "所有关键工具状态正常。";
}

function resolveSqlitePath(databaseUrl: string) {
  return databaseUrl.startsWith("file:") ? databaseUrl.replace(/^file:/, "") : databaseUrl;
}

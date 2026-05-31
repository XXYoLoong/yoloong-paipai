import { Button } from "@/components/ui/button";
import { HeaderControls } from "@/components/system/header-controls";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { env } from "@/lib/env";
import { isAuthEnabledFromHash } from "@/lib/auth-core";
import { getAppSettings } from "@/lib/db/queries";
import { HealthCheckPanel } from "@/components/settings/health-check-panel";
import { SettingsForm } from "@/components/settings/settings-form";

export default function SettingsPage() {
  const appSettings = getAppSettings();
  const settings = [
    ["DeepSeek API", env.DEEPSEEK_API_KEY ? "已配置" : "未配置，将使用本地基础拆解"],
    ["默认模型", env.DEEPSEEK_MODEL],
    ["高质量模型", env.DEEPSEEK_HIGH_QUALITY_MODEL],
    ["SearXNG 地址", env.SEARXNG_URL],
    ["数据库", env.DATABASE_URL],
    ["访问密码", isAuthEnabledFromHash(env.APP_ACCESS_PASSWORD_HASH) ? "已启用" : "未启用"],
  ];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="panel-elevated flex items-center justify-between rounded-xl px-5 py-4">
        <div className="flex flex-col gap-1.5">
          <span className="kicker">Control Surface</span>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">设置</h1>
          <p className="text-sm text-slate-500">运行配置只读；应用偏好与数据清理可在下方操作。</p>
        </div>
        <div className="flex items-center gap-2">
          <Button href="/" variant="secondary">
            返回首页
          </Button>
          <HeaderControls />
        </div>
      </header>

      <SettingsForm initial={appSettings} />

      <Card>
        <CardHeader>
          <CardTitle>运行配置</CardTitle>
          <CardDescription>修改 `.env` 或系统环境变量后需要重启开发服务。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {settings.map(([key, value]) => (
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between" key={key}>
              <div className="font-medium text-slate-950">{key}</div>
              <Badge tone={value.includes("未配置") ? "amber" : "slate"}>{value}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <HealthCheckPanel />

      <Card>
        <CardHeader>
          <CardTitle>隐私说明</CardTitle>
          <CardDescription>个人项目默认策略。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm leading-7 text-slate-600">
          <p>用户目标、任务、搜索来源和运行日志只保存到本地 SQLite 数据库。</p>
          <p>DeepSeek API Key 只读取服务端环境变量，不进入前端 bundle。</p>
          <p>启用搜索时，搜索关键词会通过本地 SearXNG 请求外部搜索引擎，执行前建议脱敏。</p>
        </CardContent>
      </Card>
    </main>
  );
}

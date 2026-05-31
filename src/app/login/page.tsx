import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { env } from "@/lib/env";
import { isAuthEnabledFromHash } from "@/lib/auth-core";
import { LoginForm } from "@/components/auth/login-form";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (!isAuthEnabledFromHash(env.APP_ACCESS_PASSWORD_HASH)) {
    redirect("/");
  }

  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="panel-elevated w-full max-w-md rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex size-11 items-center justify-center rounded-xl border border-teal-400/30 bg-teal-500/10 text-teal-300">
            <LockKeyhole aria-hidden="true" className="size-5" />
          </div>
          <div>
            <span className="kicker">Access Gate</span>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">访问保护</h1>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              该演示环境已启用访问密码，登录后即可使用游龙排排。
            </p>
          </div>
        </div>
        <LoginForm nextPath={next} />
      </section>
    </main>
  );
}

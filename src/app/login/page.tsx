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
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex size-11 items-center justify-center rounded-lg bg-teal-700 text-white">
            <LockKeyhole aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-normal text-slate-950">访问保护</h1>
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

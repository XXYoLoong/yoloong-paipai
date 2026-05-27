"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, Input } from "@/components/ui/field";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "登录失败");
      }

      router.replace(safeNextPath(nextPath));
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登录失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-6" onSubmit={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password">访问密码</FieldLabel>
          <Input
            autoComplete="current-password"
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <FieldDescription>
            密码只用于当前演示环境访问控制，不会进入浏览器脚本。
          </FieldDescription>
        </Field>
        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={isSubmitting || !password.trim()}>
          <LogIn data-icon="inline-start" aria-hidden="true" />
          {isSubmitting ? "登录中" : "登录"}
        </Button>
      </FieldGroup>
    </form>
  );
}

function safeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) {
    return "/";
  }

  return value;
}

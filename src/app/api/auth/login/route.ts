import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE_NAME, createSessionToken, verifyPasswordAgainstHash } from "@/lib/auth-core";
import { env } from "@/lib/env";
import { fail } from "@/lib/api/responses";

const loginSchema = z.object({
  password: z.string().min(1, "请输入访问密码"),
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const valid = await verifyPasswordAgainstHash(body.password, env.APP_ACCESS_PASSWORD_HASH);

    if (!valid) {
      return NextResponse.json({ error: "访问密码不正确。" }, { status: 401 });
    }

    const token = await createSessionToken(env.APP_ACCESS_PASSWORD_HASH);
    const response = NextResponse.json({ ok: true });
    if (token) {
      response.cookies.set(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 8,
      });
    }

    return response;
  } catch (error) {
    return fail(error);
  }
}

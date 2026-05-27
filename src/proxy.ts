import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, createSessionToken, isAuthEnabledFromHash } from "@/lib/auth-core";

const publicRoutes = ["/login", "/api/auth/login"];
const publicPrefixes = ["/_next", "/favicon.ico"];

export async function proxy(request: NextRequest) {
  const passwordHash = process.env.APP_ACCESS_PASSWORD_HASH;
  if (!isAuthEnabledFromHash(passwordHash)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const expectedToken = await createSessionToken(passwordHash);
  const currentToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (currentToken === expectedToken) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "请先登录后再访问。" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

function isPublicPath(pathname: string) {
  return publicRoutes.includes(pathname) || publicPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/api/:path*"],
};

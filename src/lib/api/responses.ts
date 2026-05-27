import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(error: unknown, status = 500) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "请求参数不符合要求",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : "服务端处理失败",
    },
    { status },
  );
}


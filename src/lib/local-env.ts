import "server-only";

import { execFileSync } from "node:child_process";

const isWindows = process.platform === "win32";
const safeEnvNamePattern = /^[A-Z0-9_]+$/i;

export function getLocalEnv(name: string) {
  const current = process.env[name];
  if (current?.trim()) {
    return current.trim();
  }

  if (!isWindows) {
    return undefined;
  }

  return getWindowsEnv(name);
}

function getWindowsEnv(name: string) {
  if (!safeEnvNamePattern.test(name)) {
    return undefined;
  }

  return readWindowsEnvTarget(name, "User") ?? readWindowsEnvTarget(name, "Machine");
}

function readWindowsEnvTarget(name: string, target: "User" | "Machine") {
  try {
    const value = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); [Environment]::GetEnvironmentVariable('${name}', '${target}')`,
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 2000,
      },
    ).trim();

    if (value) {
      return value;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

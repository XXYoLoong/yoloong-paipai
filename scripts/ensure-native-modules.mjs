import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function canLoadBetterSqlite3() {
  try {
    const Database = require("better-sqlite3");
    const sqlite = new Database(":memory:");
    sqlite.prepare("select 1").get();
    sqlite.close();
    return true;
  } catch (error) {
    const message = String(error?.message ?? error);
    if (error?.code === "ERR_DLOPEN_FAILED" || message.includes("NODE_MODULE_VERSION")) {
      return false;
    }
    throw error;
  }
}

function rebuildBetterSqlite3() {
  console.log(`better-sqlite3 与 Node ${process.version} 不兼容，正在重新编译…`);
  const packageRoot = path.dirname(require.resolve("better-sqlite3/package.json"));
  rmSync(path.join(packageRoot, "build"), { recursive: true, force: true });

  const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(pnpmCommand, ["rebuild", "better-sqlite3"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ""}`,
      npm_config_node_execpath: process.execPath,
    },
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error("pnpm rebuild better-sqlite3 失败。");
    console.error("若缺少编译环境，请安装 Visual Studio Build Tools 后重试。");
    process.exit(result.status ?? 1);
  }
}

if (!canLoadBetterSqlite3()) {
  rebuildBetterSqlite3();
  if (!canLoadBetterSqlite3()) {
    console.error("重新编译后 better-sqlite3 仍无法加载。请尝试：pnpm install --force");
    process.exit(1);
  }
  console.log("better-sqlite3 已重新编译完成。");
} else {
  console.log(`better-sqlite3 与 Node ${process.version} 兼容。`);
}

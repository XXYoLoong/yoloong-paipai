// 生成提交文件夹 0601/：把「未被 .gitignore 忽略」的全部文件复制成一份干净副本，
// 因此天然不含 node_modules / .next / data / logs / .env 等依赖与环境文件，
// 同时包含依赖描述文件、一键启动脚本与项目计划书 PDF，可直接打包提交。

import { execSync } from "node:child_process";
import { mkdir, copyFile, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "0601");

async function main() {
  // 列出「已跟踪 + 未跟踪但未被忽略」的文件，等价于「仓库里应有的全部源码与资源」
  // -c core.quotePath=false：让 git 原样输出含中文的路径（如计划书 PDF），不做八进制转义
  const raw = execSync("git -c core.quotePath=false ls-files --cached --others --exclude-standard", {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const files = raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    // 双保险：即使有人取消忽略，也不把这些目录带进提交包
    .filter((f) => !f.startsWith("0601/") && !f.startsWith("node_modules/") && !f.startsWith(".next/"));

  if (existsSync(OUT)) {
    await rm(OUT, { recursive: true, force: true });
  }
  await mkdir(OUT, { recursive: true });

  let totalBytes = 0;
  for (const rel of files) {
    const src = join(ROOT, rel);
    if (!existsSync(src)) {
      continue;
    }
    const dest = join(OUT, rel);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(src, dest);
    totalBytes += (await stat(src)).size;
  }

  const reportRel = "docs/游龙排排-项目计划书.pdf";
  const hasReport = existsSync(join(OUT, reportRel));

  console.log(`已生成提交文件夹：${OUT}`);
  console.log(`  文件数：${files.length}`);
  console.log(`  总大小：${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  项目计划书 PDF：${hasReport ? "已包含" : "未找到（请先运行 pnpm report:pdf）"}`);
  console.log("  已排除：node_modules / .next / data / logs / output / .env（由 .gitignore 决定）");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

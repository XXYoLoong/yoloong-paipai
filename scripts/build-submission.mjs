// 生成提交文件夹 0601/：把「未被 .gitignore 忽略」的全部文件复制成一份干净副本，
// 因此天然不含 node_modules / .next / data / logs / .env 等依赖与环境文件，
// 同时包含依赖描述文件、一键启动脚本与项目计划书 PDF，可直接打包提交。

import { execSync } from "node:child_process";
import { mkdir, copyFile, rm, stat, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "0601");

/** 提交包中不应出现的敏感痕迹（商业交付 / 仓库地址 / 内部编号等） */
const BANNED_PATTERNS = [
  { label: "仓库地址", pattern: /github\.com\/XXYoLoong/i },
  { label: "分支名", pattern: /\byoloong\b/i },
  { label: "外部交易平台痕迹", pattern: /\u54b8\u9c7c|\u95f2\u9c7c|xianyu/i },
  { label: "二期编号", pattern: /F-\d{2}/ },
  { label: "演示环境", pattern: /演示环境/ },
];

const TEXT_EXT = new Set([".md", ".mjs", ".ts", ".tsx", ".json", ".ps1", ".bat", ".sh", ".txt", ".yml"]);

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

  let reuseExisting = false;
  if (existsSync(OUT)) {
    try {
      await rm(OUT, { recursive: true, force: true });
    } catch {
      // 目录被占用时（如资源管理器打开），就地覆盖同步而不删除
      reuseExisting = true;
      console.log("提示：0601 目录被占用，将就地覆盖更新文件。");
    }
  }
  if (!reuseExisting) {
    await mkdir(OUT, { recursive: true });
  }

  /** 已从仓库移除、提交包中也不应再出现的文件 */
  const staleInPackage = [
    "docs/step-by-step-log.md",
    "docs/phase2-completion-audit.md",
  ];
  for (const rel of staleInPackage) {
    const dest = join(OUT, rel);
    if (existsSync(dest)) {
      await rm(dest, { force: true });
    }
  }

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

  const findings = [];
  for (const rel of files) {
    if (rel === "scripts/build-submission.mjs") continue;
    const ext = extname(rel).toLowerCase();
    if (!TEXT_EXT.has(ext)) continue;
    const dest = join(OUT, rel);
    if (!existsSync(dest)) continue;
    const text = await readFile(dest, "utf8");
    for (const rule of BANNED_PATTERNS) {
      if (rule.pattern.test(text)) {
        findings.push(`${rel} → ${rule.label}`);
        break;
      }
    }
  }
  if (findings.length) {
    console.error("提交包脱敏检查未通过：");
    for (const item of findings) console.error(`  - ${item}`);
    process.exit(1);
  }

  console.log(`已生成提交文件夹：${OUT}`);
  console.log(`  文件数：${files.length}`);
  console.log(`  总大小：${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  项目计划书 PDF：${hasReport ? "已包含" : "未找到（请先运行 pnpm report:pdf）"}`);
  console.log("  脱敏检查：已通过（无仓库地址、商业交付痕迹等敏感词）");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

const blockedSegments = new Set([
  ".codex-build",
  ".next",
  "__pycache__",
  "logs",
  "node_modules",
  "output",
]);

const blockedFiles = new Set([
  ".env",
  ".env.development",
  ".env.local",
  ".env.production",
  ".env.test",
]);

const binaryExtensions = new Set([
  ".db",
  ".docx",
  ".gif",
  ".ico",
  ".jpg",
  ".jpeg",
  ".lock",
  ".pdf",
  ".png",
  ".sqlite",
  ".webp",
  ".xlsx",
  ".zip",
]);

const secretRules = [
  {
    label: "DeepSeek API Key",
    pattern: /\bDEEPSEEK_API_KEY[ \t]*=[ \t]*(?!["']?[ \t]*(?:$|#|your_|YOUR_|xxx|XXX|<|填写|示例))["']?([^\s"'#]{12,})/im,
  },
  {
    label: "OpenAI-style API Key",
    pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/,
  },
  {
    label: "Bearer Token",
    pattern: /\bBearer\s+[A-Za-z0-9_.-]{20,}\b/i,
  },
  {
    label: "Access Password Hash",
    pattern: /\bAPP_ACCESS_PASSWORD_HASH[ \t]*=[ \t]*["']?(?:sha256:)?[a-f0-9]{64}\b/i,
  },
];

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function getSubmitCandidates() {
  try {
    const output = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return output.split("\0").filter(Boolean).sort();
  } catch {
    throw new Error("无法通过 git 获取提交候选文件，请确认项目已初始化 Git 仓库。");
  }
}

function isBlockedPath(relativePath) {
  const parts = toPosix(relativePath).split("/");
  return parts.some((part) => blockedSegments.has(part)) || blockedFiles.has(parts.at(-1));
}

function shouldScanText(relativePath) {
  const ext = path.extname(relativePath).toLowerCase();
  if (binaryExtensions.has(ext)) {
    return false;
  }

  const fullPath = path.join(projectRoot, relativePath);
  if (!existsSync(fullPath)) {
    return false;
  }

  return statSync(fullPath).size <= 1024 * 1024;
}

const findings = [];
const candidates = getSubmitCandidates();

for (const relativePath of candidates) {
  if (isBlockedPath(relativePath)) {
    findings.push(`不应进入提交包：${toPosix(relativePath)}`);
    continue;
  }

  if (!shouldScanText(relativePath)) {
    continue;
  }

  const fullPath = path.join(projectRoot, relativePath);
  let text = "";
  try {
    text = readFileSync(fullPath, "utf8");
  } catch {
    continue;
  }

  for (const rule of secretRules) {
    if (rule.pattern.test(text)) {
      findings.push(`疑似敏感信息：${toPosix(relativePath)} 匹配 ${rule.label}`);
      break;
    }
  }
}

if (findings.length > 0) {
  console.error("提交包检查未通过：");
  for (const finding of [...new Set(findings)].sort()) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log(`提交包检查通过：${candidates.length} 个候选文件未发现依赖目录、环境文件、日志/输出目录或明显密钥痕迹。`);

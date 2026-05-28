function stripCodeFence(content: string) {
  return content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function extractJsonObject(content: string) {
  const start = content.indexOf("{");
  if (start === -1) {
    return content;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < content.length; index += 1) {
    const char = content[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return content.slice(start, index + 1);
      }
    }
  }

  return balanceJson(content.slice(start));
}

function balanceJson(content: string) {
  const stack: Array<"{" | "["> = [];
  let inString = false;
  let escaped = false;

  for (const char of content) {
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") stack.push("{");
    if (char === "[") stack.push("[");
    if (char === "}" && stack.at(-1) === "{") stack.pop();
    if (char === "]" && stack.at(-1) === "[") stack.pop();
  }

  let suffix = inString ? '"' : "";
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    suffix += stack[index] === "{" ? "}" : "]";
  }

  return content + suffix;
}

function removeTrailingCommas(content: string) {
  return content.replace(/,\s*([}\]])/g, "$1");
}

function repairTruncatedJson(content: string) {
  let attempt = removeTrailingCommas(content.trim());

  for (let step = 0; step < 12; step += 1) {
    try {
      JSON.parse(attempt);
      return attempt;
    } catch {
      const lastComma = attempt.lastIndexOf(",");
      const lastStructure = Math.max(attempt.lastIndexOf("}"), attempt.lastIndexOf("]"));
      if (lastComma > lastStructure) {
        attempt = balanceJson(attempt.slice(0, lastComma));
      } else if (lastStructure >= 0) {
        attempt = balanceJson(attempt.slice(0, lastStructure + 1));
      } else {
        attempt = balanceJson(attempt);
      }
    }
  }

  return balanceJson(content);
}

function tryParse(content: string) {
  return JSON.parse(removeTrailingCommas(content));
}

export function parseModelJson(content: string) {
  const candidates = [
    content.trim(),
    stripCodeFence(content),
    extractJsonObject(content),
    repairTruncatedJson(stripCodeFence(content)),
    repairTruncatedJson(extractJsonObject(content)),
  ];

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);

    try {
      return tryParse(candidate);
    } catch {
      try {
        return tryParse(repairTruncatedJson(candidate));
      } catch {
        continue;
      }
    }
  }

  throw new SyntaxError("无法解析模型返回的 JSON");
}

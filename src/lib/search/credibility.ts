import type { CredibilityLevel } from "@/lib/types";

const TRUSTED_DOMAINS = [
  ".gov.cn",
  ".edu.cn",
  ".gov",
  ".edu",
  "wikipedia.org",
  "baike.baidu.com",
];

const OFFICIAL_KEYWORDS = ["官方", "人民政府", "教育部", "统计局"];

export type CredibilityResult = {
  credibility: CredibilityLevel;
  domain: string;
  citationReason: string;
};

export function scoreCredibility(input: {
  url: string;
  title: string;
  snippet: string;
  source: string;
  seenUrls: Set<string>;
}): CredibilityResult {
  const domain = extractDomain(input.url);
  const duplicate = input.seenUrls.has(normalizeUrl(input.url));

  if (duplicate) {
    return {
      credibility: "low",
      domain,
      citationReason: "重复来源，建议人工复核。",
    };
  }

  input.seenUrls.add(normalizeUrl(input.url));

  const trustedDomain = TRUSTED_DOMAINS.some((suffix) => domain.endsWith(suffix) || domain.includes(suffix));
  const officialTitle = OFFICIAL_KEYWORDS.some((keyword) => input.title.includes(keyword));
  const richSnippet = input.snippet.trim().length >= 80;

  if (trustedDomain || officialTitle) {
    return {
      credibility: "high",
      domain,
      citationReason: trustedDomain ? "政府/教育/百科类域名，可信度较高。" : "标题含官方关键词。",
    };
  }

  if (richSnippet && input.source) {
    return {
      credibility: "medium",
      domain,
      citationReason: "摘要较完整，可作为参考，关键结论仍需复核。",
    };
  }

  return {
    credibility: "unverified",
    domain,
    citationReason: "来源信息不足，标记为待复核。",
  };
}

function extractDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

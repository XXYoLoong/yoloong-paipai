import "server-only";

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, initDb } from "@/lib/db";
import { searchCache } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { scoreCredibility } from "@/lib/search/credibility";
import type { EvidenceItem } from "@/lib/types";

type RawSearxResult = {
  title?: string;
  content?: string;
  url?: string;
  engine?: string;
};

type RawSearxResponse = {
  results?: RawSearxResult[];
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function hashQuery(query: string) {
  return createHash("sha256").update(query.trim().toLowerCase()).digest("hex");
}

export async function searchSearxng(query: string, limit = 5): Promise<EvidenceItem[]> {
  initDb();

  const queryHash = hashQuery(query);
  const cached = db.select().from(searchCache).where(eq(searchCache.queryHash, queryHash)).get();
  const now = Date.now();

  if (cached && now - cached.createdAtMs < CACHE_TTL_MS) {
    return JSON.parse(cached.resultsJson) as EvidenceItem[];
  }

  const url = new URL("/search", env.SEARXNG_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "zh-CN");
  url.searchParams.set("safesearch", "1");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        accept: "application/json",
      },
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    throw new Error(formatSearxngFetchError(error));
  }

  if (!response.ok) {
    const message =
      response.status === 403
        ? "SearXNG 拒绝 JSON 请求，请在 settings.yml 中启用 search.formats: [html, json]。"
        : `SearXNG 请求失败：HTTP ${response.status}`;
    throw new Error(message);
  }

  const data = (await response.json()) as RawSearxResponse;
  const seenUrls = new Set<string>();
  const items = (data.results ?? [])
    .filter((item) => item.title && item.url)
    .slice(0, limit)
    .map((item, index) => {
      const scored = scoreCredibility({
        url: item.url ?? "",
        title: item.title ?? "未命名结果",
        snippet: item.content ?? "",
        source: item.engine ?? "SearXNG",
        seenUrls,
      });
      return {
        id: `${queryHash}-${index}`,
        title: item.title ?? "未命名结果",
        snippet: item.content ?? "",
        url: item.url ?? "",
        source: item.engine ?? "SearXNG",
        queryHash,
        query,
        credibility: scored.credibility,
        domain: scored.domain,
        citationReason: scored.citationReason,
      };
    });

  db.insert(searchCache)
    .values({
      queryHash,
      query,
      resultsJson: JSON.stringify(items),
      createdAtMs: now,
    })
    .onConflictDoUpdate({
      target: searchCache.queryHash,
      set: {
        resultsJson: JSON.stringify(items),
        createdAtMs: now,
      },
    })
    .run();

  return items;
}

export async function searchMany(queries: string[], limitPerQuery = 5) {
  const settled = await Promise.allSettled(
    queries.slice(0, 3).map((query) => searchSearxng(query, limitPerQuery)),
  );

  const items: EvidenceItem[] = [];
  const errors: string[] = [];
  const globalSeen = new Set<string>();

  for (const result of settled) {
    if (result.status === "fulfilled") {
      for (const item of result.value) {
        const scored = scoreCredibility({
          url: item.url,
          title: item.title,
          snippet: item.snippet,
          source: item.source,
          seenUrls: globalSeen,
        });
        items.push({
          ...item,
          credibility: scored.credibility,
          domain: scored.domain,
          citationReason: scored.citationReason,
        });
      }
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : "搜索失败");
    }
  }

  return { items, errors: Array.from(new Set(errors)) };
}

function formatSearxngFetchError(error: unknown) {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "本地 SearXNG 搜索超时，已跳过联网搜索并继续生成计划。";
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("fetch failed") || message.includes("connect") || message.includes("econnrefused")) {
      return "本地 SearXNG 未连接或容器未就绪，已跳过联网搜索并继续生成计划。";
    }
    if (message.includes("aborted") || message.includes("timeout")) {
      return "本地 SearXNG 搜索被超时中断，已跳过联网搜索并继续生成计划。";
    }
    return `本地 SearXNG 搜索失败：${error.message}`;
  }

  return "本地 SearXNG 搜索失败，已跳过联网搜索并继续生成计划。";
}

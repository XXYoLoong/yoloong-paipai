import { fail, ok } from "@/lib/api/responses";
import { searchSearxng } from "@/lib/search/searxng";

export async function POST() {
  try {
    const items = await searchSearxng("SearXNG JSON API 测试", 1);
    return ok({
      ok: true,
      sample: items[0] ?? null,
    });
  } catch (error) {
    return fail(error, 502);
  }
}


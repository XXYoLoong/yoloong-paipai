import { runPlanPipeline } from "@/lib/agent/orchestrator";
import { getPlan } from "@/lib/db/queries";

export const runtime = "nodejs";

function sse(data: Record<string, unknown>) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const body = await request.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await runPlanPipeline(body, {
          onStage(entry) {
            controller.enqueue(encoder.encode(sse({ type: "stage", ...entry })));
          },
          onWarning(message) {
            controller.enqueue(encoder.encode(sse({ type: "warning", message })));
          },
        });

        const storedPlan = getPlan(result.planId);
        controller.enqueue(
          encoder.encode(
            sse({
              type: "done",
              planId: result.planId,
              storedPlan,
              stageLog: result.stageLog,
              warnings: result.warnings,
            }),
          ),
        );
        controller.close();
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            sse({
              type: "error",
              message: error instanceof Error ? error.message : "生成失败",
            }),
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

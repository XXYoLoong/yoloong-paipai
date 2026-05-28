import { z } from "zod";
import { deletePlan } from "@/lib/agent/orchestrator";
import { fail, ok } from "@/lib/api/responses";
import { archivePlan, clonePlan, createManualTask, getPlan } from "@/lib/db/queries";

const manualTaskSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).default("手动新增任务"),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  dueDate: z.string().optional(),
  parentTaskId: z.string().optional(),
});

const patchPlanSchema = z.object({
  action: z.enum(["archive", "unarchive", "clone"]),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const plan = getPlan(id);

    if (!plan) {
      return ok({ error: "计划不存在" }, { status: 404 });
    }

    return ok({ plan });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = manualTaskSchema.parse(await request.json());
    const plan = createManualTask({
      planId: id,
      ...body,
    });

    return ok({ plan });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = patchPlanSchema.parse(await request.json());

    if (body.action === "clone") {
      const plan = clonePlan(id);
      if (!plan) {
        return ok({ error: "计划不存在" }, { status: 404 });
      }
      return ok({ plan });
    }

    const plan = archivePlan(id, body.action === "archive");
    if (!plan) {
      return ok({ error: "计划不存在" }, { status: 404 });
    }

    return ok({ plan });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    deletePlan(id);
    return ok({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

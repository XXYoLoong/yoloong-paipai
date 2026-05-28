import { fail, ok } from "@/lib/api/responses";
import { computeCompletionRate, createPlanReview, getPlan, listPlanReviews } from "@/lib/db/queries";
import { planReviewSchema } from "@/lib/schemas";
import { upsertMemoryFromPlan } from "@/lib/agent/memory";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return ok({ reviews: listPlanReviews(id) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = planReviewSchema.parse(await request.json());
    const plan = getPlan(id);

    if (!plan) {
      return ok({ error: "计划不存在" }, { status: 404 });
    }

    const review = createPlanReview({
      planId: id,
      completionRate: computeCompletionRate(id),
      delayReasons: body.delayReasons,
      summary: body.summary,
    });

    upsertMemoryFromPlan(plan, {
      goal: plan.originalGoal,
      enableSearch: true,
      preferences: [],
      constraints: body.delayReasons,
      memoryMode: "on",
    });

    return ok({ review });
  } catch (error) {
    return fail(error);
  }
}

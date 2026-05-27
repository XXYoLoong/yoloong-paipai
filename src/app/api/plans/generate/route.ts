import { generateAndPersistPlan } from "@/lib/agent/orchestrator";
import { fail, ok } from "@/lib/api/responses";
import { getPlan } from "@/lib/db/queries";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await generateAndPersistPlan(body);
    const storedPlan = getPlan(result.planId);

    return ok({
      ...result,
      storedPlan,
    });
  } catch (error) {
    return fail(error);
  }
}


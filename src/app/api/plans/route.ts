import { fail, ok } from "@/lib/api/responses";
import { listPlans } from "@/lib/db/queries";

export async function GET() {
  try {
    return ok({
      plans: listPlans(),
    });
  } catch (error) {
    return fail(error);
  }
}


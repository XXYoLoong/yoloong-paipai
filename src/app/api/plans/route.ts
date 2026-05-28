import { fail, ok } from "@/lib/api/responses";
import { listPlans, type ListPlansQuery } from "@/lib/db/queries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query: ListPlansQuery = {
      q: searchParams.get("q") ?? undefined,
      goalType: searchParams.get("goalType") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      includeArchived: searchParams.get("includeArchived") === "true",
    };

    return ok({
      plans: listPlans(query),
    });
  } catch (error) {
    return fail(error);
  }
}

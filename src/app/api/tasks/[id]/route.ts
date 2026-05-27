import { fail, ok } from "@/lib/api/responses";
import { taskPatchSchema } from "@/lib/schemas";
import { updateTask } from "@/lib/db/queries";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const patch = taskPatchSchema.parse(await request.json());
    const task = updateTask(id, patch);

    if (!task) {
      return ok({ error: "任务不存在" }, { status: 404 });
    }

    return ok({ task });
  } catch (error) {
    return fail(error);
  }
}


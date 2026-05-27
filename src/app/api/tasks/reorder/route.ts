import { fail, ok } from "@/lib/api/responses";
import { reorderTasks } from "@/lib/db/queries";
import { reorderTasksSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const body = reorderTasksSchema.parse(await request.json());
    reorderTasks(body.items);

    return ok({ ok: true });
  } catch (error) {
    return fail(error);
  }
}


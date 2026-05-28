import { fail, ok } from "@/lib/api/responses";
import { listTemplates } from "@/lib/templates/builtin";

export async function GET() {
  try {
    return ok({ templates: listTemplates() });
  } catch (error) {
    return fail(error);
  }
}

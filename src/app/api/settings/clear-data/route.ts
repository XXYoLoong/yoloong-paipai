import { fail, ok } from "@/lib/api/responses";
import { clearAllPlanData } from "@/lib/db/queries";

export async function POST() {
  try {
    clearAllPlanData();
    return ok({ ok: true, message: "已清空计划与任务数据，设置项保留。" });
  } catch (error) {
    return fail(error);
  }
}

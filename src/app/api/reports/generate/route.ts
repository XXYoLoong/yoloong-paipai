import { fail, ok } from "@/lib/api/responses";
import { generateProjectReport } from "@/lib/reports/generate-report";
import { z } from "zod";

const bodySchema = z.object({
  planId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const result = await generateProjectReport(body.planId);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

import ExcelJS from "exceljs";
import type { PlanWithTasks } from "@/lib/types";

export async function planToTasksWorkbook(plan: PlanWithTasks) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("任务清单");

  sheet.columns = [
    { header: "任务ID", key: "id", width: 36 },
    { header: "标题", key: "title", width: 30 },
    { header: "说明", key: "description", width: 50 },
    { header: "优先级", key: "priority", width: 12 },
    { header: "状态", key: "status", width: 12 },
    { header: "截止时间", key: "dueDate", width: 16 },
    { header: "预计分钟", key: "estimatedMinutes", width: 12 },
    { header: "依赖任务", key: "dependencies", width: 30 },
    { header: "父任务", key: "parentTaskId", width: 36 },
  ];

  for (const task of plan.tasks) {
    sheet.addRow({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ?? "",
      estimatedMinutes: task.estimatedMinutes ?? "",
      dependencies: (task.dependencyIds ?? []).join(", "),
      parentTaskId: task.parentTaskId ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

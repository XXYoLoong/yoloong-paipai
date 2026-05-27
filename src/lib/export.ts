import type { PlanWithTasks, StoredTask } from "@/lib/types";

export function planToMarkdown(plan: PlanWithTasks) {
  const lines = [
    `# ${plan.title}`,
    "",
    `> 原始目标：${plan.originalGoal}`,
    "",
    `## 摘要`,
    "",
    plan.summary,
    "",
    `## 假设`,
    "",
    ...toList(plan.assumptions),
    "",
    `## 补充问题`,
    "",
    ...toList(plan.followUpQuestions.length ? plan.followUpQuestions : ["暂无"]),
    "",
    `## 任务清单`,
    "",
    ...renderTasks(plan.tasks),
    "",
    `## 信息来源`,
    "",
    ...toList(plan.evidenceItems.map((item) => `[${item.title}](${item.url}) - ${item.source}`)),
  ];

  return lines.join("\n");
}

function toList(items: string[]) {
  return items.map((item) => `- ${item}`);
}

function renderTasks(tasks: StoredTask[]) {
  const byParent = new Map<string | undefined, StoredTask[]>();
  for (const task of tasks) {
    const group = byParent.get(task.parentTaskId) ?? [];
    group.push(task);
    byParent.set(task.parentTaskId, group);
  }

  const renderGroup = (parentId: string | undefined, level: number): string[] => {
    return (byParent.get(parentId) ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .flatMap((task) => {
        const prefix = "  ".repeat(level);
        return [
          `${prefix}- [${task.status === "done" ? "x" : " "}] ${task.title}（${task.priority}）`,
          `${prefix}  - ${task.description}`,
          ...renderGroup(task.id, level + 1),
        ];
      });
  };

  return renderGroup(undefined, 0);
}


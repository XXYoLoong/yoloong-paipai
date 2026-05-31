import type { GeneratedPlan, PlanTask } from "@/lib/types";

export type NormalizeScheduleOptions = {
  deadline?: string;
  /** 用于测试；默认今天 12:00 */
  now?: Date;
};

function parseDate(value?: string | null) {
  if (!value?.trim()) {
    return null;
  }

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatDueDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfToday(now = new Date()) {
  const start = new Date(now);
  start.setHours(12, 0, 0, 0);
  return start;
}

function isDueDateValid(value: string | undefined, start: Date, end: Date) {
  const parsed = parseDate(value);
  if (!parsed) {
    return false;
  }

  return parsed.getTime() >= start.getTime() && parsed.getTime() <= end.getTime();
}

function distributeDueDates(taskList: PlanTask[], start: Date, end: Date) {
  const count = taskList.length;
  if (!count) {
    return taskList;
  }

  const totalMs = Math.max(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
  const stepMs = totalMs / count;

  return taskList.map((task, index) => {
    const slot = new Date(start.getTime() + stepMs * (index + 1));
    const dueDate = formatDueDate(slot > end ? end : slot);
    const subtasks = task.subtasks?.length
      ? task.subtasks.map((subtask) => ({
          ...subtask,
          dueDate: isDueDateValid(subtask.dueDate, start, end) ? subtask.dueDate!.trim() : dueDate,
        }))
      : task.subtasks;

    return {
      ...task,
      dueDate,
      subtasks,
    };
  });
}

function stripPastDueDates(taskList: PlanTask[], start: Date): PlanTask[] {
  return taskList.map((task) => {
    const parsed = parseDate(task.dueDate);
    const dueDate = parsed && parsed.getTime() < start.getTime() ? undefined : task.dueDate?.trim();
    const subtasks = task.subtasks?.length ? stripPastDueDates(task.subtasks, start) : task.subtasks;
    return { ...task, dueDate, subtasks };
  });
}

export function normalizePlanSchedule(plan: GeneratedPlan, options: NormalizeScheduleOptions = {}): GeneratedPlan {
  const start = startOfToday(options.now);
  const end = parseDate(options.deadline);
  const notes: string[] = [];

  let tasks = plan.tasks;

  if (end) {
    if (end.getTime() < start.getTime()) {
      tasks = stripPastDueDates(tasks, start);
      notes.push(`目标截止时间 ${formatDueDate(end)} 已早于今天，已清除无效任务截止日期。`);
    } else {
      const hadInvalidDates = tasks.some((task) => !isDueDateValid(task.dueDate, start, end));
      tasks = distributeDueDates(tasks, start, end);
      if (hadInvalidDates) {
        notes.push(`已按 ${formatDueDate(start)} 至 ${formatDueDate(end)} 重新分配全部任务截止日期（覆盖模型返回的过期日期）。`);
      }
    }
  } else {
    const hadPastDates = tasks.some((task) => {
      const parsed = parseDate(task.dueDate);
      return parsed && parsed.getTime() < start.getTime();
    });
    tasks = stripPastDueDates(tasks, start);
    if (hadPastDates) {
      notes.push("已清除早于今天的任务截止日期；如需自动排期，请在首页填写目标截止时间。");
    }
  }

  if (!notes.length) {
    return { ...plan, tasks };
  }

  return {
    ...plan,
    tasks,
    assumptions: [...plan.assumptions.filter((item) => !item.includes("任务截止")), ...notes],
  };
}

/** @deprecated 使用 normalizePlanSchedule */
export function applyDueDatesToPlan(plan: GeneratedPlan, deadline?: string): GeneratedPlan {
  return normalizePlanSchedule(plan, { deadline });
}

export function formatDeadlineLabel(deadline?: string) {
  const parsed = parseDate(deadline);
  return parsed ? formatDueDate(parsed) : null;
}

export function remapDependencyIds(
  dependencyIds: string[] | undefined,
  idMap: Map<string, string>,
  validIds: Set<string>,
) {
  return (dependencyIds ?? [])
    .map((id) => idMap.get(id) ?? id)
    .filter((id, index, array) => validIds.has(id) && array.indexOf(id) === index);
}

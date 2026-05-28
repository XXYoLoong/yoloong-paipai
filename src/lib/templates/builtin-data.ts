import type { GoalTemplate } from "@/lib/types";

export const BUILTIN_TEMPLATES: GoalTemplate[] = [
  {
    id: "tpl-travel",
    name: "周末旅行",
    goalType: "travel",
    goalTemplate: "策划{days}天{location}周末游，预算{budget}元，偏好{preferences}",
    defaultFields: {
      location: "北京",
      budget: "3000",
      preferencesText: "文化景点, 本地美食",
      enableSearch: true,
      qualityMode: "fast",
    },
    builtin: true,
  },
  {
    id: "tpl-study",
    name: "考试备考",
    goalType: "study",
    goalTemplate: "在{deadline}前准备{exam}，每天学习不超过{hours}小时",
    defaultFields: {
      deadline: "",
      preferencesText: "词汇, 听力, 真题",
      constraintsText: "工作日晚上学习",
      enableSearch: false,
      qualityMode: "quality",
    },
    builtin: true,
  },
  {
    id: "tpl-event",
    name: "班级团建",
    goalType: "event",
    goalTemplate: "组织一次{count}人团建活动，预算{budget}元，需要应急预案",
    defaultFields: {
      budget: "5000",
      preferencesText: "户外, 团队协作",
      constraintsText: "雨天备选室内方案",
      enableSearch: true,
    },
    builtin: true,
  },
  {
    id: "tpl-career",
    name: "求职准备",
    goalType: "career",
    goalTemplate: "在{deadline}前完成{role}岗位求职准备，目标城市{location}",
    defaultFields: {
      location: "上海",
      preferencesText: "简历, 作品集, 模拟面试",
      enableSearch: true,
    },
    builtin: true,
  },
  {
    id: "tpl-shopping",
    name: "采购清单",
    goalType: "shopping",
    goalTemplate: "在预算{budget}元内完成{category}采购，注重性价比",
    defaultFields: {
      budget: "2000",
      preferencesText: "比价, 售后保障",
      enableSearch: true,
    },
    builtin: true,
  },
  {
    id: "tpl-health",
    name: "健康习惯",
    goalType: "health",
    goalTemplate: "用{weeks}周建立{habit}习惯，每周复盘一次",
    defaultFields: {
      preferencesText: "作息, 运动, 饮食",
      constraintsText: "循序渐进，避免受伤",
      enableSearch: false,
    },
    builtin: true,
  },
  {
    id: "tpl-course",
    name: "课程项目",
    goalType: "general",
    goalTemplate: "在{deadline}前完成课程项目《{title}》，包含文档与演示",
    defaultFields: {
      constraintsText: "符合课程评分标准, 保留 AI 使用声明",
      enableSearch: true,
      qualityMode: "quality",
    },
    builtin: true,
  },
];

export function fillTemplateGoal(template: GoalTemplate, overrides: Record<string, string> = {}) {
  const vars: Record<string, string> = {
    days: overrides.days ?? "3",
    location: overrides.location ?? template.defaultFields.location ?? "目的地",
    budget: overrides.budget ?? template.defaultFields.budget ?? "3000",
    preferences: overrides.preferences ?? template.defaultFields.preferencesText ?? "个性化体验",
    deadline: overrides.deadline ?? template.defaultFields.deadline ?? "本月底",
    exam: overrides.exam ?? "英语四级",
    hours: overrides.hours ?? "2",
    count: overrides.count ?? "30",
    role: overrides.role ?? "前端开发",
    category: overrides.category ?? "数码设备",
    weeks: overrides.weeks ?? "4",
    habit: overrides.habit ?? "早睡与运动",
    title: overrides.title ?? "智能任务规划器",
  };

  return template.goalTemplate.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

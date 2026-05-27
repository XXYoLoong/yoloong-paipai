import type { GeneratedPlan, GoalInput, GoalType, PlanTask } from "@/lib/types";

const typeKeywords: Array<[GoalType, string[]]> = [
  ["travel", ["旅行", "旅游", "周末游", "行程", "酒店", "景点", "机票", "高铁"]],
  ["study", ["考试", "复习", "学习", "备考", "课程", "四级", "六级", "考研"]],
  ["event", ["活动", "团建", "会议", "策划", "聚会", "发布会", "班级"]],
  ["career", ["求职", "简历", "面试", "实习", "作品集", "职业", "offer"]],
  ["shopping", ["购买", "采购", "选购", "预算", "对比", "设备", "电脑", "手机"]],
  ["health", ["健身", "减脂", "睡眠", "饮食", "跑步", "健康", "训练"]],
];

export function inferGoalType(goal: string): GoalType {
  const matched = typeKeywords.find(([, keywords]) =>
    keywords.some((keyword) => goal.includes(keyword)),
  );

  return matched?.[0] ?? "general";
}

export function detectSensitiveInput(value: string) {
  const patterns = [
    /1[3-9]\d{9}/,
    /\d{17}[\dXx]/,
    /[\w.-]+@[\w.-]+\.\w+/,
    /(住址|身份证|银行卡|手机号|家庭地址)/,
  ];

  return patterns.some((pattern) => pattern.test(value));
}

export function buildFollowUpQuestions(input: GoalInput, goalType: GoalType) {
  const questions: string[] = [];

  if (!input.deadline) {
    questions.push("希望什么时候完成这个目标？");
  }

  if ((goalType === "travel" || goalType === "event" || goalType === "shopping") && !input.budget) {
    questions.push("是否有大致预算上限？");
  }

  if ((goalType === "travel" || goalType === "event") && !input.location) {
    questions.push("这个目标涉及哪个城市或地点？");
  }

  if (!input.preferences?.length) {
    questions.push("有没有明显偏好，比如省钱、效率、体验、稳妥或低风险？");
  }

  return questions.slice(0, 3);
}

export function buildSearchQueries(input: GoalInput, goalType: GoalType) {
  const base = input.location ? `${input.location} ${input.goal}` : input.goal;
  const queriesByType: Record<GoalType, string[]> = {
    travel: [`${base} 最新攻略 开放时间`, `${base} 预算 交通`, `${base} 注意事项`],
    study: [`${base} 最新考试时间 大纲`, `${base} 备考方法`, `${base} 真题 资源`],
    event: [`${base} 场地 预算 流程`, `${base} 活动策划 注意事项`, `${base} 应急预案`],
    career: [`${base} 招聘要求 最新`, `${base} 面试准备`, `${base} 简历 项目经验`],
    shopping: [`${base} 选购 对比 价格`, `${base} 评测 最新`, `${base} 避坑`],
    health: [`${base} 科学建议`, `${base} 训练计划`, `${base} 风险 注意事项`],
    general: [`${base} 最新信息`, `${base} 方法 步骤`, `${base} 注意事项`],
  };

  return queriesByType[goalType].slice(0, 3);
}

export function buildFallbackPlan(input: GoalInput, evidenceIds: string[] = []): GeneratedPlan {
  const goalType = inferGoalType(input.goal);
  const title = normalizeTitle(input.goal);
  const questions = buildFollowUpQuestions(input, goalType);
  const searchQueries = input.enableSearch ? buildSearchQueries(input, goalType) : [];
  const tasks = getFallbackTasks(input, goalType, evidenceIds);

  return {
    title,
    goalType,
    summary: `围绕“${input.goal}”拆解为信息确认、方案设计、执行准备、落地推进和复盘优化五个阶段。`,
    assumptions: [
      input.deadline ? `目标截止时间按 ${input.deadline} 处理。` : "未提供截止时间，默认按可持续推进的节奏安排。",
      input.budget ? `预算上限按 ${input.budget} 元处理。` : "未提供预算，默认先做低成本方案。",
      input.enableSearch ? "已允许使用本地 SearXNG 查询公开信息。" : "已关闭联网搜索，仅基于目标描述生成计划。",
    ],
    followUpQuestions: questions,
    searchQueries,
    tasks,
  };
}

function normalizeTitle(goal: string) {
  const compact = goal.replace(/\s+/g, "").replace(/[。.!！?？]$/g, "");
  return compact.length > 22 ? `${compact.slice(0, 22)}计划` : `${compact}计划`;
}

function getFallbackTasks(input: GoalInput, goalType: GoalType, evidenceIds: string[]): PlanTask[] {
  const sourceIds = evidenceIds.slice(0, 3);
  const common: PlanTask[] = [
    {
      title: "确认目标边界与成功标准",
      description: "把目标拆成可衡量结果，确认时间、预算、地点、偏好和不可接受条件。",
      priority: "high",
      status: "todo",
      estimatedMinutes: 30,
      evidenceIds: sourceIds,
      subtasks: [
        {
          title: "整理已知条件",
          description: "记录用户已经提供的 deadline、budget、location、preferences 和 constraints。",
          priority: "high",
          status: "todo",
          estimatedMinutes: 15,
          evidenceIds: [],
          subtasks: [],
        },
      ],
    },
    {
      title: "收集必要信息",
      description: input.enableSearch
        ? "查询与目标相关的最新信息，并筛选可信来源。"
        : "基于已有资料列出需要后续确认的信息缺口。",
      priority: "high",
      status: "todo",
      estimatedMinutes: 45,
      evidenceIds: sourceIds,
      subtasks: [],
    },
    {
      title: "形成初版方案",
      description: "按照阶段、优先级和依赖关系生成可执行方案，并保留备选路径。",
      priority: "high",
      status: "todo",
      estimatedMinutes: 60,
      evidenceIds: [],
      subtasks: [],
    },
    {
      title: "执行高优先级事项",
      description: "先完成不可逆、长周期或会影响后续安排的关键任务。",
      priority: "medium",
      status: "todo",
      estimatedMinutes: 90,
      evidenceIds: [],
      subtasks: [],
    },
    {
      title: "检查风险并准备预案",
      description: "针对时间延误、预算超支、信息失真和临时变化准备替代方案。",
      priority: "medium",
      status: "todo",
      estimatedMinutes: 45,
      evidenceIds: sourceIds,
      subtasks: [],
    },
    {
      title: "复盘并更新任务清单",
      description: "根据执行结果更新任务状态，沉淀可复用模板。",
      priority: "low",
      status: "todo",
      estimatedMinutes: 30,
      evidenceIds: [],
      subtasks: [],
    },
  ];

  const typedDescriptions: Partial<Record<GoalType, string[]>> = {
    travel: ["确认交通住宿约束", "查询景点开放和天气信息", "规划每日路线", "预订关键资源", "准备行李和应急方案"],
    study: ["拆分考试范围", "收集大纲和真题", "制定周复习节奏", "安排模拟测试", "复盘错题和薄弱项"],
    event: ["明确活动目标和人数", "筛选场地和预算", "设计流程和分工", "推进通知和物资", "准备现场风险预案"],
    career: ["明确目标岗位", "梳理简历素材", "补齐作品集", "准备面试题库", "安排投递和跟进节奏"],
    shopping: ["明确需求和预算", "收集型号和评测", "建立对比表", "确认售后和价格", "下单前复核风险"],
    health: ["确认身体条件", "制定训练节奏", "安排饮食和睡眠", "记录执行数据", "根据反馈调整强度"],
  };

  const replacements = typedDescriptions[goalType];
  if (!replacements) {
    return common;
  }

  return common.map((task, index) => ({
    ...task,
    title: replacements[index] ?? task.title,
  }));
}


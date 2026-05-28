export type GoalType =
  | "travel"
  | "study"
  | "event"
  | "career"
  | "shopping"
  | "health"
  | "general";

export type TaskPriority = "high" | "medium" | "low";
export type TaskStatus = "todo" | "doing" | "done";
export type CredibilityLevel = "high" | "medium" | "low" | "unverified";
export type MemoryMode = "on" | "off";

export type GoalInput = {
  goal: string;
  deadline?: string;
  budget?: number;
  location?: string;
  preferences?: string[];
  constraints?: string[];
  enableSearch: boolean;
  qualityMode?: "fast" | "quality";
  templateId?: string;
  memoryMode?: MemoryMode;
};

export type EvidenceItem = {
  id: string;
  title: string;
  snippet: string;
  url: string;
  source: string;
  queryHash: string;
  query: string;
  credibility?: CredibilityLevel;
  domain?: string;
  citationReason?: string;
};

export type PlanTask = {
  id?: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  estimatedMinutes?: number;
  evidenceIds?: string[];
  dependencyIds?: string[];
  subtasks?: PlanTask[];
};

export type GeneratedPlan = {
  title: string;
  goalType: GoalType;
  summary: string;
  assumptions: string[];
  followUpQuestions: string[];
  searchQueries: string[];
  tasks: PlanTask[];
};

export type PlanWithTasks = {
  id: string;
  title: string;
  originalGoal: string;
  goalType: GoalType;
  status: "draft" | "active" | "archived";
  summary: string;
  assumptions: string[];
  followUpQuestions: string[];
  searchQueries: string[];
  templateId?: string;
  promptVersion?: string;
  schemaVersion?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
  tasks: StoredTask[];
  evidenceItems: EvidenceItem[];
};

export type StoredTask = PlanTask & {
  id: string;
  planId: string;
  parentTaskId?: string;
  sortOrder: number;
  riskLevel?: string;
  confirmRequired?: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type GoalTemplate = {
  id: string;
  name: string;
  goalType: GoalType;
  goalTemplate: string;
  defaultFields: {
    deadline?: string;
    budget?: string;
    location?: string;
    preferencesText?: string;
    constraintsText?: string;
    enableSearch?: boolean;
    qualityMode?: "fast" | "quality";
  };
  builtin: boolean;
};

export type PlanReview = {
  id: string;
  planId: string;
  completionRate: number;
  delayReasons: string[];
  summary: string;
  createdAt: string;
};

export type AgentStage =
  | "intent_parser"
  | "slot_extractor"
  | "question_generator"
  | "search_planner"
  | "searxng_tool"
  | "plan_generator"
  | "validator"
  | "persistence";

export type StageLogEntry = {
  stage: AgentStage;
  status: "done" | "skipped" | "failed";
  message: string;
};

export type AgentRunSummary = {
  id: string;
  planId: string | null;
  modelName: string;
  status: string;
  promptVersion?: string;
  schemaVersion?: string;
  stageLog: StageLogEntry[];
  createdAt: string;
};

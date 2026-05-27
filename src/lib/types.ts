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

export type GoalInput = {
  goal: string;
  deadline?: string;
  budget?: number;
  location?: string;
  preferences?: string[];
  constraints?: string[];
  enableSearch: boolean;
  qualityMode?: "fast" | "quality";
};

export type EvidenceItem = {
  id: string;
  title: string;
  snippet: string;
  url: string;
  source: string;
  queryHash: string;
  query: string;
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
  createdAt: string;
  updatedAt: string;
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


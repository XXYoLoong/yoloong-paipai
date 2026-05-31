"use client";

import * as React from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Save } from "lucide-react";
import type { PlanWithTasks, StoredTask, TaskPriority, TaskStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const statusLabels: Record<TaskStatus, string> = {
  todo: "待办",
  doing: "进行中",
  done: "已完成",
};

const priorityLabels: Record<TaskPriority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export function TaskBoard({ plan, onPlanChange }: { plan: PlanWithTasks; onPlanChange?: (plan: PlanWithTasks) => void }) {
  const [currentPlan, setCurrentPlan] = React.useState(plan);
  const dragEnabled = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const tasksByParent = React.useMemo(() => groupTasksByParent(currentPlan.tasks), [currentPlan.tasks]);
  const rootTasks = React.useMemo(() => tasksByParent.get(undefined) ?? [], [tasksByParent]);
  const [orderedTaskIds, setOrderedTaskIds] = React.useState<string[]>([]);
  const [selectedTaskId, setSelectedTaskId] = React.useState(rootTasks[0]?.id ?? "");
  const [collapsedTaskIds, setCollapsedTaskIds] = React.useState<Set<string>>(() => new Set());
  const orderedTasks = React.useMemo(() => {
    const byId = new Map(rootTasks.map((task) => [task.id, task]));
    const selected = orderedTaskIds.map((id) => byId.get(id)).filter((task): task is StoredTask => Boolean(task));
    const missing = rootTasks.filter((task) => !orderedTaskIds.includes(task.id));
    return [...selected, ...missing];
  }, [orderedTaskIds, rootTasks]);
  const selectedTask = currentPlan.tasks.find((task) => task.id === selectedTaskId) ?? rootTasks[0];
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = orderedTasks.findIndex((task) => task.id === active.id);
    const newIndex = orderedTasks.findIndex((task) => task.id === over.id);
    const nextTasks = arrayMove(orderedTasks, oldIndex, newIndex);
    setOrderedTaskIds(nextTasks.map((task) => task.id));

    await fetch("/api/tasks/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: nextTasks.map((task, index) => ({
          id: task.id,
          sortOrder: index,
        })),
      }),
    });
  }

  async function refreshPlan() {
    const response = await fetch(`/api/plans/${currentPlan.id}`, { cache: "no-store" });
    const data = (await response.json()) as { plan: PlanWithTasks };
    setCurrentPlan(data.plan);
    onPlanChange?.(data.plan);
  }

  function toggleCollapsed(taskId: string) {
    setCollapsedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>待办清单</CardTitle>
          <CardDescription>支持拖拽排序，点击任务查看详情。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {dragEnabled ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-3">
                  {orderedTasks.map((task) => (
                    <TaskTreeItem
                      collapsedTaskIds={collapsedTaskIds}
                      dragEnabled
                      key={task.id}
                      level={0}
                      onCreated={refreshPlan}
                      onSelectTask={setSelectedTaskId}
                      onStatusChange={async (status) => {
                        await patchTask(task.id, { status });
                        await refreshPlan();
                      }}
                      onToggleCollapsed={toggleCollapsed}
                      planId={currentPlan.id}
                      selectedTaskId={selectedTask?.id}
                      task={task}
                      tasksByParent={tasksByParent}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="flex flex-col gap-3">
              {orderedTasks.map((task) => (
                <TaskTreeItem
                  collapsedTaskIds={collapsedTaskIds}
                  dragEnabled={false}
                  key={task.id}
                  level={0}
                  onCreated={refreshPlan}
                  onSelectTask={setSelectedTaskId}
                  onStatusChange={async (status) => {
                    await patchTask(task.id, { status });
                    await refreshPlan();
                  }}
                  onToggleCollapsed={toggleCollapsed}
                  planId={currentPlan.id}
                  selectedTaskId={selectedTask?.id}
                  task={task}
                  tasksByParent={tasksByParent}
                />
              ))}
            </div>
          )}
          <ManualTaskForm planId={currentPlan.id} onCreated={refreshPlan} />
        </CardContent>
      </Card>

      <TaskDetail task={selectedTask} plan={currentPlan} tasksByParent={tasksByParent} onSaved={refreshPlan} />
    </div>
  );
}

function TaskTreeItem({
  task,
  tasksByParent,
  collapsedTaskIds,
  dragEnabled,
  level,
  planId,
  selectedTaskId,
  onSelectTask,
  onToggleCollapsed,
  onStatusChange,
  onCreated,
}: {
  task: StoredTask;
  tasksByParent: Map<string | undefined, StoredTask[]>;
  collapsedTaskIds: Set<string>;
  dragEnabled: boolean;
  level: number;
  planId: string;
  selectedTaskId?: string;
  onSelectTask: (taskId: string) => void;
  onToggleCollapsed: (taskId: string) => void;
  onStatusChange: (status: TaskStatus) => void;
  onCreated: () => void;
}) {
  const childTasks = tasksByParent.get(task.id) ?? [];
  const isCollapsed = collapsedTaskIds.has(task.id);
  const isSelected = selectedTaskId === task.id;

  return (
    <div className={cn("flex flex-col gap-2", level > 0 && "ml-5 border-l border-slate-200 pl-3")}>
      {level === 0 && dragEnabled ? (
        <SortableTaskItem
          childCount={childTasks.length}
          isCollapsed={isCollapsed}
          isSelected={isSelected}
          onClick={() => onSelectTask(task.id)}
          onStatusChange={onStatusChange}
          onToggleCollapsed={() => onToggleCollapsed(task.id)}
          task={task}
        />
      ) : (
        <NestedTaskItem
          childCount={childTasks.length}
          isCollapsed={isCollapsed}
          isSelected={isSelected}
          onClick={() => onSelectTask(task.id)}
          onStatusChange={onStatusChange}
          onToggleCollapsed={() => onToggleCollapsed(task.id)}
          task={task}
        />
      )}

      {childTasks.length && !isCollapsed ? (
        <div className="flex flex-col gap-2">
          {childTasks.map((child) => (
            <TaskTreeItem
              collapsedTaskIds={collapsedTaskIds}
              dragEnabled={dragEnabled}
              key={child.id}
              level={level + 1}
              onCreated={onCreated}
              onSelectTask={onSelectTask}
              onStatusChange={async (status) => {
                await patchTask(child.id, { status });
                await onCreated();
              }}
              onToggleCollapsed={onToggleCollapsed}
              planId={planId}
              selectedTaskId={selectedTaskId}
              task={child}
              tasksByParent={tasksByParent}
            />
          ))}
        </div>
      ) : null}

      {level === 0 && !isCollapsed ? (
        <div className="ml-9">
          <ManualTaskForm compact parentTaskId={task.id} planId={planId} onCreated={onCreated} />
        </div>
      ) : null}
    </div>
  );
}

function SortableTaskItem({
  task,
  childCount,
  isCollapsed,
  isSelected,
  onClick,
  onStatusChange,
  onToggleCollapsed,
}: {
  task: StoredTask;
  childCount: number;
  isCollapsed: boolean;
  isSelected: boolean;
  onClick: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onToggleCollapsed: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-lg border bg-surface-2 p-3 text-left transition",
        isSelected ? "border-teal-400 ring-2 ring-teal-100" : "border-slate-200 hover:border-slate-300",
      )}
    >
      <button className="mt-1 cursor-grab text-slate-400 active:cursor-grabbing" type="button" aria-label="拖拽排序" {...attributes} {...listeners}>
        <GripVertical aria-hidden="true" />
      </button>
      <button className="min-w-0 text-left" type="button" onClick={onClick}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-950">{task.title}</span>
          <Badge tone={task.priority === "high" ? "rose" : task.priority === "medium" ? "amber" : "slate"}>{priorityLabels[task.priority]}</Badge>
          {childCount ? <Badge tone="indigo">{childCount} 个子任务</Badge> : null}
        </div>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{task.description}</p>
      </button>
      <div className="flex items-center gap-1">
        {childCount ? (
          <button
            className="mt-1 flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            type="button"
            aria-label={isCollapsed ? "展开子任务" : "收起子任务"}
            onClick={onToggleCollapsed}
          >
            {isCollapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </button>
        ) : null}
      <button
        className={cn(
          "mt-1 flex size-8 items-center justify-center rounded-md border text-xs transition",
          task.status === "done" ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 text-slate-500 hover:bg-slate-50",
        )}
        type="button"
        aria-label="切换完成状态"
        onClick={() => onStatusChange(task.status === "done" ? "todo" : "done")}
      >
        <Check aria-hidden="true" />
      </button>
      </div>
    </div>
  );
}

function NestedTaskItem({
  task,
  childCount,
  isCollapsed,
  isSelected,
  onClick,
  onStatusChange,
  onToggleCollapsed,
}: {
  task: StoredTask;
  childCount: number;
  isCollapsed: boolean;
  isSelected: boolean;
  onClick: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onToggleCollapsed: () => void;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto] items-start gap-3 rounded-lg border bg-surface-2 p-3 text-left transition",
        isSelected ? "border-teal-400 ring-2 ring-teal-100" : "border-slate-200 hover:border-slate-300",
      )}
    >
      <button className="min-w-0 text-left" type="button" onClick={onClick}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-950">{task.title}</span>
          <Badge tone={task.priority === "high" ? "rose" : task.priority === "medium" ? "amber" : "slate"}>{priorityLabels[task.priority]}</Badge>
          {childCount ? <Badge tone="indigo">{childCount} 个子任务</Badge> : null}
        </div>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{task.description}</p>
      </button>
      <div className="flex items-center gap-1">
        {childCount ? (
          <button
            className="flex size-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            type="button"
            aria-label={isCollapsed ? "展开子任务" : "收起子任务"}
            onClick={onToggleCollapsed}
          >
            {isCollapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </button>
        ) : null}
        <button
          className={cn(
            "flex size-8 items-center justify-center rounded-md border text-xs transition",
            task.status === "done" ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 text-slate-500 hover:bg-slate-50",
          )}
          type="button"
          aria-label="切换完成状态"
          onClick={() => onStatusChange(task.status === "done" ? "todo" : "done")}
        >
          <Check aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function TaskDetail({
  task,
  plan,
  tasksByParent,
  onSaved,
}: {
  task?: StoredTask;
  plan: PlanWithTasks;
  tasksByParent: Map<string | undefined, StoredTask[]>;
  onSaved: () => void;
}) {
  const [editing, setEditing] = React.useState(false);

  if (!task) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-slate-500">暂无任务。</p>
        </CardContent>
      </Card>
    );
  }

  const evidence = plan.evidenceItems.filter((item) => task.evidenceIds?.includes(item.id));
  const childTasks = tasksByParent.get(task.id) ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{editing ? "编辑任务" : task.title}</CardTitle>
            <CardDescription>查看任务原因、状态和关联来源。</CardDescription>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setEditing((value) => !value)}>
            {editing ? <Check data-icon="inline-start" aria-hidden="true" /> : <Pencil data-icon="inline-start" aria-hidden="true" />}
            {editing ? "取消" : "编辑"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {editing ? (
          <TaskEditForm
            key={task.id}
            allTasks={plan.tasks}
            task={task}
            onCancel={() => setEditing(false)}
            onSaved={async () => {
              setEditing(false);
              await onSaved();
            }}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge tone={task.status === "done" ? "teal" : task.status === "doing" ? "indigo" : "slate"}>{statusLabels[task.status]}</Badge>
              <Badge tone={task.priority === "high" ? "rose" : task.priority === "medium" ? "amber" : "slate"}>优先级 {priorityLabels[task.priority]}</Badge>
              {task.dueDate ? <Badge tone="indigo">截止 {task.dueDate}</Badge> : <Badge tone="slate">未设截止</Badge>}
              {task.estimatedMinutes ? <Badge tone="slate">{task.estimatedMinutes} 分钟</Badge> : null}
            </div>
            <p className="text-sm leading-7 text-slate-700">{task.description}</p>
          </>
        )}

        <div className="rounded-lg bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-950">为什么要做这个任务</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            它属于目标执行链条中的一个可控节点。先完成这一步，可以降低后续任务的不确定性，并让计划从“想法”进入“可执行动作”。
          </p>
        </div>

        {childTasks.length ? (
          <div>
            <div className="text-sm font-semibold text-slate-950">子任务</div>
            <div className="mt-3 flex flex-col gap-2">
              {childTasks.map((child) => (
                <div className="rounded-md border border-slate-200 p-3" key={child.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-950">{child.title}</span>
                    <Badge tone={child.status === "done" ? "teal" : child.status === "doing" ? "indigo" : "slate"}>{statusLabels[child.status]}</Badge>
                    <Badge tone={child.priority === "high" ? "rose" : child.priority === "medium" ? "amber" : "slate"}>{priorityLabels[child.priority]}</Badge>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{child.description}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <div className="text-sm font-semibold text-slate-950">信息来源</div>
          <div className="mt-3 flex flex-col gap-2">
            {evidence.length ? (
              evidence.map((item) => (
                <a className="rounded-md border border-slate-200 p-3 text-sm leading-6 text-slate-600 transition hover:border-teal-300 hover:bg-teal-50" href={item.url} key={item.id} target="_blank" rel="noreferrer">
                  <span className="font-medium text-slate-950">{item.title}</span>
                  <span className="mt-1 block line-clamp-2">{item.snippet}</span>
                </a>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-200 p-3 text-sm text-slate-500">这个任务没有绑定搜索来源，适合人工确认后再执行。</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskEditForm({
  task,
  allTasks,
  onCancel,
  onSaved,
}: {
  task: StoredTask;
  allTasks: StoredTask[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.description);
  const [priority, setPriority] = React.useState<TaskPriority>(task.priority);
  const [status, setStatus] = React.useState<TaskStatus>(task.status);
  const [dueDate, setDueDate] = React.useState(task.dueDate ?? "");
  const [dependencyIds, setDependencyIds] = React.useState<string[]>(task.dependencyIds ?? []);

  const dependencyOptions = allTasks.filter((item) => item.id !== task.id);

  function toggleDependency(id: string) {
    setDependencyIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function save() {
    await patchTask(task.id, {
      title,
      description,
      priority,
      status,
      dueDate: dueDate.trim() ? dueDate : null,
      dependencyIds,
    });
    await onSaved();
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>任务名</FieldLabel>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel>说明</FieldLabel>
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>优先级</FieldLabel>
          <select className="h-10 rounded-md border border-slate-200 px-3 text-sm" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </Field>
        <Field>
          <FieldLabel>状态</FieldLabel>
          <select className="h-10 rounded-md border border-slate-200 px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
            <option value="todo">待办</option>
            <option value="doing">进行中</option>
            <option value="done">已完成</option>
          </select>
        </Field>
      </div>
      <Field>
        <FieldLabel>任务截止时间</FieldLabel>
        <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel>前置依赖任务</FieldLabel>
        <div className="flex max-h-32 flex-col gap-1 overflow-auto rounded-md border border-slate-200 p-2">
          {dependencyOptions.length ? (
            dependencyOptions.map((item) => (
              <label className="flex items-center gap-2 text-sm text-slate-700" key={item.id}>
                <input type="checkbox" checked={dependencyIds.includes(item.id)} onChange={() => toggleDependency(item.id)} />
                {item.title}
              </label>
            ))
          ) : (
            <span className="text-xs text-slate-500">无其它任务可选</span>
          )}
        </div>
      </Field>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save}>
          <Save data-icon="inline-start" aria-hidden="true" />
          保存
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          取消
        </Button>
      </div>
    </FieldGroup>
  );
}

function ManualTaskForm({
  planId,
  parentTaskId,
  compact = false,
  onCreated,
}: {
  planId: string;
  parentTaskId?: string;
  compact?: boolean;
  onCreated: () => void;
}) {
  const [title, setTitle] = React.useState("");

  async function createTask() {
    if (!title.trim()) {
      return;
    }

    await fetch(`/api/plans/${planId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        description: parentTaskId ? "手动新增子任务，可继续编辑说明和优先级。" : "手动新增任务，可继续编辑说明和优先级。",
        priority: "medium",
        parentTaskId,
      }),
    });
    setTitle("");
    await onCreated();
  }

  return (
    <div className="flex gap-2">
      <Input
        className={compact ? "h-9" : undefined}
        placeholder={parentTaskId ? "新增子任务" : "手动新增任务"}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <Button type="button" size={compact ? "sm" : "icon"} variant="secondary" onClick={createTask} aria-label="新增任务">
        <Plus aria-hidden="true" />
      </Button>
    </div>
  );
}

async function patchTask(taskId: string, patch: Record<string, unknown>) {
  await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
}

function groupTasksByParent(tasks: StoredTask[]) {
  const groups = new Map<string | undefined, StoredTask[]>();
  for (const task of tasks) {
    const group = groups.get(task.parentTaskId) ?? [];
    group.push(task);
    groups.set(task.parentTaskId, group);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return groups;
}

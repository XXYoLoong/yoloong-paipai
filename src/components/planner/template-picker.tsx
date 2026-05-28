"use client";

import * as React from "react";
import type { GoalTemplate } from "@/lib/types";
import { fillTemplateGoal } from "@/lib/templates/builtin-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function TemplatePicker({
  templates: initialTemplates,
  onApply,
}: {
  templates: GoalTemplate[];
  onApply: (payload: {
    templateId: string;
    goal: string;
    deadline?: string;
    location?: string;
    budget?: string;
    preferencesText?: string;
    constraintsText?: string;
    enableSearch?: boolean;
    qualityMode?: "fast" | "quality";
  }) => void;
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const templates = initialTemplates;

  function applyTemplate(template: GoalTemplate) {
    setSelectedId(template.id);
    onApply({
      templateId: template.id,
      goal: fillTemplateGoal(template),
      deadline: template.defaultFields.deadline,
      location: template.defaultFields.location,
      budget: template.defaultFields.budget,
      preferencesText: template.defaultFields.preferencesText,
      constraintsText: template.defaultFields.constraintsText,
      enableSearch: template.defaultFields.enableSearch,
      qualityMode: template.defaultFields.qualityMode,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-medium text-slate-800">模板库</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {templates.map((template) => (
          <button
            className={`rounded-lg border p-3 text-left text-sm transition hover:border-teal-300 hover:bg-teal-50 ${
              selectedId === template.id ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white"
            }`}
            key={template.id}
            type="button"
            onClick={() => applyTemplate(template)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-950">{template.name}</span>
              <Badge tone="teal">{template.goalType}</Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{fillTemplateGoal(template)}</p>
          </button>
        ))}
      </div>
      {selectedId ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
          清除模板选择
        </Button>
      ) : null}
    </div>
  );
}

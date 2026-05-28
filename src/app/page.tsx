import { PlannerApp } from "@/components/planner/planner-app";
import { listPlans } from "@/lib/db/queries";
import { listTemplates } from "@/lib/templates/builtin";

export default function Home() {
  const recentPlans = listPlans();
  const templates = listTemplates();

  return <PlannerApp recentPlans={recentPlans} templates={templates} />;
}

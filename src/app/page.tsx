import { PlannerApp } from "@/components/planner/planner-app";
import { listPlans } from "@/lib/db/queries";

export default function Home() {
  const recentPlans = listPlans();

  return <PlannerApp recentPlans={recentPlans} />;
}

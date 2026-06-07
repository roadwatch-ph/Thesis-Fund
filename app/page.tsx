import { AppShell } from "@/components/app-shell";
import { DashboardClient } from "@/components/dashboard-client";
import { getDashboardData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();
  return (
    <AppShell active="Dashboard">
      <DashboardClient data={data} />
    </AppShell>
  );
}

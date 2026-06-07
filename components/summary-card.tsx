import type { LucideIcon } from "lucide-react";

export function SummaryCard({ label, value, helper, icon: Icon, tone = "blue" }: { label: string; value: string | number; helper: string; icon: LucideIcon; tone?: "blue" | "green" | "orange" | "purple" | "red" }) {
  const gradients = {
    blue: "from-blue-500 to-blue-700 shadow-blue-500/20",
    green: "from-emerald-500 to-green-700 shadow-emerald-500/20",
    orange: "from-amber-400 to-orange-600 shadow-orange-500/20",
    purple: "from-violet-500 to-indigo-700 shadow-violet-500/20",
    red: "from-red-500 to-rose-700 shadow-red-500/20",
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-5">
        <div className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-lg ${gradients[tone]}`}><Icon className="h-7 w-7" /></div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{helper}</p>
        </div>
      </div>
    </div>
  );
}

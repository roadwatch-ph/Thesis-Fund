import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import type { PaymentStatus } from "@/lib/types";

const config = {
  Paid: { className: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  Pending: { className: "bg-orange-50 text-orange-700", icon: Clock3 },
  Missing: { className: "bg-red-50 text-red-700", icon: XCircle },
};

export function StatusPill({ status }: { status: PaymentStatus }) {
  const Icon = config[status].icon;
  return <span className={`pill ${config[status].className}`}><Icon className="h-4 w-4" />{status}</span>;
}

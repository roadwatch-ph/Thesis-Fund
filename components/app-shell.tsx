import type { ReactNode } from "react";
import Link from "next/link";
import { BarChart3, CalendarDays, CloudUpload, FileText, LayoutDashboard, LogOut, Menu, ReceiptText, UserCircle } from "lucide-react";
import { DEFAULT_WEEKLY_CONTRIBUTION } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Upload Payment", href: "/submit", icon: CloudUpload },
  { label: "My Contributions", href: "/#member-summary", icon: UserCircle },
  { label: "Payment Schedule", href: "/#payment-matrix", icon: CalendarDays },
  { label: "Receipts", href: "/#recent-payments", icon: ReceiptText },
  { label: "Summary", href: "/#collection-summary", icon: BarChart3 },
];

export function AppShell({ children, active = "Dashboard" }: { children: ReactNode; active?: string }) {
  return (
    <div className="min-h-screen bg-slate-50 text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200/80 bg-white/90 px-5 py-7 backdrop-blur xl:block">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-2xl font-bold text-white shadow-lg shadow-blue-500/25">P</div>
          <div>
            <p className="font-bold tracking-tight">PAYMENT TRACKER</p>
            <p className="text-sm text-slate-500">Weekly Contribution System</p>
          </div>
        </Link>

        <nav className="mt-10 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.label === active;
            return (
              <Link key={item.label} href={item.href} className={`flex items-center gap-4 rounded-2xl px-4 py-3 text-sm font-semibold transition ${isActive ? "bg-blue-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-24 left-5 right-5 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-card">
          <p className="text-sm font-bold text-brand-700">Contribution Details</p>
          <dl className="mt-5 space-y-4 text-sm">
            <div><dt className="text-slate-500">Amount per week</dt><dd className="mt-1 text-xl font-bold">{formatCurrency(DEFAULT_WEEKLY_CONTRIBUTION)}</dd></div>
            <div><dt className="text-slate-500">Total Weeks</dt><dd className="mt-1 text-xl font-bold">30</dd></div>
            <div><dt className="text-slate-500">Duration</dt><dd className="mt-1 font-bold">June 7 - Dec 27, 2026</dd></div>
          </dl>
        </div>

        <button className="absolute bottom-8 left-5 right-5 flex items-center gap-4 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
          <LogOut className="h-5 w-5" /> Logout
        </button>
      </aside>

      <main className="xl:pl-72">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/60 bg-white/85 px-5 py-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-4">
            <button className="rounded-2xl p-2 text-slate-600 hover:bg-slate-100 xl:hidden"><Menu className="h-6 w-6" /></button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{active}</h1>
              <p className="text-sm text-slate-500">Overview of all member payments</p>
            </div>
          </div>
          <div className="hidden items-center gap-4 md:flex">
            <button className="rounded-2xl p-3 text-slate-600 hover:bg-slate-100"><FileText className="h-5 w-5" /></button>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <UserCircle className="h-8 w-8 text-slate-500" />
              <div><p className="text-sm font-bold">Admin</p><p className="text-xs text-slate-500">Administrator</p></div>
            </div>
          </div>
        </header>
        <div className="p-5 md:p-8">{children}</div>
      </main>
    </div>
  );
}

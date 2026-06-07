"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, CalendarDays, Check, ChevronRight, Clock3, CloudUpload, Eye, RefreshCw, Search, Users, WalletCards, XCircle } from "lucide-react";
import { Pie, PieChart, Cell, ResponsiveContainer } from "recharts";
import { SummaryCard } from "@/components/summary-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate, formatShortDate } from "@/lib/format";
import type { DashboardData, Payment, PaymentStatus } from "@/lib/types";

const chartColors = ["#22c55e", "#2563eb", "#cbd5e1"];
const statusOptions: Array<"All" | PaymentStatus> = ["All", "Paid", "Pending", "Missing"];

export function DashboardClient({ data }: { data: DashboardData }) {
  const [dashboardData, setDashboardData] = useState(data);
  const [selectedWeek, setSelectedWeek] = useState(data.totals.currentDueDate);
  const [selectedStatus, setSelectedStatus] = useState<"All" | PaymentStatus>("All");
  const [memberSearch, setMemberSearch] = useState("");
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  const refreshDashboard = useCallback(() => {
    setRefreshError(null);
    startRefresh(async () => {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          setRefreshError(payload.message ?? "Unable to refresh dashboard data.");
          return;
        }

        setDashboardData(payload as DashboardData);
        setLastUpdated(new Date());
      } catch (error) {
        setRefreshError(error instanceof Error ? error.message : "Unable to refresh dashboard data.");
      }
    });
  }, []);

  useEffect(() => {
    setDashboardData(data);
  }, [data]);

  const selectedWeekLabel = useMemo(() => formatDate(selectedWeek), [selectedWeek]);
  const selectedWeekStatuses = useMemo(() => {
    const statusCounts: Record<PaymentStatus, number> = { Paid: 0, Pending: 0, Missing: 0 };

    for (const member of dashboardData.members) {
      const status = dashboardData.weeklyStatuses[member.name]?.[selectedWeek] ?? "Pending";
      statusCounts[status] += 1;
    }

    return statusCounts;
  }, [dashboardData.members, dashboardData.weeklyStatuses, selectedWeek]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();

    return dashboardData.members.filter((member) => {
      const status = dashboardData.weeklyStatuses[member.name]?.[selectedWeek] ?? "Pending";
      const matchesName = !query || member.name.toLowerCase().includes(query) || member.id.toLowerCase().includes(query);
      const matchesStatus = selectedStatus === "All" || status === selectedStatus;
      return matchesName && matchesStatus;
    });
  }, [dashboardData.members, dashboardData.weeklyStatuses, memberSearch, selectedStatus, selectedWeek]);

  const chartData = useMemo(() => [
    { name: "Collected", value: dashboardData.totals.collectedAmount },
    { name: "Remaining", value: Math.max(dashboardData.totals.remainingAmount, 0) },
    { name: "Not Started", value: dashboardData.totals.collectedAmount || dashboardData.totals.remainingAmount ? 0 : dashboardData.totals.expectedCollection },
  ], [dashboardData.totals.collectedAmount, dashboardData.totals.expectedCollection, dashboardData.totals.remainingAmount]);

  const recentPayments = useMemo(
    () => [...dashboardData.payments].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5),
    [dashboardData.payments],
  );
  const upcomingDates = dashboardData.dueDates.filter((date) => date > dashboardData.totals.currentDueDate).slice(0, 5);
  const totalMembers = Math.max(dashboardData.totals.totalMembers, 1);

  return (
    <>
      <section className="mb-5 flex flex-col gap-3 rounded-3xl border border-blue-100 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold text-brand-700">Live Dashboard</p>
          <p className="mt-1 text-sm text-slate-500">
            Data is loaded from the active backend and can be refreshed after uploads or verification.
          </p>
          {lastUpdated && <p className="mt-1 text-xs font-semibold text-slate-400">Last refreshed: {lastUpdated.toLocaleString()}</p>}
          {refreshError && <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-red-600"><AlertCircle className="h-4 w-4" />{refreshError}</p>}
        </div>
        <button onClick={refreshDashboard} disabled={isRefreshing} className="btn-secondary justify-center disabled:cursor-not-allowed disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh Data
        </button>
      </section>

      <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
        <SummaryCard label="Total Members" value={dashboardData.totals.totalMembers} helper={`${filteredMembers.length} shown in current filter`} icon={Users} />
        <SummaryCard label="Paid This Week" value={selectedWeekStatuses.Paid} helper={`${Math.round((selectedWeekStatuses.Paid / totalMembers) * 100)}% for ${selectedWeekLabel}`} icon={Check} tone="green" />
        <SummaryCard label="Pending This Week" value={selectedWeekStatuses.Pending} helper={`${Math.round((selectedWeekStatuses.Pending / totalMembers) * 100)}% for ${selectedWeekLabel}`} icon={Clock3} tone="orange" />
        <SummaryCard label="Total Collection" value={formatCurrency(dashboardData.totals.collectedAmount)} helper={`of ${formatCurrency(dashboardData.totals.expectedCollection)}`} icon={WalletCards} tone="purple" />
      </section>

      <section className="mt-5 grid gap-5 2xl:grid-cols-[1fr_460px]">
        <div id="payment-matrix" className="card p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-bold">Weekly Payment Tracker</h2>
              <p className="mt-1 text-sm text-slate-500">Green = Paid, Orange = Pending review/payment, Red = Missing</p>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_170px_160px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} className="input pl-9" placeholder="Search member or ID" />
              </label>
              <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as "All" | PaymentStatus)} className="input">
                {statusOptions.map((status) => <option key={status} value={status}>{status} statuses</option>)}
              </select>
              <select value={selectedWeek} onChange={(event) => setSelectedWeek(event.target.value)} className="input">
                {dashboardData.dueDates.map((date) => <option key={date} value={date}>{formatDate(date)} (Sunday)</option>)}
              </select>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <StatusCounter label="Paid" value={selectedWeekStatuses.Paid} tone="bg-emerald-50 text-emerald-700" />
            <StatusCounter label="Pending" value={selectedWeekStatuses.Pending} tone="bg-orange-50 text-orange-700" />
            <StatusCounter label="Missing" value={selectedWeekStatuses.Missing} tone="bg-red-50 text-red-700" />
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3">Member</th>
                  <th className="px-4 py-3">Selected Week</th>
                  {dashboardData.dueDates.map((date) => <th key={date} className="whitespace-nowrap px-3 py-3 text-center normal-case">{formatShortDate(date)}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredMembers.map((member) => (
                  <tr key={member.id}>
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-4 font-semibold">
                      <span>{member.name}</span>
                      <span className="ml-2 text-xs font-medium text-slate-400">{member.id}</span>
                    </td>
                    <td className="px-4 py-4"><StatusPill status={dashboardData.weeklyStatuses[member.name]?.[selectedWeek] ?? "Pending"} /></td>
                    {dashboardData.dueDates.map((date) => {
                      const status = dashboardData.weeklyStatuses[member.name]?.[date] ?? "Pending";
                      const colors = status === "Paid" ? "bg-emerald-500" : status === "Pending" ? "bg-orange-400" : "bg-red-500";
                      return <td key={date} className="px-3 py-4 text-center"><button type="button" onClick={() => setSelectedWeek(date)} title={`${member.name} - ${formatDate(date)}: ${status}. Click to view this week.`} className={`mx-auto block h-3.5 w-3.5 rounded-full ring-offset-2 transition hover:scale-125 hover:ring-2 hover:ring-brand-300 ${colors}`} /></td>;
                    })}
                  </tr>
                ))}
                {!filteredMembers.length && (
                  <tr>
                    <td colSpan={dashboardData.dueDates.length + 2} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">No members match the selected filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside id="collection-summary" className="space-y-5">
          <div className="card p-6">
            <h2 className="text-lg font-bold">Collection Summary</h2>
            <div className="mt-5 grid items-center gap-5 md:grid-cols-[190px_1fr] 2xl:grid-cols-1">
              <div className="relative h-48">
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" innerRadius={58} outerRadius={86} paddingAngle={1}>{chartData.map((entry, index) => <Cell key={entry.name} fill={chartColors[index]} />)}</Pie></PieChart></ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center"><p className="text-3xl font-bold">{dashboardData.totals.collectionPercentage}%</p><p className="text-sm text-slate-500">Collected</p></div>
              </div>
              <dl className="space-y-3 text-sm">
                <SummaryRow label="Expected Total" value={formatCurrency(dashboardData.totals.expectedCollection)} />
                <SummaryRow label="Collected" value={formatCurrency(dashboardData.totals.collectedAmount)} />
                <SummaryRow label="Remaining" value={formatCurrency(dashboardData.totals.remainingAmount)} />
                <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${dashboardData.totals.collectionPercentage}%` }} /></div>
              </dl>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-bold">Upcoming Due Dates</h2>
            <div className="mt-4 space-y-4">
              {upcomingDates.map((date) => (
                <button key={date} type="button" onClick={() => setSelectedWeek(date)} className="flex w-full items-center justify-between gap-3 rounded-2xl p-2 text-left transition hover:bg-slate-50">
                  <div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-slate-500" /><div><p className="font-semibold">{formatDate(date)} (Sun)</p><p className="text-xs text-slate-500">Week {dashboardData.dueDates.indexOf(date) + 1}</p></div></div>
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-600">₱100</span>
                </button>
              ))}
            </div>
            <Link href="/submit" className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5 text-sm font-bold text-brand-700">Submit a payment <ChevronRight className="h-5 w-5" /></Link>
          </div>
        </aside>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_420px]">
        <div id="member-summary" className="card p-5 md:p-6">
          <h2 className="text-lg font-bold">Member Contribution Summary</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {dashboardData.summaries.filter((summary) => filteredMembers.some((member) => member.id === summary.member.id)).map((summary) => (
              <div key={summary.member.id} className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{summary.member.name}</h3><p className="text-sm text-slate-500">{summary.paidWeeks}/{dashboardData.dueDates.length} paid weeks</p></div><p className="text-lg font-bold text-emerald-600">{formatCurrency(summary.totalContribution)}</p></div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${summary.progress}%` }} /></div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <SummaryRow label="Remaining" value={formatCurrency(summary.remainingBalance)} />
                  <SummaryRow label="Progress" value={`${summary.progress}%`} />
                  <SummaryRow label="Last Payment" value={summary.lastPaymentDate ? formatDate(summary.lastPaymentDate, "MMM d, yyyy") : "—"} />
                  <SummaryRow label="Next Due" value={summary.nextDueDate ? formatDate(summary.nextDueDate, "MMM d, yyyy") : "Complete"} />
                </dl>
              </div>
            ))}
          </div>
        </div>

        <div id="recent-payments" className="card p-5 md:p-6">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Recent Payments</h2><Link href="/submit" className="text-sm font-bold text-brand-700">Upload</Link></div>
          <div className="mt-5 divide-y divide-slate-100">
            {recentPayments.length ? recentPayments.map((payment) => (
              <button key={`${payment.memberName}-${payment.dueDate}-${payment.referenceNumber}`} onClick={() => setReceipt(payment)} className="flex w-full items-center justify-between gap-4 py-4 text-left hover:bg-slate-50">
                <div className="flex items-center gap-3"><ReceiptIcon /><div><p className="font-semibold">{payment.memberName}</p><p className="text-sm text-slate-500">{formatDate(payment.dueDate, "MMM d, yyyy")} · Ref: {payment.referenceNumber}</p></div></div>
                <div className="text-right"><p className="font-bold">{formatCurrency(payment.amountPaid)}</p><p className={`text-xs font-semibold ${payment.status === "Paid" ? "text-emerald-600" : payment.status === "Pending" ? "text-orange-600" : "text-red-600"}`}>{payment.status}</p></div>
              </button>
            )) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                <ReceiptIcon />
                <p className="mt-4 font-semibold text-slate-800">No payment uploads yet</p>
                <p className="mt-1 text-sm text-slate-500">Submitted receipts will appear here once members upload their proof of payment.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <Link href="/submit" className="fixed bottom-6 right-6 z-20 flex h-24 w-24 flex-col items-center justify-center rounded-full bg-brand-600 text-center text-sm font-bold text-white shadow-2xl shadow-blue-600/30 transition hover:bg-brand-700"><CloudUpload className="mb-1 h-7 w-7" />Upload<br />Receipt</Link>

      {receipt && <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} onVerified={refreshDashboard} />}
    </>
  );
}

function StatusCounter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className={`rounded-2xl px-4 py-3 ${tone}`}><p className="text-xs font-bold uppercase tracking-wide opacity-80">{label}</p><p className="mt-1 text-2xl font-extrabold">{value}</p></div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="font-bold">{value}</dd></div>;
}

function ReceiptIcon() {
  return <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-brand-700"><Eye className="h-5 w-5" /></div>;
}

function ReceiptModal({ payment, onClose, onVerified }: { payment: Payment; onClose: () => void; onVerified: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function verifyPayment() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referenceNumber: payment.referenceNumber,
            dueDate: payment.dueDate,
            memberName: payment.memberName,
          }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          setError(payload.message ?? "Unable to verify payment.");
          return;
        }

        setMessage(payload.message ?? "Payment verified.");
        onVerified();
      } catch (error) {
        setError(error instanceof Error ? error.message : "Unable to verify payment.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-bold">Receipt Viewer</h2><p className="mt-1 text-sm text-slate-500">{payment.memberName} · {formatDate(payment.dueDate)} · {payment.referenceNumber}</p></div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><XCircle className="h-6 w-6" /></button>
        </div>
        <div className="mt-6 flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <div><Eye className="mx-auto h-12 w-12 text-slate-400" /><p className="mt-3 font-semibold">Preview depends on Google Drive sharing settings.</p><p className="mt-1 text-sm text-slate-500">Open the uploaded file in Drive to inspect the receipt and verify payment.</p></div>
        </div>
        {(message || error) && (
          <div className={`mt-5 rounded-2xl px-4 py-3 text-sm font-semibold ${message ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {message || error}
          </div>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <a href={payment.receiptLink} target="_blank" rel="noreferrer" className="btn-secondary">Open Receipt File</a>
          <button onClick={verifyPayment} disabled={isPending || payment.status === "Paid"} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
            {isPending ? <Clock3 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {payment.status === "Paid" ? "Verified" : "Verify Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

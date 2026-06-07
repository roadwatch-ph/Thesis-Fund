"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronRight, Clock3, CloudUpload, Eye, Users, WalletCards, XCircle } from "lucide-react";
import { Pie, PieChart, Cell, ResponsiveContainer } from "recharts";
import { SummaryCard } from "@/components/summary-card";
import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate, formatShortDate } from "@/lib/format";
import type { DashboardData, Payment } from "@/lib/types";

const chartColors = ["#22c55e", "#2563eb", "#cbd5e1"];

export function DashboardClient({ data }: { data: DashboardData }) {
  const [selectedWeek, setSelectedWeek] = useState(data.totals.currentDueDate);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const chartData = [
    { name: "Collected", value: data.totals.collectedAmount },
    { name: "Remaining", value: data.totals.remainingAmount },
    { name: "Not Started", value: 0 },
  ];
  const recentPayments = [...data.payments].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);
  const upcomingDates = data.dueDates.filter((date) => date > data.totals.currentDueDate).slice(0, 5);

  return (
    <>
      <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
        <SummaryCard label="Total Members" value={data.totals.totalMembers} helper="Active Members" icon={Users} />
        <SummaryCard label="Paid This Week" value={data.totals.paidThisWeek} helper={`${Math.round((data.totals.paidThisWeek / data.totals.totalMembers) * 100)}% of members`} icon={Check} tone="green" />
        <SummaryCard label="Pending This Week" value={data.totals.pendingThisWeek} helper={`${Math.round((data.totals.pendingThisWeek / data.totals.totalMembers) * 100)}% of members`} icon={Clock3} tone="orange" />
        <SummaryCard label="Total Collection" value={formatCurrency(data.totals.collectedAmount)} helper={`of ${formatCurrency(data.totals.expectedCollection)}`} icon={WalletCards} tone="purple" />
      </section>

      <section className="mt-5 grid gap-5 2xl:grid-cols-[1fr_460px]">
        <div id="payment-matrix" className="card p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold">Weekly Payment Tracker</h2>
              <p className="mt-1 text-sm text-slate-500">Green = Paid, Orange = Pending, Red = Missing</p>
            </div>
            <select value={selectedWeek} onChange={(event) => setSelectedWeek(event.target.value)} className="input max-w-xs">
              {data.dueDates.map((date) => <option key={date} value={date}>{formatDate(date)} (Sunday)</option>)}
            </select>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3">Member</th>
                  <th className="px-4 py-3">Selected Week</th>
                  {data.dueDates.map((date) => <th key={date} className="whitespace-nowrap px-3 py-3 text-center normal-case">{formatShortDate(date)}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {data.members.map((member) => (
                  <tr key={member.id}>
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-4 font-semibold">{member.name}</td>
                    <td className="px-4 py-4"><StatusPill status={data.weeklyStatuses[member.name][selectedWeek]} /></td>
                    {data.dueDates.map((date) => {
                      const status = data.weeklyStatuses[member.name][date];
                      const colors = status === "Paid" ? "bg-emerald-500" : status === "Pending" ? "bg-orange-400" : "bg-red-500";
                      return <td key={date} className="px-3 py-4 text-center"><span title={`${member.name} - ${formatDate(date)}: ${status}`} className={`mx-auto block h-3 w-3 rounded-full ${colors}`} /></td>;
                    })}
                  </tr>
                ))}
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
                <div className="absolute inset-0 flex flex-col items-center justify-center"><p className="text-3xl font-bold">{data.totals.collectionPercentage}%</p><p className="text-sm text-slate-500">Collected</p></div>
              </div>
              <dl className="space-y-3 text-sm">
                <SummaryRow label="Expected Total" value={formatCurrency(data.totals.expectedCollection)} />
                <SummaryRow label="Collected" value={formatCurrency(data.totals.collectedAmount)} />
                <SummaryRow label="Remaining" value={formatCurrency(data.totals.remainingAmount)} />
                <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${data.totals.collectionPercentage}%` }} /></div>
              </dl>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-bold">Upcoming Due Dates</h2>
            <div className="mt-4 space-y-4">
              {upcomingDates.map((date) => (
                <div key={date} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-slate-500" /><div><p className="font-semibold">{formatDate(date)} (Sun)</p><p className="text-xs text-slate-500">Week {data.dueDates.indexOf(date) + 1}</p></div></div>
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-600">₱100</span>
                </div>
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
            {data.summaries.map((summary) => (
              <div key={summary.member.id} className="rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{summary.member.name}</h3><p className="text-sm text-slate-500">{summary.paidWeeks}/30 paid weeks</p></div><p className="text-lg font-bold text-emerald-600">{formatCurrency(summary.totalContribution)}</p></div>
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
                <div className="text-right"><p className="font-bold">{formatCurrency(payment.amountPaid)}</p><p className="text-xs text-emerald-600">{payment.status}</p></div>
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

      {receipt && <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">{label}</dt><dd className="font-bold">{value}</dd></div>;
}

function ReceiptIcon() {
  return <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-brand-700"><Eye className="h-5 w-5" /></div>;
}

function ReceiptModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
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
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end"><a href={payment.receiptLink} target="_blank" rel="noreferrer" className="btn-secondary">Open Google Drive File</a><button className="btn-primary"><Check className="h-4 w-4" />Verify Payment</button></div>
      </div>
    </div>
  );
}

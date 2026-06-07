"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, CloudUpload, FileUp, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Member } from "@/lib/types";

export function PaymentForm({ members, dueDates }: { members: Member[]; dueDates: string[] }) {
  const [selectedMember, setSelectedMember] = useState(members[0]?.name ?? "");
  const [selectedDate, setSelectedDate] = useState(dueDates[0] ?? "");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [amountPaid, setAmountPaid] = useState("250");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedMemberDetails = useMemo(() => members.find((member) => member.name === selectedMember), [members, selectedMember]);

  function submitPayment(formData: FormData) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/payments", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.message ?? "Payment submission failed.");
        return;
      }
      setMessage("Payment saved to Google Sheets and receipt uploaded to Google Drive.");
      setReferenceNumber("");
      setReceipt(null);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <form action={submitPayment} className="card p-6 md:p-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-brand-600">Simple payment submission</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">Upload GCash Receipt</h2>
          <p className="mt-2 max-w-2xl text-slate-500">The system uploads the receipt to the member's Google Drive folder, saves the receipt URL to Google Sheets, and marks the selected due date as Paid.</p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <label className="block"><span className="text-sm font-semibold text-slate-700">Member Name</span><select name="memberName" value={selectedMember} onChange={(event) => setSelectedMember(event.target.value)} className="input mt-2" required>{members.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}</select></label>
          <label className="block"><span className="text-sm font-semibold text-slate-700">Due Date</span><select name="dueDate" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="input mt-2" required>{dueDates.map((date) => <option key={date} value={date}>{formatDate(date)} (Sunday)</option>)}</select></label>
          <label className="block"><span className="text-sm font-semibold text-slate-700">GCash Reference Number</span><input name="referenceNumber" value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} className="input mt-2" placeholder="1234 5678 9012 3456" required /></label>
          <label className="block"><span className="text-sm font-semibold text-slate-700">Amount Paid</span><input name="amountPaid" type="number" min="1" value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} className="input mt-2" required /></label>
        </div>

        <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/50 px-6 py-10 text-center transition hover:border-brand-500 hover:bg-blue-50">
          <FileUp className="h-10 w-10 text-brand-600" />
          <span className="mt-3 font-bold text-slate-900">Upload Receipt</span>
          <span className="mt-1 text-sm text-slate-500">JPG, PNG, HEIC, or PDF screenshot from GCash</span>
          <span className="mt-3 rounded-full bg-white px-3 py-1 text-sm font-semibold text-brand-700 shadow-sm">{receipt ? receipt.name : "Choose file"}</span>
          <input name="receipt" type="file" accept="image/*,.pdf" className="sr-only" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} required />
        </label>

        {message && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}
        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={isPending} className="btn-primary">{isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}Submit Payment</button>
          <button type="button" onClick={() => setReceipt(null)} className="btn-secondary">Clear Receipt</button>
        </div>
      </form>

      <aside className="space-y-5">
        <div className="card p-6">
          <h3 className="text-lg font-bold">Selected Contribution</h3>
          <dl className="mt-5 space-y-4 text-sm">
            <Row label="Member" value={selectedMember} />
            <Row label="Due Date" value={selectedDate ? formatDate(selectedDate) : "—"} />
            <Row label="Weekly Amount" value={formatCurrency(selectedMemberDetails?.weeklyContribution ?? 250)} />
            <Row label="Drive Folder" value={`Payment Receipts / ${selectedMember}`} />
          </dl>
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-bold">Google Integration Flow</h3>
          <ol className="mt-5 space-y-4 text-sm text-slate-600">
            {[
              "Create or find the Payment Receipts folder in Google Drive.",
              "Create or find the selected member folder.",
              "Rename the uploaded file as MemberName_DueDate.ext.",
              "Append the payment row to the Payments sheet with Status = Paid.",
            ].map((step) => <li key={step} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /><span>{step}</span></li>)}
          </ol>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className="text-right font-bold">{value}</dd></div>;
}

"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Clock3, CloudUpload, Copy, FileIcon, ImageIcon, Loader2, LockKeyhole } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Member } from "@/lib/types";

const uploadGuidelines = [
  {
    title: "Clear Image",
    description: "Ensure the image is clear and all details are readable",
    icon: ImageIcon,
  },
  {
    title: "Accepted Formats",
    description: "PNG, JPG, JPEG, or PDF files only",
    icon: Copy,
  },
  {
    title: "File Size",
    description: "Maximum file size is 5MB",
    icon: FileIcon,
  },
  {
    title: "Required Information",
    description: "Make sure the proof shows amount, date, and reference",
    icon: Clock3,
  },
];

const sampleProofs = [
  { title: "Bank Transfer", accent: "bg-slate-50", label: "₱100.00", sublabel: "Bank receipt" },
  { title: "GCash Payment", accent: "bg-blue-600", label: "PHP 100.00", sublabel: "GCash" },
  { title: "Maya Receipt", accent: "bg-slate-950", label: "₱100.00", sublabel: "maya" },
];

export function PaymentForm({ members, dueDates }: { members: Member[]; dueDates: string[] }) {
  const [selectedMember] = useState(members[0]?.name ?? "");
  const [selectedDate, setSelectedDate] = useState(dueDates[0] ?? "");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedMemberDetails = useMemo(() => members.find((member) => member.name === selectedMember), [members, selectedMember]);
  const amountPaid = String(selectedMemberDetails?.weeklyContribution ?? 100);

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
      setMessage("Payment submitted successfully. Your proof of payment is now recorded.");
      setReferenceNumber("");
      setNotes("");
      setReceipt(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function clearForm() {
    setPaymentMethod("");
    setReferenceNumber("");
    setNotes("");
    setReceipt(null);
    setMessage(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,0.85fr)]">
      <form action={submitPayment} className="card overflow-hidden">
        <div className="p-6 md:p-8">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Payment Information</h2>
            <p className="mt-2 text-sm text-slate-500">Please fill in the details of your payment</p>
          </div>

          <input type="hidden" name="memberName" value={selectedMember} />
          <input type="hidden" name="paymentMethod" value={paymentMethod} />

          <div className="mt-7 max-w-2xl space-y-5">
            <label className="block">
              <span className="text-sm font-bold text-slate-800">Pay For</span>
              <select name="dueDate" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="input mt-2" required>
                {dueDates.map((date) => (
                  <option key={date} value={date}>{formatDate(date)} (Sunday)</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-800">Amount</span>
              <input type="text" value={formatCurrency(Number(amountPaid))} className="input mt-2 bg-slate-100 text-slate-500" readOnly />
              <input type="hidden" name="amountPaid" value={amountPaid} />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-800">Payment Method</span>
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="input mt-2" required>
                <option value="">Select payment method</option>
                <option value="GCash">GCash</option>
                <option value="Maya">Maya</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-800">Reference / Transaction ID (Optional)</span>
              <input name="referenceNumber" value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} className="input mt-2" placeholder="Enter reference or transaction ID" />
            </label>
          </div>

          <label className="mt-5 block">
            <span className="text-sm font-bold text-slate-800">Notes (Optional)</span>
            <textarea name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="input mt-2 min-h-20 resize-y" placeholder="Add any notes about your payment" />
          </label>

          <div className="mt-5">
            <p className="text-sm font-bold text-slate-800">Upload Proof of Payment</p>
            <label className="mt-2 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-white px-6 py-8 text-center transition hover:border-brand-500 hover:bg-blue-50/50">
              <CloudUpload className="h-8 w-8 text-brand-600" />
              <span className="mt-4 text-sm text-slate-600"><span className="font-semibold text-brand-600">Click to upload</span> or drag and drop</span>
              <span className="mt-2 text-xs text-slate-500">PNG, JPG, JPEG, PDF up to 5MB</span>
              {receipt && <span className="mt-3 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-700">{receipt.name}</span>}
              <input name="receipt" type="file" accept="image/png,image/jpeg,.pdf" className="sr-only" ref={fileInputRef} onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} required />
            </label>
          </div>

          {message && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}
          {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-white px-6 py-5 sm:flex-row sm:justify-end md:px-8">
          <button type="button" onClick={clearForm} className="btn-secondary min-w-28">Cancel</button>
          <button type="submit" disabled={isPending} className="btn-primary min-w-44">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Payment
          </button>
        </div>
      </form>

      <aside className="space-y-6">
        <div className="card p-6 md:p-7">
          <h3 className="text-xl font-bold tracking-tight">Upload Guidelines</h3>
          <p className="mt-2 text-sm text-slate-500">Please follow these guidelines when uploading your payment proof</p>

          <div className="mt-8 space-y-6">
            {uploadGuidelines.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-center gap-5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-brand-600">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{item.title}</h4>
                    <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 border-t border-slate-200 pt-7">
            <h4 className="font-bold text-slate-900">Sample Accepted Proofs</h4>
            <div className="mt-4 grid grid-cols-3 gap-4">
              {sampleProofs.map((proof) => (
                <div key={proof.title} className="text-center">
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                    <div className={`flex h-12 items-center rounded-t-lg px-3 text-left text-xs font-bold ${proof.accent} ${proof.accent === "bg-slate-50" ? "text-slate-400" : "text-white"}`}>{proof.sublabel}</div>
                    <div className="space-y-2 px-2 py-4 text-left">
                      <div className="h-2 w-3/4 rounded bg-slate-200" />
                      <div className="h-2 w-1/2 rounded bg-slate-200" />
                      <p className="pt-2 text-base font-extrabold text-slate-900">{proof.label}</p>
                      <div className="h-1.5 w-full rounded bg-emerald-400" />
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="h-2 rounded bg-slate-100" />
                        <div className="h-2 rounded bg-slate-100" />
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-medium text-slate-500">{proof.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-blue-200 bg-blue-50/30 px-5 py-4 text-sm">
          <LockKeyhole className="h-5 w-5 shrink-0 text-brand-600" />
          <div>
            <p className="font-bold text-slate-900">Your payments are secure</p>
            <p className="text-xs text-slate-500">All uploaded files are encrypted and stored securely.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

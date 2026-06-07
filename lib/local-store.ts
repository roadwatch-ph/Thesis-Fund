import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildReceiptFileName, sanitizeReceiptNamePart } from "@/lib/format";
import type { Payment, PaymentStatus } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const PAYMENTS_FILE = path.join(DATA_DIR, "payments.json");
const RECEIPTS_DIR = path.join(process.cwd(), "public", "uploads", "receipts");
const VALID_STATUSES = new Set<PaymentStatus>(["Paid", "Pending", "Missing"]);

function normalizeStatus(status: unknown): PaymentStatus {
  return VALID_STATUSES.has(status as PaymentStatus) ? (status as PaymentStatus) : "Pending";
}

function normalizePayment(payment: Partial<Payment>): Payment {
  return {
    timestamp: String(payment.timestamp || new Date().toISOString()),
    memberName: String(payment.memberName || ""),
    dueDate: String(payment.dueDate || ""),
    paymentMethod: String(payment.paymentMethod || ""),
    amountPaid: Number(payment.amountPaid) || 0,
    referenceNumber: String(payment.referenceNumber || "Not provided"),
    notes: String(payment.notes || ""),
    receiptFileName: String(payment.receiptFileName || ""),
    receiptFileId: String(payment.receiptFileId || ""),
    receiptLink: String(payment.receiptLink || ""),
    status: normalizeStatus(payment.status),
  };
}

export async function getLocalPayments(): Promise<Payment[]> {
  try {
    const raw = await readFile(PAYMENTS_FILE, "utf8");
    const payments = JSON.parse(raw);
    return Array.isArray(payments) ? payments.map(normalizePayment).filter((payment) => payment.memberName && payment.dueDate) : [];
  } catch (error) {
    const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
    if (code === "ENOENT") return [];
    throw error;
  }
}

async function saveLocalPayments(payments: Payment[]) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(PAYMENTS_FILE, `${JSON.stringify(payments, null, 2)}\n`, "utf8");
}

function safeExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName) return fromName;
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  return "jpg";
}

export async function saveLocalReceipt(params: { memberName: string; dueDate: string; file: File }) {
  const memberFolderName = sanitizeReceiptNamePart(params.memberName);
  const memberReceiptsDir = path.join(RECEIPTS_DIR, memberFolderName);
  await mkdir(memberReceiptsDir, { recursive: true });
  const extension = safeExtension(params.file);
  const fileName = buildReceiptFileName(params.memberName, params.dueDate, extension);
  const filePath = path.join(memberReceiptsDir, fileName);
  const buffer = Buffer.from(await params.file.arrayBuffer());
  await writeFile(filePath, buffer);
  return `/uploads/receipts/${encodeURIComponent(memberFolderName)}/${encodeURIComponent(fileName)}`;
}

export async function appendLocalPayment(payment: Payment) {
  const payments = await getLocalPayments();
  const normalized = normalizePayment(payment);
  const existingIndex = payments.findIndex(
    (item) => item.memberName === normalized.memberName && item.dueDate === normalized.dueDate && item.referenceNumber === normalized.referenceNumber,
  );

  if (existingIndex >= 0) {
    payments[existingIndex] = normalized;
  } else {
    payments.push(normalized);
  }

  await saveLocalPayments(payments);
  return normalized;
}

export async function verifyLocalPayment(params: { referenceNumber: string; dueDate?: string; memberName?: string }) {
  const payments = await getLocalPayments();
  const index = payments.findIndex((payment) => {
    const matchesReference = String(payment.referenceNumber) === String(params.referenceNumber);
    const matchesDate = !params.dueDate || payment.dueDate === params.dueDate;
    const matchesMember = !params.memberName || payment.memberName === params.memberName;
    return matchesReference && matchesDate && matchesMember;
  });

  if (index < 0) {
    throw new Error("Payment not found for verification.");
  }

  payments[index] = { ...payments[index], status: "Paid" };
  await saveLocalPayments(payments);
  return { message: "Payment verified.", payment: payments[index] };
}

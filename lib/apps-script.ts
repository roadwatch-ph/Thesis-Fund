import { buildDashboardData } from "@/lib/mock-data";
import type { DashboardData, Payment, PaymentStatus } from "@/lib/types";

const DEFAULT_APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxnaQnzv3VgLqxrxaAo4strOu1EOiEumW643WMhaSIGEXNaYxNG73v7Cgk1upEK0bL5RA/exec";

const VALID_PAYMENT_STATUSES = new Set<PaymentStatus>(["Paid", "Pending", "Missing"]);

export function getAppsScriptWebAppUrl() {
  return process.env.GOOGLE_APPS_SCRIPT_WEB_APP_URL?.trim() || DEFAULT_APPS_SCRIPT_WEB_APP_URL;
}

export function hasAppsScriptWebAppUrl() {
  return Boolean(getAppsScriptWebAppUrl());
}

type AppsScriptResponse<T> = T & {
  error?: string;
  message?: string;
};

async function requestAppsScript<T>(init?: RequestInit & { action?: string }) {
  const url = new URL(getAppsScriptWebAppUrl());
  if (init?.action) url.searchParams.set("action", init.action);

  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  const text = await response.text();
  let payload: AppsScriptResponse<T>;

  try {
    payload = text ? JSON.parse(text) : ({} as AppsScriptResponse<T>);
  } catch {
    throw new Error(`Apps Script returned a non-JSON response (${response.status}).`);
  }

  if (!response.ok || payload.error) {
    throw new Error(payload.error || payload.message || `Apps Script request failed with status ${response.status}.`);
  }

  return payload as T;
}

function normalizePaymentStatus(status: unknown): PaymentStatus {
  return VALID_PAYMENT_STATUSES.has(status as PaymentStatus) ? (status as PaymentStatus) : "Pending";
}

function normalizePayment(payment: Payment): Payment {
  return {
    timestamp: String(payment.timestamp || new Date().toISOString()),
    memberName: String(payment.memberName || ""),
    dueDate: String(payment.dueDate || ""),
    amountPaid: Number(payment.amountPaid) || 0,
    referenceNumber: String(payment.referenceNumber || ""),
    receiptLink: String(payment.receiptLink || ""),
    status: normalizePaymentStatus(payment.status),
  };
}

export async function getAppsScriptDashboardData(): Promise<DashboardData> {
  const dashboard = await requestAppsScript<DashboardData>();

  return {
    ...dashboard,
    payments: Array.isArray(dashboard.payments) ? dashboard.payments.map(normalizePayment) : [],
  };
}

export async function submitPaymentToAppsScript(params: {
  memberName: string;
  dueDate: string;
  referenceNumber: string;
  amountPaid: number;
  receipt: File;
}) {
  const buffer = Buffer.from(await params.receipt.arrayBuffer());
  const payload = {
    action: "submitPayment",
    memberName: params.memberName,
    dueDate: params.dueDate,
    referenceNumber: params.referenceNumber,
    amountPaid: params.amountPaid,
    fileName: params.receipt.name,
    mimeType: params.receipt.type || "application/octet-stream",
    fileBase64: buffer.toString("base64"),
  };

  const response = await requestAppsScript<{ message: string; payment: Payment; dashboard?: DashboardData }>({
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    ...response,
    payment: normalizePayment(response.payment),
  };
}

export async function setupAppsScriptTracker() {
  return requestAppsScript<{ message: string; spreadsheetId?: string; rootFolderUrl?: string }>({
    method: "POST",
    body: JSON.stringify({ action: "setup" }),
  });
}

export async function verifyAppsScriptPayment(params: Pick<Payment, "referenceNumber" | "dueDate" | "memberName">) {
  return requestAppsScript<{ message: string; row: number }>({
    method: "POST",
    body: JSON.stringify({ action: "verifyPayment", ...params }),
  });
}

export function fallbackDashboardData() {
  return buildDashboardData();
}

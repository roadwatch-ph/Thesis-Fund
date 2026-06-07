import { MEMBERS, SHEET_NAMES, WEEKLY_DUE_DATES } from "@/lib/constants";
import { getAppsScriptDashboardData, hasAppsScriptWebAppUrl } from "@/lib/apps-script";
import { buildDashboardData } from "@/lib/mock-data";
import { getLocalPayments } from "@/lib/local-store";
import type { DashboardData, Payment, PaymentStatus } from "@/lib/types";

const VALID_PAYMENT_STATUSES = new Set<PaymentStatus>(["Paid", "Pending", "Missing"]);

function normalizeHeader(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cell(row: unknown[], headers: string[], headerName: string, fallbackIndex: number) {
  const index = headers.indexOf(headerName);
  return row[index >= 0 ? index : fallbackIndex];
}

function normalizeStatus(value: unknown): PaymentStatus {
  return VALID_PAYMENT_STATUSES.has(value as PaymentStatus) ? (value as PaymentStatus) : "Paid";
}

function mapPaymentRow(row: unknown[], headers: string[]): Payment {
  const hasTimestampHeaders = headers.includes("timestamp") && headers.includes("receiptlink");

  if (hasTimestampHeaders) {
    return {
      timestamp: String(cell(row, headers, "timestamp", 0) || new Date().toISOString()),
      memberName: String(cell(row, headers, "member", 1) || cell(row, headers, "membername", 1) || ""),
      dueDate: String(cell(row, headers, "duedate", 2) || ""),
      paymentMethod: String(cell(row, headers, "paymentmethod", 3) || ""),
      amountPaid: Number(cell(row, headers, "amountpaid", 4)) || 0,
      referenceNumber: String(cell(row, headers, "referencenumber", 5) || ""),
      notes: String(cell(row, headers, "notes", 6) || ""),
      receiptFileName: String(cell(row, headers, "receiptfilename", 7) || ""),
      receiptLink: String(cell(row, headers, "receiptlink", 8) || cell(row, headers, "receipt", 8) || ""),
      receiptFileId: String(cell(row, headers, "drivefileid", 9) || cell(row, headers, "receiptfileid", 9) || ""),
      status: normalizeStatus(cell(row, headers, "status", 10)),
    };
  }

  return {
    timestamp: String(row[1] || new Date().toISOString()),
    memberName: String(row[0] || ""),
    dueDate: String(row[1] || ""),
    paymentMethod: String(row[2] || ""),
    amountPaid: Number(row[3]) || 0,
    referenceNumber: String(row[4] || ""),
    notes: "",
    receiptFileName: "",
    receiptLink: String(row[5] || ""),
    receiptFileId: "",
    status: "Paid",
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  if (process.env.DISABLE_APPS_SCRIPT_BACKEND !== "true" && hasAppsScriptWebAppUrl()) {
    try {
      return await getAppsScriptDashboardData();
    } catch (error) {
      console.error("Unable to load dashboard data from Google Apps Script.", error);
    }
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const hasGoogleCredentials = process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && spreadsheetId;

  if (!hasGoogleCredentials) {
    return buildDashboardData(await getLocalPayments());
  }

  const { getGoogleClients } = await import("@/lib/google");
  const { sheets } = getGoogleClients();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAMES.payments}!A:K`,
  });

  const rows = response.data.values ?? [];
  const headers = rows[0]?.map(normalizeHeader) ?? [];
  const dataRows = headers.length ? rows.slice(1) : rows;
  const payments = dataRows
    .filter((row) => row.length >= 6)
    .map((row) => mapPaymentRow(row, headers))
    .filter((payment) => payment.memberName && payment.dueDate && payment.referenceNumber);

  return buildDashboardData(payments);
}

export function getStaticAppData() {
  return {
    members: MEMBERS.map((member) => ({ ...member })),
    dueDates: [...WEEKLY_DUE_DATES],
  };
}

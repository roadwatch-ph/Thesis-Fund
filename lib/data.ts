import { MEMBERS, SHEET_NAMES, WEEKLY_DUE_DATES } from "@/lib/constants";
import { getAppsScriptDashboardData } from "@/lib/apps-script";
import { buildDashboardData } from "@/lib/mock-data";
import { getLocalPayments } from "@/lib/local-store";
import type { DashboardData, Payment } from "@/lib/types";

export async function getDashboardData(): Promise<DashboardData> {
  if (process.env.DISABLE_APPS_SCRIPT_BACKEND !== "true") {
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
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [`${SHEET_NAMES.payments}!A2:G`],
  });

  const rows = response.data.valueRanges?.[0]?.values ?? [];
  const payments: Payment[] = rows
    .filter((row) => row.length >= 7)
    .map((row) => ({
      timestamp: String(row[0]),
      memberName: String(row[1]),
      dueDate: String(row[2]),
      amountPaid: Number(row[3]) || 0,
      referenceNumber: String(row[4]),
      receiptLink: String(row[5]),
      status: row[6] === "Paid" ? "Paid" : row[6] === "Missing" ? "Missing" : "Pending",
    }));

  return buildDashboardData(payments);
}

export function getStaticAppData() {
  return {
    members: MEMBERS.map((member) => ({ ...member })),
    dueDates: [...WEEKLY_DUE_DATES],
  };
}

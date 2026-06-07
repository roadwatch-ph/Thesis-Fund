import { Readable } from "node:stream";
import { google } from "googleapis";
import { buildReceiptFileName } from "@/lib/format";
import { MEMBERS, SHEET_NAMES, WEEKLY_DUE_DATES } from "@/lib/constants";
import type { Payment } from "@/lib/types";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DEFAULT_DRIVE_ROOT_FOLDER_ID = "1JU78o8NGnt-YrBp_7iR7d3WIEbx2AceL";

const PAYMENT_HEADERS = [
  "Timestamp",
  "Member",
  "Due Date",
  "Payment Method",
  "Amount Paid",
  "Reference Number",
  "Notes",
  "Receipt File Name",
  "Receipt Link",
  "Drive File ID",
  "Status",
];

function normalizeHeader(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cell(row: unknown[], headers: string[], headerName: string, fallbackIndex: number) {
  const index = headers.indexOf(headerName);
  return row[index >= 0 ? index : fallbackIndex];
}

function normalizePaymentRow(row: unknown[], headers: string[]) {
  const hasDetailedHeaders = headers.includes("timestamp") && (headers.includes("receiptlink") || headers.includes("receipt"));
  if (hasDetailedHeaders) {
    return [
      String(cell(row, headers, "timestamp", 0) || new Date().toISOString()),
      String(cell(row, headers, "member", 1) || cell(row, headers, "membername", 1) || ""),
      String(cell(row, headers, "duedate", 2) || ""),
      String(cell(row, headers, "paymentmethod", 3) || ""),
      Number(cell(row, headers, "amountpaid", 4)) || 0,
      String(cell(row, headers, "referencenumber", 5) || ""),
      String(cell(row, headers, "notes", 6) || ""),
      String(cell(row, headers, "receiptfilename", 7) || ""),
      String(cell(row, headers, "receiptlink", 8) || cell(row, headers, "receipt", 8) || ""),
      String(cell(row, headers, "drivefileid", 9) || cell(row, headers, "receiptfileid", 9) || ""),
      String(cell(row, headers, "status", 10) || "Paid"),
    ];
  }

  return [
    String(row[1] || new Date().toISOString()),
    String(row[0] || ""),
    String(row[1] || ""),
    String(row[2] || ""),
    Number(row[3]) || 0,
    String(row[4] || ""),
    "",
    "",
    String(row[5] || ""),
    "",
    "Paid",
  ];
}

function getDriveRootFolderId() {
  return process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim() || DEFAULT_DRIVE_ROOT_FOLDER_ID;
}

function getAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY environment variables.");
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [DRIVE_SCOPE, SHEETS_SCOPE],
  });
}

export function getGoogleClients() {
  const auth = getAuth();
  return {
    drive: google.drive({ version: "v3", auth }),
    sheets: google.sheets({ version: "v4", auth }),
  };
}

export async function ensureDriveFolder(name: string, parentFolderId?: string) {
  const { drive } = getGoogleClients();
  const escaped = name.replace(/'/g, "\\'");
  const parentQuery = parentFolderId ? ` and '${parentFolderId}' in parents` : "";
  const list = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${escaped}' and trashed=false${parentQuery}`,
    fields: "files(id, name, webViewLink)",
    spaces: "drive",
  });

  const existing = list.data.files?.[0];
  if (existing?.id) return existing.id;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentFolderId ? { parents: [parentFolderId] } : {}),
    },
    fields: "id",
  });

  if (!created.data.id) throw new Error(`Unable to create Google Drive folder: ${name}`);
  return created.data.id;
}

export type DriveReceiptUpload = {
  id: string;
  name: string;
  webViewLink: string;
};

export async function uploadReceiptToDrive(params: {
  memberName: string;
  dueDate: string;
  file: File;
}): Promise<DriveReceiptUpload> {
  const { drive } = getGoogleClients();
  const rootFolderId = getDriveRootFolderId() || (await ensureDriveFolder("Payment Receipts"));
  const memberFolderId = await ensureDriveFolder(params.memberName, rootFolderId);
  const extension = params.file.name.split(".").pop() || "jpg";
  const fileName = buildReceiptFileName(params.memberName, params.dueDate, extension);
  const arrayBuffer = await params.file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [memberFolderId],
    },
    media: {
      mimeType: params.file.type || "application/octet-stream",
      body: Readable.from(buffer),
    },
    fields: "id, webViewLink, webContentLink",
  });

  if (!created.data.id) throw new Error("Receipt upload failed: missing Drive file id.");

  await drive.permissions.create({
    fileId: created.data.id,
    requestBody: { role: "reader", type: "anyone" },
  });

  return {
    id: created.data.id,
    name: fileName,
    webViewLink: created.data.webViewLink ?? `https://drive.google.com/file/d/${created.data.id}/view`,
  };
}

async function ensurePaymentsSheetStructure(spreadsheetId: string) {
  const { sheets } = getGoogleClients();
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheet = spreadsheet.data.sheets?.find((sheet) => sheet.properties?.title === SHEET_NAMES.payments);

  if (!existingSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAMES.payments } } }] },
    });
  }

  const current = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${SHEET_NAMES.payments}!A:K` });
  const rows = current.data.values ?? [];
  const headers = rows[0]?.map(normalizeHeader) ?? [];
  const desiredHeaders = PAYMENT_HEADERS.map(normalizeHeader);
  const alreadyCurrent = desiredHeaders.every((header, index) => headers[index] === header);

  if (alreadyCurrent) return;

  const normalizedRows = rows.length > 0
    ? rows.slice(1).map((row) => normalizePaymentRow(row, headers)).filter((row) => row[1] && row[2] && row[5])
    : [];

  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${SHEET_NAMES.payments}!A:K` });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAMES.payments}!A1:K${normalizedRows.length + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [PAYMENT_HEADERS, ...normalizedRows] },
  });
}

export async function appendPaymentToSheet(payment: Payment) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID environment variable.");
  await ensurePaymentsSheetStructure(spreadsheetId);
  const { sheets } = getGoogleClients();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAMES.payments}!A:K`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        payment.timestamp,
        payment.memberName,
        payment.dueDate,
        payment.paymentMethod,
        payment.amountPaid,
        payment.referenceNumber,
        payment.notes,
        payment.receiptFileName,
        payment.receiptLink,
        payment.receiptFileId,
        payment.status,
      ]],
    },
  });
}

export async function seedSpreadsheetStructure() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID environment variable.");
  const { sheets } = getGoogleClients();
  const rootFolderId = getDriveRootFolderId() || (await ensureDriveFolder("Payment Receipts"));

  await Promise.all(MEMBERS.map((member) => ensureDriveFolder(member.name, rootFolderId)));

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = new Set(spreadsheet.data.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean));
  const addSheetRequests = Object.values(SHEET_NAMES)
    .filter((title) => !existingSheets.has(title))
    .map((title) => ({ addSheet: { properties: { title } } }));

  if (addSheetRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: addSheetRequests } });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: `${SHEET_NAMES.members}!A1:C${MEMBERS.length + 1}`,
          values: [["MemberID", "MemberName", "WeeklyContribution"], ...MEMBERS.map((member) => [member.id, member.name, member.weeklyContribution])],
        },
        {
          range: `${SHEET_NAMES.schedule}!A1:A${WEEKLY_DUE_DATES.length + 1}`,
          values: [["DueDate"], ...WEEKLY_DUE_DATES.map((date) => [date])],
        },
        {
          range: `${SHEET_NAMES.payments}!A1:K1`,
          values: [PAYMENT_HEADERS],
        },
      ],
    },
  });
}

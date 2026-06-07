import { Readable } from "node:stream";
import { google } from "googleapis";
import { buildReceiptFileName } from "@/lib/format";
import { MEMBERS, SHEET_NAMES, WEEKLY_DUE_DATES } from "@/lib/constants";
import type { Payment } from "@/lib/types";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DEFAULT_DRIVE_ROOT_FOLDER_ID = "1JU78o8NGnt-YrBp_7iR7d3WIEbx2AceL";

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

export async function uploadReceiptToDrive(params: {
  memberName: string;
  dueDate: string;
  file: File;
}) {
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

  return created.data.webViewLink ?? `https://drive.google.com/file/d/${created.data.id}/view`;
}

export async function appendPaymentToSheet(payment: Payment) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID environment variable.");
  const { sheets } = getGoogleClients();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAMES.payments}!A:G`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        payment.timestamp,
        payment.memberName,
        payment.dueDate,
        payment.amountPaid,
        payment.referenceNumber,
        payment.receiptLink,
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
          range: `${SHEET_NAMES.payments}!A1:G1`,
          values: [["Timestamp", "MemberName", "DueDate", "AmountPaid", "ReferenceNumber", "ReceiptLink", "Status"]],
        },
      ],
    },
  });
}

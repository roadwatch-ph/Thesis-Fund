import { NextResponse } from "next/server";
import { setupAppsScriptTracker, verifyAppsScriptPayment } from "@/lib/apps-script";
import { seedSpreadsheetStructure } from "@/lib/google";
import { verifyLocalPayment } from "@/lib/local-store";

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));

    if (payload.referenceNumber) {
      const params = {
        referenceNumber: String(payload.referenceNumber),
        dueDate: String(payload.dueDate || ""),
        memberName: String(payload.memberName || ""),
      };

      if (process.env.DISABLE_APPS_SCRIPT_BACKEND !== "true") {
        try {
          const result = await verifyAppsScriptPayment(params);
          return NextResponse.json(result);
        } catch (error) {
          console.error("Unable to verify payment in Google Apps Script. Trying the local backend instead.", error);
        }
      }

      const result = await verifyLocalPayment(params);
      return NextResponse.json(result);
    }

    if (process.env.DISABLE_APPS_SCRIPT_BACKEND !== "true") {
      try {
        const result = await setupAppsScriptTracker();
        return NextResponse.json(result);
      } catch (error) {
        console.error("Unable to prepare Google Apps Script. Falling back to local setup.", error);
      }
    }

    if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
      await seedSpreadsheetStructure();
      return NextResponse.json({ message: "Google Sheets database structure is ready." });
    }

    return NextResponse.json({ message: "Local payment backend is ready." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare Google Sheets.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

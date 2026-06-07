import { NextResponse } from "next/server";
import { setupAppsScriptTracker, verifyAppsScriptPayment } from "@/lib/apps-script";
import { seedSpreadsheetStructure } from "@/lib/google";

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));

    if (payload.referenceNumber) {
      const result = await verifyAppsScriptPayment({
        referenceNumber: String(payload.referenceNumber),
        dueDate: String(payload.dueDate || ""),
        memberName: String(payload.memberName || ""),
      });
      return NextResponse.json(result);
    }

    if (process.env.DISABLE_APPS_SCRIPT_BACKEND !== "true") {
      const result = await setupAppsScriptTracker();
      return NextResponse.json(result);
    }

    await seedSpreadsheetStructure();
    return NextResponse.json({ message: "Google Sheets database structure is ready." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare Google Sheets.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

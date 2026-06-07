import { NextResponse } from "next/server";
import { hasAppsScriptWebAppUrl, submitPaymentToAppsScript } from "@/lib/apps-script";
import { appendPaymentToSheet, uploadReceiptToDrive } from "@/lib/google";
import { appendLocalPayment, saveLocalReceipt } from "@/lib/local-store";
import type { Payment } from "@/lib/types";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Google backend error.";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const memberName = String(formData.get("memberName") ?? "").trim();
    const dueDate = String(formData.get("dueDate") ?? "").trim();
    const paymentMethod = String(formData.get("paymentMethod") ?? "").trim();
    const referenceNumber = String(formData.get("referenceNumber") ?? "").trim() || "Not provided";
    const amountPaid = Number(formData.get("amountPaid"));
    const receipt = formData.get("receipt");

    if (!memberName || !dueDate || !paymentMethod || !amountPaid || !(receipt instanceof File)) {
      return NextResponse.json({ message: "Please complete all required payment fields." }, { status: 400 });
    }

    const allowedTypes = new Set(["image/png", "image/jpeg", "application/pdf"]);
    if (!allowedTypes.has(receipt.type)) {
      return NextResponse.json({ message: "Receipt must be a PNG, JPG, JPEG, or PDF file." }, { status: 400 });
    }

    if (receipt.size > 5 * 1024 * 1024) {
      return NextResponse.json({ message: "Receipt file must be 5MB or smaller." }, { status: 400 });
    }

    const hasAppsScriptBackend = process.env.DISABLE_APPS_SCRIPT_BACKEND !== "true" && hasAppsScriptWebAppUrl();
    const hasGoogleCredentials = Boolean(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SHEETS_SPREADSHEET_ID);
    let googleBackendError: string | null = null;

    if (hasAppsScriptBackend) {
      try {
        const result = await submitPaymentToAppsScript({ memberName, dueDate, paymentMethod, referenceNumber, amountPaid, receipt });
        return NextResponse.json({ message: result.message || "Payment saved to Google Sheets successfully.", payment: result.payment });
      } catch (error) {
        googleBackendError = getErrorMessage(error);
        console.error("Unable to submit payment to Google Apps Script.", error);
      }
    }

    if (hasAppsScriptBackend && !hasGoogleCredentials) {
      return NextResponse.json(
        {
          message: `Payment was not saved to Google Sheets. Please check your Google Apps Script deployment. Error: ${googleBackendError ?? "Google Apps Script unavailable."}`,
        },
        { status: 502 },
      );
    }

    const receiptLink = hasGoogleCredentials ? await uploadReceiptToDrive({ memberName, dueDate, file: receipt }) : await saveLocalReceipt({ memberName, dueDate, file: receipt });
    const payment: Payment = {
      timestamp: new Date().toISOString(),
      memberName,
      dueDate,
      paymentMethod,
      amountPaid,
      referenceNumber,
      receiptLink,
      status: hasGoogleCredentials ? "Paid" : "Pending",
    };

    if (hasGoogleCredentials) {
      try {
        await appendPaymentToSheet(payment);
        return NextResponse.json({ message: "Payment saved to Google Sheets successfully.", payment });
      } catch (error) {
        googleBackendError = getErrorMessage(error);
        console.error("Unable to append payment to Google Sheets.", error);
      }
    }

    if (hasAppsScriptBackend || hasGoogleCredentials) {
      return NextResponse.json(
        {
          message: `Payment was not saved to Google Sheets. Please check your Google backend configuration. Error: ${googleBackendError ?? "Google backend unavailable."}`,
        },
        { status: 502 },
      );
    }

    await appendLocalPayment(payment);
    return NextResponse.json({ message: "Payment saved to the local backend. Configure Google Sheets to record it online.", payment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit payment.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

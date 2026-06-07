import { NextResponse } from "next/server";
import { hasAppsScriptWebAppUrl, submitPaymentToAppsScript } from "@/lib/apps-script";
import { appendPaymentToSheet, uploadReceiptToDrive } from "@/lib/google";
import { appendLocalPayment, saveLocalReceipt } from "@/lib/local-store";
import type { Payment } from "@/lib/types";

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

    if (process.env.DISABLE_APPS_SCRIPT_BACKEND !== "true" && hasAppsScriptWebAppUrl()) {
      try {
        const result = await submitPaymentToAppsScript({ memberName, dueDate, paymentMethod, referenceNumber, amountPaid, receipt });
        return NextResponse.json({ message: result.message || "Payment submitted successfully.", payment: result.payment });
      } catch (error) {
        console.error("Unable to submit payment to Google Apps Script. Saving to the local backend instead.", error);
      }
    }

    const hasGoogleCredentials = process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
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
      await appendPaymentToSheet(payment);
    } else {
      await appendLocalPayment(payment);
    }

    return NextResponse.json({ message: "Payment submitted successfully.", payment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit payment.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

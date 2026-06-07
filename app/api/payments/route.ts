import { NextResponse } from "next/server";
import { submitPaymentToAppsScript } from "@/lib/apps-script";
import { appendPaymentToSheet, uploadReceiptToDrive } from "@/lib/google";
import type { Payment } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const memberName = String(formData.get("memberName") ?? "").trim();
    const dueDate = String(formData.get("dueDate") ?? "").trim();
    const referenceNumber = String(formData.get("referenceNumber") ?? "").trim();
    const amountPaid = Number(formData.get("amountPaid"));
    const receipt = formData.get("receipt");

    if (!memberName || !dueDate || !referenceNumber || !amountPaid || !(receipt instanceof File)) {
      return NextResponse.json({ message: "Please complete all required payment fields." }, { status: 400 });
    }

    if (process.env.DISABLE_APPS_SCRIPT_BACKEND !== "true") {
      const result = await submitPaymentToAppsScript({ memberName, dueDate, referenceNumber, amountPaid, receipt });
      return NextResponse.json({ message: result.message || "Payment submitted successfully.", payment: result.payment });
    }

    const receiptLink = await uploadReceiptToDrive({ memberName, dueDate, file: receipt });
    const payment: Payment = {
      timestamp: new Date().toISOString(),
      memberName,
      dueDate,
      amountPaid,
      referenceNumber,
      receiptLink,
      status: "Paid",
    };

    await appendPaymentToSheet(payment);

    return NextResponse.json({ message: "Payment submitted successfully.", payment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit payment.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

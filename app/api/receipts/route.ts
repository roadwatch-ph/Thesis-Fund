import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data";

export async function GET() {
  const data = await getDashboardData();
  return NextResponse.json({ receipts: data.payments.filter((payment) => payment.receiptLink) });
}

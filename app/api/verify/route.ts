import { NextResponse } from "next/server";
import { seedSpreadsheetStructure } from "@/lib/google";

export async function POST() {
  try {
    await seedSpreadsheetStructure();
    return NextResponse.json({ message: "Google Sheets database structure is ready." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare Google Sheets.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export const MEMBERS = [
  { id: "M001", name: "Jhon Lenard Dimaano", weeklyContribution: 250 },
  { id: "M002", name: "Prince Johnel Abe", weeklyContribution: 250 },
  { id: "M003", name: "Michael Orilla", weeklyContribution: 250 },
  { id: "M004", name: "Carmela Elaine Agrao", weeklyContribution: 250 },
  { id: "M005", name: "Darlene Grace Villanueva", weeklyContribution: 250 },
] as const;

export const WEEKLY_DUE_DATES = [
  "2026-06-07", "2026-06-14", "2026-06-21", "2026-06-28", "2026-07-05", "2026-07-12",
  "2026-07-19", "2026-07-26", "2026-08-02", "2026-08-09", "2026-08-16", "2026-08-23",
  "2026-08-30", "2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27", "2026-10-04",
  "2026-10-11", "2026-10-18", "2026-10-25", "2026-11-01", "2026-11-08", "2026-11-15",
  "2026-11-22", "2026-11-29", "2026-12-06", "2026-12-13", "2026-12-20", "2026-12-27",
] as const;

export const CONTRIBUTION_START = "2026-06-07";
export const CONTRIBUTION_END = "2026-12-27";
export const DEFAULT_WEEKLY_CONTRIBUTION = 250;

export const SHEET_NAMES = {
  members: "Members",
  schedule: "Schedule",
  payments: "Payments",
} as const;

export const PAYMENT_STATUSES = ["Paid", "Pending", "Missing"] as const;

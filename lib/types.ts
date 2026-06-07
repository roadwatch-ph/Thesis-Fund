export type PaymentStatus = "Paid" | "Pending" | "Missing";

export type Member = {
  id: string;
  name: string;
  weeklyContribution: number;
};

export type Payment = {
  timestamp: string;
  memberName: string;
  dueDate: string;
  amountPaid: number;
  referenceNumber: string;
  receiptLink: string;
  status: PaymentStatus;
};

export type MemberSummary = {
  member: Member;
  totalContribution: number;
  paidWeeks: number;
  remainingBalance: number;
  lastPaymentDate: string | null;
  nextDueDate: string | null;
  progress: number;
};

export type DashboardData = {
  members: Member[];
  dueDates: string[];
  payments: Payment[];
  summaries: MemberSummary[];
  weeklyStatuses: Record<string, Record<string, PaymentStatus>>;
  totals: {
    totalMembers: number;
    paidThisWeek: number;
    pendingThisWeek: number;
    missingPayments: number;
    expectedCollection: number;
    collectedAmount: number;
    remainingAmount: number;
    collectionPercentage: number;
    currentDueDate: string;
  };
};

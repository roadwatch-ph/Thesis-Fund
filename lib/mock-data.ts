import { MEMBERS, WEEKLY_DUE_DATES } from "@/lib/constants";
import type { DashboardData, Member, Payment, PaymentStatus } from "@/lib/types";

export const seededPayments: Payment[] = [
  { timestamp: "2026-06-21T09:20:00.000Z", memberName: "Juan Dela Cruz", dueDate: "2026-06-07", amountPaid: 250, referenceNumber: "1234 5678 9012 3456", receiptLink: "https://drive.google.com/file/d/sample-juan-0607/view", status: "Paid" },
  { timestamp: "2026-06-21T09:23:00.000Z", memberName: "Juan Dela Cruz", dueDate: "2026-06-14", amountPaid: 250, referenceNumber: "9876 5432 1098 7654", receiptLink: "https://drive.google.com/file/d/sample-juan-0614/view", status: "Paid" },
  { timestamp: "2026-06-21T09:26:00.000Z", memberName: "Juan Dela Cruz", dueDate: "2026-06-21", amountPaid: 250, referenceNumber: "2468 1357 9753 8642", receiptLink: "https://drive.google.com/file/d/sample-juan-0621/view", status: "Paid" },
  { timestamp: "2026-06-21T10:15:00.000Z", memberName: "Mark Anthony", dueDate: "2026-06-07", amountPaid: 250, referenceNumber: "9844 2210 7741 3330", receiptLink: "https://drive.google.com/file/d/sample-mark-0607/view", status: "Paid" },
  { timestamp: "2026-06-21T10:18:00.000Z", memberName: "Mark Anthony", dueDate: "2026-06-14", amountPaid: 250, referenceNumber: "7856 0088 1122 4466", receiptLink: "https://drive.google.com/file/d/sample-mark-0614/view", status: "Paid" },
  { timestamp: "2026-06-21T11:05:00.000Z", memberName: "Anne Villanueva", dueDate: "2026-06-07", amountPaid: 250, referenceNumber: "3456 1000 5543 1111", receiptLink: "https://drive.google.com/file/d/sample-anne-0607/view", status: "Paid" },
  { timestamp: "2026-06-21T11:40:00.000Z", memberName: "Paul Garcia", dueDate: "2026-06-07", amountPaid: 250, referenceNumber: "6654 2341 9901 2221", receiptLink: "https://drive.google.com/file/d/sample-paul-0607/view", status: "Paid" },
  { timestamp: "2026-06-21T11:44:00.000Z", memberName: "Paul Garcia", dueDate: "2026-06-14", amountPaid: 250, referenceNumber: "0012 3344 5566 7788", receiptLink: "https://drive.google.com/file/d/sample-paul-0614/view", status: "Paid" },
  { timestamp: "2026-06-21T11:50:00.000Z", memberName: "Paul Garcia", dueDate: "2026-06-21", amountPaid: 250, referenceNumber: "8642 9753 1357 2468", receiptLink: "https://drive.google.com/file/d/sample-paul-0621/view", status: "Paid" },
  { timestamp: "2026-06-21T12:10:00.000Z", memberName: "Lisa Reyes", dueDate: "2026-06-07", amountPaid: 250, referenceNumber: "5100 2345 6666 0101", receiptLink: "https://drive.google.com/file/d/sample-lisa-0607/view", status: "Paid" },
  { timestamp: "2026-06-21T12:13:00.000Z", memberName: "Lisa Reyes", dueDate: "2026-06-14", amountPaid: 250, referenceNumber: "7231 9990 1256 4312", receiptLink: "https://drive.google.com/file/d/sample-lisa-0614/view", status: "Paid" },
];

export function buildDashboardData(payments: Payment[] = seededPayments): DashboardData {
  const members = MEMBERS.map((member) => ({ ...member })) satisfies Member[];
  const dueDates = [...WEEKLY_DUE_DATES];
  const currentDueDate = "2026-06-21";
  const paymentMap = new Map(payments.map((payment) => [`${payment.memberName}:${payment.dueDate}`, payment]));
  const weeklyStatuses: DashboardData["weeklyStatuses"] = {};

  for (const member of members) {
    weeklyStatuses[member.name] = {};
    for (const dueDate of dueDates) {
      if (paymentMap.has(`${member.name}:${dueDate}`)) {
        weeklyStatuses[member.name][dueDate] = "Paid";
      } else if (dueDate <= currentDueDate) {
        weeklyStatuses[member.name][dueDate] = "Missing";
      } else {
        weeklyStatuses[member.name][dueDate] = "Pending";
      }
    }
  }

  const summaries = members.map((member) => {
    const memberPayments = payments.filter((payment) => payment.memberName === member.name && payment.status === "Paid");
    const paidWeeks = new Set(memberPayments.map((payment) => payment.dueDate)).size;
    const totalContribution = memberPayments.reduce((sum, payment) => sum + payment.amountPaid, 0);
    const lastPaymentDate = memberPayments.sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0]?.dueDate ?? null;
    const nextDueDate = dueDates.find((date) => weeklyStatuses[member.name][date] !== "Paid") ?? null;
    const expectedForMember = dueDates.length * member.weeklyContribution;

    return {
      member,
      totalContribution,
      paidWeeks,
      remainingBalance: Math.max(expectedForMember - totalContribution, 0),
      lastPaymentDate,
      nextDueDate,
      progress: Math.round((paidWeeks / dueDates.length) * 1000) / 10,
    };
  });

  const expectedCollection = members.reduce((sum, member) => sum + member.weeklyContribution * dueDates.length, 0);
  const collectedAmount = payments.filter((payment) => payment.status === "Paid").reduce((sum, payment) => sum + payment.amountPaid, 0);
  const paidThisWeek = members.filter((member) => weeklyStatuses[member.name][currentDueDate] === "Paid").length;
  const pendingThisWeek = members.length - paidThisWeek;
  const missingPayments = members.reduce((sum, member) => sum + Object.values(weeklyStatuses[member.name]).filter((status: PaymentStatus) => status === "Missing").length, 0);

  return {
    members,
    dueDates,
    payments,
    summaries,
    weeklyStatuses,
    totals: {
      totalMembers: members.length,
      paidThisWeek,
      pendingThisWeek,
      missingPayments,
      expectedCollection,
      collectedAmount,
      remainingAmount: expectedCollection - collectedAmount,
      collectionPercentage: Math.round((collectedAmount / expectedCollection) * 1000) / 10,
      currentDueDate,
    },
  };
}

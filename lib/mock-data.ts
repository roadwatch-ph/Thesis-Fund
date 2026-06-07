import { MEMBERS, WEEKLY_DUE_DATES } from "@/lib/constants";
import type { DashboardData, Member, Payment, PaymentStatus } from "@/lib/types";

export const seededPayments: Payment[] = [];

export function buildDashboardData(payments: Payment[] = []): DashboardData {
  const members = MEMBERS.map((member) => ({ ...member })) satisfies Member[];
  const dueDates = [...WEEKLY_DUE_DATES];
  const today = new Date().toISOString().slice(0, 10);
  const currentDueDate = dueDates.find((date) => date >= today) ?? dueDates[dueDates.length - 1];
  const paymentMap = new Map(payments.filter((payment) => payment.status === "Paid").map((payment) => [`${payment.memberName}:${payment.dueDate}`, payment]));
  const weeklyStatuses: DashboardData["weeklyStatuses"] = {};

  for (const member of members) {
    weeklyStatuses[member.name] = {};
    for (const dueDate of dueDates) {
      if (paymentMap.has(`${member.name}:${dueDate}`)) {
        weeklyStatuses[member.name][dueDate] = "Paid";
      } else if (dueDate < currentDueDate) {
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

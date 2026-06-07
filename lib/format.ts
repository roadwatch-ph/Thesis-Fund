import { format, parseISO } from "date-fns";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string, pattern = "MMMM d, yyyy") {
  return format(parseISO(value), pattern);
}

export function formatShortDate(value: string) {
  return format(parseISO(value), "MMM d, yyyy");
}

export function compactMemberName(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "");
}

export function sanitizeReceiptNamePart(value: string) {
  return value.trim().replace(/[\\/]/g, "-").replace(/\s+/g, " ");
}

export function buildReceiptFileName(memberName: string, dueDate: string, extension: string) {
  const cleanExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return `${sanitizeReceiptNamePart(memberName)}_${dueDate}.${cleanExtension}`;
}

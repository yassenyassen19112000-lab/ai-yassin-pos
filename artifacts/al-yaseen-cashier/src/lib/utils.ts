import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function paymentTypeLabel(type: string): string {
  switch (type) {
    case "cash": return "نقدي";
    case "credit": return "آجل";
    case "partial": return "جزئي";
    default: return type;
  }
}

export function debtStatusLabel(status: string): string {
  switch (status) {
    case "pending": return "معلق";
    case "partial": return "جزئي";
    case "paid": return "مدفوع";
    default: return status;
  }
}

export function debtStatusColor(status: string): string {
  switch (status) {
    case "pending": return "text-red-600 bg-red-50 border-red-200";
    case "partial": return "text-yellow-600 bg-yellow-50 border-yellow-200";
    case "paid": return "text-green-600 bg-green-50 border-green-200";
    default: return "text-gray-600 bg-gray-50";
  }
}

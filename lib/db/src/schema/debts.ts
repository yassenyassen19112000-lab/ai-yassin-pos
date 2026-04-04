import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const debtsTable = pgTable("debts", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  supplierId: integer("supplier_id"),
  supplierName: text("supplier_name"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  remainingAmount: numeric("remaining_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  saleId: integer("sale_id"),
  purchaseId: integer("purchase_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const debtPaymentsTable = pgTable("debt_payments", {
  id: serial("id").primaryKey(),
  debtId: integer("debt_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDebtSchema = createInsertSchema(debtsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDebt = z.infer<typeof insertDebtSchema>;
export type Debt = typeof debtsTable.$inferSelect;

export const insertDebtPaymentSchema = createInsertSchema(debtPaymentsTable).omit({ id: true });
export type InsertDebtPayment = z.infer<typeof insertDebtPaymentSchema>;
export type DebtPayment = typeof debtPaymentsTable.$inferSelect;

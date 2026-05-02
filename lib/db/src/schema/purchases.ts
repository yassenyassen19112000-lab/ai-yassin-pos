import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const purchasesTable = pgTable("purchases", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull(),
  invoiceNumber: text("invoice_number"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  remainingAmount: numeric("remaining_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentType: text("payment_type").notNull().default("cash"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const purchaseItemsTable = pgTable("purchase_items", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  costPrice: numeric("cost_price", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const purchaseReturnsTable = pgTable("purchase_returns", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id").notNull(),
  returnNumber: text("return_number").notNull(),
  returnAmount: numeric("return_amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"),
  cashierName: text("cashier_name").notNull().default("كاشير"),
  items: text("items").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPurchaseSchema = createInsertSchema(purchasesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchasesTable.$inferSelect;

export const insertPurchaseItemSchema = createInsertSchema(purchaseItemsTable).omit({ id: true, createdAt: true });
export type InsertPurchaseItem = z.infer<typeof insertPurchaseItemSchema>;
export type PurchaseItem = typeof purchaseItemsTable.$inferSelect;

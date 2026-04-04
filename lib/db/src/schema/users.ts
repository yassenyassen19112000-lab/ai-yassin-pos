import { pgTable, text, serial, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const permissionsSchema = z.object({
  canViewDashboard: z.boolean().default(true),
  canManageProducts: z.boolean().default(false),
  canManageSuppliers: z.boolean().default(false),
  canMakeSales: z.boolean().default(true),
  canViewReports: z.boolean().default(false),
  canManageUsers: z.boolean().default(false),
  canManageDebts: z.boolean().default(false),
  canViewPurchases: z.boolean().default(false),
  canCreatePurchases: z.boolean().default(false),
});

export type Permissions = z.infer<typeof permissionsSchema>;

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("cashier"),
  permissions: jsonb("permissions").notNull().$type<Permissions>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

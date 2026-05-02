import { Router } from "express";
import { db, expensesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

const CATEGORIES: Record<string, string> = {
  salary: "رواتب",
  rent: "إيجار",
  utilities: "مرافق",
  transport: "مواصلات",
  maintenance: "صيانة",
  other: "أخرى",
};

function formatExpense(e: typeof expensesTable.$inferSelect) {
  return {
    id: e.id,
    description: e.description,
    amount: parseFloat(e.amount as string),
    category: e.category,
    categoryLabel: CATEGORIES[e.category] ?? e.category,
    notes: e.notes ?? null,
    expenseDate: e.expenseDate.toISOString(),
    createdBy: e.createdBy ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}

router.get("/expenses", requireAuth, async (_req, res): Promise<void> => {
  const expenses = await db.select().from(expensesTable).orderBy(desc(expensesTable.expenseDate));
  res.json(expenses.map(formatExpense));
});

router.post("/expenses", requireAuth, async (req, res): Promise<void> => {
  const { description, amount, category, notes, expenseDate, createdBy } = req.body;
  if (!description || amount == null) {
    res.status(400).json({ error: "الوصف والمبلغ مطلوبان" });
    return;
  }
  const [expense] = await db.insert(expensesTable).values({
    description,
    amount: parseFloat(amount).toString(),
    category: category || "other",
    notes: notes || null,
    expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
    createdBy: createdBy || null,
  }).returning();
  res.status(201).json(formatExpense(expense));
});

router.delete("/expenses/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [expense] = await db.delete(expensesTable).where(eq(expensesTable.id, id)).returning();
  if (!expense) { res.status(404).json({ error: "المصروف غير موجود" }); return; }
  res.sendStatus(204);
});

export default router;

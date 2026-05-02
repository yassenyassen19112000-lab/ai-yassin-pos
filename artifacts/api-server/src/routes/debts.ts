import { Router } from "express";
import { db, debtsTable, debtPaymentsTable, suppliersTable } from "@workspace/db";
import { eq, and, like } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

async function formatDebt(d: typeof debtsTable.$inferSelect) {
  const payments = await db.select().from(debtPaymentsTable).where(eq(debtPaymentsTable.debtId, d.id));
  return {
    id: d.id,
    type: d.type,
    customerName: d.customerName ?? null,
    customerPhone: d.customerPhone ?? null,
    supplierId: d.supplierId ?? null,
    supplierName: d.supplierName ?? null,
    totalAmount: parseFloat(d.totalAmount as string),
    paidAmount: parseFloat(d.paidAmount as string),
    remainingAmount: parseFloat(d.remainingAmount as string),
    status: d.status,
    saleId: d.saleId ?? null,
    purchaseId: d.purchaseId ?? null,
    notes: d.notes ?? null,
    payments: payments.map(p => ({
      id: p.id,
      amount: parseFloat(p.amount as string),
      notes: p.notes ?? null,
      paidAt: p.paidAt.toISOString(),
    })),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

router.get("/debts", requireAuth, async (req, res): Promise<void> => {
  const { type, status } = req.query;
  
  let conditions = [];
  if (type && typeof type === "string") conditions.push(eq(debtsTable.type, type));
  if (status && typeof status === "string") conditions.push(eq(debtsTable.status, status));

  let debts;
  if (conditions.length > 0) {
    debts = await db.select().from(debtsTable).where(and(...conditions)).orderBy(debtsTable.createdAt);
  } else {
    debts = await db.select().from(debtsTable).orderBy(debtsTable.createdAt);
  }

  const formatted = await Promise.all(debts.map(formatDebt));
  res.json(formatted.reverse());
});

router.post("/debts", requireAuth, async (req, res): Promise<void> => {
  const { type, customerName, customerPhone, supplierId, totalAmount, paidAmount, notes, saleId, purchaseId } = req.body;
  if (!type || totalAmount == null) {
    res.status(400).json({ error: "النوع والمبلغ الكلي مطلوبان" });
    return;
  }

  const addedAmount = parseFloat(totalAmount);
  const paid = parseFloat(paidAmount ?? 0);

  let supplierName = null;
  if (supplierId) {
    const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, supplierId));
    supplierName = supplier?.name ?? null;
  }

  // ── Check for existing open debt for the same customer/supplier ──────────
  // Only merge when this is a manual debt (no saleId/purchaseId linkage)
  if (!saleId && !purchaseId) {
    let existing: typeof debtsTable.$inferSelect | undefined;

    if (type === "customer" && customerName) {
      const rows = await db.select().from(debtsTable)
        .where(and(eq(debtsTable.type, "customer"), like(debtsTable.customerName, customerName)));
      existing = rows.find(d => d.status !== "paid");
    } else if (type === "supplier" && supplierId) {
      const rows = await db.select().from(debtsTable)
        .where(and(eq(debtsTable.type, "supplier"), eq(debtsTable.supplierId, supplierId)));
      existing = rows.find(d => d.status !== "paid");
    }

    if (existing) {
      // Add the new amount to the existing debt record
      const newTotal = parseFloat(existing.totalAmount as string) + addedAmount;
      const newPaid = parseFloat(existing.paidAmount as string) + paid;
      const newRemaining = Math.max(0, newTotal - newPaid);
      const newStatus = newRemaining <= 0 ? "paid" : newPaid > 0 ? "partial" : "pending";
      const mergedNotes = [existing.notes, notes].filter(Boolean).join(" | ") || null;

      const [updated] = await db.update(debtsTable).set({
        totalAmount: newTotal.toString(),
        paidAmount: newPaid.toString(),
        remainingAmount: newRemaining.toString(),
        status: newStatus,
        notes: mergedNotes,
      }).where(eq(debtsTable.id, existing.id)).returning();

      return res.status(200).json(await formatDebt(updated));
    }
  }

  // ── No existing record → create new ─────────────────────────────────────
  const remaining = addedAmount - paid;
  const status = remaining <= 0 ? "paid" : paid > 0 ? "partial" : "pending";

  const [debt] = await db.insert(debtsTable).values({
    type,
    customerName: customerName || null,
    customerPhone: customerPhone || null,
    supplierId: supplierId || null,
    supplierName,
    totalAmount: addedAmount.toString(),
    paidAmount: paid.toString(),
    remainingAmount: remaining.toString(),
    status,
    saleId: saleId || null,
    purchaseId: purchaseId || null,
    notes: notes || null,
  }).returning();

  res.status(201).json(await formatDebt(debt));
});

router.get("/debts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [debt] = await db.select().from(debtsTable).where(eq(debtsTable.id, id));
  if (!debt) { res.status(404).json({ error: "الدين غير موجود" }); return; }
  res.json(await formatDebt(debt));
});

router.patch("/debts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { notes } = req.body;
  const [debt] = await db.update(debtsTable).set({ notes }).where(eq(debtsTable.id, id)).returning();
  if (!debt) { res.status(404).json({ error: "الدين غير موجود" }); return; }
  res.json(await formatDebt(debt));
});

router.post("/debts/:id/payments", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { amount, notes } = req.body;
  if (!amount || amount <= 0) { res.status(400).json({ error: "المبلغ مطلوب" }); return; }

  const [debt] = await db.select().from(debtsTable).where(eq(debtsTable.id, id));
  if (!debt) { res.status(404).json({ error: "الدين غير موجود" }); return; }

  const payAmount = parseFloat(amount);
  const newPaid = parseFloat(debt.paidAmount as string) + payAmount;
  const newRemaining = Math.max(0, parseFloat(debt.remainingAmount as string) - payAmount);
  const newStatus = newRemaining <= 0 ? "paid" : "partial";

  await db.insert(debtPaymentsTable).values({
    debtId: id,
    amount: payAmount.toString(),
    notes: notes || null,
    paidAt: new Date(),
  });

  if (debt.type === "supplier" && debt.supplierId) {
    const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, debt.supplierId));
    if (supplier) {
      const currentDebt = parseFloat(supplier.totalDebt as string);
      await db.update(suppliersTable)
        .set({ totalDebt: Math.max(0, currentDebt - payAmount).toString() })
        .where(eq(suppliersTable.id, debt.supplierId));
    }
  }

  const [updated] = await db.update(debtsTable).set({
    paidAmount: newPaid.toString(),
    remainingAmount: newRemaining.toString(),
    status: newStatus,
  }).where(eq(debtsTable.id, id)).returning();

  res.status(201).json(await formatDebt(updated));
});

router.get("/customers/debts", requireAuth, async (req, res): Promise<void> => {
  const { customerName } = req.query;
  if (!customerName || typeof customerName !== "string") {
    res.status(400).json({ error: "اسم العميل مطلوب" });
    return;
  }

  const debts = await db.select().from(debtsTable)
    .where(and(
      eq(debtsTable.type, "customer"),
      like(debtsTable.customerName, `%${customerName}%`)
    ));

  const formatted = await Promise.all(debts.filter(d => d.status !== "paid").map(formatDebt));
  res.json(formatted);
});

export default router;

import { Router } from "express";
import { db, purchasesTable, purchaseItemsTable, productsTable, suppliersTable, debtsTable } from "@workspace/db";
import { eq, and, gte, lte, ne } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

async function formatPurchase(p: typeof purchasesTable.$inferSelect) {
  const items = await db.select().from(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, p.id));
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, p.supplierId));
  
  const formattedItems = await Promise.all(items.map(async (item) => {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    return {
      id: item.id,
      productId: item.productId,
      productName: product?.name ?? "منتج محذوف",
      quantity: item.quantity,
      costPrice: parseFloat(item.costPrice as string),
      total: parseFloat(item.total as string),
    };
  }));

  return {
    id: p.id,
    supplierId: p.supplierId,
    supplierName: supplier?.name ?? "مورد محذوف",
    invoiceNumber: p.invoiceNumber ?? null,
    totalAmount: parseFloat(p.totalAmount as string),
    paidAmount: parseFloat(p.paidAmount as string),
    remainingAmount: parseFloat(p.remainingAmount as string),
    previousDebt: parseFloat((p as any).previousDebt ?? "0"),
    paymentType: p.paymentType,
    notes: p.notes ?? null,
    items: formattedItems,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/purchases", requireAuth, async (req, res): Promise<void> => {
  const { supplierId, startDate, endDate } = req.query;
  
  let conditions = [];
  if (supplierId) conditions.push(eq(purchasesTable.supplierId, parseInt(supplierId as string)));
  if (startDate) conditions.push(gte(purchasesTable.createdAt, new Date(startDate as string)));
  if (endDate) conditions.push(lte(purchasesTable.createdAt, new Date(endDate as string)));

  let purchases;
  if (conditions.length > 0) {
    purchases = await db.select().from(purchasesTable).where(and(...conditions)).orderBy(purchasesTable.createdAt);
  } else {
    purchases = await db.select().from(purchasesTable).orderBy(purchasesTable.createdAt);
  }

  const formatted = await Promise.all(purchases.map(formatPurchase));
  res.json(formatted.reverse());
});

router.get("/suppliers/:supplierId/pending-debt", requireAuth, async (req, res): Promise<void> => {
  const supplierId = parseInt(req.params.supplierId, 10);
  const debts = await db.select().from(debtsTable)
    .where(and(
      eq(debtsTable.type, "supplier"),
      eq(debtsTable.supplierId, supplierId),
      ne(debtsTable.status, "paid"),
    ));
  const total = debts.reduce((sum, d) => sum + parseFloat(d.remainingAmount as string), 0);
  res.json({ pendingDebt: total, debtIds: debts.map(d => d.id) });
});

router.post("/purchases", requireAuth, async (req, res): Promise<void> => {
  const { supplierId, invoiceNumber, paymentType, paidAmount, notes, items, includeExistingDebt } = req.body;
  if (!supplierId || !paymentType || !items?.length) {
    res.status(400).json({ error: "المورد، نوع الدفع، والمنتجات مطلوبة" });
    return;
  }

  const itemsTotal = items.reduce((sum: number, item: { quantity: number; costPrice: number }) => 
    sum + (item.quantity * item.costPrice), 0);
  const paid = parseFloat(paidAmount ?? 0);

  // Get existing supplier pending debts if requested
  let previousDebt = 0;
  let oldDebtIds: number[] = [];
  if (includeExistingDebt) {
    const existingDebts = await db.select().from(debtsTable)
      .where(and(
        eq(debtsTable.type, "supplier"),
        eq(debtsTable.supplierId, supplierId),
        ne(debtsTable.status, "paid"),
      ));
    oldDebtIds = existingDebts.map(d => d.id);
    previousDebt = existingDebts.reduce((sum, d) => sum + parseFloat(d.remainingAmount as string), 0);
  }

  const totalAmount = itemsTotal + previousDebt;
  const remaining = Math.max(0, totalAmount - paid);

  const [purchase] = await db.insert(purchasesTable).values({
    supplierId,
    invoiceNumber: invoiceNumber || null,
    totalAmount: totalAmount.toString(),
    paidAmount: paid.toString(),
    remainingAmount: remaining.toString(),
    paymentType,
    notes: notes || null,
  }).returning();

  for (const item of items) {
    const total = item.quantity * item.costPrice;
    await db.insert(purchaseItemsTable).values({
      purchaseId: purchase.id,
      productId: item.productId,
      quantity: item.quantity,
      costPrice: item.costPrice.toString(),
      total: total.toString(),
    });

    const [prod] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    if (prod) {
      await db.update(productsTable)
        .set({ quantity: prod.quantity + item.quantity })
        .where(eq(productsTable.id, item.productId));
    }
  }

  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, supplierId));

  // Settle old debts that are now consolidated into this new invoice
  for (const oldId of oldDebtIds) {
    await db.update(debtsTable)
      .set({ status: "paid", remainingAmount: "0" })
      .where(eq(debtsTable.id, oldId));
  }

  if (remaining > 0) {
    await db.insert(debtsTable).values({
      type: "supplier",
      supplierId,
      supplierName: supplier?.name ?? "",
      totalAmount: remaining.toString(),
      paidAmount: "0",
      remainingAmount: remaining.toString(),
      status: "pending",
      purchaseId: purchase.id,
    });

    // Recalculate supplier total debt based on actual pending debts
    const allPending = await db.select().from(debtsTable)
      .where(and(
        eq(debtsTable.type, "supplier"),
        eq(debtsTable.supplierId, supplierId),
        ne(debtsTable.status, "paid"),
      ));
    const newTotal = allPending.reduce((sum, d) => sum + parseFloat(d.remainingAmount as string), 0);
    await db.update(suppliersTable)
      .set({ totalDebt: newTotal.toString() })
      .where(eq(suppliersTable.id, supplierId));
  } else {
    // Paid in full, recalculate supplier debt
    const allPending = await db.select().from(debtsTable)
      .where(and(
        eq(debtsTable.type, "supplier"),
        eq(debtsTable.supplierId, supplierId),
        ne(debtsTable.status, "paid"),
      ));
    const newTotal = allPending.reduce((sum, d) => sum + parseFloat(d.remainingAmount as string), 0);
    await db.update(suppliersTable)
      .set({ totalDebt: newTotal.toString() })
      .where(eq(suppliersTable.id, supplierId));
  }

  const formatted = await formatPurchase(purchase);
  res.status(201).json(formatted);
});

router.get("/purchases/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [purchase] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id));
  if (!purchase) { res.status(404).json({ error: "الفاتورة غير موجودة" }); return; }
  res.json(await formatPurchase(purchase));
});

export default router;

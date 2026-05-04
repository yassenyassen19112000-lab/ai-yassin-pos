import { Router } from "express";
import { db, purchasesTable, purchaseItemsTable, productsTable, suppliersTable, debtsTable } from "@workspace/db";
import { eq, and, gte, lte, ne, like } from "drizzle-orm";
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
  let { supplierId, supplierName: supplierNameInput, invoiceNumber, paymentType, paidAmount, notes, items, includeExistingDebt } = req.body;

  // Support free-text supplier name: find existing or auto-create
  if (!supplierId && supplierNameInput?.trim()) {
    const existing = await db.select().from(suppliersTable)
      .where(like(suppliersTable.name, supplierNameInput.trim()));
    if (existing.length > 0) {
      supplierId = existing[0].id;
    } else {
      const [created] = await db.insert(suppliersTable)
        .values({ name: supplierNameInput.trim() }).returning();
      supplierId = created.id;
    }
  }

  if (!supplierId || !paymentType || !items?.length) {
    res.status(400).json({ error: "المورد، نوع الدفع، والمنتجات مطلوبة" });
    return;
  }

  // Support productName fallback in items (find-or-create product)
  const resolvedItems: Array<{ productId: number; quantity: number; costPrice: number }> = [];
  for (const item of items) {
    if (item.productId) {
      resolvedItems.push(item);
    } else if (item.productName?.trim()) {
      // Find existing product by name or create it
      const existing = await db.select().from(productsTable)
        .where(like(productsTable.name, item.productName.trim()));
      if (existing.length > 0) {
        resolvedItems.push({ productId: existing[0].id, quantity: item.quantity, costPrice: item.costPrice });
      } else {
        const cp = (item.costPrice ?? 0).toString();
        const [created] = await db.insert(productsTable).values({
          name: item.productName.trim(),
          costPrice: cp,
          sellingPrice: cp,
          quantity: 0,
          minStockLevel: 5,
          unit: "قطعة",
        }).returning();
        resolvedItems.push({ productId: created.id, quantity: item.quantity, costPrice: item.costPrice });
      }
    }
  }

  const itemsTotal = resolvedItems.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);
  const paid = parseFloat(paidAmount ?? 0);

  // Get existing supplier pending debts if includeExistingDebt requested
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

  for (const item of resolvedItems) {
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

  // Settle old debts when includeExistingDebt is set
  for (const oldId of oldDebtIds) {
    await db.update(debtsTable)
      .set({ status: "paid", remainingAmount: "0" })
      .where(eq(debtsTable.id, oldId));
  }

  // ── Debt consolidation: always update existing pending debt for this supplier ──
  if (remaining > 0) {
    const [existingDebt] = await db.select().from(debtsTable)
      .where(and(
        eq(debtsTable.type, "supplier"),
        eq(debtsTable.supplierId, supplierId),
        ne(debtsTable.status, "paid"),
      ));

    if (existingDebt) {
      // Consolidate: add new remaining to existing debt record
      const newTotal = parseFloat(existingDebt.totalAmount as string) + remaining;
      const newRem   = parseFloat(existingDebt.remainingAmount as string) + remaining;
      await db.update(debtsTable)
        .set({ totalAmount: newTotal.toString(), remainingAmount: newRem.toString(), status: "pending" })
        .where(eq(debtsTable.id, existingDebt.id));
    } else {
      // No existing pending debt — create new consolidated one
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
    }
  }

  // Recalculate supplier total debt
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

  const formatted = await formatPurchase(purchase);
  res.status(201).json(formatted);
});

router.get("/purchases/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [purchase] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id));
  if (!purchase) { res.status(404).json({ error: "الفاتورة غير موجودة" }); return; }
  res.json(await formatPurchase(purchase));
});

// ── Add items to existing purchase ───────────────────────────────────────────
router.post("/purchases/:id/add-items", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { items } = req.body;
  if (!items?.length) { res.status(400).json({ error: "يجب إضافة منتجات" }); return; }

  const [purchase] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id));
  if (!purchase) { res.status(404).json({ error: "الفاتورة غير موجودة" }); return; }

  let additionalTotal = 0;
  for (const item of items) {
    const total = item.quantity * item.costPrice;
    additionalTotal += total;
    await db.insert(purchaseItemsTable).values({
      purchaseId: id, productId: item.productId,
      quantity: item.quantity, costPrice: item.costPrice.toString(), total: total.toString(),
    });
    const [prod] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    if (prod) {
      await db.update(productsTable)
        .set({ quantity: prod.quantity + item.quantity })
        .where(eq(productsTable.id, item.productId));
    }
  }

  const newTotal     = parseFloat(purchase.totalAmount     as string) + additionalTotal;
  const newRemaining = parseFloat(purchase.remainingAmount as string) + additionalTotal;
  await db.update(purchasesTable)
    .set({ totalAmount: newTotal.toString(), remainingAmount: newRemaining.toString() })
    .where(eq(purchasesTable.id, id));

  // Consolidate: update existing pending debt for this supplier
  const [existingDebt] = await db.select().from(debtsTable)
    .where(and(eq(debtsTable.supplierId, purchase.supplierId), ne(debtsTable.status, "paid")));
  if (existingDebt) {
    await db.update(debtsTable)
      .set({
        totalAmount:     (parseFloat(existingDebt.totalAmount     as string) + additionalTotal).toString(),
        remainingAmount: (parseFloat(existingDebt.remainingAmount as string) + additionalTotal).toString(),
        status: "pending",
      })
      .where(eq(debtsTable.id, existingDebt.id));
  } else if (newRemaining > 0) {
    const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, purchase.supplierId));
    await db.insert(debtsTable).values({
      type: "supplier", supplierId: purchase.supplierId, supplierName: supplier?.name ?? "",
      totalAmount: additionalTotal.toString(), paidAmount: "0",
      remainingAmount: additionalTotal.toString(), status: "pending", purchaseId: id,
    });
  }

  const [updated] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id));
  res.json(await formatPurchase(updated));
});

// ── Record payment on existing purchase ──────────────────────────────────────
router.post("/purchases/:id/payment", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { amount } = req.body;
  if (!amount || parseFloat(amount) <= 0) { res.status(400).json({ error: "المبلغ مطلوب" }); return; }

  const [purchase] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id));
  if (!purchase) { res.status(404).json({ error: "الفاتورة غير موجودة" }); return; }

  const payAmount    = parseFloat(amount);
  const newPaid      = parseFloat(purchase.paidAmount as string) + payAmount;
  const newRemaining = Math.max(0, parseFloat(purchase.remainingAmount as string) - payAmount);

  await db.update(purchasesTable)
    .set({ paidAmount: newPaid.toString(), remainingAmount: newRemaining.toString() })
    .where(eq(purchasesTable.id, id));

  // Update matching supplier debt record
  const [existingDebt] = await db.select().from(debtsTable)
    .where(and(
      eq(debtsTable.type, "supplier"),
      eq(debtsTable.supplierId, purchase.supplierId),
      ne(debtsTable.status, "paid"),
    ));
  if (existingDebt) {
    const newDebtPaid = parseFloat(existingDebt.paidAmount as string) + payAmount;
    const newDebtRem  = Math.max(0, parseFloat(existingDebt.remainingAmount as string) - payAmount);
    const debtStatus  = newDebtRem <= 0 ? "paid" : "partial";
    await db.update(debtsTable)
      .set({ paidAmount: newDebtPaid.toString(), remainingAmount: newDebtRem.toString(), status: debtStatus })
      .where(eq(debtsTable.id, existingDebt.id));
  }

  // Recalculate supplier total debt
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, purchase.supplierId));
  if (supplier) {
    const allPending = await db.select().from(debtsTable)
      .where(and(eq(debtsTable.type, "supplier"), eq(debtsTable.supplierId, purchase.supplierId), ne(debtsTable.status, "paid")));
    const newTotal = allPending.reduce((s, d) => s + parseFloat(d.remainingAmount as string), 0);
    await db.update(suppliersTable)
      .set({ totalDebt: newTotal.toString() })
      .where(eq(suppliersTable.id, purchase.supplierId));
  }

  const [updated] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id));
  res.json(await formatPurchase(updated));
});

router.get("/purchases/:id/returns", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { db: dbInst, purchaseReturnsTable } = await import("@workspace/db");
  const { eq: eqInst } = await import("drizzle-orm");
  const returns = await dbInst.select().from(purchaseReturnsTable).where(eqInst(purchaseReturnsTable.purchaseId, id)).orderBy(purchaseReturnsTable.createdAt);
  res.json(returns.map((r: any) => ({
    id: r.id,
    return_number: r.returnNumber,
    return_amount: r.returnAmount,
    items: r.items,
    reason: r.reason,
    created_at: r.createdAt.toISOString(),
  })));
});

router.post("/purchases/:id/return", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { items: returnItems, reason } = req.body;
  if (!returnItems?.length) { res.status(400).json({ error: "يجب تحديد منتجات للمرتجع" }); return; }

  const [purchase] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id));
  if (!purchase) { res.status(404).json({ error: "الفاتورة غير موجودة" }); return; }

  const { db: dbInst, purchaseReturnsTable, purchaseItemsTable: piTable } = await import("@workspace/db");
  const { eq: eqInst } = await import("drizzle-orm");

  let returnAmount = 0;
  const itemsWithPrice: any[] = [];
  for (const ri of returnItems) {
    const allItems = await dbInst.select().from(piTable).where(eqInst(piTable.purchaseId, id));
    const item = allItems.find((i: any) => i.productId === ri.productId);
    const costPrice = item ? parseFloat(item.costPrice as string) : 0;
    const total = ri.quantity * costPrice;
    returnAmount += total;
    itemsWithPrice.push({ productId: ri.productId, productName: ri.productName, quantity: ri.quantity, costPrice, total });

    const [prod] = await db.select().from(productsTable).where(eq(productsTable.id, ri.productId));
    if (prod) {
      await db.update(productsTable)
        .set({ quantity: Math.max(0, prod.quantity - ri.quantity) })
        .where(eq(productsTable.id, ri.productId));
    }
  }

  const returnNumber = `RET-PUR-${Date.now().toString().slice(-8)}`;
  await dbInst.insert(purchaseReturnsTable).values({
    purchaseId: id,
    returnNumber,
    returnAmount: returnAmount.toString(),
    items: itemsWithPrice,
    reason: reason || null,
  });

  const newRemaining = parseFloat(purchase.remainingAmount as string) - returnAmount;
  await db.update(purchasesTable)
    .set({ remainingAmount: newRemaining.toString() })
    .where(eq(purchasesTable.id, id));

  if (purchase.supplierId) {
    const [existingDebt] = await db.select().from(debtsTable)
      .where(and(eq(debtsTable.supplierId, purchase.supplierId), ne(debtsTable.status, "paid")));
    if (existingDebt) {
      const newDebtRem = Math.max(0, parseFloat(existingDebt.remainingAmount as string) - returnAmount);
      const newDebtTotal = Math.max(0, parseFloat(existingDebt.totalAmount as string) - returnAmount);
      await db.update(debtsTable)
        .set({
          totalAmount: newDebtTotal.toString(),
          remainingAmount: newDebtRem.toString(),
          status: newDebtRem <= 0 ? "paid" : "pending",
        })
        .where(eq(debtsTable.id, existingDebt.id));
    }

    const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, purchase.supplierId));
    if (supplier) {
      await db.update(suppliersTable)
        .set({ totalDebt: Math.max(0, parseFloat(supplier.totalDebt as string) - returnAmount).toString() })
        .where(eq(suppliersTable.id, purchase.supplierId));
    }
  }

  res.json({
    returnAmount,
    returnNumber,
    purchaseTotal: parseFloat(purchase.totalAmount as string),
    paidAmount: parseFloat(purchase.paidAmount as string),
    newRemaining,
  });
});

export default router;

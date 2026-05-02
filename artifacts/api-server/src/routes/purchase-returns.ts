import { Router } from "express";
import { db, purchasesTable, purchaseItemsTable, productsTable, debtsTable, purchaseReturnsTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../lib/auth";
import { sql } from "drizzle-orm";

const router = Router();

function generateReturnNumber() {
  const now = new Date();
  return `PRET-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}-${Date.now().toString().slice(-6)}`;
}

// ── GET returns for a purchase ──────────────────────────────────────────────
router.get("/purchases/:id/returns", requireAuth, async (req, res): Promise<void> => {
  const purchaseId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const returns = await db.execute(
    sql`SELECT * FROM purchase_returns WHERE purchase_id = ${purchaseId} ORDER BY created_at DESC`
  );
  res.json(returns.rows);
});

// ── POST create a return ────────────────────────────────────────────────────
router.post("/purchases/:id/return", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const purchaseId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { items, reason } = req.body;

  if (!items?.length) {
    res.status(400).json({ error: "يجب تحديد منتجات المرتجع" });
    return;
  }

  const [purchase] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, purchaseId));
  if (!purchase) {
    res.status(404).json({ error: "الفاتورة غير موجودة" });
    return;
  }

  const purchaseItems = await db.select().from(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, purchaseId));

  let returnAmount = 0;
  const returnItems = [];

  for (const retItem of items) {
    const purchaseItem = purchaseItems.find(i => i.productId === retItem.productId);
    if (!purchaseItem) {
      res.status(400).json({ error: `المنتج ${retItem.productName} غير موجود في الفاتورة` });
      return;
    }
    if (retItem.quantity > purchaseItem.quantity) {
      res.status(400).json({ error: `الكمية المرتجعة لـ ${retItem.productName} تتجاوز الكمية المشتراة` });
      return;
    }

    const itemTotal = retItem.quantity * parseFloat(purchaseItem.costPrice as string);
    returnAmount += itemTotal;
    returnItems.push({
      productId: retItem.productId,
      productName: retItem.productName,
      quantity: retItem.quantity,
      costPrice: parseFloat(purchaseItem.costPrice as string),
      total: itemTotal,
    });

    // Decrease stock (we're returning items to supplier)
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, retItem.productId));
    if (product) {
      await db.update(productsTable)
        .set({ quantity: Math.max(0, product.quantity - retItem.quantity) })
        .where(eq(productsTable.id, retItem.productId));
    }
  }

  // Insert return record
  await db.execute(sql`
    INSERT INTO purchase_returns (purchase_id, return_number, return_amount, reason, cashier_name, items)
    VALUES (${purchaseId}, ${generateReturnNumber()}, ${returnAmount}, ${reason || null}, ${req.userName || "كاشير"}, ${JSON.stringify(returnItems)}::jsonb)
  `);

  // ── Update purchase's remainingAmount (allow negative = supplier owes us) ─
  const currentRemaining = parseFloat(purchase.remainingAmount as string);
  const newRemainingAmount = currentRemaining - returnAmount; // can be negative
  await db.update(purchasesTable)
    .set({ remainingAmount: newRemainingAmount.toString() })
    .where(eq(purchasesTable.id, purchaseId));

  // ── Update linked supplier debt record if exists ────────────────────────
  const purchaseDebts = await db.select().from(debtsTable)
    .where(and(
      eq(debtsTable.purchaseId, purchaseId),
      ne(debtsTable.status, "paid"),
    ));

  for (const debt of purchaseDebts) {
    const debtRemaining = parseFloat(debt.remainingAmount as string);
    const newDebtRemaining = Math.max(0, debtRemaining - returnAmount);
    const newStatus = newDebtRemaining <= 0 ? "paid" : "partial";
    await db.update(debtsTable)
      .set({
        remainingAmount: newDebtRemaining.toString(),
        paidAmount: (parseFloat(debt.paidAmount as string) + Math.min(returnAmount, debtRemaining)).toString(),
        status: newStatus,
      })
      .where(eq(debtsTable.id, debt.id));
  }

  res.status(201).json({
    returnAmount,
    items: returnItems,
    reason: reason || null,
    purchaseTotal: parseFloat(purchase.totalAmount as string),
    paidAmount: parseFloat(purchase.paidAmount as string),
    newRemainingAmount,
  });
});

export default router;

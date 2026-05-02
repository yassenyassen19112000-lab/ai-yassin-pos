import { Router } from "express";
import { db, salesTable, saleItemsTable, productsTable, debtsTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../lib/auth";
import { sql } from "drizzle-orm";

const router = Router();

function generateReturnNumber() {
  const now = new Date();
  return `RET-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Date.now().toString().slice(-6)}`;
}

router.get("/sales/:id/returns", requireAuth, async (req, res): Promise<void> => {
  const saleId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const returns = await db.execute(
    sql`SELECT * FROM sales_returns WHERE sale_id = ${saleId} ORDER BY created_at DESC`
  );
  res.json(returns.rows);
});

router.post("/sales/:id/return", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const saleId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { items, reason } = req.body;

  if (!items?.length) {
    res.status(400).json({ error: "يجب تحديد منتجات المرتجع" });
    return;
  }

  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, saleId));
  if (!sale) {
    res.status(404).json({ error: "الفاتورة غير موجودة" });
    return;
  }

  const saleItems = await db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, saleId));

  let returnAmount = 0;
  const returnItems = [];

  for (const retItem of items) {
    const saleItem = saleItems.find(i => i.productId === retItem.productId);
    if (!saleItem) {
      res.status(400).json({ error: `المنتج ${retItem.productName} غير موجود في الفاتورة` });
      return;
    }
    if (retItem.quantity > saleItem.quantity) {
      res.status(400).json({ error: `الكمية المرتجعة لـ ${retItem.productName} تتجاوز الكمية المباعة` });
      return;
    }

    const itemTotal = retItem.quantity * parseFloat(saleItem.sellingPrice as string);
    returnAmount += itemTotal;
    returnItems.push({
      productId: retItem.productId,
      productName: saleItem.productName,
      quantity: retItem.quantity,
      sellingPrice: parseFloat(saleItem.sellingPrice as string),
      total: itemTotal,
    });

    // Restore stock
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, retItem.productId));
    if (product) {
      await db.update(productsTable)
        .set({ quantity: product.quantity + retItem.quantity })
        .where(eq(productsTable.id, retItem.productId));
    }
  }

  // Insert return record
  await db.execute(sql`
    INSERT INTO sales_returns (sale_id, return_number, return_amount, reason, cashier_name, items)
    VALUES (${saleId}, ${generateReturnNumber()}, ${returnAmount}, ${reason || null}, ${req.userName || "كاشير"}, ${JSON.stringify(returnItems)}::jsonb)
  `);

  // ── Update sale's remainingDebt (allow negative = refund due) ────────────
  const currentRemaining = parseFloat(sale.remainingDebt as string);
  const newRemainingDebt = currentRemaining - returnAmount; // can be negative
  await db.update(salesTable)
    .set({ remainingDebt: newRemainingDebt.toString() })
    .where(eq(salesTable.id, saleId));

  // ── If there's a linked debt record for this sale, reduce it too ─────────
  if (sale.customerName && returnAmount > 0) {
    const saleDebts = await db.select().from(debtsTable)
      .where(and(
        eq(debtsTable.saleId, saleId),
        ne(debtsTable.status, "paid")
      ));

    for (const debt of saleDebts) {
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
  }

  res.status(201).json({
    returnAmount,
    items: returnItems,
    reason: reason || null,
    saleTotal: parseFloat(sale.totalAmount as string),
    previousDebt: parseFloat(sale.previousDebt as string),
    paidAmount: parseFloat(sale.paidAmount as string),
    newRemainingDebt,
  });
});

export default router;

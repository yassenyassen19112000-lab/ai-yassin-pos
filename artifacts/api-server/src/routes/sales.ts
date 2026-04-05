import { Router } from "express";
import { db, salesTable, saleItemsTable, productsTable, debtsTable } from "@workspace/db";
import { eq, and, gte, lte, like, ne } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../lib/auth";

const router = Router();

async function formatSale(s: typeof salesTable.$inferSelect) {
  const items = await db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, s.id));
  
  return {
    id: s.id,
    invoiceNumber: s.invoiceNumber,
    customerName: s.customerName ?? null,
    customerPhone: s.customerPhone ?? null,
    totalAmount: parseFloat(s.totalAmount as string),
    paidAmount: parseFloat(s.paidAmount as string),
    discountAmount: parseFloat(s.discountAmount as string),
    previousDebt: parseFloat(s.previousDebt as string),
    remainingDebt: parseFloat(s.remainingDebt as string),
    paymentType: s.paymentType,
    notes: s.notes ?? null,
    cashierName: s.cashierName,
    items: items.map(item => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      sellingPrice: parseFloat(item.sellingPrice as string),
      total: parseFloat(item.total as string),
    })),
    createdAt: s.createdAt.toISOString(),
  };
}

function generateInvoiceNumber() {
  const now = new Date();
  return `INV-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Date.now().toString().slice(-6)}`;
}

router.get("/sales", requireAuth, async (req, res): Promise<void> => {
  const { startDate, endDate, customerName } = req.query;
  
  let conditions = [];
  if (startDate) conditions.push(gte(salesTable.createdAt, new Date(startDate as string)));
  if (endDate) conditions.push(lte(salesTable.createdAt, new Date(endDate as string)));
  if (customerName && typeof customerName === "string") {
    conditions.push(like(salesTable.customerName, `%${customerName}%`));
  }

  let sales;
  if (conditions.length > 0) {
    sales = await db.select().from(salesTable).where(and(...conditions)).orderBy(salesTable.createdAt);
  } else {
    sales = await db.select().from(salesTable).orderBy(salesTable.createdAt);
  }

  const formatted = await Promise.all(sales.map(formatSale));
  res.json(formatted.reverse());
});

router.post("/sales", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { customerName, customerPhone, paymentType, paidAmount, discountAmount, notes, items } = req.body;
  if (!paymentType || !items?.length) {
    res.status(400).json({ error: "نوع الدفع والمنتجات مطلوبة" });
    return;
  }

  const subtotal = items.reduce((sum: number, item: { quantity: number; sellingPrice: number }) => 
    sum + (item.quantity * item.sellingPrice), 0);
  const discount = parseFloat(discountAmount ?? 0);
  const totalAmount = subtotal - discount;
  const paid = parseFloat(paidAmount ?? 0);

  let previousDebt = 0;
  let oldDebtIds: number[] = [];

  if (customerName) {
    const customerDebts = await db.select().from(debtsTable)
      .where(and(
        eq(debtsTable.type, "customer"),
        like(debtsTable.customerName, customerName),
        ne(debtsTable.status, "paid"),
      ));
    oldDebtIds = customerDebts.map(d => d.id);
    previousDebt = customerDebts
      .reduce((sum, d) => sum + parseFloat(d.remainingAmount as string), 0);
  }

  const totalWithDebt = totalAmount + previousDebt;
  const remainingDebt = Math.max(0, totalWithDebt - paid);

  const [sale] = await db.insert(salesTable).values({
    invoiceNumber: generateInvoiceNumber(),
    customerName: customerName || null,
    customerPhone: customerPhone || null,
    totalAmount: totalAmount.toString(),
    paidAmount: paid.toString(),
    discountAmount: discount.toString(),
    previousDebt: previousDebt.toString(),
    remainingDebt: remainingDebt.toString(),
    paymentType,
    notes: notes || null,
    cashierId: req.userId || null,
    cashierName: req.userName || "كاشير",
  }).returning();

  for (const item of items) {
    const total = item.quantity * item.sellingPrice;
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    
    await db.insert(saleItemsTable).values({
      saleId: sale.id,
      productId: item.productId,
      productName: product?.name ?? "منتج",
      quantity: item.quantity,
      sellingPrice: item.sellingPrice.toString(),
      total: total.toString(),
    });

    if (product) {
      await db.update(productsTable)
        .set({ quantity: Math.max(0, product.quantity - item.quantity) })
        .where(eq(productsTable.id, item.productId));
    }
  }

  // Mark old debts as settled so they don't get counted again
  for (const oldId of oldDebtIds) {
    await db.update(debtsTable)
      .set({ status: "paid", remainingAmount: "0" })
      .where(eq(debtsTable.id, oldId));
  }

  // Create new debt only for the new remaining amount
  if (remainingDebt > 0 && customerName) {
    await db.insert(debtsTable).values({
      type: "customer",
      customerName,
      customerPhone: customerPhone || null,
      totalAmount: remainingDebt.toString(),
      paidAmount: "0",
      remainingAmount: remainingDebt.toString(),
      status: "pending",
      saleId: sale.id,
    });
  }

  const formatted = await formatSale(sale);
  res.status(201).json(formatted);
});

router.get("/sales/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, id));
  if (!sale) { res.status(404).json({ error: "الفاتورة غير موجودة" }); return; }
  res.json(await formatSale(sale));
});

export default router;

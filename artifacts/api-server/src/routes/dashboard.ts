import { Router } from "express";
import { db, salesTable, purchasesTable, productsTable, debtsTable, saleItemsTable, expensesTable } from "@workspace/db";
import { eq, gte, and, sql, lt } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // ── TODAY ────────────────────────────────────────────────────────────────
  const [salesToday] = await db.select({
    total: sql<string>`COALESCE(SUM(paid_amount), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(salesTable).where(gte(salesTable.createdAt, startOfToday));

  // ── THIS MONTH — SALES ───────────────────────────────────────────────────
  const salesThisMonth = await db.select().from(salesTable).where(gte(salesTable.createdAt, startOfMonth));
  const totalSalesInvoicedMonth   = salesThisMonth.reduce((s, r) => s + parseFloat(r.totalAmount as string), 0);
  const totalSalesCollectedMonth  = salesThisMonth.reduce((s, r) => s + parseFloat(r.paidAmount as string), 0);
  // Pending = positive remainingDebt on sales this month (already deducted by returns)
  const pendingDebtsMonth = salesThisMonth.reduce((s, r) => {
    const rd = parseFloat(r.remainingDebt as string);
    return s + (rd > 0 ? rd : 0);
  }, 0);
  // Refunds due = negative remainingDebt on sales this month
  const refundsDueMonth = salesThisMonth.reduce((s, r) => {
    const rd = parseFloat(r.remainingDebt as string);
    return s + (rd < 0 ? Math.abs(rd) : 0);
  }, 0);

  // ── THIS MONTH — RETURNS ─────────────────────────────────────────────────
  const returnsMonthRow = await db.execute(
    sql`SELECT COALESCE(SUM(sr.return_amount), 0) AS total
        FROM sales_returns sr
        JOIN sales s ON sr.sale_id = s.id
        WHERE sr.created_at >= ${startOfMonth}`
  );
  const totalReturnsMonth = parseFloat((returnsMonthRow.rows[0] as any)?.total ?? "0");

  // ── THIS MONTH — PURCHASES ───────────────────────────────────────────────
  const [purchasesMonth] = await db.select({
    total: sql<string>`COALESCE(SUM(total_amount), 0)`,
    paid:  sql<string>`COALESCE(SUM(paid_amount), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(purchasesTable).where(gte(purchasesTable.createdAt, startOfMonth));
  const totalPurchasesInvoicedMonth = parseFloat(purchasesMonth.total ?? "0");
  const totalPurchasesPaidMonth     = parseFloat(purchasesMonth.paid ?? "0");

  // ── THIS MONTH — EXPENSES ────────────────────────────────────────────────
  const [expensesMonth] = await db.select({
    total: sql<string>`COALESCE(SUM(amount), 0)`,
  }).from(expensesTable).where(gte(expensesTable.createdAt, startOfMonth));
  const totalExpensesMonth = parseFloat(expensesMonth.total ?? "0");

  // ── THIS MONTH — PROFIT (cash-basis) ─────────────────────────────────────
  // Revenue    = collected cash from sales this month
  // COGS       = proportional to collection rate (only for collected portion)
  // Returns    = reduce gross profit proportionally
  // Expenses   = fully deducted (already paid cash)
  const allProducts = await db.select().from(productsTable);
  const productMap  = new Map(allProducts.map(p => [p.id, p]));
  const saleIdSet   = new Set(salesThisMonth.map(s => s.id));
  const saleCollectionRate = new Map(salesThisMonth.map(s => {
    const total = parseFloat(s.totalAmount as string);
    const paid  = parseFloat(s.paidAmount  as string);
    return [s.id, total > 0 ? Math.min(1, paid / total) : 0];
  }));

  const allSaleItemsMonth = await db.select().from(saleItemsTable);
  let collectedRevenue = 0;
  let proportionalCOGS = 0;
  for (const item of allSaleItemsMonth) {
    if (!saleIdSet.has(item.saleId)) continue;
    const product = productMap.get(item.productId);
    const rate    = saleCollectionRate.get(item.saleId) ?? 0;
    collectedRevenue += parseFloat(item.total as string) * rate;
    proportionalCOGS += (product ? parseFloat(product.costPrice as string) * item.quantity : 0) * rate;
  }

  let returnsRevenueImpact = 0;
  let returnsCOGSImpact    = 0;
  const returnsItemsRows = await db.execute(
    sql`SELECT sr.items, s.paid_amount, s.total_amount
        FROM sales_returns sr JOIN sales s ON sr.sale_id = s.id
        WHERE sr.created_at >= ${startOfMonth}`
  );
  for (const row of returnsItemsRows.rows as any[]) {
    const rate  = row.total_amount > 0 ? Math.min(1, row.paid_amount / row.total_amount) : 0;
    const items = Array.isArray(row.items) ? row.items : [];
    for (const ri of items) {
      const product     = productMap.get(ri.productId);
      const retRevenue  = ri.total ?? (ri.sellingPrice ?? 0) * ri.quantity;
      const retCOGS     = product ? parseFloat(product.costPrice as string) * ri.quantity : 0;
      returnsRevenueImpact += retRevenue * rate;
      returnsCOGSImpact    += retCOGS    * rate;
    }
  }

  const grossProfitMonth    = collectedRevenue - proportionalCOGS;
  const returnsGrossImpact  = returnsRevenueImpact - returnsCOGSImpact;
  const totalProfitMonth    = grossProfitMonth - returnsGrossImpact - totalExpensesMonth;

  // ── ALL-TIME ─────────────────────────────────────────────────────────────
  const [salesAll] = await db.select({
    totalAmount: sql<string>`COALESCE(SUM(total_amount), 0)`,
    paidAmount:  sql<string>`COALESCE(SUM(paid_amount), 0)`,
    count:       sql<number>`COUNT(*)`,
  }).from(salesTable);

  const [purchasesAll] = await db.select({
    total: sql<string>`COALESCE(SUM(total_amount), 0)`,
    paid:  sql<string>`COALESCE(SUM(paid_amount), 0)`,
  }).from(purchasesTable);

  const [expensesAll] = await db.select({
    total: sql<string>`COALESCE(SUM(amount), 0)`,
  }).from(expensesTable);

  const returnsAllRow = await db.execute(
    sql`SELECT COALESCE(SUM(return_amount), 0) AS total FROM sales_returns`
  );
  const totalReturnsAll = parseFloat((returnsAllRow.rows[0] as any)?.total ?? "0");

  const totalCollectedAll     = parseFloat(salesAll.paidAmount ?? "0");
  const totalInvoicedAll      = parseFloat(salesAll.totalAmount ?? "0");
  const totalPurchasesPaidAll = parseFloat(purchasesAll.paid ?? "0");
  const totalPurchasesInvoicedAll = parseFloat(purchasesAll.total ?? "0");
  const totalExpensesAll      = parseFloat(expensesAll.total ?? "0");

  // ── DEBTS (current outstanding) ──────────────────────────────────────────
  const [customerDebtsRow] = await db.select({
    total: sql<string>`COALESCE(SUM(remaining_amount), 0)`,
  }).from(debtsTable).where(and(eq(debtsTable.type, "customer"), sql`status != 'paid'`));

  const [supplierDebtsRow] = await db.select({
    total: sql<string>`COALESCE(SUM(remaining_amount), 0)`,
  }).from(debtsTable).where(and(eq(debtsTable.type, "supplier"), sql`status != 'paid'`));

  const totalCustomerDebts = parseFloat(customerDebtsRow?.total ?? "0");
  const totalSupplierDebts = parseFloat(supplierDebtsRow?.total ?? "0");

  // ── NET POSITIONS ─────────────────────────────────────────────────────────
  // Cash actually received minus cash actually paid out minus refunds
  const netCashAllTime   = totalCollectedAll - totalReturnsAll - totalPurchasesPaidAll - totalExpensesAll;
  // Full financial position = net cash + what customers still owe - what we still owe suppliers
  const netPositionAllTime = netCashAllTime + totalCustomerDebts - totalSupplierDebts;

  // Monthly cash flow
  const netCashMonth = totalSalesCollectedMonth - totalReturnsMonth - totalPurchasesPaidMonth - totalExpensesMonth;

  // ── LOW STOCK ─────────────────────────────────────────────────────────────
  const lowStock = allProducts.filter(p => p.quantity <= p.minStockLevel);

  res.json({
    // Today
    totalSalesToday: parseFloat(salesToday.total ?? "0"),
    totalSalesCountToday: parseInt(String(salesToday.count ?? 0)),

    // This month — Sales
    totalSalesInvoicedMonth,
    totalSalesCollectedMonth,
    pendingDebtsMonth,
    refundsDueMonth,
    totalReturnsMonth,
    totalSalesCountMonth: salesThisMonth.length,

    // This month — Purchases
    totalPurchasesInvoicedMonth,
    totalPurchasesPaidMonth,

    // This month — Expenses
    totalExpensesMonth,

    // This month — Net
    netCashMonth,
    totalProfitMonth,

    // All-time — Sales
    totalCollectedAll,
    totalInvoicedAll,
    totalReturnsAll,

    // All-time — Purchases
    totalPurchasesPaidAll,
    totalPurchasesInvoicedAll,

    // All-time — Expenses
    totalExpensesAll,

    // Current debts
    totalCustomerDebts,
    totalSupplierDebts,

    // Net positions
    netCashAllTime,
    netPositionAllTime,

    // Other
    lowStockCount: lowStock.length,
    totalProducts: allProducts.length,

    // Legacy keys kept for Dashboard.tsx compatibility
    totalSalesMonth: totalSalesInvoicedMonth,
    totalPurchasesMonth: totalPurchasesInvoicedMonth,
    totalExpenses: totalExpensesAll,
    totalCollected: totalCollectedAll,
    totalPurchasesPaid: totalPurchasesPaidAll,
    totalReturns: totalReturnsAll,
    netCashPosition: netCashAllTime,
    netPosition: netPositionAllTime,
  });
});

router.get("/dashboard/low-stock", requireAuth, async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable);
  const lowStock = products.filter(p => p.quantity <= p.minStockLevel).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    barcode: p.barcode ?? null,
    category: p.category ?? null,
    costPrice: parseFloat(p.costPrice as string),
    sellingPrice: parseFloat(p.sellingPrice as string),
    quantity: p.quantity,
    minStockLevel: p.minStockLevel,
    unit: p.unit,
    isLowStock: true,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
  res.json(lowStock);
});

router.get("/dashboard/recent-sales", requireAuth, async (_req, res): Promise<void> => {
  const sales = await db.select().from(salesTable).orderBy(sql`created_at DESC`).limit(10);
  const formatted = await Promise.all(sales.map(async s => {
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
  }));
  res.json(formatted);
});

router.get("/dashboard/sales-chart", requireAuth, async (req, res): Promise<void> => {
  const { period } = req.query;
  const now = new Date();
  const result = [];
  const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const days   = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

  if (period === "month") {
    for (let i = 11; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const [sales]     = await db.select({ collected: sql<string>`COALESCE(SUM(paid_amount), 0)`, invoiced: sql<string>`COALESCE(SUM(total_amount), 0)` }).from(salesTable).where(and(gte(salesTable.createdAt, d), lt(salesTable.createdAt, end)));
      const [purchases] = await db.select({ total: sql<string>`COALESCE(SUM(paid_amount), 0)` }).from(purchasesTable).where(and(gte(purchasesTable.createdAt, d), lt(purchasesTable.createdAt, end)));
      const [expenses]  = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` }).from(expensesTable).where(and(gte(expensesTable.createdAt, d), lt(expensesTable.createdAt, end)));
      const returnsRow  = await db.execute(sql`SELECT COALESCE(SUM(return_amount), 0) AS total FROM sales_returns WHERE created_at >= ${d} AND created_at < ${end}`);
      const collected   = parseFloat(sales?.collected ?? "0");
      const returnsAmt  = parseFloat((returnsRow.rows[0] as any)?.total ?? "0");
      const purchTotal  = parseFloat(purchases?.total ?? "0");
      const expTotal    = parseFloat(expenses?.total ?? "0");
      result.push({
        label:     months[d.getMonth()],
        sales:     collected,
        returns:   returnsAmt,
        purchases: purchTotal,
        expenses:  expTotal,
        profit:    collected - returnsAmt - purchTotal - expTotal,
      });
    }
  } else {
    for (let i = 6; i >= 0; i--) {
      const d     = new Date(now);
      d.setDate(d.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const [sales]     = await db.select({ collected: sql<string>`COALESCE(SUM(paid_amount), 0)` }).from(salesTable).where(and(gte(salesTable.createdAt, start), lt(salesTable.createdAt, end)));
      const [purchases] = await db.select({ total: sql<string>`COALESCE(SUM(paid_amount), 0)` }).from(purchasesTable).where(and(gte(purchasesTable.createdAt, start), lt(purchasesTable.createdAt, end)));
      const [expenses]  = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` }).from(expensesTable).where(and(gte(expensesTable.createdAt, start), lt(expensesTable.createdAt, end)));
      const returnsRow  = await db.execute(sql`SELECT COALESCE(SUM(return_amount), 0) AS total FROM sales_returns WHERE created_at >= ${start} AND created_at < ${end}`);
      const collected   = parseFloat(sales?.collected ?? "0");
      const returnsAmt  = parseFloat((returnsRow.rows[0] as any)?.total ?? "0");
      const purchTotal  = parseFloat(purchases?.total ?? "0");
      const expTotal    = parseFloat(expenses?.total ?? "0");
      result.push({
        label:     days[d.getDay()],
        sales:     collected,
        returns:   returnsAmt,
        purchases: purchTotal,
        expenses:  expTotal,
        profit:    collected - returnsAmt - purchTotal - expTotal,
      });
    }
  }

  res.json(result);
});

export default router;

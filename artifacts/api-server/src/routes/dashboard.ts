import { Router } from "express";
import { db, salesTable, purchasesTable, productsTable, debtsTable, saleItemsTable, expensesTable } from "@workspace/db";
import { eq, gte, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Sales totals
  const [salesToday] = await db.select({
    total: sql<string>`COALESCE(SUM(paid_amount), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(salesTable).where(gte(salesTable.createdAt, startOfToday));

  const [salesMonth] = await db.select({
    totalAmount: sql<string>`COALESCE(SUM(total_amount), 0)`,
    paidAmount: sql<string>`COALESCE(SUM(paid_amount), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(salesTable).where(gte(salesTable.createdAt, startOfMonth));

  // Purchases this month (what we paid)
  const [purchasesMonth] = await db.select({
    total: sql<string>`COALESCE(SUM(total_amount), 0)`,
    paid: sql<string>`COALESCE(SUM(paid_amount), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(purchasesTable).where(gte(purchasesTable.createdAt, startOfMonth));

  // Expenses this month
  const [expensesMonth] = await db.select({
    total: sql<string>`COALESCE(SUM(amount), 0)`,
  }).from(expensesTable).where(gte(expensesTable.createdAt, startOfMonth));

  // All-time expenses
  const [expensesAll] = await db.select({
    total: sql<string>`COALESCE(SUM(amount), 0)`,
  }).from(expensesTable);

  // All-time sales collected
  const [salesAll] = await db.select({
    totalAmount: sql<string>`COALESCE(SUM(total_amount), 0)`,
    paidAmount: sql<string>`COALESCE(SUM(paid_amount), 0)`,
  }).from(salesTable);

  // All-time purchases paid
  const [purchasesAll] = await db.select({
    paid: sql<string>`COALESCE(SUM(paid_amount), 0)`,
  }).from(purchasesTable);

  // Returns this month
  const returnsThisMonth = await db.execute(
    sql`SELECT COALESCE(SUM(return_amount), 0) as total FROM sales_returns WHERE created_at >= ${startOfMonth}`
  );
  const returnsMonthTotal = parseFloat((returnsThisMonth.rows[0] as any)?.total ?? "0");

  // All-time returns
  const returnsAllTime = await db.execute(
    sql`SELECT COALESCE(SUM(return_amount), 0) as total FROM sales_returns`
  );
  const returnsAllTotal = parseFloat((returnsAllTime.rows[0] as any)?.total ?? "0");

  // Customer debts (what they owe us)
  const [customerDebts] = await db.select({
    total: sql<string>`COALESCE(SUM(remaining_amount), 0)`,
  }).from(debtsTable).where(and(eq(debtsTable.type, "customer"), sql`status != 'paid'`));

  // Supplier debts (what we owe them)
  const [supplierDebts] = await db.select({
    total: sql<string>`COALESCE(SUM(remaining_amount), 0)`,
  }).from(debtsTable).where(and(eq(debtsTable.type, "supplier"), sql`status != 'paid'`));

  const allProducts = await db.select().from(productsTable);
  const lowStock = allProducts.filter(p => p.quantity <= p.minStockLevel);

  // ── Profit: cash-basis (only collected revenue counts) ───────────────────
  // Revenue = paidAmount for each sale (not the full invoiced totalAmount)
  // COGS    = proportional to collection rate (paidAmount / totalAmount * fullCOGS)
  // This ensures unpaid invoices (debts) don't inflate profits
  const allSaleItems = await db.select().from(saleItemsTable);
  const productMap = new Map(allProducts.map(p => [p.id, p]));

  const salesThisMonth = await db.select().from(salesTable).where(gte(salesTable.createdAt, startOfMonth));
  const saleIdSet = new Set(salesThisMonth.map(s => s.id));
  // Map saleId → collection rate (paid / total)
  const saleCollectionRate = new Map(salesThisMonth.map(s => {
    const total = parseFloat(s.totalAmount as string);
    const paid  = parseFloat(s.paidAmount  as string);
    return [s.id, total > 0 ? Math.min(1, paid / total) : 0];
  }));

  let collectedRevenue = 0;
  let proportionalCOGS = 0;
  for (const item of allSaleItems) {
    if (!saleIdSet.has(item.saleId)) continue;
    const product = productMap.get(item.productId);
    const rate = saleCollectionRate.get(item.saleId) ?? 0;
    const itemRevenue = parseFloat(item.total as string);
    const itemCOGS   = product ? parseFloat(product.costPrice as string) * item.quantity : 0;
    collectedRevenue += itemRevenue * rate;
    proportionalCOGS += itemCOGS   * rate;
  }

  // Returns this month: reduce collected revenue AND proportional COGS
  const returnsThisMonthItems = await db.execute(
    sql`SELECT sr.items, s.paid_amount, s.total_amount
        FROM sales_returns sr JOIN sales s ON sr.sale_id = s.id
        WHERE s.created_at >= ${startOfMonth}`
  );
  let returnsRevenueImpact = 0;
  let returnsCOGSImpact = 0;
  for (const row of returnsThisMonthItems.rows as any[]) {
    const rate = row.total_amount > 0 ? Math.min(1, row.paid_amount / row.total_amount) : 0;
    const items = Array.isArray(row.items) ? row.items : [];
    for (const ri of items) {
      const product = productMap.get(ri.productId);
      const retRevenue = ri.total ?? (ri.sellingPrice ?? 0) * ri.quantity;
      const retCOGS    = product ? parseFloat(product.costPrice as string) * ri.quantity : 0;
      returnsRevenueImpact += retRevenue * rate;
      returnsCOGSImpact    += retCOGS    * rate;
    }
  }

  const expensesMonthTotal = parseFloat(expensesMonth.total ?? "0");
  // Net profit = (collected revenue - proportional COGS) - returns margin - expenses
  const grossProfitMonth = collectedRevenue - proportionalCOGS;
  const returnsGrossImpact = returnsRevenueImpact - returnsCOGSImpact;
  const profitMonth = grossProfitMonth - returnsGrossImpact - expensesMonthTotal;

  // Pending (uncollected) this month = invoiced but not yet paid
  const pendingDebtsMonth = salesThisMonth.reduce((s, sale) => {
    return s + Math.max(0, parseFloat(sale.totalAmount as string) - parseFloat(sale.paidAmount as string));
  }, 0);

  // Financial position (all-time)
  const totalCollected = parseFloat(salesAll.paidAmount ?? "0"); // cash received from customers
  const totalPurchasesPaid = parseFloat(purchasesAll.paid ?? "0"); // cash paid to suppliers
  const totalExpenses = parseFloat(expensesAll.total ?? "0"); // other expenses paid
  const totalCustomerDebts = parseFloat(customerDebts[0]?.total ?? "0"); // still owed by customers
  const totalSupplierDebts = parseFloat(supplierDebts[0]?.total ?? "0"); // still owed to suppliers

  // Net cash position = money in - money out + what customers owe - what suppliers owe
  const netCashPosition = totalCollected - totalPurchasesPaid - totalExpenses;
  const netPosition = netCashPosition + totalCustomerDebts - totalSupplierDebts;

  res.json({
    // Today
    totalSalesToday: parseFloat(salesToday.total ?? "0"),
    // This month
    totalSalesMonth: parseFloat(salesMonth.totalAmount ?? "0"),
    totalSalesCollectedMonth: parseFloat(salesMonth.paidAmount ?? "0"),
    totalPurchasesMonth: parseFloat(purchasesMonth.total ?? "0"),
    totalPurchasesPaidMonth: parseFloat(purchasesMonth.paid ?? "0"),
    totalExpensesMonth: parseFloat(expensesMonth.total ?? "0"),
    totalReturnsMonth: returnsMonthTotal,
    totalProfitMonth: profitMonth,
    pendingDebtsMonth,
    // All-time
    totalCollected,
    totalPurchasesPaid,
    totalExpenses,
    totalReturns: returnsAllTotal,
    // Debts (current)
    totalCustomerDebts,
    totalSupplierDebts,
    // Net position
    netCashPosition,
    netPosition,
    // Other
    lowStockCount: lowStock.length,
    totalProducts: allProducts.length,
    totalSalesCount: parseInt(String(salesMonth.count ?? 0)),
    totalPurchasesCount: parseInt(String(purchasesMonth.count ?? 0)),
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

  if (period === "month") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const [sales] = await db.select({ total: sql<string>`COALESCE(SUM(total_amount), 0)` }).from(salesTable).where(and(gte(salesTable.createdAt, d), sql`created_at < ${end}`));
      const [purchases] = await db.select({ total: sql<string>`COALESCE(SUM(total_amount), 0)` }).from(purchasesTable).where(and(gte(purchasesTable.createdAt, d), sql`created_at < ${end}`));
      const [expenses] = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` }).from(expensesTable).where(and(gte(expensesTable.createdAt, d), sql`created_at < ${end}`));
      const salesTotal = parseFloat(sales?.total ?? "0");
      const purchasesTotal = parseFloat(purchases?.total ?? "0");
      const expensesTotal = parseFloat(expenses?.total ?? "0");
      const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
      result.push({ label: months[d.getMonth()], sales: salesTotal, purchases: purchasesTotal, expenses: expensesTotal, profit: salesTotal - purchasesTotal - expensesTotal });
    }
  } else {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const [sales] = await db.select({ total: sql<string>`COALESCE(SUM(total_amount), 0)` }).from(salesTable).where(and(gte(salesTable.createdAt, start), sql`created_at < ${end}`));
      const [purchases] = await db.select({ total: sql<string>`COALESCE(SUM(total_amount), 0)` }).from(purchasesTable).where(and(gte(purchasesTable.createdAt, start), sql`created_at < ${end}`));
      const [expenses] = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` }).from(expensesTable).where(and(gte(expensesTable.createdAt, start), sql`created_at < ${end}`));
      const salesTotal = parseFloat(sales?.total ?? "0");
      const purchasesTotal = parseFloat(purchases?.total ?? "0");
      const expensesTotal = parseFloat(expenses?.total ?? "0");
      const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      result.push({ label: days[d.getDay()], sales: salesTotal, purchases: purchasesTotal, expenses: expensesTotal, profit: salesTotal - purchasesTotal - expensesTotal });
    }
  }

  res.json(result);
});

export default router;

import * as XLSX from "xlsx";

function toSheet(data: any[], headers: { key: string; label: string }[]) {
  const rows = data.map(row =>
    Object.fromEntries(headers.map(h => [h.label, row[h.key] ?? ""]))
  );
  return XLSX.utils.json_to_sheet(rows, { header: headers.map(h => h.label) });
}

function styleHeader(ws: XLSX.WorkSheet, cols: number) {
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let c = 0; c <= cols - 1; c++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cell]) continue;
    ws[cell].s = { font: { bold: true }, fill: { fgColor: { rgb: "1A1033" } } };
  }
}

export function exportFullBackup(data: {
  products: any[];
  customers: any[];
  suppliers: any[];
  sales: any[];
  saleItems: any[];
  purchases: any[];
  purchaseItems: any[];
  debts: any[];
  expenses: any[];
}) {
  const wb = XLSX.utils.book_new();

  const productsSheet = toSheet(data.products, [
    { key: "id", label: "الكود" },
    { key: "name", label: "اسم المنتج" },
    { key: "category", label: "الفئة" },
    { key: "unit", label: "الوحدة" },
    { key: "costPrice", label: "سعر الشراء" },
    { key: "sellingPrice", label: "سعر البيع" },
    { key: "quantity", label: "الكمية المتاحة" },
    { key: "minStockLevel", label: "الحد الأدنى" },
    { key: "barcode", label: "الباركود" },
  ]);
  XLSX.utils.book_append_sheet(wb, productsSheet, "المنتجات");

  const customersSheet = toSheet(data.customers, [
    { key: "id", label: "الكود" },
    { key: "name", label: "اسم العميل" },
    { key: "phone", label: "رقم الهاتف" },
    { key: "notes", label: "ملاحظات" },
  ]);
  XLSX.utils.book_append_sheet(wb, customersSheet, "العملاء");

  const suppliersSheet = toSheet(data.suppliers, [
    { key: "id", label: "الكود" },
    { key: "name", label: "اسم المورد" },
    { key: "phone", label: "رقم الهاتف" },
    { key: "address", label: "العنوان" },
    { key: "totalDebt", label: "إجمالي الديون" },
    { key: "notes", label: "ملاحظات" },
  ]);
  XLSX.utils.book_append_sheet(wb, suppliersSheet, "الموردين");

  const salesSheet = toSheet(data.sales, [
    { key: "invoiceNumber", label: "رقم الفاتورة" },
    { key: "customerName", label: "اسم العميل" },
    { key: "customerPhone", label: "رقم الهاتف" },
    { key: "totalAmount", label: "الإجمالي" },
    { key: "paidAmount", label: "المدفوع" },
    { key: "remainingDebt", label: "المتبقي" },
    { key: "paymentType", label: "نوع الدفع" },
    { key: "cashierName", label: "الكاشير" },
    { key: "createdAt", label: "التاريخ" },
  ]);
  XLSX.utils.book_append_sheet(wb, salesSheet, "المبيعات");

  const saleItemsSheet = toSheet(data.saleItems, [
    { key: "saleId", label: "رقم الفاتورة (ID)" },
    { key: "productName", label: "المنتج" },
    { key: "quantity", label: "الكمية" },
    { key: "sellingPrice", label: "سعر البيع" },
    { key: "total", label: "الإجمالي" },
  ]);
  XLSX.utils.book_append_sheet(wb, saleItemsSheet, "بنود المبيعات");

  const purchasesSheet = toSheet(data.purchases, [
    { key: "id", label: "الكود" },
    { key: "supplierName", label: "المورد" },
    { key: "invoiceNumber", label: "رقم الفاتورة" },
    { key: "totalAmount", label: "الإجمالي" },
    { key: "paidAmount", label: "المدفوع" },
    { key: "remainingAmount", label: "المتبقي" },
    { key: "paymentType", label: "نوع الدفع" },
    { key: "createdAt", label: "التاريخ" },
  ]);
  XLSX.utils.book_append_sheet(wb, purchasesSheet, "المشتريات");

  const debtsSheet = toSheet(data.debts, [
    { key: "type", label: "النوع" },
    { key: "customerName", label: "اسم العميل" },
    { key: "supplierName", label: "اسم المورد" },
    { key: "totalAmount", label: "الإجمالي" },
    { key: "paidAmount", label: "المدفوع" },
    { key: "remainingAmount", label: "المتبقي" },
    { key: "status", label: "الحالة" },
  ]);
  XLSX.utils.book_append_sheet(wb, debtsSheet, "الديون");

  const expensesSheet = toSheet(data.expenses, [
    { key: "id", label: "الكود" },
    { key: "description", label: "البيان" },
    { key: "amount", label: "المبلغ" },
    { key: "category", label: "الفئة" },
    { key: "expenseDate", label: "التاريخ" },
    { key: "notes", label: "ملاحظات" },
  ]);
  XLSX.utils.book_append_sheet(wb, expensesSheet, "المصروفات");

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  XLSX.writeFile(wb, `نسخة_احتياطية_آل_ياسين_${dateStr}.xlsx`);
}

export function exportSheet(
  sheetName: string,
  fileName: string,
  data: any[],
  headers: { key: string; label: string }[]
) {
  const wb = XLSX.utils.book_new();
  const ws = toSheet(data, headers);
  styleHeader(ws, headers.length);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

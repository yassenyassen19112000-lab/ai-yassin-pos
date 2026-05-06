import ExcelJS from "exceljs";

function triggerDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function addSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  data: any[],
  headers: { key: string; label: string }[]
) {
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = headers.map((h) => ({
    header: h.label,
    key: h.key,
    width: 20,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1A1033" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });

  data.forEach((row) => {
    const rowData: Record<string, any> = {};
    headers.forEach((h) => {
      rowData[h.key] = row[h.key] ?? "";
    });
    sheet.addRow(rowData);
  });

  return sheet;
}

export async function exportFullBackup(data: {
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
  const workbook = new ExcelJS.Workbook();

  addSheet(workbook, "المنتجات", data.products, [
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

  addSheet(workbook, "العملاء", data.customers, [
    { key: "id", label: "الكود" },
    { key: "name", label: "اسم العميل" },
    { key: "phone", label: "رقم الهاتف" },
    { key: "notes", label: "ملاحظات" },
  ]);

  addSheet(workbook, "الموردين", data.suppliers, [
    { key: "id", label: "الكود" },
    { key: "name", label: "اسم المورد" },
    { key: "phone", label: "رقم الهاتف" },
    { key: "address", label: "العنوان" },
    { key: "totalDebt", label: "إجمالي الديون" },
    { key: "notes", label: "ملاحظات" },
  ]);

  addSheet(workbook, "المبيعات", data.sales, [
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

  addSheet(workbook, "بنود المبيعات", data.saleItems, [
    { key: "saleId", label: "رقم الفاتورة (ID)" },
    { key: "productName", label: "المنتج" },
    { key: "quantity", label: "الكمية" },
    { key: "sellingPrice", label: "سعر البيع" },
    { key: "total", label: "الإجمالي" },
  ]);

  addSheet(workbook, "المشتريات", data.purchases, [
    { key: "id", label: "الكود" },
    { key: "supplierName", label: "المورد" },
    { key: "invoiceNumber", label: "رقم الفاتورة" },
    { key: "totalAmount", label: "الإجمالي" },
    { key: "paidAmount", label: "المدفوع" },
    { key: "remainingAmount", label: "المتبقي" },
    { key: "paymentType", label: "نوع الدفع" },
    { key: "createdAt", label: "التاريخ" },
  ]);

  addSheet(workbook, "الديون", data.debts, [
    { key: "type", label: "النوع" },
    { key: "customerName", label: "اسم العميل" },
    { key: "supplierName", label: "اسم المورد" },
    { key: "totalAmount", label: "الإجمالي" },
    { key: "paidAmount", label: "المدفوع" },
    { key: "remainingAmount", label: "المتبقي" },
    { key: "status", label: "الحالة" },
  ]);

  addSheet(workbook, "المصروفات", data.expenses, [
    { key: "id", label: "الكود" },
    { key: "description", label: "البيان" },
    { key: "amount", label: "المبلغ" },
    { key: "category", label: "الفئة" },
    { key: "expenseDate", label: "التاريخ" },
    { key: "notes", label: "ملاحظات" },
  ]);

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer as ArrayBuffer, `نسخة_احتياطية_آل_ياسين_${dateStr}.xlsx`);
}

export async function exportSheet(
  sheetName: string,
  fileName: string,
  data: any[],
  headers: { key: string; label: string }[]
) {
  const workbook = new ExcelJS.Workbook();
  addSheet(workbook, sheetName, data, headers);
  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer as ArrayBuffer, `${fileName}.xlsx`);
}

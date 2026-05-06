import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { exportFullBackup, exportSheet } from "@/lib/exportExcel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Download, Database, Package, Users, Truck,
  FileText, CreditCard, TrendingDown, Loader2,
  ShieldCheck, RefreshCw, CheckCircle2
} from "lucide-react";

function useAll() {
  const products   = useQuery({ queryKey: ["products"],   queryFn: () => apiClient("/api/products") });
  const customers  = useQuery({ queryKey: ["customers"],  queryFn: () => apiClient("/api/customers") });
  const suppliers  = useQuery({ queryKey: ["suppliers"],  queryFn: () => apiClient("/api/suppliers") });
  const sales      = useQuery({ queryKey: ["sales"],      queryFn: () => apiClient("/api/sales") });
  const purchases  = useQuery({ queryKey: ["purchases"],  queryFn: () => apiClient("/api/purchases") });
  const debts      = useQuery({ queryKey: ["debts"],      queryFn: () => apiClient("/api/debts") });
  const expenses   = useQuery({ queryKey: ["expenses"],   queryFn: () => apiClient("/api/expenses") });
  const isLoading  = [products, customers, suppliers, sales, purchases, debts, expenses].some(q => q.isLoading);
  return { products, customers, suppliers, sales, purchases, debts, expenses, isLoading };
}

interface Section {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  getCount: (d: ReturnType<typeof useAll>) => number;
  doExport: (d: ReturnType<typeof useAll>) => void;
}

const sections: Section[] = [
  {
    label: "المنتجات",
    icon: Package,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    getCount: d => (d.products.data as any[] ?? []).length,
    doExport: d => exportSheet("المنتجات", "منتجات_آل_ياسين", d.products.data as any[] ?? [], [
      { key: "id", label: "الكود" },
      { key: "name", label: "اسم المنتج" },
      { key: "category", label: "الفئة" },
      { key: "unit", label: "الوحدة" },
      { key: "costPrice", label: "سعر الشراء" },
      { key: "sellingPrice", label: "سعر البيع" },
      { key: "quantity", label: "الكمية المتاحة" },
      { key: "minStockLevel", label: "الحد الأدنى" },
      { key: "barcode", label: "الباركود" },
    ]),
  },
  {
    label: "العملاء",
    icon: Users,
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
    getCount: d => (d.customers.data as any[] ?? []).length,
    doExport: d => exportSheet("العملاء", "عملاء_آل_ياسين", d.customers.data as any[] ?? [], [
      { key: "id", label: "الكود" },
      { key: "name", label: "اسم العميل" },
      { key: "phone", label: "رقم الهاتف" },
      { key: "notes", label: "ملاحظات" },
    ]),
  },
  {
    label: "الموردين",
    icon: Truck,
    color: "text-orange-600",
    bg: "bg-orange-50 border-orange-200",
    getCount: d => (d.suppliers.data as any[] ?? []).length,
    doExport: d => exportSheet("الموردين", "موردين_آل_ياسين", d.suppliers.data as any[] ?? [], [
      { key: "id", label: "الكود" },
      { key: "name", label: "اسم المورد" },
      { key: "phone", label: "رقم الهاتف" },
      { key: "address", label: "العنوان" },
      { key: "totalDebt", label: "إجمالي الديون" },
      { key: "notes", label: "ملاحظات" },
    ]),
  },
  {
    label: "المبيعات",
    icon: FileText,
    color: "text-purple-600",
    bg: "bg-purple-50 border-purple-200",
    getCount: d => (d.sales.data as any[] ?? []).length,
    doExport: d => exportSheet("المبيعات", "مبيعات_آل_ياسين", d.sales.data as any[] ?? [], [
      { key: "invoiceNumber", label: "رقم الفاتورة" },
      { key: "customerName", label: "اسم العميل" },
      { key: "customerPhone", label: "رقم الهاتف" },
      { key: "totalAmount", label: "الإجمالي" },
      { key: "paidAmount", label: "المدفوع" },
      { key: "remainingDebt", label: "المتبقي" },
      { key: "paymentType", label: "نوع الدفع" },
      { key: "cashierName", label: "الكاشير" },
      { key: "createdAt", label: "التاريخ" },
    ]),
  },
  {
    label: "المشتريات",
    icon: FileText,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    getCount: d => (d.purchases.data as any[] ?? []).length,
    doExport: d => exportSheet("المشتريات", "مشتريات_آل_ياسين", d.purchases.data as any[] ?? [], [
      { key: "id", label: "الكود" },
      { key: "supplierName", label: "المورد" },
      { key: "invoiceNumber", label: "رقم الفاتورة" },
      { key: "totalAmount", label: "الإجمالي" },
      { key: "paidAmount", label: "المدفوع" },
      { key: "remainingAmount", label: "المتبقي" },
      { key: "paymentType", label: "نوع الدفع" },
      { key: "createdAt", label: "التاريخ" },
    ]),
  },
  {
    label: "الديون",
    icon: CreditCard,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    getCount: d => (d.debts.data as any[] ?? []).length,
    doExport: d => exportSheet("الديون", "ديون_آل_ياسين", d.debts.data as any[] ?? [], [
      { key: "type", label: "النوع" },
      { key: "customerName", label: "اسم العميل" },
      { key: "supplierName", label: "اسم المورد" },
      { key: "totalAmount", label: "الإجمالي" },
      { key: "paidAmount", label: "المدفوع" },
      { key: "remainingAmount", label: "المتبقي" },
      { key: "status", label: "الحالة" },
    ]),
  },
  {
    label: "المصروفات",
    icon: TrendingDown,
    color: "text-rose-600",
    bg: "bg-rose-50 border-rose-200",
    getCount: d => (d.expenses.data as any[] ?? []).length,
    doExport: d => exportSheet("المصروفات", "مصروفات_آل_ياسين", d.expenses.data as any[] ?? [], [
      { key: "id", label: "الكود" },
      { key: "description", label: "البيان" },
      { key: "amount", label: "المبلغ" },
      { key: "category", label: "الفئة" },
      { key: "expenseDate", label: "التاريخ" },
      { key: "notes", label: "ملاحظات" },
    ]),
  },
];

export default function Backup() {
  const { toast } = useToast();
  const allData = useAll();
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const handleFullBackup = async () => {
    if (allData.isLoading) return;
    setExporting(true);
    try {
      exportFullBackup({
        products:      allData.products.data  as any[] ?? [],
        customers:     allData.customers.data as any[] ?? [],
        suppliers:     allData.suppliers.data as any[] ?? [],
        sales:         allData.sales.data     as any[] ?? [],
        saleItems:     [],
        purchases:     allData.purchases.data as any[] ?? [],
        purchaseItems: [],
        debts:         allData.debts.data     as any[] ?? [],
        expenses:      allData.expenses.data  as any[] ?? [],
      });
      const now = new Date();
      const label = `${now.toLocaleDateString("ar-EG")} ${now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`;
      setLastExport(label);
      toast({ title: "✅ تم تصدير النسخة الاحتياطية بنجاح" });
    } catch {
      toast({ title: "خطأ في التصدير", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const totalRecords =
    (allData.products.data  as any[] ?? []).length +
    (allData.customers.data as any[] ?? []).length +
    (allData.suppliers.data as any[] ?? []).length +
    (allData.sales.data     as any[] ?? []).length +
    (allData.purchases.data as any[] ?? []).length +
    (allData.debts.data     as any[] ?? []).length +
    (allData.expenses.data  as any[] ?? []).length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">النسخ الاحتياطي والتصدير</h1>
          <p className="text-sm text-muted-foreground">احفظ بياناتك بشكل دوري لتفادي أي فقدان</p>
        </div>
      </div>

      {/* Full backup card */}
      <Card className="border-2 border-green-200 bg-gradient-to-l from-green-50 to-white">
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Database className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-bold text-green-800">نسخة احتياطية كاملة</h2>
              </div>
              <p className="text-sm text-green-700 mb-2">
                تصدير جميع البيانات في ملف Excel واحد يحتوي على {sections.length + 1} أوراق منفصلة
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                  {allData.isLoading ? "..." : `${totalRecords} سجل`} إجمالي
                </span>
                {lastExport && (
                  <span className="text-xs bg-white text-green-600 px-2 py-0.5 rounded-full border border-green-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    آخر تصدير: {lastExport}
                  </span>
                )}
              </div>
            </div>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white shrink-0 w-full sm:w-auto h-11 text-base"
              onClick={handleFullBackup}
              disabled={allData.isLoading || exporting}
            >
              {exporting ? (
                <Loader2 className="w-5 h-5 animate-spin ml-2" />
              ) : (
                <Download className="w-5 h-5 ml-2" />
              )}
              {exporting ? "جاري التصدير..." : "تحميل نسخة احتياطية"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reminder card */}
      <Card className="border border-amber-200 bg-amber-50">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3 items-start">
            <RefreshCw className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">نصيحة: احفظ نسخة احتياطية بشكل منتظم</p>
              <p className="text-xs text-amber-700 mt-0.5">
                يُنصح بتحميل نسخة كل أسبوع أو عند إدخال بيانات كثيرة، واحفظها على جهازك أو Google Drive.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual exports */}
      <div>
        <h2 className="text-base font-bold mb-3 text-muted-foreground">تصدير منفصل لكل قسم</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sections.map(sec => {
            const Icon = sec.icon;
            const count = allData.isLoading ? null : sec.getCount(allData);
            return (
              <Card key={sec.label} className={`border ${sec.bg}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg ${sec.bg} border flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 ${sec.color}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{sec.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {count === null ? "..." : `${count} سجل`}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`border ${sec.bg} ${sec.color} hover:opacity-80`}
                      onClick={() => {
                        try {
                          sec.doExport(allData);
                          toast({ title: `✅ تم تصدير ${sec.label} بنجاح` });
                        } catch {
                          toast({ title: "خطأ في التصدير", variant: "destructive" });
                        }
                      }}
                      disabled={allData.isLoading}
                    >
                      <Download className="w-3.5 h-3.5 ml-1" />
                      تصدير
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* How to use section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">كيفية استخدام النسخة الاحتياطية</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-muted-foreground list-none">
            {[
              "اضغط على «تحميل نسخة احتياطية» لتنزيل ملف Excel كامل",
              "الملف يحتوي على جميع بياناتك: منتجات، عملاء، موردين، مبيعات، مشتريات، ديون، مصروفات",
              "احفظ الملف على جهازك أو ارفعه على Google Drive أو Dropbox",
              "كرر ذلك أسبوعياً أو بعد أي إدخال مهم للبيانات",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

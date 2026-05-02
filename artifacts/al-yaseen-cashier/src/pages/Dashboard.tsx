import { useState } from "react";
import { Link } from "wouter";
import {
  useGetDashboardSummary,
  useGetLowStockProducts,
  useGetRecentSales,
  useGetSalesChart,
} from "@workspace/api-client-react";
import { formatCurrency, formatDateTime, paymentTypeLabel } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, TrendingUp, ShoppingBag, ShoppingCart, AlertTriangle, CreditCard, Package, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const [chartPeriod, setChartPeriod] = useState<"week" | "month">("week");

  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({ period: "month" });
  const { data: lowStock } = useGetLowStockProducts();
  const { data: recentSales } = useGetRecentSales();
  const { data: chartData } = useGetSalesChart({ period: chartPeriod });

  if (summaryLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const netPosition = summary?.netPosition ?? 0;

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
      </div>

      {/* Financial position banner */}
      <Card className={`border-2 ${netPosition >= 0 ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">صافي المركز المالي الكلي</p>
              <p className={`text-3xl font-bold mt-1 ${netPosition >= 0 ? "text-green-700" : "text-red-700"}`}>
                {netPosition >= 0 ? "+" : ""}{formatCurrency(netPosition)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                = إيرادات محصلة - مشتريات مدفوعة - مصروفات + ديون عملاء - ديون موردين
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white/70 rounded-lg p-3 min-w-[140px]">
                <div className="flex items-center gap-1 text-green-600 mb-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">إيرادات محصلة</span>
                </div>
                <p className="font-bold text-green-700">{formatCurrency(summary?.totalCollected ?? 0)}</p>
              </div>
              <div className="bg-white/70 rounded-lg p-3 min-w-[140px]">
                <div className="flex items-center gap-1 text-red-500 mb-1">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">مدفوعات + مصروفات</span>
                </div>
                <p className="font-bold text-red-600">{formatCurrency((summary?.totalPurchasesPaid ?? 0) + (summary?.totalExpenses ?? 0))}</p>
              </div>
              <div className="bg-white/70 rounded-lg p-3 min-w-[140px]">
                <div className="flex items-center gap-1 text-blue-500 mb-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">ديون لنا (عملاء)</span>
                </div>
                <p className="font-bold text-blue-600">{formatCurrency(summary?.totalCustomerDebts ?? 0)}</p>
              </div>
              <div className="bg-white/70 rounded-lg p-3 min-w-[140px]">
                <div className="flex items-center gap-1 text-orange-500 mb-1">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">ديون علينا (موردين)</span>
                </div>
                <p className="font-bold text-orange-600">{formatCurrency(summary?.totalSupplierDebts ?? 0)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* This month KPIs */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">هذا الشهر</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "مبيعات اليوم", value: formatCurrency(summary?.totalSalesToday ?? 0), icon: ShoppingBag, color: "text-green-600", bg: "bg-green-50" },
            { label: "مبيعات الشهر", value: formatCurrency(summary?.totalSalesMonth ?? 0), icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "أرباح الشهر", value: formatCurrency(summary?.totalProfitMonth ?? 0), icon: Wallet, color: "text-primary", bg: "bg-amber-50" },
            { label: "مصروفات الشهر", value: formatCurrency(summary?.totalExpensesMonth ?? 0), icon: TrendingDown, color: "text-red-500", bg: "bg-red-50" },
            { label: "مشتريات الشهر", value: formatCurrency(summary?.totalPurchasesMonth ?? 0), icon: ShoppingCart, color: "text-orange-500", bg: "bg-orange-50" },
            { label: "عدد المنتجات", value: summary?.totalProducts ?? 0, icon: Package, color: "text-purple-600", bg: "bg-purple-50" },
          ].map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-4 h-4 ${kpi.color}`} />
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                  <p className="font-bold text-sm">{kpi.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock && lowStock.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-orange-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              تحذير: منتجات على وشك النفاد ({lowStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStock.slice(0, 8).map((p) => (
                <Badge key={p.id} variant="outline" className="text-orange-700 border-orange-300 bg-white">
                  {p.name} ({p.quantity} {p.unit})
                </Badge>
              ))}
              {lowStock.length > 8 && (
                <Link href="/products">
                  <Badge variant="outline" className="text-orange-700 border-orange-300 cursor-pointer hover:bg-orange-100">
                    +{lowStock.length - 8} أخرى
                  </Badge>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts & Recent Sales */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">المبيعات والمشتريات والمصروفات</CardTitle>
              <div className="flex gap-2">
                {(["week", "month"] as const).map((p) => (
                  <Button key={p} variant={chartPeriod === p ? "default" : "ghost"} size="sm" className="text-xs h-7" onClick={() => setChartPeriod(p)}>
                    {p === "week" ? "أسبوع" : "شهر"}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData ?? []} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="sales" name="مبيعات" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="purchases" name="مشتريات" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="مصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="أرباح" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">آخر المبيعات</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {(recentSales ?? []).slice(0, 6).map((sale) => (
                <div key={sale.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{sale.invoiceNumber}</span>
                    <Badge variant="outline" className="text-xs">{paymentTypeLabel(sale.paymentType)}</Badge>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-medium">{sale.customerName || "عميل نقدي"}</span>
                    <span className="text-sm font-bold text-primary">{formatCurrency(sale.totalAmount)}</span>
                  </div>
                  {sale.remainingDebt > 0 && (
                    <p className="text-xs text-red-500">متبقي: {formatCurrency(sale.remainingDebt)}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{formatDateTime(sale.createdAt)}</p>
                </div>
              ))}
              {(!recentSales || recentSales.length === 0) && (
                <p className="text-center text-muted-foreground text-sm py-8">لا توجد مبيعات بعد</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

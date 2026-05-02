import { useState } from "react";
import { useGetDashboardSummary, useGetSalesChart } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { Loader2, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Wallet, CreditCard } from "lucide-react";

export default function Reports() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const { data: summary, isLoading } = useGetDashboardSummary({ period: "month" });
  const { data: chartData, isLoading: chartLoading } = useGetSalesChart({ period });

  const totalOut = (summary?.totalPurchasesPaid ?? 0) + (summary?.totalExpenses ?? 0);
  const netCash = (summary?.totalCollected ?? 0) - totalOut;
  const netWithDebts = netCash + (summary?.totalCustomerDebts ?? 0) - (summary?.totalSupplierDebts ?? 0);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">التقارير المالية</h1>

      {/* Main financial reconciliation */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            ملخص المركز المالي الكامل
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Revenues */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">الإيرادات</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-green-50 rounded-lg px-4 py-2.5">
                <span className="text-sm flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-green-500" />إجمالي المبيعات (كل الوقت)</span>
                <span className="font-bold text-green-700">{formatCurrency(summary?.totalSalesMonth ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center bg-green-50/60 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">  └ منه تم تحصيله فعلاً</span>
                <span className="font-semibold text-green-600">{formatCurrency(summary?.totalCollected ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center bg-blue-50/60 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground flex items-center gap-2"><CreditCard className="w-3.5 h-3.5 text-blue-400" />  └ ديون عملاء لم تُحصَّل بعد</span>
                <span className="font-semibold text-blue-600">+ {formatCurrency(summary?.totalCustomerDebts ?? 0)}</span>
              </div>
              {(summary?.totalReturns ?? 0) > 0 && (
                <div className="flex justify-between items-center bg-orange-50/60 rounded-lg px-4 py-2.5">
                  <span className="text-sm text-muted-foreground">  └ مرتجعات</span>
                  <span className="font-semibold text-orange-600">- {formatCurrency(summary?.totalReturns ?? 0)}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Outflows */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">المدفوعات والمصروفات</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-red-50 rounded-lg px-4 py-2.5">
                <span className="text-sm flex items-center gap-2"><ArrowDownRight className="w-4 h-4 text-red-500" />مشتريات بضاعة (مدفوعة)</span>
                <span className="font-bold text-red-600">- {formatCurrency(summary?.totalPurchasesPaid ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center bg-red-50 rounded-lg px-4 py-2.5">
                <span className="text-sm flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-500" />مصروفات أخرى (رواتب، إيجار...)</span>
                <span className="font-bold text-red-600">- {formatCurrency(summary?.totalExpenses ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center bg-orange-50/60 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground flex items-center gap-2"><CreditCard className="w-3.5 h-3.5 text-orange-400" />ديون لموردين لم تُسدَّد بعد</span>
                <span className="font-semibold text-orange-600">- {formatCurrency(summary?.totalSupplierDebts ?? 0)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Net positions */}
          <div className="space-y-2">
            <div className={`flex justify-between items-center rounded-lg px-4 py-3 ${netCash >= 0 ? "bg-green-100" : "bg-red-100"}`}>
              <span className="text-sm font-semibold">صافي النقدية المحصلة</span>
              <span className={`font-bold text-base ${netCash >= 0 ? "text-green-700" : "text-red-700"}`}>
                {netCash >= 0 ? "+" : ""}{formatCurrency(netCash)}
              </span>
            </div>
            <div className={`flex justify-between items-center rounded-lg px-4 py-3 border-2 ${netWithDebts >= 0 ? "border-green-400 bg-green-50" : "border-red-400 bg-red-50"}`}>
              <div>
                <span className="text-sm font-bold">المركز المالي الإجمالي</span>
                <p className="text-xs text-muted-foreground">(شامل الديون المستحقة والمتبقية)</p>
              </div>
              <span className={`font-bold text-xl ${netWithDebts >= 0 ? "text-green-700" : "text-red-700"}`}>
                {netWithDebts >= 0 ? "+" : ""}{formatCurrency(netWithDebts)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly KPIs */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">هذا الشهر</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "مبيعات اليوم", value: formatCurrency(summary?.totalSalesToday ?? 0), color: "text-blue-600" },
            { label: "مبيعات الشهر", value: formatCurrency(summary?.totalSalesMonth ?? 0), color: "text-green-600" },
            { label: "محصل الشهر", value: formatCurrency(summary?.totalSalesCollectedMonth ?? 0), color: "text-green-700" },
            { label: "مشتريات الشهر", value: formatCurrency(summary?.totalPurchasesMonth ?? 0), color: "text-orange-500" },
            { label: "مصروفات الشهر", value: formatCurrency(summary?.totalExpensesMonth ?? 0), color: "text-red-500" },
            { label: "أرباح الشهر", value: formatCurrency(summary?.totalProfitMonth ?? 0), color: "text-primary" },
          ].map((card) => (
            <Card key={card.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
                <p className={`font-bold text-sm ${card.color}`}>{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Charts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">مخطط الإيرادات والمصروفات</CardTitle>
            <div className="flex gap-2">
              {(["week", "month"] as const).map((p) => (
                <Button key={p} variant={period === p ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setPeriod(p)}>
                  {p === "week" ? "أسبوع" : "شهر"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="sales" name="مبيعات" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="purchases" name="مشتريات" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="مصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="صافي الربح" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Profit trend */}
      <Card>
        <CardHeader><CardTitle className="text-base">منحنى صافي الربح</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Line type="monotone" dataKey="profit" name="صافي الربح" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: "#f59e0b", r: 4 }} />
              <Line type="monotone" dataKey="sales" name="مبيعات" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

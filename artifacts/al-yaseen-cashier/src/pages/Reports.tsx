import { useState } from "react";
import { useGetDashboardSummary, useGetSalesChart } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { Loader2, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Wallet, CreditCard, RotateCcw } from "lucide-react";

function Row({ label, value, color, sub, indent }: { label: string; value: string; color: string; sub?: string; indent?: boolean }) {
  return (
    <div className={`flex justify-between items-center rounded-lg px-4 py-2.5 ${color}`}>
      <span className={`text-sm flex items-center gap-1 ${indent ? "mr-4 text-muted-foreground" : ""}`}>
        {label}
        {sub && <span className="text-xs text-muted-foreground ml-1">({sub})</span>}
      </span>
      <span className={`font-bold ${indent ? "text-sm" : ""}`}>{value}</span>
    </div>
  );
}

export default function Reports() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const { data: summary, isLoading } = useGetDashboardSummary({ period: "month" });
  const { data: chartData, isLoading: chartLoading } = useGetSalesChart({ period });

  const s = summary as any;

  const totalOut = (s?.totalPurchasesPaid ?? 0) + (s?.totalExpenses ?? 0);
  const netCash = (s?.totalCollected ?? 0) - totalOut;
  const netWithDebts = netCash + (s?.totalCustomerDebts ?? 0) - (s?.totalSupplierDebts ?? 0);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">التقارير المالية</h1>

      {/* ── Main financial reconciliation ─────────────────────────────── */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            ملخص المركز المالي الكامل (كل الوقت)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Section 1: Cash actually collected */}
          <div>
            <p className="text-xs font-bold text-green-700 uppercase mb-2 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              الإيرادات المحصلة فعلاً
            </p>
            <div className="space-y-1.5">
              <Row label="إجمالي المبيعات المحصولة" value={formatCurrency(s?.totalCollected ?? 0)} color="bg-green-50" />
              {(s?.totalReturns ?? 0) > 0 && (
                <Row label="└ مرتجعات (خُصمت من الإيرادات)" value={`- ${formatCurrency(s?.totalReturns ?? 0)}`} color="bg-orange-50/60" indent />
              )}
            </div>
          </div>

          <Separator />

          {/* Section 2: Pending debts — SEPARATE from revenue */}
          <div>
            <p className="text-xs font-bold text-blue-700 uppercase mb-2 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5" />
              ديون قائمة (لم تُحصَّل بعد — ليست إيراداً)
            </p>
            <div className="space-y-1.5">
              <Row
                label="ديون عملاء لم تُحصَّل"
                value={formatCurrency(s?.totalCustomerDebts ?? 0)}
                color="bg-blue-50"
              />
              <Row
                label="ديون لموردين لم تُسدَّد"
                value={`- ${formatCurrency(s?.totalSupplierDebts ?? 0)}`}
                color="bg-orange-50/60"
              />
              <div className={`flex justify-between rounded-lg px-4 py-2.5 border ${(s?.totalCustomerDebts ?? 0) >= (s?.totalSupplierDebts ?? 0) ? "border-blue-300 bg-blue-50" : "border-orange-300 bg-orange-50"}`}>
                <span className="text-sm font-semibold">صافي الديون القائمة</span>
                <span className={`font-bold ${(s?.totalCustomerDebts ?? 0) >= (s?.totalSupplierDebts ?? 0) ? "text-blue-700" : "text-orange-700"}`}>
                  {formatCurrency((s?.totalCustomerDebts ?? 0) - (s?.totalSupplierDebts ?? 0))}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 3: Cash outflows */}
          <div>
            <p className="text-xs font-bold text-red-700 uppercase mb-2 flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5" />
              المدفوعات والمصروفات الفعلية
            </p>
            <div className="space-y-1.5">
              <Row label="مشتريات بضاعة (مدفوعة)" value={`- ${formatCurrency(s?.totalPurchasesPaid ?? 0)}`} color="bg-red-50" />
              <Row label="مصروفات تشغيلية (رواتب، إيجار...)" value={`- ${formatCurrency(s?.totalExpenses ?? 0)}`} color="bg-red-50" />
            </div>
          </div>

          <Separator />

          {/* Net positions */}
          <div className="space-y-2">
            <div className={`flex justify-between items-center rounded-lg px-4 py-3 ${netCash >= 0 ? "bg-green-100" : "bg-red-100"}`}>
              <div>
                <span className="text-sm font-semibold">صافي النقدية (محصلة - مدفوعات)</span>
                <p className="text-xs text-muted-foreground">فقط الفلوس الفعلية الداخلة والخارجة</p>
              </div>
              <span className={`font-bold text-base ${netCash >= 0 ? "text-green-700" : "text-red-700"}`}>
                {netCash >= 0 ? "+" : ""}{formatCurrency(netCash)}
              </span>
            </div>
            <div className={`flex justify-between items-center rounded-lg px-4 py-3 border-2 ${netWithDebts >= 0 ? "border-green-400 bg-green-50" : "border-red-400 bg-red-50"}`}>
              <div>
                <span className="text-sm font-bold">المركز المالي الإجمالي</span>
                <p className="text-xs text-muted-foreground">النقدية + ديون العملاء - ديون الموردين</p>
              </div>
              <span className={`font-bold text-xl ${netWithDebts >= 0 ? "text-green-700" : "text-red-700"}`}>
                {netWithDebts >= 0 ? "+" : ""}{formatCurrency(netWithDebts)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Monthly KPIs ──────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">هذا الشهر</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">محصل الشهر (نقدي)</p>
              <p className="font-bold text-sm text-green-600">{formatCurrency(s?.totalSalesCollectedMonth ?? 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-100">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-blue-400" />
                ديون لم تُحصَّل (الشهر)
              </p>
              <p className="font-bold text-sm text-blue-600">{formatCurrency((s as any)?.pendingDebtsMonth ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">مشتريات الشهر</p>
              <p className="font-bold text-sm text-orange-500">{formatCurrency(s?.totalPurchasesMonth ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">مصروفات الشهر</p>
              <p className="font-bold text-sm text-red-500">{formatCurrency(s?.totalExpensesMonth ?? 0)}</p>
            </CardContent>
          </Card>
          {(s?.totalReturnsMonth ?? 0) > 0 && (
            <Card className="border-orange-100">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3 text-orange-400" />
                  مرتجعات الشهر
                </p>
                <p className="font-bold text-sm text-orange-600">- {formatCurrency(s?.totalReturnsMonth ?? 0)}</p>
              </CardContent>
            </Card>
          )}
          <Card className={`border-2 ${(s?.totalProfitMonth ?? 0) >= 0 ? "border-primary/30" : "border-red-300"}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">
                صافي الربح (بعد المصروفات والمرتجعات)
              </p>
              <p className={`font-bold text-sm ${(s?.totalProfitMonth ?? 0) >= 0 ? "text-primary" : "text-red-600"}`}>
                {formatCurrency(s?.totalProfitMonth ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">من المحصول فقط</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Charts ───────────────────────────────────────────────────── */}
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
                <Bar dataKey="sales" name="مبيعات محصلة" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="purchases" name="مشتريات" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="مصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="صافي الربح" fill="#f59e0b" radius={[4, 4, 0, 0]} />
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
              <Line type="monotone" dataKey="sales" name="محصل" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

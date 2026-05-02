import { useState } from "react";
import { useGetDashboardSummary, useGetSalesChart } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import {
  Loader2, TrendingUp, TrendingDown, Wallet, CreditCard,
  RotateCcw, ShoppingCart, Receipt, ArrowUpCircle, ArrowDownCircle,
} from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────────────────────

function SectionTitle({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${color} mb-2`}>
      {icon}
      {label}
    </div>
  );
}

function Row({
  label, value, sub, color = "bg-transparent", bold = false,
  sign, indent = false,
}: {
  label: string; value: number; sub?: string;
  color?: string; bold?: boolean;
  sign?: "+" | "-" | "auto" | "none";
  indent?: boolean;
}) {
  const prefix =
    sign === "+" ? "+" :
    sign === "-" ? "-" :
    sign === "auto" ? (value >= 0 ? "+" : "-") :
    "";
  const displayVal = `${prefix}${formatCurrency(Math.abs(value))}`;
  const isNeg = value < 0;
  const valColor =
    sign === "auto"
      ? (value >= 0 ? "text-green-700" : "text-red-600")
      : sign === "+" ? "text-green-700"
      : sign === "-" ? "text-red-600"
      : "";

  return (
    <div className={`flex justify-between items-center rounded-lg px-4 py-2 ${color}`}>
      <span className={`text-sm ${indent ? "mr-4 text-muted-foreground" : ""}`}>
        {label}
        {sub && <span className="text-xs text-muted-foreground mr-1"> ({sub})</span>}
      </span>
      <span className={`${bold ? "font-bold text-base" : "font-semibold text-sm"} ${valColor}`}>
        {displayVal}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-dashed border-gray-200 my-1" />;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Reports() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const { data: summary, isLoading } = useGetDashboardSummary({ period: "month" });
  const { data: chartData, isLoading: chartLoading } = useGetSalesChart({ period });

  const s = summary as any;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Month values ────────────────────────────────────────────────────────────
  const invoicedMonth    = s?.totalSalesInvoicedMonth    ?? 0;
  const collectedMonth   = s?.totalSalesCollectedMonth   ?? 0;
  const pendingMonth     = s?.pendingDebtsMonth          ?? 0;
  const refundsDueMonth  = s?.refundsDueMonth            ?? 0;
  const returnsMonth     = s?.totalReturnsMonth          ?? 0;
  const purchInvMonth    = s?.totalPurchasesInvoicedMonth ?? 0;
  const purchPaidMonth   = s?.totalPurchasesPaidMonth    ?? 0;
  const purchDebtMonth   = purchInvMonth - purchPaidMonth;
  const expensesMonth    = s?.totalExpensesMonth         ?? 0;
  const netCashMonth     = s?.netCashMonth               ?? 0;
  const profitMonth      = s?.totalProfitMonth           ?? 0;

  // ── All-time values ─────────────────────────────────────────────────────────
  const collectedAll     = s?.totalCollectedAll          ?? 0;
  const returnsAll       = s?.totalReturnsAll            ?? 0;
  const purchPaidAll     = s?.totalPurchasesPaidAll      ?? 0;
  const expensesAll      = s?.totalExpensesAll           ?? 0;
  const netCashAll       = s?.netCashAllTime             ?? 0;
  const custDebts        = s?.totalCustomerDebts         ?? 0;
  const suppDebts        = s?.totalSupplierDebts         ?? 0;
  const netPosition      = s?.netPositionAllTime         ?? 0;

  return (
    <div className="space-y-5" dir="rtl">
      <h1 className="text-2xl font-bold">التقارير المالية</h1>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — هذا الشهر
      ══════════════════════════════════════════════════════════════════════ */}
      <h2 className="text-sm font-bold text-muted-foreground border-b pb-1">هذا الشهر</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── الإيرادات ──────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <SectionTitle
              icon={<ArrowUpCircle className="w-4 h-4" />}
              label="الإيرادات"
              color="text-green-700"
            />
          </CardHeader>
          <CardContent className="px-3 pb-4 space-y-1">
            <Row label="فواتير مصدرة (إجمالي)" value={invoicedMonth} color="bg-gray-50" />
            <Row label="└ محصول نقداً" value={collectedMonth} color="bg-green-50" indent sign="+" />
            {pendingMonth > 0 && (
              <Row label="└ مؤجل (لم يُدفع بعد)" value={pendingMonth} color="bg-blue-50/60" indent sign="none" />
            )}
            {refundsDueMonth > 0 && (
              <Row label="└ مسترد للعملاء (مرتجع زائد)" value={refundsDueMonth} color="bg-orange-50/60" indent sign="-" />
            )}
            {returnsMonth > 0 && (
              <Row label="مرتجعات الشهر" value={returnsMonth} color="bg-orange-50" sign="-" />
            )}
            <Divider />
            <Row
              label="صافي الإيرادات الفعلية"
              value={collectedMonth - returnsMonth}
              color={`${collectedMonth - returnsMonth >= 0 ? "bg-green-100" : "bg-red-100"}`}
              bold sign="auto"
            />
          </CardContent>
        </Card>

        {/* ── المصروفات والمشتريات ───────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <SectionTitle
              icon={<ArrowDownCircle className="w-4 h-4" />}
              label="المصروفات والمشتريات"
              color="text-red-600"
            />
          </CardHeader>
          <CardContent className="px-3 pb-4 space-y-1">
            <Row label="مشتريات بضاعة (إجمالي الفواتير)" value={purchInvMonth} color="bg-gray-50" />
            <Row label="└ مدفوعة للموردين" value={purchPaidMonth} color="bg-red-50" indent sign="-" />
            {purchDebtMonth > 0 && (
              <Row label="└ متبقي لموردين (دين)" value={purchDebtMonth} color="bg-orange-50/60" indent sign="none" />
            )}
            <Row label="مصروفات تشغيلية (رواتب، إيجار...)" value={expensesMonth} color="bg-red-50" sign="-" />
            <Divider />
            <Row
              label="إجمالي ما دُفع نقداً"
              value={purchPaidMonth + expensesMonth}
              color="bg-red-100"
              bold sign="-"
            />
          </CardContent>
        </Card>
      </div>

      {/* ── صافي الشهر ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className={`border-2 ${netCashMonth >= 0 ? "border-green-300" : "border-red-300"}`}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" />
              صافي التدفق النقدي (الشهر)
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              محصول − مرتجعات − مشتريات مدفوعة − مصروفات
            </p>
            <p className={`font-bold text-xl ${netCashMonth >= 0 ? "text-green-700" : "text-red-600"}`}>
              {netCashMonth >= 0 ? "+" : "-"}{formatCurrency(Math.abs(netCashMonth))}
            </p>
          </CardContent>
        </Card>
        <Card className={`border-2 ${profitMonth >= 0 ? "border-primary/40" : "border-red-300"}`}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              صافي الربح التشغيلي (الشهر)
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              هامش الربح من المحصول فقط − مصروفات
            </p>
            <p className={`font-bold text-xl ${profitMonth >= 0 ? "text-primary" : "text-red-600"}`}>
              {profitMonth >= 0 ? "+" : "-"}{formatCurrency(Math.abs(profitMonth))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — المركز المالي الكامل (كل الوقت)
      ══════════════════════════════════════════════════════════════════════ */}
      <h2 className="text-sm font-bold text-muted-foreground border-b pb-1 pt-2">المركز المالي الكامل (منذ البداية)</h2>

      <Card className="border-2 border-primary/20">
        <CardContent className="px-3 py-4 space-y-1">

          {/* الأموال الداخلة */}
          <SectionTitle
            icon={<ArrowUpCircle className="w-3.5 h-3.5" />}
            label="الأموال الداخلة"
            color="text-green-700"
          />
          <Row label="إجمالي محصل من العملاء" value={collectedAll} color="bg-green-50" sign="+" />
          {returnsAll > 0 && (
            <Row label="└ مرتجعات (مستردة أو محسوبة)" value={returnsAll} color="bg-orange-50/60" indent sign="-" />
          )}
          <Row
            label="صافي الأموال الداخلة"
            value={collectedAll - returnsAll}
            color="bg-green-100"
            bold sign="auto"
          />

          <div className="my-2" />

          {/* الأموال الخارجة */}
          <SectionTitle
            icon={<ArrowDownCircle className="w-3.5 h-3.5" />}
            label="الأموال الخارجة"
            color="text-red-600"
          />
          <Row label="مدفوعات للموردين (مشتريات)" value={purchPaidAll} color="bg-red-50" sign="-" />
          <Row label="مصروفات تشغيلية" value={expensesAll} color="bg-red-50" sign="-" />
          <Row
            label="إجمالي الأموال الخارجة"
            value={purchPaidAll + expensesAll}
            color="bg-red-100"
            bold sign="-"
          />

          <Divider />

          {/* صافي النقدية */}
          <Row
            label="صافي النقدية (داخل − خارج)"
            value={netCashAll}
            color={netCashAll >= 0 ? "bg-green-100" : "bg-red-100"}
            bold sign="auto"
          />

          <div className="my-2" />

          {/* الديون القائمة */}
          <SectionTitle
            icon={<CreditCard className="w-3.5 h-3.5" />}
            label="الديون القائمة (لم تُسوَّى بعد)"
            color="text-blue-700"
          />
          {custDebts > 0 && (
            <Row label="ديون عملاء (يدينون لنا)" value={custDebts} color="bg-blue-50" sign="+" />
          )}
          {suppDebts > 0 && (
            <Row label="ديون موردين (ندين لهم)" value={suppDebts} color="bg-orange-50" sign="-" />
          )}
          {custDebts === 0 && suppDebts === 0 && (
            <div className="text-center text-sm text-muted-foreground py-2">لا توجد ديون قائمة ✓</div>
          )}

          <Divider />

          {/* المركز الإجمالي */}
          <div className={`rounded-xl px-4 py-3 border-2 ${netPosition >= 0 ? "border-green-400 bg-green-50" : "border-red-400 bg-red-50"}`}>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold text-sm">المركز المالي الإجمالي</p>
                <p className="text-xs text-muted-foreground">نقدية + ديون عملاء − ديون موردين</p>
              </div>
              <p className={`font-bold text-2xl ${netPosition >= 0 ? "text-green-700" : "text-red-600"}`}>
                {netPosition >= 0 ? "+" : "-"}{formatCurrency(Math.abs(netPosition))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3 — الرسوم البيانية
      ══════════════════════════════════════════════════════════════════════ */}
      <h2 className="text-sm font-bold text-muted-foreground border-b pb-1 pt-2">الرسوم البيانية</h2>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">الإيرادات والمصروفات</CardTitle>
            <div className="flex gap-2">
              {(["week", "month"] as const).map((p) => (
                <Button
                  key={p}
                  variant={period === p ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setPeriod(p)}
                >
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
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData ?? []} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} width={60} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend iconType="circle" iconSize={8} />
                <Bar dataKey="sales"     name="محصول"     fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="returns"   name="مرتجعات"   fill="#f97316" radius={[3, 3, 0, 0]} />
                <Bar dataKey="purchases" name="مشتريات"   fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses"  name="مصروفات"   fill="#ef4444" radius={[3, 3, 0, 0]} />
                <Bar dataKey="profit"    name="صافي"      fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">منحنى صافي الربح</CardTitle>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} width={60} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend iconType="circle" iconSize={8} />
                <Line type="monotone" dataKey="profit" name="صافي الربح" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: "#f59e0b", r: 4 }} />
                <Line type="monotone" dataKey="sales"  name="محصول"     stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

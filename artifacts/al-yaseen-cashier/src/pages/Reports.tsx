import { useState } from "react";
import { useGetDashboardSummary, useGetSalesChart } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Loader2 } from "lucide-react";

export default function Reports() {
  const [period, setPeriod] = useState<"week" | "month" | "year">("week");
  const { data: summary } = useGetDashboardSummary({ period: "month" });
  const { data: chartData, isLoading } = useGetSalesChart({ period });

  const summaryCards = [
    { label: "مبيعات اليوم", value: formatCurrency(summary?.totalSalesToday ?? 0), color: "text-blue-600" },
    { label: "مبيعات هذا الشهر", value: formatCurrency(summary?.totalSalesMonth ?? 0), color: "text-green-600" },
    { label: "مشتريات الشهر", value: formatCurrency(summary?.totalPurchasesMonth ?? 0), color: "text-orange-500" },
    { label: "أرباح الشهر", value: formatCurrency(summary?.totalProfitMonth ?? 0), color: "text-primary" },
    { label: "ديون العملاء", value: formatCurrency(summary?.totalCustomerDebts ?? 0), color: "text-red-500" },
    { label: "ديون للموردين", value: formatCurrency(summary?.totalSupplierDebts ?? 0), color: "text-orange-600" },
  ];

  const pieData = [
    { name: "الأرباح", value: summary?.totalProfitMonth ?? 0, color: "#f59e0b" },
    { name: "تكاليف", value: (summary?.totalSalesMonth ?? 0) - (summary?.totalProfitMonth ?? 0), color: "#3b82f6" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">التقارير</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
              <p className={`font-bold text-sm ${card.color}`}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">مخطط المبيعات والمشتريات</CardTitle>
            <div className="flex gap-2">
              {(["week", "month", "year"] as const).map((p) => (
                <Button key={p} variant={period === p ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setPeriod(p)}>
                  {p === "week" ? "أسبوع" : p === "month" ? "شهر" : "سنة"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
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
                <Bar dataKey="profit" name="أرباح" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">منحنى الأرباح</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line type="monotone" dataKey="profit" name="الأرباح" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">توزيع الإيرادات (الشهر)</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-center">
            <PieChart width={200} height={200}>
              <Pie data={pieData} cx={100} cy={100} innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

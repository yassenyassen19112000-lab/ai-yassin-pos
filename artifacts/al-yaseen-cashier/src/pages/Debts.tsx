import { useState } from "react";
import {
  useListDebts,
  useAddDebtPayment,
  getListDebtsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDateTime, debtStatusLabel, debtStatusColor } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CreditCard, Plus, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function DebtCard({ debt, onPay }: { debt: any; onPay: (debt: any) => void }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-semibold">{debt.customerName || debt.supplierName || "غير محدد"}</p>
            {debt.customerPhone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{debt.customerPhone}</p>}
            <p className="text-xs text-muted-foreground">{formatDateTime(debt.createdAt)}</p>
          </div>
          <Badge className={`text-xs border ${debtStatusColor(debt.status)}`}>
            {debtStatusLabel(debt.status)}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs mb-3">
          <div className="bg-muted rounded p-2">
            <p className="text-muted-foreground">الإجمالي</p>
            <p className="font-bold">{formatCurrency(debt.totalAmount)}</p>
          </div>
          <div className="bg-green-50 rounded p-2">
            <p className="text-muted-foreground">المدفوع</p>
            <p className="font-bold text-green-600">{formatCurrency(debt.paidAmount)}</p>
          </div>
          <div className={`rounded p-2 ${debt.remainingAmount > 0 ? "bg-red-50" : "bg-green-50"}`}>
            <p className="text-muted-foreground">المتبقي</p>
            <p className={`font-bold ${debt.remainingAmount > 0 ? "text-red-500" : "text-green-600"}`}>{formatCurrency(debt.remainingAmount)}</p>
          </div>
        </div>

        {debt.payments.length > 0 && (
          <div className="mb-2 text-xs">
            <p className="text-muted-foreground mb-1">المدفوعات:</p>
            {debt.payments.map((p: any) => (
              <div key={p.id} className="flex justify-between bg-muted/50 rounded px-2 py-1 mb-0.5">
                <span>{formatDateTime(p.paidAt)}</span>
                <span className="text-green-600 font-medium">{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {debt.status !== "paid" && (
          <Button variant="outline" size="sm" className="w-full text-green-600 border-green-300 hover:bg-green-50" onClick={() => onPay(debt)}>
            <Plus className="w-3.5 h-3.5 ml-1" />
            تسجيل دفعة
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function Debts() {
  const [payingDebt, setPayingDebt] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: customerDebts, isLoading: loadingCustomer } = useListDebts({ type: "customer" });
  const { data: supplierDebts, isLoading: loadingSupplier } = useListDebts({ type: "supplier" });

  const payMutation = useAddDebtPayment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDebtsQueryKey() });
        setPayingDebt(null);
        setPayAmount("");
        setPayNotes("");
        toast({ title: "تم تسجيل الدفعة" });
      },
      onError: () => toast({ title: "خطأ في تسجيل الدفعة", variant: "destructive" }),
    },
  });

  const handlePay = () => {
    if (!payAmount || parseFloat(payAmount) <= 0) return;
    payMutation.mutate({ id: payingDebt.id, data: { amount: parseFloat(payAmount), notes: payNotes || undefined } });
  };

  const totalCustomerDebt = (customerDebts ?? []).filter(d => d.status !== "paid").reduce((s, d) => s + d.remainingAmount, 0);
  const totalSupplierDebt = (supplierDebts ?? []).filter(d => d.status !== "paid").reduce((s, d) => s + d.remainingAmount, 0);

  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-2xl font-bold">الديون</h1>

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <p className="text-sm text-red-600">إجمالي ديون العملاء</p>
            <p className="text-xl font-bold text-red-700">{formatCurrency(totalCustomerDebt)}</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4">
            <p className="text-sm text-orange-600">إجمالي ديون للموردين</p>
            <p className="text-xl font-bold text-orange-700">{formatCurrency(totalSupplierDebt)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="customer">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="customer">ديون العملاء ({(customerDebts ?? []).filter(d => d.status !== "paid").length})</TabsTrigger>
          <TabsTrigger value="supplier">ديون للموردين ({(supplierDebts ?? []).filter(d => d.status !== "paid").length})</TabsTrigger>
        </TabsList>

        <TabsContent value="customer" className="mt-4">
          {loadingCustomer ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(customerDebts ?? []).map(d => <DebtCard key={d.id} debt={d} onPay={setPayingDebt} />)}
              {(!customerDebts || customerDebts.length === 0) && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>لا توجد ديون للعملاء</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="supplier" className="mt-4">
          {loadingSupplier ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(supplierDebts ?? []).map(d => <DebtCard key={d.id} debt={d} onPay={setPayingDebt} />)}
              {(!supplierDebts || supplierDebts.length === 0) && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>لا توجد ديون للموردين</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!payingDebt} onOpenChange={() => setPayingDebt(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تسجيل دفعة</DialogTitle></DialogHeader>
          {payingDebt && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3 text-sm">
                <p className="font-medium">{payingDebt.customerName || payingDebt.supplierName}</p>
                <p className="text-muted-foreground">المتبقي: <span className="text-red-500 font-bold">{formatCurrency(payingDebt.remainingAmount)}</span></p>
              </div>
              <div>
                <Label>المبلغ المدفوع *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="أدخل المبلغ"
                  max={payingDebt.remainingAmount}
                />
              </div>
              <div>
                <Label>ملاحظات</Label>
                <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setPayingDebt(null)}>إلغاء</Button>
                <Button onClick={handlePay} disabled={payMutation.isPending} className="bg-green-600 hover:bg-green-700">
                  {payMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  تسجيل الدفعة
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import {
  useListDebts,
  useAddDebtPayment,
  getListDebtsQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { formatCurrency, formatDateTime, debtStatusLabel, debtStatusColor } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CreditCard, Plus, Phone, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function DebtCard({ debt, onPay }: { debt: any; onPay: (debt: any) => void }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-semibold">{debt.customerName || debt.supplierName || "غير محدد"}</p>
            {debt.customerPhone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{debt.customerPhone}</p>}
            {debt.notes && <p className="text-xs text-muted-foreground mt-0.5">{debt.notes}</p>}
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
  const [payingDebt, setPayingDebt]     = useState<any>(null);
  const [payAmount, setPayAmount]       = useState("");
  const [payNotes, setPayNotes]         = useState("");
  const [addDebtOpen, setAddDebtOpen]   = useState(false);
  const [addDebtType, setAddDebtType]   = useState<"customer" | "supplier">("customer");
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [debtAmount, setDebtAmount]     = useState("");
  const [debtNotes, setDebtNotes]       = useState("");
  const [partySearch, setPartySearch]   = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: customerDebts, isLoading: loadingCustomer } = useListDebts({ type: "customer" });
  const { data: supplierDebts, isLoading: loadingSupplier } = useListDebts({ type: "supplier" });

  const { data: customers } = useQuery<any[]>({
    queryKey: ["customers"],
    queryFn: () => apiClient("/api/customers"),
    enabled: addDebtOpen && addDebtType === "customer",
  });

  const { data: suppliers } = useQuery<any[]>({
    queryKey: ["suppliers"],
    queryFn: () => apiClient("/api/suppliers"),
    enabled: addDebtOpen && addDebtType === "supplier",
  });

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

  const addDebtMutation = useMutation({
    mutationFn: (data: any) => apiClient("/api/debts", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListDebtsQueryKey() });
      setAddDebtOpen(false);
      resetAddForm();
      toast({ title: "تم تسجيل الدين بنجاح" });
    },
    onError: () => toast({ title: "خطأ في تسجيل الدين", variant: "destructive" }),
  });

  const resetAddForm = () => {
    setSelectedParty(null);
    setDebtAmount("");
    setDebtNotes("");
    setPartySearch("");
  };

  const handlePay = () => {
    if (!payAmount || parseFloat(payAmount) <= 0) return;
    payMutation.mutate({ id: payingDebt.id, data: { amount: parseFloat(payAmount), notes: payNotes || undefined } });
  };

  const handleAddDebt = () => {
    if (!selectedParty) { toast({ title: "اختر العميل أو المورد", variant: "destructive" }); return; }
    if (!debtAmount || parseFloat(debtAmount) <= 0) { toast({ title: "أدخل مبلغ الدين", variant: "destructive" }); return; }
    addDebtMutation.mutate({
      type: addDebtType,
      customerName: addDebtType === "customer" ? selectedParty.name : undefined,
      customerPhone: addDebtType === "customer" ? (selectedParty.phone || undefined) : undefined,
      supplierId: addDebtType === "supplier" ? selectedParty.id : undefined,
      totalAmount: parseFloat(debtAmount),
      paidAmount: 0,
      notes: debtNotes.trim() || undefined,
    });
  };

  // Only show non-paid debts + apply search filter
  const activeCustomerDebts = (customerDebts ?? []).filter(d => {
    if (d.status === "paid") return false;
    if (!customerSearch) return true;
    const name = (d.customerName ?? "").toLowerCase();
    return name.includes(customerSearch.toLowerCase());
  });

  const activeSupplierDebts = (supplierDebts ?? []).filter(d => {
    if (d.status === "paid") return false;
    if (!supplierSearch) return true;
    const name = (d.supplierName ?? "").toLowerCase();
    return name.includes(supplierSearch.toLowerCase());
  });

  const totalCustomerDebt = activeCustomerDebts.reduce((s, d) => s + d.remainingAmount, 0);
  const totalSupplierDebt = activeSupplierDebts.reduce((s, d) => s + d.remainingAmount, 0);

  const partyList = addDebtType === "customer" ? (customers ?? []) : (suppliers ?? []);
  const filteredPartyList = partySearch
    ? partyList.filter((p: any) => p.name.includes(partySearch))
    : partyList;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">الديون</h1>
        <Button onClick={() => { resetAddForm(); setAddDebtOpen(true); setAddDebtType("customer"); }}>
          <Plus className="w-4 h-4 ml-2" />
          تسجيل دين جديد
        </Button>
      </div>

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
          <TabsTrigger value="customer">ديون العملاء ({activeCustomerDebts.length})</TabsTrigger>
          <TabsTrigger value="supplier">ديون للموردين ({activeSupplierDebts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="customer" className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث باسم العميل..." value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)} className="pr-9" />
          </div>
          {loadingCustomer ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeCustomerDebts.map(d => <DebtCard key={d.id} debt={d} onPay={setPayingDebt} />)}
              {activeCustomerDebts.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>{customerSearch ? "لا توجد نتائج مطابقة" : "لا توجد ديون للعملاء"}</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="supplier" className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث باسم المورد..." value={supplierSearch}
              onChange={e => setSupplierSearch(e.target.value)} className="pr-9" />
          </div>
          {loadingSupplier ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeSupplierDebts.map(d => <DebtCard key={d.id} debt={d} onPay={setPayingDebt} />)}
              {activeSupplierDebts.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>{supplierSearch ? "لا توجد نتائج مطابقة" : "لا توجد ديون للموردين"}</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Pay debt dialog */}
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
                <Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="أدخل المبلغ" max={payingDebt.remainingAmount} autoFocus />
              </div>
              <div>
                <Label>ملاحظات</Label>
                <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="اختياري" />
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

      {/* Add new debt dialog */}
      <Dialog open={addDebtOpen} onOpenChange={(open) => { if (!open) { setAddDebtOpen(false); resetAddForm(); } }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-orange-500" />
              تسجيل دين جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setAddDebtType("customer"); setSelectedParty(null); setPartySearch(""); }}
                className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${addDebtType === "customer" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              >
                دين على عميل
              </button>
              <button
                onClick={() => { setAddDebtType("supplier"); setSelectedParty(null); setPartySearch(""); }}
                className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${addDebtType === "supplier" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              >
                دين لمورد
              </button>
            </div>

            <div>
              <Label className="mb-1.5 block">{addDebtType === "customer" ? "اختر العميل" : "اختر المورد"} *</Label>
              {selectedParty ? (
                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
                  <div>
                    <p className="font-semibold text-sm">{selectedParty.name}</p>
                    {selectedParty.phone && <p className="text-xs text-muted-foreground" dir="ltr">{selectedParty.phone}</p>}
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => { setSelectedParty(null); setPartySearch(""); }}>
                    تغيير
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder={`ابحث باسم ${addDebtType === "customer" ? "العميل" : "المورد"}...`}
                    value={partySearch}
                    onChange={e => setPartySearch(e.target.value)}
                    className="h-9"
                    autoFocus
                  />
                  <div className="max-h-44 overflow-y-auto border rounded-lg divide-y">
                    {filteredPartyList.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-4">
                        {addDebtType === "customer" ? "لا يوجد عملاء" : "لا يوجد موردين"}
                      </p>
                    ) : (
                      filteredPartyList.map((p: any) => (
                        <button
                          key={p.id}
                          className="w-full text-right px-3 py-2.5 hover:bg-muted transition-colors text-sm flex items-center justify-between"
                          onClick={() => setSelectedParty(p)}
                        >
                          <span className="font-medium">{p.name}</span>
                          {p.phone && <span className="text-xs text-muted-foreground" dir="ltr">{p.phone}</span>}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>مبلغ الدين (ج.م) *</Label>
              <Input type="number" step="0.01" min="0.01" value={debtAmount}
                onChange={e => setDebtAmount(e.target.value)} placeholder="0.00" className="mt-1" />
            </div>

            <div>
              <Label>ملاحظات <span className="text-muted-foreground text-xs">(اختياري)</span></Label>
              <Input value={debtNotes} onChange={e => setDebtNotes(e.target.value)}
                placeholder="سبب الدين أو تفاصيل إضافية" className="mt-1" />
            </div>

            {selectedParty && debtAmount && parseFloat(debtAmount) > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                <p className="text-orange-700">
                  سيتم تسجيل دين قيمته{" "}
                  <span className="font-bold">{formatCurrency(parseFloat(debtAmount))}</span>{" "}
                  {addDebtType === "customer" ? "على العميل" : "للمورد"}{" "}
                  <span className="font-bold">{selectedParty.name}</span>
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setAddDebtOpen(false); resetAddForm(); }}>إلغاء</Button>
              <Button
                onClick={handleAddDebt}
                disabled={addDebtMutation.isPending || !selectedParty || !debtAmount}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {addDebtMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                تسجيل الدين
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

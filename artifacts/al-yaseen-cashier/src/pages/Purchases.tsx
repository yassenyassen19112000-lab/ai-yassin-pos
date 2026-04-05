import { useState } from "react";
import {
  useListPurchases,
  useCreatePurchase,
  useListSuppliers,
  useListProducts,
  getListPurchasesQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDateTime, paymentTypeLabel } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Plus, Loader2, Trash2, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PurchaseItem { productId: number; productName: string; quantity: number; costPrice: number; }

export default function Purchases() {
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentType, setPaymentType] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemPrice, setItemPrice] = useState("");
  const [includeExistingDebt, setIncludeExistingDebt] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: purchases, isLoading } = useListPurchases({});
  const { data: suppliers } = useListSuppliers();
  const { data: products } = useListProducts({});

  const { data: supplierPendingDebt } = useQuery<{ pendingDebt: number; debtIds: number[] }>({
    queryKey: ["supplier-pending-debt", supplierId],
    queryFn: () => apiClient(`/api/suppliers/${supplierId}/pending-debt`),
    enabled: !!supplierId,
  });

  const createMutation = useCreatePurchase({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPurchasesQueryKey() });
        setShowForm(false);
        setSupplierId(""); setInvoiceNumber(""); setPaymentType("cash"); setPaidAmount("0"); setNotes(""); setItems([]);
        setIncludeExistingDebt(false);
        toast({ title: "تم تسجيل المشترى" });
      },
      onError: () => toast({ title: "خطأ في التسجيل", variant: "destructive" }),
    },
  });

  const addItem = () => {
    const product = products?.find(p => p.id === parseInt(selectedProduct));
    if (!product || !itemQty || !itemPrice) return;
    setItems(prev => [...prev, { productId: product.id, productName: product.name, quantity: parseInt(itemQty), costPrice: parseFloat(itemPrice) }]);
    setSelectedProduct(""); setItemQty("1"); setItemPrice("");
  };

  const itemsTotal = items.reduce((s, i) => s + i.quantity * i.costPrice, 0);
  const previousDebt = (includeExistingDebt && supplierPendingDebt) ? supplierPendingDebt.pendingDebt : 0;
  const grandTotal = itemsTotal + previousDebt;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || items.length === 0) { toast({ title: "يرجى اختيار المورد وإضافة منتجات", variant: "destructive" }); return; }
    createMutation.mutate({
      data: {
        supplierId: parseInt(supplierId),
        invoiceNumber: invoiceNumber || undefined,
        paymentType,
        paidAmount: parseFloat(paidAmount),
        notes: notes || undefined,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity, costPrice: i.costPrice })),
        includeExistingDebt,
      } as any,
    });
  };

  const resetForm = () => {
    setShowForm(false);
    setSupplierId(""); setInvoiceNumber(""); setPaymentType("cash"); setPaidAmount("0"); setNotes(""); setItems([]);
    setIncludeExistingDebt(false);
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">المشتريات</h1>
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 ml-1" />تسجيل مشترى</Button>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المورد</TableHead>
                <TableHead className="text-right">رقم الفاتورة</TableHead>
                <TableHead className="text-right">الإجمالي</TableHead>
                <TableHead className="text-right">المدفوع</TableHead>
                <TableHead className="text-right">المتبقي</TableHead>
                <TableHead className="text-right">النوع</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(purchases ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.supplierName}</TableCell>
                  <TableCell>{p.invoiceNumber ?? "-"}</TableCell>
                  <TableCell>{formatCurrency(p.totalAmount)}</TableCell>
                  <TableCell className="text-green-600">{formatCurrency(p.paidAmount)}</TableCell>
                  <TableCell className={p.remainingAmount > 0 ? "text-red-500 font-bold" : ""}>{formatCurrency(p.remainingAmount)}</TableCell>
                  <TableCell><Badge variant="outline">{paymentTypeLabel(p.paymentType)}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDateTime(p.createdAt)}</TableCell>
                </TableRow>
              ))}
              {(!purchases || purchases.length === 0) && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground"><Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />لا توجد مشتريات</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={showForm} onOpenChange={resetForm}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader><DialogTitle>تسجيل مشترى جديد</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>المورد *</Label>
                <Select value={supplierId} onValueChange={(v) => { setSupplierId(v); setIncludeExistingDebt(false); }}>
                  <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                  <SelectContent>
                    {(suppliers ?? []).map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name}
                        {s.totalDebt > 0 && <span className="text-red-500 text-xs mr-2">({formatCurrency(s.totalDebt)} دين)</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>رقم الفاتورة</Label><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></div>
              <div>
                <Label>طريقة الدفع</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="credit">آجل</SelectItem>
                    <SelectItem value="partial">جزئي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>المبلغ المدفوع</Label><Input type="number" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} /></div>
            </div>

            {supplierId && supplierPendingDebt && supplierPendingDebt.pendingDebt > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-orange-700 font-medium text-sm mb-2">
                  يوجد دين سابق لهذا المورد: <span className="font-bold">{formatCurrency(supplierPendingDebt.pendingDebt)}</span>
                </p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="includeDebt"
                    checked={includeExistingDebt}
                    onCheckedChange={(v) => setIncludeExistingDebt(!!v)}
                  />
                  <label htmlFor="includeDebt" className="text-sm cursor-pointer">
                    إضافة الدين السابق لهذه الفاتورة وتسويته
                  </label>
                </div>
              </div>
            )}

            <div>
              <Label>المنتجات</Label>
              <div className="flex gap-2 mt-1">
                <Select value={selectedProduct} onValueChange={(v) => { setSelectedProduct(v); const p = products?.find(pr => pr.id === parseInt(v)); if (p) setItemPrice(p.costPrice.toString()); }}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="اختر منتج" /></SelectTrigger>
                  <SelectContent>{(products ?? []).map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" placeholder="الكمية" value={itemQty} onChange={(e) => setItemQty(e.target.value)} className="w-20" />
                <Input type="number" step="0.01" placeholder="السعر" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className="w-28" />
                <Button type="button" onClick={addItem}><Plus className="w-4 h-4" /></Button>
              </div>
              {items.length > 0 && (
                <div className="mt-2 space-y-1">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-muted rounded px-3 py-1.5 text-sm">
                      <span>{item.productName}</span>
                      <span>{item.quantity} × {formatCurrency(item.costPrice)} = {formatCurrency(item.quantity * item.costPrice)}</span>
                      <button type="button" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} className="text-destructive mr-2"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <div className="border-t pt-2 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">إجمالي المشتريات</span><span className="font-bold">{formatCurrency(itemsTotal)}</span></div>
                    {includeExistingDebt && previousDebt > 0 && (
                      <div className="flex justify-between text-orange-600"><span>الدين السابق</span><span className="font-bold">+ {formatCurrency(previousDebt)}</span></div>
                    )}
                    {(includeExistingDebt && previousDebt > 0) && (
                      <div className="flex justify-between font-bold text-base border-t pt-1"><span>الإجمالي الكلي</span><span className="text-primary">{formatCurrency(grandTotal)}</span></div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div><Label>ملاحظات</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={resetForm}>إلغاء</Button>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}تسجيل</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

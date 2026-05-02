import { useState } from "react";
import { useListSales, useGetSale } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { formatCurrency, formatDateTime, paymentTypeLabel } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Loader2, Eye, Printer, MessageCircle, FileText, RotateCcw, Minus, Plus, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReturnItem { productId: number; productName: string; quantity: number; maxQty: number; sellingPrice: number; }

export default function Sales() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [returnSaleId, setReturnSaleId] = useState<number | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const [returnSuccess, setReturnSuccess] = useState<any>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: sales, isLoading } = useListSales({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    customerName: customerName || undefined,
  });

  const { data: saleDetail } = useGetSale(
    selectedSaleId ?? returnSaleId ?? 0,
    { query: { enabled: !!(selectedSaleId || returnSaleId) } }
  );

  const returnMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiClient(`/api/sales/${id}/return`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (data: any) => {
      setReturnSuccess(data);
      qc.invalidateQueries({ queryKey: ["sales"] });
      toast({ title: `تم تسجيل المرتجع: ${formatCurrency(data.returnAmount)}` });
    },
    onError: (err: any) => toast({ title: err?.message || "خطأ في تسجيل المرتجع", variant: "destructive" }),
  });

  const openReturn = (sale: any) => {
    setReturnSaleId(sale.id);
    setReturnReason("");
    setReturnSuccess(null);
  };

  const initReturnItems = (sale: any) => {
    setReturnItems(sale.items.map((i: any) => ({
      productId: i.productId,
      productName: i.productName,
      quantity: 0,
      maxQty: i.quantity,
      sellingPrice: i.sellingPrice,
    })));
  };

  const updateReturnQty = (idx: number, delta: number) => {
    setReturnItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const newQty = Math.max(0, Math.min(item.maxQty, item.quantity + delta));
      return { ...item, quantity: newQty };
    }));
  };

  const setReturnQtyDirect = (idx: number, val: number) => {
    setReturnItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, quantity: Math.max(0, Math.min(item.maxQty, val)) };
    }));
  };

  const handleSubmitReturn = () => {
    const selected = returnItems.filter(i => i.quantity > 0);
    if (!selected.length) { toast({ title: "اختر منتجاً واحداً على الأقل", variant: "destructive" }); return; }
    returnMutation.mutate({
      id: returnSaleId!,
      data: { items: selected.map(i => ({ productId: i.productId, productName: i.productName, quantity: i.quantity })), reason: returnReason || undefined },
    });
  };

  const returnTotal = returnItems.reduce((s, i) => s + i.quantity * i.sellingPrice, 0);

  const handleWhatsApp = (sale: any) => {
    const text = `فاتورة من محل آل ياسين لاكسسوار الموتال\nرقم الفاتورة: ${sale.invoiceNumber}\nالتاريخ: ${new Date(sale.createdAt).toLocaleDateString("ar-EG")}\n---\n` +
      sale.items.map((i: any) => `${i.productName} × ${i.quantity} = ${formatCurrency(i.total)}`).join("\n") +
      `\n---\nالإجمالي: ${formatCurrency(sale.totalAmount)}\nالمدفوع: ${formatCurrency(sale.paidAmount)}` +
      (sale.remainingDebt > 0 ? `\nالمتبقي: ${formatCurrency(sale.remainingDebt)}` : "") +
      `\nشكراً لتعاملكم معنا`;
    const phone = sale.customerPhone?.replace(/[^0-9]/g, "") || "";
    window.open(phone ? `https://wa.me/2${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-2xl font-bold">سجل المبيعات</h1>

      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><Label className="text-xs">من تاريخ</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8" /></div>
            <div><Label className="text-xs">إلى تاريخ</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8" /></div>
            <div className="col-span-2"><Label className="text-xs">اسم العميل</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="بحث باسم العميل" className="h-8" /></div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الفاتورة</TableHead>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-right">الإجمالي</TableHead>
                <TableHead className="text-right">المدفوع</TableHead>
                <TableHead className="text-right">المتبقي</TableHead>
                <TableHead className="text-right">النوع</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sales ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.invoiceNumber}</TableCell>
                  <TableCell>{s.customerName || "نقدي"}</TableCell>
                  <TableCell className="font-bold">{formatCurrency(s.totalAmount)}</TableCell>
                  <TableCell className="text-green-600">{formatCurrency(s.paidAmount)}</TableCell>
                  <TableCell className={s.remainingDebt > 0 ? "text-red-500 font-bold" : "text-muted-foreground"}>{formatCurrency(s.remainingDebt)}</TableCell>
                  <TableCell><Badge variant="outline">{paymentTypeLabel(s.paymentType)}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatDateTime(s.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedSaleId(s.id)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                        onClick={() => { openReturn(s); }}>
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!sales || sales.length === 0) && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground"><FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />لا توجد مبيعات</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Invoice detail dialog */}
      <Dialog open={!!selectedSaleId} onOpenChange={() => setSelectedSaleId(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>تفاصيل الفاتورة</DialogTitle></DialogHeader>
          {saleDetail && selectedSaleId && (
            <div className="space-y-3">
              <div id="print-invoice" className="border rounded-lg p-5 bg-white text-gray-900">
                <div className="text-center mb-4 pb-3 border-b-2 border-gray-400">
                  <p className="font-bold text-xl text-gray-900">آل ياسين لاكسسوار الموتال</p>
                  <p className="text-sm text-gray-600 mt-1">{formatDateTime(saleDetail.createdAt)}</p>
                  <p className="text-sm font-mono mt-1 text-gray-800">فاتورة رقم: {saleDetail.invoiceNumber}</p>
                </div>
                {saleDetail.customerName && (
                  <div className="mb-3 pb-2 border-b border-gray-300">
                    <p className="font-semibold text-gray-900">العميل: {saleDetail.customerName}</p>
                    {saleDetail.customerPhone && <p className="text-sm text-gray-600" dir="ltr">{saleDetail.customerPhone}</p>}
                  </div>
                )}
                <div className="space-y-2 mb-4">
                  <div className="grid grid-cols-3 text-xs font-bold text-gray-700 border-b border-gray-300 pb-1">
                    <span>المنتج</span><span className="text-center">الكمية</span><span className="text-left">الإجمالي</span>
                  </div>
                  {saleDetail.items.map((item: any) => (
                    <div key={item.id} className="grid grid-cols-3 text-sm text-gray-900">
                      <span className="truncate">{item.productName}</span>
                      <span className="text-center">{item.quantity}</span>
                      <span className="text-left font-medium">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t-2 border-gray-400 pt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between font-bold text-base text-gray-900"><span>الإجمالي</span><span>{formatCurrency(saleDetail.totalAmount)}</span></div>
                  {saleDetail.discountAmount > 0 && <div className="flex justify-between text-gray-700"><span>الخصم</span><span>- {formatCurrency(saleDetail.discountAmount)}</span></div>}
                  {saleDetail.previousDebt > 0 && <div className="flex justify-between text-gray-800"><span>ديون سابقة</span><span>{formatCurrency(saleDetail.previousDebt)}</span></div>}
                  <div className="flex justify-between font-semibold text-gray-900"><span>المدفوع</span><span>{formatCurrency(saleDetail.paidAmount)}</span></div>
                  {saleDetail.remainingDebt > 0 && <div className="flex justify-between font-bold text-base text-gray-900 border-t border-gray-300 pt-1"><span>المتبقي (دين)</span><span>{formatCurrency(saleDetail.remainingDebt)}</span></div>}
                </div>
                <p className="text-center text-sm mt-4 text-gray-600 border-t border-gray-300 pt-3">شكراً لتعاملكم معنا</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => window.print()}><Printer className="w-4 h-4 ml-2" />طباعة</Button>
                <Button variant="outline" className="flex-1 text-green-600" onClick={() => handleWhatsApp(saleDetail)}><MessageCircle className="w-4 h-4 ml-2" />واتساب</Button>
                <Button variant="outline" className="text-orange-500 border-orange-200" onClick={() => { setSelectedSaleId(null); openReturn(saleDetail); }}>
                  <RotateCcw className="w-4 h-4 ml-1" />مرتجع
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Return dialog */}
      <Dialog open={!!returnSaleId} onOpenChange={(open) => { if (!open) { setReturnSaleId(null); setReturnItems([]); setReturnSuccess(null); } }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-orange-500" />
              تسجيل مرتجع
            </DialogTitle>
          </DialogHeader>

          {returnSuccess ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <Check className="w-10 h-10 text-green-500 mx-auto mb-2" />
                <p className="font-bold text-green-700 text-lg">تم تسجيل المرتجع بنجاح</p>
                <p className="text-green-600 mt-1">تم استرداد: <span className="font-bold">{formatCurrency(returnSuccess.returnAmount)}</span></p>
                <p className="text-xs text-green-500 mt-1">تم إضافة المنتجات للمخزون تلقائياً</p>
              </div>
              <div className="space-y-1 text-sm">
                {returnSuccess.items.map((i: any, idx: number) => (
                  <div key={idx} className="flex justify-between bg-muted rounded px-3 py-1.5">
                    <span>{i.productName} × {i.quantity}</span>
                    <span className="font-medium">{formatCurrency(i.total)}</span>
                  </div>
                ))}
              </div>
              {returnSuccess.reason && <p className="text-sm text-muted-foreground">السبب: {returnSuccess.reason}</p>}
              <Button className="w-full" onClick={() => { setReturnSaleId(null); setReturnItems([]); setReturnSuccess(null); }}>إغلاق</Button>
            </div>
          ) : saleDetail && returnSaleId ? (
            <div className="space-y-4">
              {returnItems.length === 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">اختر المنتجات المراد إرجاعها:</p>
                  <div className="space-y-2">
                    {saleDetail.items.map((item: any) => (
                      <div key={item.productId} className="flex items-center justify-between bg-muted rounded-lg px-3 py-2 text-sm">
                        <span className="font-medium">{item.productName}</span>
                        <span className="text-muted-foreground">الكمية: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full mt-3" onClick={() => initReturnItems(saleDetail)}>
                    تحديد المرتجعات
                  </Button>
                </div>
              )}

              {returnItems.length > 0 && (
                <>
                  <div className="space-y-2">
                    {returnItems.map((item, idx) => (
                      <div key={item.productId} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{item.productName}</span>
                          <span className="text-xs text-muted-foreground">من أصل {item.maxQty}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateReturnQty(idx, -1)} className="w-7 h-7 rounded border flex items-center justify-center hover:bg-muted">
                            <Minus className="w-3 h-3" />
                          </button>
                          <Input
                            type="number"
                            min="0"
                            max={item.maxQty}
                            value={item.quantity}
                            onChange={e => setReturnQtyDirect(idx, parseInt(e.target.value) || 0)}
                            className="w-16 h-7 text-center text-sm p-0"
                          />
                          <button onClick={() => updateReturnQty(idx, 1)} className="w-7 h-7 rounded border flex items-center justify-center hover:bg-muted">
                            <Plus className="w-3 h-3" />
                          </button>
                          <span className="text-xs text-muted-foreground mr-auto">{formatCurrency(item.quantity * item.sellingPrice)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <Label className="text-xs">سبب المرتجع (اختياري)</Label>
                    <Input value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="عيب، خطأ في الطلب..." className="h-8 mt-1 text-sm" />
                  </div>

                  {returnTotal > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex justify-between items-center">
                      <span className="text-sm text-orange-700 font-medium">إجمالي المرتجع:</span>
                      <span className="text-lg font-bold text-orange-700">{formatCurrency(returnTotal)}</span>
                    </div>
                  )}

                  <Separator />
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setReturnItems([])}>رجوع</Button>
                    <Button
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={handleSubmitReturn}
                      disabled={returnTotal === 0 || returnMutation.isPending}
                    >
                      {returnMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                      تأكيد المرتجع
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

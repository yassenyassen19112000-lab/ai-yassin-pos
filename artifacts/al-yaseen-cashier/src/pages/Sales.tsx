import { useState } from "react";
import { useListSales, useGetSale } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

  // Fetch returns for the currently viewed invoice (detail view)
  const { data: saleReturns } = useQuery({
    queryKey: ["sale-returns", selectedSaleId],
    queryFn: () => apiClient<any[]>(`/api/sales/${selectedSaleId}/returns`),
    enabled: !!selectedSaleId,
  });

  // Fetch returns for the return dialog (to know remaining returnable qty)
  const { data: returnSaleReturns } = useQuery({
    queryKey: ["sale-returns", returnSaleId],
    queryFn: () => apiClient<any[]>(`/api/sales/${returnSaleId}/returns`),
    enabled: !!returnSaleId,
  });

  const returnMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiClient(`/api/sales/${id}/return`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (data: any) => {
      setReturnSuccess(data);
      qc.invalidateQueries({ queryKey: ["sales"] });
      // Refresh returns for this sale so quantities update immediately if dialog is re-opened
      qc.invalidateQueries({ queryKey: ["sale-returns", returnSaleId] });
      qc.invalidateQueries({ queryKey: ["sale-returns", selectedSaleId] });
      toast({ title: `تم تسجيل المرتجع: ${formatCurrency(data.returnAmount)}` });
    },
    onError: (err: any) => toast({ title: err?.message || "خطأ في تسجيل المرتجع", variant: "destructive" }),
  });

  const openReturn = (sale: any) => {
    setReturnSaleId(sale.id);
    setReturnReason("");
    setReturnSuccess(null);
    setReturnItems([]);
  };

  const initReturnItems = (sale: any) => {
    // Calculate already-returned qty per product from previous returns on this sale
    const alreadyReturned: Record<number, number> = {};
    for (const ret of (returnSaleReturns ?? [])) {
      const items = Array.isArray(ret.items) ? ret.items : [];
      for (const ri of items) {
        alreadyReturned[ri.productId] = (alreadyReturned[ri.productId] ?? 0) + ri.quantity;
      }
    }
    setReturnItems(
      sale.items
        .map((i: any) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: 0,
          maxQty: Math.max(0, i.quantity - (alreadyReturned[i.productId] ?? 0)),
          alreadyReturned: alreadyReturned[i.productId] ?? 0,
          sellingPrice: i.sellingPrice,
        }))
        .filter((i: any) => i.maxQty > 0)
    );
  };

  const updateReturnQty = (idx: number, delta: number) => {
    setReturnItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, quantity: Math.max(0, Math.min(item.maxQty, item.quantity + delta)) };
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

  const totalReturned = (saleReturns ?? []).reduce((s: number, r: any) => s + parseFloat(r.return_amount ?? 0), 0);

  const handleWhatsApp = (sale: any, returns: any[]) => {
    const totalReturned = returns.reduce((s, r) => s + parseFloat(r.return_amount ?? 0), 0);
    let text = `فاتورة من محل آل ياسين لاكسسوار الموتال\nرقم الفاتورة: ${sale.invoiceNumber}\nالتاريخ: ${new Date(sale.createdAt).toLocaleDateString("ar-EG")}\n---\n`;
    text += sale.items.map((i: any) => `${i.productName} × ${i.quantity} = ${formatCurrency(i.total)}`).join("\n");
    text += `\n---\nالإجمالي: ${formatCurrency(sale.totalAmount)}\nالمدفوع: ${formatCurrency(sale.paidAmount)}`;
    if (sale.remainingDebt > 0) text += `\nالمتبقي: ${formatCurrency(sale.remainingDebt)}`;
    if (totalReturned > 0) text += `\n---\nمرتجع: ${formatCurrency(totalReturned)}`;
    text += `\nشكراً لتعاملكم معنا`;
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
                <TableHead className="text-right">الإجمالي الكلي</TableHead>
                <TableHead className="text-right">المدفوع</TableHead>
                <TableHead className="text-right">المتبقي</TableHead>
                <TableHead className="text-right">دين سابق</TableHead>
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
                  <TableCell className="font-bold">{formatCurrency(s.totalAmount + s.previousDebt)}</TableCell>
                  <TableCell className="text-green-600">{formatCurrency(s.paidAmount)}</TableCell>
                  <TableCell className={s.remainingDebt > 0 ? "text-red-500 font-bold" : "text-muted-foreground"}>{formatCurrency(s.remainingDebt)}</TableCell>
                  <TableCell className={s.previousDebt > 0 ? "text-orange-500 text-xs font-medium" : "text-muted-foreground text-xs"}>{s.previousDebt > 0 ? formatCurrency(s.previousDebt) : "—"}</TableCell>
                  <TableCell><Badge variant="outline">{paymentTypeLabel(s.paymentType)}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatDateTime(s.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedSaleId(s.id)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                        onClick={() => openReturn(s)}>
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
      <Dialog open={!!selectedSaleId} onOpenChange={() => { setSelectedSaleId(null); }}>
        <DialogContent dir="rtl" className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>تفاصيل الفاتورة</DialogTitle></DialogHeader>
          {saleDetail && selectedSaleId && (
            <div className="space-y-3">
              <div id="print-invoice" className="border rounded-lg p-5 bg-white text-gray-900">
                {/* Header */}
                <div className="text-center mb-4 pb-3 border-b-2 border-gray-400">
                  <p className="font-bold text-xl text-gray-900">آل ياسين لاكسسوار الموتال</p>
                  <p className="text-sm text-gray-600 mt-1">{formatDateTime(saleDetail.createdAt)}</p>
                  <p className="text-sm font-mono mt-1 text-gray-800">فاتورة رقم: {saleDetail.invoiceNumber}</p>
                  {saleDetail.cashierName && <p className="text-xs text-gray-500 mt-0.5">الكاشير: {saleDetail.cashierName}</p>}
                </div>

                {/* Customer */}
                {saleDetail.customerName && (
                  <div className="mb-3 pb-2 border-b border-gray-300">
                    <p className="font-semibold text-gray-900">العميل: {saleDetail.customerName}</p>
                    {saleDetail.customerPhone && <p className="text-sm text-gray-600" dir="ltr">{saleDetail.customerPhone}</p>}
                  </div>
                )}

                {/* Items */}
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

                {/* Totals */}
                <div className="border-t-2 border-gray-400 pt-3 space-y-1.5 text-sm">
                  {/* Items subtotal (before discount) */}
                  {saleDetail.discountAmount > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>المجموع قبل الخصم</span>
                      <span>{formatCurrency(saleDetail.totalAmount + saleDetail.discountAmount)}</span>
                    </div>
                  )}
                  {saleDetail.discountAmount > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>خصم</span>
                      <span>- {formatCurrency(saleDetail.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-gray-900">
                    <span>{saleDetail.discountAmount > 0 ? "صافي البضاعة" : "إجمالي البضاعة"}</span>
                    <span>{formatCurrency(saleDetail.totalAmount)}</span>
                  </div>
                  {saleDetail.previousDebt > 0 && (
                    <div className="flex justify-between text-orange-700">
                      <span>ديون سابقة</span>
                      <span>+ {formatCurrency(saleDetail.previousDebt)}</span>
                    </div>
                  )}
                  {saleDetail.previousDebt > 0 && (
                    <div className="flex justify-between font-bold text-base text-gray-900 border-t border-gray-300 pt-1">
                      <span>الإجمالي الكلي المطلوب</span>
                      <span>{formatCurrency(saleDetail.totalAmount + saleDetail.previousDebt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-green-700">
                    <span>المدفوع</span>
                    <span>{formatCurrency(saleDetail.paidAmount)}</span>
                  </div>
                  {/* Net balance — positive means customer owes us, negative means we owe customer */}
                  {(() => {
                    const grandTotal = saleDetail.totalAmount + saleDetail.previousDebt - saleDetail.discountAmount;
                    // net = what is still owed after paying; positive = customer owes, negative = store owes refund
                    const net = grandTotal - saleDetail.paidAmount;
                    if (net > 0.005) {
                      return (
                        <div className="flex justify-between font-bold text-base text-red-700 border-t border-gray-300 pt-1">
                          <span>رصيد الفاتورة (على العميل)</span>
                          <span>+ {formatCurrency(net)}</span>
                        </div>
                      );
                    } else if (net < -0.005) {
                      return (
                        <div className="flex justify-between font-bold text-base text-blue-700 border-t border-gray-300 pt-1">
                          <span>💵 مسترد للعميل</span>
                          <span>- {formatCurrency(Math.abs(net))}</span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex justify-between text-green-600 border-t border-gray-300 pt-1">
                          <span>✓ الحساب مسوَّى</span>
                          <span>{formatCurrency(0)}</span>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Returns section - shown only if there are returns */}
                {saleReturns && saleReturns.length > 0 && (() => {
                  const grandTotal = saleDetail.totalAmount + saleDetail.previousDebt;
                  const netAfterReturn = grandTotal - totalReturned;
                  const refundDue = totalReturned > saleDetail.paidAmount
                    ? totalReturned - saleDetail.paidAmount
                    : 0;
                  const remainingAfterReturn = netAfterReturn > saleDetail.paidAmount
                    ? netAfterReturn - saleDetail.paidAmount
                    : 0;
                  return (
                  <div className="mt-4 pt-3 border-t-2 border-orange-300">
                    <p className="text-xs font-bold text-orange-700 mb-2 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" />
                      مرتجعات هذه الفاتورة
                    </p>
                    <div className="space-y-2">
                      {saleReturns.map((ret: any, idx: number) => (
                        <div key={idx} className="bg-orange-50 rounded p-2 text-xs">
                          <div className="flex justify-between font-semibold text-orange-800 mb-1">
                            <span>{ret.return_number}</span>
                            <span className="text-orange-700">- {formatCurrency(parseFloat(ret.return_amount))}</span>
                          </div>
                          {Array.isArray(ret.items) && ret.items.map((ri: any, i: number) => (
                            <div key={i} className="flex justify-between text-orange-600 pr-2">
                              <span>{ri.productName} × {ri.quantity}</span>
                              <span>{formatCurrency(ri.total)}</span>
                            </div>
                          ))}
                          {ret.reason && <p className="text-orange-500 mt-1">السبب: {ret.reason}</p>}
                          <p className="text-orange-400 mt-0.5">{new Date(ret.created_at).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold text-orange-800 text-sm border-t border-orange-200 pt-1">
                        <span>إجمالي المرتجعات</span>
                        <span>- {formatCurrency(totalReturned)}</span>
                      </div>
                      {/* Net after return (grand total - returns) */}
                      <div className="flex justify-between text-gray-700 text-sm">
                        <span>الإجمالي الكلي - المرتجعات</span>
                        <span className="font-semibold">{formatCurrency(Math.max(0, netAfterReturn))}</span>
                      </div>
                      <div className="flex justify-between text-gray-600 text-xs">
                        <span>المدفوع فعلياً</span>
                        <span>{formatCurrency(saleDetail.paidAmount)}</span>
                      </div>
                      {/* Final status */}
                      {refundDue > 0 ? (
                        <div className="flex justify-between font-bold text-blue-700 text-sm bg-blue-50 rounded px-2 py-1.5 border border-blue-200">
                          <span>💵 مبلغ مسترد للعميل</span>
                          <span>{formatCurrency(refundDue)}</span>
                        </div>
                      ) : remainingAfterReturn > 0 ? (
                        <div className="flex justify-between font-bold text-red-700 text-sm bg-red-50 rounded px-2 py-1.5 border border-red-200">
                          <span>باقي على العميل بعد المرتجع</span>
                          <span>{formatCurrency(remainingAfterReturn)}</span>
                        </div>
                      ) : (
                        <div className="flex justify-between font-bold text-green-700 text-sm bg-green-50 rounded px-2 py-1.5 border border-green-200">
                          <span>✓ الحساب مسوَّى بعد المرتجع</span>
                          <span>{formatCurrency(0)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })()}

                <p className="text-center text-sm mt-4 text-gray-600 border-t border-gray-300 pt-3">شكراً لتعاملكم معنا</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 ml-2" />طباعة
                </Button>
                <Button variant="outline" className="flex-1 text-green-600" onClick={() => handleWhatsApp(saleDetail, saleReturns ?? [])}>
                  <MessageCircle className="w-4 h-4 ml-2" />واتساب
                </Button>
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
        <DialogContent dir="rtl" className="max-w-md max-h-[90vh] overflow-y-auto">
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
                <p className="text-xs text-green-500 mt-1">تم إعادة المنتجات للمخزون تلقائياً</p>
              </div>

              {/* returned items */}
              <div className="space-y-1 text-sm">
                <p className="text-xs text-muted-foreground mb-1">المنتجات المرتجعة:</p>
                {returnSuccess.items.map((i: any, idx: number) => (
                  <div key={idx} className="flex justify-between bg-muted rounded px-3 py-1.5">
                    <span>{i.productName} × {i.quantity}</span>
                    <span className="font-medium text-orange-600">- {formatCurrency(i.total)}</span>
                  </div>
                ))}
              </div>

              {/* financial outcome */}
              {(() => {
                const grandTotal = returnSuccess.saleTotal + returnSuccess.previousDebt;
                const refundDue = returnSuccess.returnAmount > returnSuccess.paidAmount
                  ? returnSuccess.returnAmount - returnSuccess.paidAmount
                  : 0;
                const netPayable = grandTotal - returnSuccess.returnAmount;
                const remainingAfter = netPayable > returnSuccess.paidAmount ? netPayable - returnSuccess.paidAmount : 0;
                return (
                  <div className="border rounded-lg divide-y text-sm">
                    <div className="flex justify-between px-3 py-2 text-muted-foreground">
                      <span>إجمالي الفاتورة الكلي</span>
                      <span>{formatCurrency(grandTotal)}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2 text-orange-600">
                      <span>قيمة المرتجع</span>
                      <span>- {formatCurrency(returnSuccess.returnAmount)}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2 text-muted-foreground">
                      <span>المدفوع مسبقاً</span>
                      <span>{formatCurrency(returnSuccess.paidAmount)}</span>
                    </div>
                    {refundDue > 0 ? (
                      <div className="flex justify-between px-3 py-2.5 font-bold text-blue-700 bg-blue-50 rounded-b-lg">
                        <span>💵 مبلغ مسترد للعميل</span>
                        <span>{formatCurrency(refundDue)}</span>
                      </div>
                    ) : remainingAfter > 0 ? (
                      <div className="flex justify-between px-3 py-2.5 font-bold text-red-700 bg-red-50 rounded-b-lg">
                        <span>باقي على العميل</span>
                        <span>{formatCurrency(remainingAfter)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between px-3 py-2.5 font-bold text-green-700 bg-green-50 rounded-b-lg">
                        <span>✓ الحساب مسوَّى</span>
                        <span>{formatCurrency(0)}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {returnSuccess.reason && <p className="text-sm text-muted-foreground">السبب: {returnSuccess.reason}</p>}
              <Button className="w-full" onClick={() => { setReturnSaleId(null); setReturnItems([]); setReturnSuccess(null); }}>إغلاق</Button>
            </div>
          ) : saleDetail && returnSaleId ? (
            <div className="space-y-4">
              {/* Sale summary */}
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs space-y-0.5">
                <div className="flex justify-between text-muted-foreground">
                  <span>فاتورة: {saleDetail.invoiceNumber}</span>
                  <span>الإجمالي الكلي: {formatCurrency(saleDetail.totalAmount + saleDetail.previousDebt)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>المدفوع: {formatCurrency(saleDetail.paidAmount)}</span>
                  {saleDetail.remainingDebt > 0
                    ? <span className="text-red-500">متبقي: {formatCurrency(saleDetail.remainingDebt)}</span>
                    : <span className="text-green-600">مسوَّى ✓</span>
                  }
                </div>
              </div>

              {returnItems.length === 0 && (() => {
                // Pre-calculate already-returned qty so the list screen shows remaining
                const alreadyRet: Record<number, number> = {};
                for (const ret of (returnSaleReturns ?? [])) {
                  for (const ri of (Array.isArray(ret.items) ? ret.items : [])) {
                    alreadyRet[ri.productId] = (alreadyRet[ri.productId] ?? 0) + ri.quantity;
                  }
                }
                const availableItems = saleDetail.items.map((i: any) => ({
                  ...i,
                  available: Math.max(0, i.quantity - (alreadyRet[i.productId] ?? 0)),
                  returned: alreadyRet[i.productId] ?? 0,
                }));
                const hasAny = availableItems.some((i: any) => i.available > 0);
                return (
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">الكميات المتاحة للإرجاع:</p>
                    <div className="space-y-1.5">
                      {availableItems.map((item: any) => (
                        <div key={item.productId} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${item.available === 0 ? "bg-muted/40 opacity-50" : "bg-muted"}`}>
                          <span className={`font-medium ${item.available === 0 ? "line-through text-muted-foreground" : ""}`}>{item.productName}</span>
                          <div className="text-xs text-left">
                            {item.returned > 0 && <span className="text-orange-500 block">تم إرجاع {item.returned}</span>}
                            <span className={item.available === 0 ? "text-muted-foreground" : "text-green-600 font-medium"}>
                              متاح: {item.available}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {hasAny ? (
                      <Button className="w-full mt-3" onClick={() => initReturnItems(saleDetail)}>
                        تحديد الكميات المرتجعة
                      </Button>
                    ) : (
                      <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-center text-sm text-green-700">
                        ✓ تم إرجاع جميع المنتجات من هذه الفاتورة
                      </div>
                    )}
                  </div>
                );
              })()}

              {returnItems.length > 0 && (
                <>
                  <div className="space-y-2">
                    {returnItems.map((item, idx) => (
                      <div key={item.productId} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{item.productName}</span>
                          <span className="text-xs text-muted-foreground">متاح للإرجاع: {item.maxQty}</span>
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
                    <Input value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="عيب، خطأ في الطلب، تغيير رأي..." className="h-8 mt-1 text-sm" />
                  </div>

                  {returnTotal > 0 && (() => {
                    const grandTotal = saleDetail.totalAmount + saleDetail.previousDebt;
                    // Include previously returned amounts in the calculation
                    const prevReturnedTotal = (returnSaleReturns ?? []).reduce(
                      (s: number, r: any) => s + parseFloat(r.return_amount ?? 0), 0
                    );
                    const totalReturnedAfterThis = prevReturnedTotal + returnTotal;
                    // net = what customer owes (or store owes if negative)
                    // balance = grandTotal - allReturns - paidAmount
                    const balance = grandTotal - totalReturnedAfterThis - saleDetail.paidAmount;
                    return (
                      <div className="border border-orange-200 rounded-lg overflow-hidden text-sm">
                        <div className="bg-orange-50 px-3 py-2 flex justify-between font-bold text-orange-700">
                          <span>هذا المرتجع</span>
                          <span>- {formatCurrency(returnTotal)}</span>
                        </div>
                        {prevReturnedTotal > 0 && (
                          <div className="px-3 py-1.5 flex justify-between text-orange-500 bg-orange-50/60 border-t border-orange-100 text-xs">
                            <span>مرتجعات سابقة</span>
                            <span>- {formatCurrency(prevReturnedTotal)}</span>
                          </div>
                        )}
                        <div className="px-3 py-2 flex justify-between text-muted-foreground bg-white border-t border-orange-100">
                          <span>الإجمالي الكلي المطلوب</span>
                          <span>{formatCurrency(grandTotal)}</span>
                        </div>
                        <div className="px-3 py-2 flex justify-between text-muted-foreground bg-white border-t border-orange-100">
                          <span>المدفوع مسبقاً</span>
                          <span>{formatCurrency(saleDetail.paidAmount)}</span>
                        </div>
                        {/* Balance: positive = customer owes, negative = store owes refund */}
                        {balance > 0.005 ? (
                          <div className="px-3 py-2.5 flex justify-between font-bold text-red-700 bg-red-50 border-t border-red-200">
                            <span>رصيد على العميل بعد المرتجع</span>
                            <span>+ {formatCurrency(balance)}</span>
                          </div>
                        ) : balance < -0.005 ? (
                          <div className="px-3 py-2.5 flex justify-between font-bold text-blue-700 bg-blue-50 border-t border-blue-200">
                            <span>💵 مسترد للعميل</span>
                            <span>- {formatCurrency(Math.abs(balance))}</span>
                          </div>
                        ) : (
                          <div className="px-3 py-2.5 flex justify-between font-bold text-green-700 bg-green-50 border-t border-green-200">
                            <span>✓ الحساب سيُسوَّى تماماً</span>
                            <span>{formatCurrency(0)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

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

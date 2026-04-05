import { useState } from "react";
import { useListSales, useGetSale, getGetSaleQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatDateTime, paymentTypeLabel } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Eye, Printer, MessageCircle, FileText } from "lucide-react";

export default function Sales() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);

  const { data: sales, isLoading } = useListSales({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    customerName: customerName || undefined,
  });

  const { data: saleDetail } = useGetSale(
    selectedSaleId!,
    { query: { enabled: !!selectedSaleId } }
  );

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
                    <Button variant="ghost" size="sm" onClick={() => setSelectedSaleId(s.id)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
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

      <Dialog open={!!selectedSaleId} onOpenChange={() => setSelectedSaleId(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>تفاصيل الفاتورة</DialogTitle></DialogHeader>
          {saleDetail && (
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
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

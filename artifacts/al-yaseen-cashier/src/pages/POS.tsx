import { useState, useEffect, useRef } from "react";
import {
  useListProducts,
  useCreateSale,
  useGetCustomerDebts,
  getListSalesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, paymentTypeLabel } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Search, Plus, Minus, Trash2, Printer, MessageCircle, Loader2, ShoppingCart, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  sellingPrice: number;
  unit: string;
}

export default function POS() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentType, setPaymentType] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [successSale, setSuccessSale] = useState<any>(null);

  const { data: products } = useListProducts({ search: search || undefined });
  const { data: customerDebts } = useGetCustomerDebts(
    { customerName: customerName || "_none_" },
    { query: { enabled: customerName.length > 2 } }
  );

  const customerPendingDebt = (customerDebts ?? []).reduce(
    (sum, d) => sum + d.remainingAmount, 0
  );

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.sellingPrice, 0);
  const discount = parseFloat(discountAmount || "0");
  const totalAmount = subtotal - discount;
  const totalWithDebt = totalAmount + customerPendingDebt;
  const paid = paymentType === "cash" ? totalWithDebt : parseFloat(paidAmount || "0");
  const remaining = Math.max(0, totalWithDebt - paid);

  const createSale = useCreateSale({
    mutation: {
      onSuccess: (data) => {
        setSuccessSale(data);
        qc.invalidateQueries({ queryKey: getListSalesQueryKey() });
        setCart([]);
        setCustomerName("");
        setCustomerPhone("");
        setPaymentType("cash");
        setPaidAmount("");
        setDiscountAmount("0");
        setNotes("");
        toast({ title: "تم إنشاء الفاتورة بنجاح" });
      },
      onError: () => toast({ title: "خطأ في إنشاء الفاتورة", variant: "destructive" }),
    },
  });

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        sellingPrice: product.sellingPrice,
        unit: product.unit,
      }];
    });
  };

  const updateQty = (productId: number, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.productId !== productId));
    } else {
      setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i));
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) { toast({ title: "السلة فارغة", variant: "destructive" }); return; }
    createSale.mutate({
      data: {
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        paymentType,
        paidAmount: paymentType === "cash" ? totalWithDebt : parseFloat(paidAmount || "0"),
        discountAmount: discount,
        notes: notes || undefined,
        items: cart.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          sellingPrice: i.sellingPrice,
        })),
      },
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = (sale: any) => {
    const text = `فاتورة من محل آل ياسين لاكسسوار الموتال\n` +
      `رقم الفاتورة: ${sale.invoiceNumber}\n` +
      `التاريخ: ${new Date(sale.createdAt).toLocaleDateString("ar-EG")}\n` +
      `---\n` +
      sale.items.map((i: any) => `${i.productName} × ${i.quantity} = ${formatCurrency(i.total)}`).join("\n") +
      `\n---\n` +
      `الإجمالي: ${formatCurrency(sale.totalAmount)}\n` +
      (sale.discountAmount > 0 ? `الخصم: ${formatCurrency(sale.discountAmount)}\n` : "") +
      (sale.previousDebt > 0 ? `ديون سابقة: ${formatCurrency(sale.previousDebt)}\n` : "") +
      `المدفوع: ${formatCurrency(sale.paidAmount)}\n` +
      (sale.remainingDebt > 0 ? `المتبقي: ${formatCurrency(sale.remainingDebt)}\n` : "") +
      `شكراً لتعاملكم معنا`;
    const phone = customerPhone?.replace(/[^0-9]/g, "") || "";
    const wa = phone ? `https://wa.me/2${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(wa, "_blank");
  };

  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-2xl font-bold">نقطة البيع</h1>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Products */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث عن منتج..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[60vh] overflow-y-auto">
            {(products ?? []).map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.quantity === 0}
                className={`text-right p-3 rounded-xl border-2 transition-all ${
                  p.quantity === 0
                    ? "opacity-40 cursor-not-allowed border-border bg-muted"
                    : "hover:border-primary hover:shadow-md cursor-pointer border-border bg-card active:scale-95"
                } ${p.isLowStock && p.quantity > 0 ? "border-orange-300" : ""}`}
              >
                <p className="font-semibold text-sm truncate">{p.name}</p>
                <p className="text-primary font-bold text-sm mt-1">{formatCurrency(p.sellingPrice)}</p>
                <p className={`text-xs mt-0.5 ${p.isLowStock ? "text-orange-500" : "text-muted-foreground"}`}>
                  المتاح: {p.quantity} {p.unit}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Cart */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                السلة ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {cart.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">السلة فارغة</p>
              )}
              {cart.map((item) => (
                <div key={item.productId} className="flex items-center gap-2 py-1.5 border-b last:border-0">
                  <button onClick={() => setCart(p => p.filter(i => i.productId !== item.productId))} className="text-muted-foreground hover:text-destructive">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(item.sellingPrice)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="w-5 h-5 rounded border flex items-center justify-center hover:bg-muted">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                    <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="w-5 h-5 rounded border flex items-center justify-center hover:bg-muted">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-xs font-bold w-16 text-left">{formatCurrency(item.quantity * item.sellingPrice)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-3">
              <div>
                <Label className="text-xs">اسم العميل</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="اختياري" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">رقم الهاتف</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="01XXXXXXXXX" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">الخصم (ج.م)</Label>
                <Input type="number" step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">طريقة الدفع</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="credit">آجل</SelectItem>
                    <SelectItem value="partial">جزئي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {paymentType !== "cash" && (
                <div>
                  <Label className="text-xs">المبلغ المدفوع</Label>
                  <Input type="number" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="h-8 text-sm" />
                </div>
              )}

              <Separator />

              {customerPendingDebt > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs">
                  <p className="text-red-600 font-medium">ديون سابقة للعميل:</p>
                  <p className="text-red-700 font-bold">{formatCurrency(customerPendingDebt)}</p>
                </div>
              )}

              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">الإجمالي</span><span>{formatCurrency(subtotal)}</span></div>
                {discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">الخصم</span><span className="text-green-600">- {formatCurrency(discount)}</span></div>}
                {customerPendingDebt > 0 && <div className="flex justify-between"><span className="text-muted-foreground">ديون سابقة</span><span className="text-red-500">+ {formatCurrency(customerPendingDebt)}</span></div>}
                <div className="flex justify-between font-bold text-base border-t pt-1">
                  <span>الإجمالي الكلي</span><span className="text-primary">{formatCurrency(totalWithDebt)}</span>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">المدفوع</span><span className="text-green-600">{formatCurrency(paymentType === "cash" ? totalWithDebt : parseFloat(paidAmount || "0"))}</span></div>
                {remaining > 0 && <div className="flex justify-between text-red-500"><span>المتبقي</span><span>{formatCurrency(remaining)}</span></div>}
              </div>

              <Button
                onClick={handleCheckout}
                disabled={cart.length === 0 || createSale.isPending}
                className="w-full"
              >
                {createSale.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Check className="w-4 h-4 ml-2" />}
                إتمام البيع
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Success Modal */}
      <Dialog open={!!successSale} onOpenChange={() => setSuccessSale(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              تم البيع بنجاح
            </DialogTitle>
          </DialogHeader>
          {successSale && (
            <div className="space-y-3">
              <div id="print-invoice" className="border rounded-lg p-4 text-sm">
                <div className="text-center mb-3">
                  <p className="font-bold text-lg">آل ياسين لاكسسوار الموتال</p>
                  <p className="text-xs text-muted-foreground">{new Date(successSale.createdAt).toLocaleString("ar-EG")}</p>
                  <p className="text-xs">فاتورة رقم: {successSale.invoiceNumber}</p>
                </div>
                {successSale.customerName && <p className="text-xs mb-2">العميل: {successSale.customerName}</p>}
                <div className="space-y-1 mb-3">
                  {successSale.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span>{item.productName} × {item.quantity}</span>
                      <span>{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2 space-y-1 text-xs">
                  <div className="flex justify-between font-bold"><span>الإجمالي</span><span>{formatCurrency(successSale.totalAmount)}</span></div>
                  {successSale.discountAmount > 0 && <div className="flex justify-between"><span>الخصم</span><span>- {formatCurrency(successSale.discountAmount)}</span></div>}
                  {successSale.previousDebt > 0 && <div className="flex justify-between"><span>ديون سابقة</span><span>{formatCurrency(successSale.previousDebt)}</span></div>}
                  <div className="flex justify-between"><span>المدفوع</span><span>{formatCurrency(successSale.paidAmount)}</span></div>
                  {successSale.remainingDebt > 0 && <div className="flex justify-between text-red-500 font-bold"><span>المتبقي</span><span>{formatCurrency(successSale.remainingDebt)}</span></div>}
                </div>
                <p className="text-center text-xs mt-3 text-muted-foreground">شكراً لتعاملكم معنا</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handlePrint}>
                  <Printer className="w-4 h-4 ml-2" />
                  طباعة
                </Button>
                <Button variant="outline" className="flex-1 text-green-600 border-green-300 hover:bg-green-50" onClick={() => handleWhatsApp(successSale)}>
                  <MessageCircle className="w-4 h-4 ml-2" />
                  واتساب
                </Button>
                <Button onClick={() => setSuccessSale(null)}>إغلاق</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

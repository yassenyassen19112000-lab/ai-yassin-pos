import { useState, useEffect, useRef } from "react";
import {
  useListProducts,
  useCreateSale,
  useGetCustomerDebts,
  getListSalesQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Minus, Printer, MessageCircle, Loader2, ShoppingCart, X, Check, User, AlertTriangle, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  sellingPrice: number;
  unit: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string | null;
}

export default function POS() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentType, setPaymentType] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [successSale, setSuccessSale] = useState<any>(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [addQty, setAddQty] = useState("1");
  const [productSearch, setProductSearch] = useState("");
  const [showProductDrop, setShowProductDrop] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);
  const productRef  = useRef<HTMLDivElement>(null);

  const { data: products } = useListProducts({});
  const { data: customerDebts } = useGetCustomerDebts(
    { customerName: customerName || "_none_" },
    { query: { enabled: customerName.length > 2 } }
  );
  const { data: customerSuggestions } = useQuery<Customer[]>({
    queryKey: ["customers", customerName],
    queryFn: () => apiClient(`/api/customers?search=${encodeURIComponent(customerName)}`),
    enabled: customerName.length >= 1,
  });

  const lowStockProducts = (products ?? []).filter(p => p.isLowStock && p.quantity > 0);

  const customerPendingDebt = (customerDebts ?? []).reduce(
    (sum, d) => sum + d.remainingAmount, 0
  );

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.sellingPrice, 0);
  const discount = parseFloat(discountAmount || "0");
  const totalAmount = subtotal - discount;
  const totalWithDebt = totalAmount + customerPendingDebt;
  const paid = paymentType === "cash" ? totalWithDebt : parseFloat(paidAmount || "0");
  const remaining = Math.max(0, totalWithDebt - paid);

  // Filtered products for search dropdown
  const filteredProducts = (products ?? []).filter(p =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const createSale = useCreateSale({
    mutation: {
      onSuccess: (data) => {
        setSuccessSale(data);
        qc.invalidateQueries({ queryKey: getListSalesQueryKey() });
        qc.invalidateQueries({ queryKey: ["customers"] });
        setCart([]);
        setCustomerName("");
        setCustomerPhone("");
        setPaymentType("cash");
        setPaidAmount("");
        setDiscountAmount("0");
        setNotes("");
        setProductSearch("");
        toast({ title: "تم إنشاء الفاتورة بنجاح" });
        const phone = data.customerPhone?.replace(/[^0-9]/g, "") || "";
        if (phone) {
          window.open(`https://wa.me/2${phone}?text=${encodeURIComponent(buildWhatsAppText(data))}`, "_blank");
        }
      },
      onError: () => toast({ title: "خطأ في إنشاء الفاتورة", variant: "destructive" }),
    },
  });

  const buildWhatsAppText = (sale: any) =>
    `فاتورة من محل آل ياسين لاكسسوار الموتال\n` +
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

  const addProductToCart = (product: (typeof products)[0]) => {
    const qty = parseInt(addQty) || 1;
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + qty } : i);
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: qty,
        sellingPrice: product.sellingPrice,
        unit: product.unit,
      }];
    });
    setProductSearch("");
    setShowProductDrop(false);
    setAddQty("1");
  };

  const updateQty = (productId: number, qty: number) => {
    if (qty <= 0) setCart(prev => prev.filter(i => i.productId !== productId));
    else setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i));
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
        items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, sellingPrice: i.sellingPrice })),
      },
    });
  };

  const selectCustomer = (customer: Customer) => {
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || "");
    setShowCustomerSuggestions(false);
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) {
        setShowCustomerSuggestions(false);
      }
      if (productRef.current && !productRef.current.contains(e.target as Node)) {
        setShowProductDrop(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-2xl font-bold">نقطة البيع</h1>

      {/* Low stock warning */}
      {lowStockProducts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex flex-wrap gap-2 items-center">
          <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
          <span className="text-orange-700 text-sm font-medium">مخزون منخفض:</span>
          {lowStockProducts.map(p => (
            <span key={p.id} className="text-xs bg-orange-100 border border-orange-300 text-orange-700 px-2 py-0.5 rounded-full">
              {p.name} ({p.quantity} {p.unit})
            </span>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Product selector + cart */}
        <div className="lg:col-span-2 space-y-3">
          {/* Product search combobox */}
          <Card>
            <CardContent className="pt-4">
              <Label className="text-sm font-medium mb-2 block">ابحث عن منتج</Label>
              <div className="flex gap-2">
                <div className="flex-1 relative" ref={productRef}>
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={productSearch}
                    onChange={e => { setProductSearch(e.target.value); setShowProductDrop(true); }}
                    onFocus={() => setShowProductDrop(true)}
                    placeholder="اكتب اسم المنتج للبحث..."
                    className="pr-9"
                  />
                  {showProductDrop && (
                    <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                      {filteredProducts.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-4">لا توجد منتجات مطابقة</p>
                      ) : (
                        filteredProducts.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            disabled={p.quantity === 0}
                            onMouseDown={() => addProductToCart(p)}
                            className={`w-full text-right px-3 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 border-b last:border-0 ${
                              p.quantity === 0 ? "opacity-40 cursor-not-allowed bg-gray-50" : "hover:bg-muted cursor-pointer"
                            }`}
                          >
                            <span className={`font-medium ${p.quantity === 0 ? "line-through text-muted-foreground" : ""}`}>
                              {p.name}
                            </span>
                            <div className="flex items-center gap-3 shrink-0 text-xs">
                              <span className="text-primary font-bold">{formatCurrency(p.sellingPrice)}</span>
                              <span className={p.quantity === 0 ? "text-red-500" : p.isLowStock ? "text-orange-500" : "text-muted-foreground"}>
                                {p.quantity === 0 ? "نفد" : `${p.quantity} ${p.unit}`}
                                {p.isLowStock && p.quantity > 0 ? " ⚠️" : ""}
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <Input
                  type="number"
                  min="1"
                  value={addQty}
                  onChange={e => setAddQty(e.target.value)}
                  className="w-20"
                  placeholder="كمية"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                اكتب لتصفية المنتجات واضغط على المنتج لإضافته للسلة
              </p>
            </CardContent>
          </Card>

          {/* Cart items */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                السلة ({cart.reduce((s, i) => s + i.quantity, 0)} قطعة)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-6">السلة فارغة — ابحث عن منتج وأضفه</p>
              ) : (
                <div className="space-y-1">
                  {cart.map(item => (
                    <div key={item.productId} className="flex items-center gap-2 py-2 border-b last:border-0">
                      <button onClick={() => setCart(p => p.filter(i => i.productId !== item.productId))} className="text-muted-foreground hover:text-destructive shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(item.sellingPrice)} / {item.unit}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted">
                          <Minus className="w-3 h-3" />
                        </button>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => updateQty(item.productId, parseInt(e.target.value) || 1)}
                          className="w-14 h-6 text-center text-sm p-0"
                        />
                        <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-sm font-bold w-20 text-left shrink-0">{formatCurrency(item.quantity * item.sellingPrice)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Checkout panel */}
        <div className="space-y-3">
          <Card>
            <CardContent className="pt-4 space-y-3">
              {/* Customer with autocomplete */}
              <div ref={customerRef} className="relative">
                <Label className="text-xs flex items-center gap-1 mb-1">
                  <User className="w-3 h-3" />
                  اسم العميل
                </Label>
                <Input
                  value={customerName}
                  onChange={e => { setCustomerName(e.target.value); setShowCustomerSuggestions(true); }}
                  onFocus={() => setShowCustomerSuggestions(true)}
                  placeholder="اكتب أو اختر عميل..."
                  className="h-8 text-sm"
                />
                {showCustomerSuggestions && customerName.length >= 1 && (customerSuggestions ?? []).length > 0 && (
                  <div className="absolute z-50 w-full bg-popover border border-border rounded-md shadow-lg mt-1 max-h-40 overflow-y-auto">
                    {(customerSuggestions ?? []).map(c => (
                      <button
                        key={c.id}
                        className="w-full text-right px-3 py-2 text-sm hover:bg-muted flex items-center justify-between gap-2"
                        onMouseDown={() => selectCustomer(c)}
                      >
                        <span className="font-medium">{c.name}</span>
                        {c.phone && <span className="text-xs text-muted-foreground" dir="ltr">{c.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs">رقم الهاتف</Label>
                <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="01XXXXXXXXX" className="h-8 text-sm" dir="ltr" />
              </div>

              <div>
                <Label className="text-xs">الخصم (ج.م)</Label>
                <Input type="number" step="0.01" min="0" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} className="h-8 text-sm" />
              </div>

              <div>
                <Label className="text-xs">طريقة الدفع</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
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
                  <Input type="number" step="0.01" min="0" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} className="h-8 text-sm" />
                </div>
              )}

              <div>
                <Label className="text-xs">ملاحظات</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="اختياري" className="h-8 text-sm" />
              </div>

              <Separator />

              {customerPendingDebt > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs">
                  <p className="text-red-600 font-medium">ديون سابقة للعميل:</p>
                  <p className="text-red-700 font-bold text-sm">{formatCurrency(customerPendingDebt)}</p>
                </div>
              )}

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">الإجمالي</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
                {discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">الخصم</span><span className="text-green-600">- {formatCurrency(discount)}</span></div>}
                {customerPendingDebt > 0 && <div className="flex justify-between"><span className="text-muted-foreground">ديون سابقة</span><span className="text-red-500">+ {formatCurrency(customerPendingDebt)}</span></div>}
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>الإجمالي الكلي</span>
                  <span className="text-primary">{formatCurrency(totalWithDebt)}</span>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">المدفوع</span><span className="text-green-600 font-medium">{formatCurrency(paid)}</span></div>
                {remaining > 0 && <div className="flex justify-between text-red-500 font-bold"><span>المتبقي</span><span>{formatCurrency(remaining)}</span></div>}
              </div>

              <Button onClick={handleCheckout} disabled={cart.length === 0 || createSale.isPending} className="w-full h-11 text-base">
                {createSale.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Check className="w-4 h-4 ml-2" />}
                إتمام البيع
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Success Modal */}
      <Dialog open={!!successSale} onOpenChange={() => setSuccessSale(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              تم البيع بنجاح
            </DialogTitle>
          </DialogHeader>
          {successSale && (
            <div className="space-y-3">
              <div id="print-invoice" className="border rounded-lg p-5 bg-white text-gray-900">
                <div className="text-center mb-4 pb-3 border-b-2 border-gray-400">
                  <p className="font-bold text-xl text-gray-900">آل ياسين لاكسسوار الموتال</p>
                  <p className="text-sm text-gray-600 mt-1">{new Date(successSale.createdAt).toLocaleString("ar-EG")}</p>
                  <p className="text-sm font-mono mt-1 text-gray-800">فاتورة رقم: {successSale.invoiceNumber}</p>
                </div>
                {successSale.customerName && (
                  <div className="mb-3 pb-2 border-b border-gray-300">
                    <p className="font-semibold text-gray-900">العميل: {successSale.customerName}</p>
                    {successSale.customerPhone && <p className="text-sm text-gray-600" dir="ltr">{successSale.customerPhone}</p>}
                  </div>
                )}
                <div className="space-y-2 mb-4">
                  <div className="grid grid-cols-3 text-xs font-bold text-gray-700 border-b border-gray-300 pb-1">
                    <span>المنتج</span>
                    <span className="text-center">الكمية</span>
                    <span className="text-left">الإجمالي</span>
                  </div>
                  {successSale.items.map((item: any) => (
                    <div key={item.id} className="grid grid-cols-3 text-sm text-gray-900">
                      <span className="truncate">{item.productName}</span>
                      <span className="text-center">{item.quantity}</span>
                      <span className="text-left font-medium">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t-2 border-gray-400 pt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between font-bold text-base text-gray-900"><span>الإجمالي</span><span>{formatCurrency(successSale.totalAmount)}</span></div>
                  {successSale.discountAmount > 0 && <div className="flex justify-between text-gray-700"><span>الخصم</span><span>- {formatCurrency(successSale.discountAmount)}</span></div>}
                  {successSale.previousDebt > 0 && <div className="flex justify-between text-gray-800"><span>ديون سابقة</span><span>{formatCurrency(successSale.previousDebt)}</span></div>}
                  <div className="flex justify-between font-semibold text-gray-900"><span>المدفوع</span><span>{formatCurrency(successSale.paidAmount)}</span></div>
                  {successSale.remainingDebt > 0 && <div className="flex justify-between font-bold text-base text-gray-900 border-t border-gray-300 pt-1"><span>المتبقي (دين)</span><span>{formatCurrency(successSale.remainingDebt)}</span></div>}
                </div>
                <p className="text-center text-sm mt-4 text-gray-600 border-t border-gray-300 pt-3">شكراً لتعاملكم معنا</p>
              </div>
              {successSale.customerPhone && (
                <p className="text-xs text-green-600 text-center bg-green-50 py-1.5 rounded">✓ تم فتح واتساب تلقائياً</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 ml-2" />
                  طباعة
                </Button>
                <Button variant="outline" className="flex-1 text-green-600 border-green-300 hover:bg-green-50"
                  onClick={() => {
                    const text = buildWhatsAppText(successSale);
                    const phone = successSale.customerPhone?.replace(/[^0-9]/g, "") || "";
                    window.open(phone ? `https://wa.me/2${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                  }}>
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

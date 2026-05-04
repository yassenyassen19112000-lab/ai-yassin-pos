import { useState, useRef, useEffect } from "react";
import {
  useListPurchases,
  useCreatePurchase,
  useListSuppliers,
  useListProducts,
  getListPurchasesQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDateTime, paymentTypeLabel } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Plus, Loader2, Trash2, Receipt, Search, Minus, RotateCcw, PackagePlus, Banknote, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PurchaseItem {
  productId?: number;
  productName: string;
  quantity: number;
  costPrice: number;
  isNew?: boolean;
}
interface ReturnItem { productId: number; productName: string; qty: number; maxQty: number; costPrice: number; }
interface AddItem    { productId: number; productName: string; quantity: number; costPrice: number; }

// ── Inline product combobox ────────────────────────────────────────────────
function ProductCombobox({
  products,
  value,
  onSelect,
  placeholder = "اكتب اسم المنتج...",
}: {
  products: any[];
  value: string;
  onSelect: (product: { id?: number; name: string; costPrice: number; isNew: boolean }) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = products.filter(p =>
    !value || p.name.toLowerCase().includes(value.toLowerCase())
  );
  const exactMatch = products.find(p => p.name.toLowerCase() === value.toLowerCase());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative flex-1" ref={ref}>
      <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={e => {
          onSelect({ id: undefined, name: e.target.value, costPrice: 0, isNew: true });
          setShow(true);
        }}
        onFocus={() => setShow(true)}
        placeholder={placeholder}
        className="pr-9"
      />
      {show && (
        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => {
                onSelect({ id: p.id, name: p.name, costPrice: p.costPrice, isNew: false });
                setShow(false);
              }}
              className="w-full text-right px-3 py-2 hover:bg-muted text-sm flex items-center justify-between border-b last:border-0"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-primary text-xs font-bold">{formatCurrency(p.costPrice)}</span>
            </button>
          ))}
          {value && !exactMatch && (
            <button
              type="button"
              onMouseDown={() => {
                onSelect({ id: undefined, name: value, costPrice: 0, isNew: true });
                setShow(false);
              }}
              className="w-full text-right px-3 py-2 hover:bg-blue-50 text-sm text-blue-600 border-t flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>إنشاء منتج جديد: "<strong>{value}</strong>"</span>
            </button>
          )}
          {filtered.length === 0 && !value && (
            <p className="text-center text-sm text-muted-foreground py-4">لا توجد منتجات</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Purchases() {
  // ── new purchase form ─────────────────────────────────────────────────────
  const [showForm, setShowForm]               = useState(false);
  const [supplierId, setSupplierId]           = useState("");
  const [supplierInput, setSupplierInput]     = useState("");
  const [showSupplierDrop, setShowSupplierDrop] = useState(false);
  const [invoiceNumber, setInvoiceNumber]     = useState("");
  const [paymentType, setPaymentType]         = useState("cash");
  const [paidAmount, setPaidAmount]           = useState("0");
  const [notes, setNotes]                     = useState("");
  const [items, setItems]                     = useState<PurchaseItem[]>([]);

  // product combobox state for new-purchase form
  const [itemProductName, setItemProductName] = useState("");
  const [itemProductId, setItemProductId]     = useState<number | undefined>(undefined);
  const [itemIsNew, setItemIsNew]             = useState(false);
  const [itemQty, setItemQty]                 = useState("1");
  const [itemPrice, setItemPrice]             = useState("");

  const [includeExistingDebt, setIncludeExistingDebt] = useState(false);
  const [search, setSearch]                   = useState("");
  const supplierInputRef = useRef<HTMLDivElement>(null);

  // ── invoice detail dialog ─────────────────────────────────────────────────
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(null);

  // ── return dialog ─────────────────────────────────────────────────────────
  const [returnPurchaseId, setReturnPurchaseId] = useState<number | null>(null);
  const [returnItems, setReturnItems]           = useState<ReturnItem[]>([]);
  const [returnReason, setReturnReason]         = useState("");
  const [returnSuccess, setReturnSuccess]       = useState<any>(null);

  // ── payment dialog ────────────────────────────────────────────────────────
  const [paymentPurchaseId, setPaymentPurchaseId]   = useState<number | null>(null);
  const [paymentPurchaseData, setPaymentPurchaseData] = useState<any>(null);
  const [paymentAmount, setPaymentAmount]           = useState("");

  // ── add-items dialog ──────────────────────────────────────────────────────
  const [addItemsPurchaseId, setAddItemsPurchaseId] = useState<number | null>(null);
  const [addItemsList, setAddItemsList]             = useState<AddItem[]>([]);
  const [addNewProductName, setAddNewProductName]   = useState("");
  const [addNewProductId, setAddNewProductId]       = useState<number | undefined>(undefined);
  const [addNewQty, setAddNewQty]                   = useState("1");
  const [addNewPrice, setAddNewPrice]               = useState("");

  const { toast } = useToast();
  const qc = useQueryClient();

  // ── queries ───────────────────────────────────────────────────────────────
  const { data: purchases, isLoading } = useListPurchases({});
  const { data: suppliers }            = useListSuppliers();
  const { data: products }             = useListProducts({});

  const { data: supplierPendingDebt } = useQuery<{ pendingDebt: number; debtIds: number[] }>({
    queryKey: ["supplier-pending-debt", supplierId],
    queryFn:  () => apiClient(`/api/suppliers/${supplierId}/pending-debt`),
    enabled:  !!supplierId && supplierId !== "0",
  });

  const { data: purchaseDetail } = useQuery<any>({
    queryKey: ["purchase-detail", selectedPurchaseId],
    queryFn:  () => apiClient(`/api/purchases/${selectedPurchaseId}`),
    enabled:  !!selectedPurchaseId,
  });
  const { data: purchaseReturns } = useQuery<any[]>({
    queryKey: ["purchase-returns", selectedPurchaseId],
    queryFn:  () => apiClient(`/api/purchases/${selectedPurchaseId}/returns`),
    enabled:  !!selectedPurchaseId,
  });
  const { data: returnPurchaseReturns } = useQuery<any[]>({
    queryKey: ["purchase-returns", returnPurchaseId],
    queryFn:  () => apiClient(`/api/purchases/${returnPurchaseId}/returns`),
    enabled:  !!returnPurchaseId,
  });
  const { data: returnPurchaseDetail } = useQuery<any>({
    queryKey: ["purchase-detail", returnPurchaseId],
    queryFn:  () => apiClient(`/api/purchases/${returnPurchaseId}`),
    enabled:  !!returnPurchaseId,
  });

  // ── mutations ─────────────────────────────────────────────────────────────
  const createMutation = useCreatePurchase({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListPurchasesQueryKey() });
        qc.invalidateQueries({ queryKey: ["products"] });
        resetForm();
        toast({ title: "تم تسجيل المشترى" });
      },
      onError: () => toast({ title: "خطأ في التسجيل", variant: "destructive" }),
    },
  });

  const returnMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiClient(`/api/purchases/${id}/return`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (data: any) => {
      setReturnSuccess(data);
      qc.invalidateQueries({ queryKey: getListPurchasesQueryKey() });
      qc.invalidateQueries({ queryKey: ["purchase-returns", returnPurchaseId] });
      qc.invalidateQueries({ queryKey: ["purchase-detail", returnPurchaseId] });
      toast({ title: `تم تسجيل المرتجع: ${formatCurrency(data.returnAmount)}` });
    },
    onError: (err: any) => toast({ title: err?.message || "خطأ في المرتجع", variant: "destructive" }),
  });

  const addItemsMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiClient(`/api/purchases/${id}/add-items`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListPurchasesQueryKey() });
      qc.invalidateQueries({ queryKey: ["purchase-detail", addItemsPurchaseId] });
      qc.invalidateQueries({ queryKey: ["purchase-detail", selectedPurchaseId] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setAddItemsPurchaseId(null);
      setAddItemsList([]);
      toast({ title: "تم إضافة المنتجات للفاتورة" });
    },
    onError: () => toast({ title: "خطأ في إضافة المنتجات", variant: "destructive" }),
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      apiClient(`/api/purchases/${id}/payment`, { method: "POST", body: JSON.stringify({ amount }) }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: getListPurchasesQueryKey() });
      qc.invalidateQueries({ queryKey: ["purchase-detail", paymentPurchaseId] });
      qc.invalidateQueries({ queryKey: ["debts"] });
      setPaymentPurchaseData(data);
      setPaymentAmount("");
      toast({ title: "تم تسجيل الدفعة بنجاح" });
    },
    onError: () => toast({ title: "خطأ في تسجيل الدفعة", variant: "destructive" }),
  });

  // ── close supplier dropdown on outside click ──────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (supplierInputRef.current && !supplierInputRef.current.contains(e.target as Node)) {
        setShowSupplierDrop(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── helpers ───────────────────────────────────────────────────────────────
  const addItem = () => {
    if (!itemProductName.trim() || !itemQty || !itemPrice) return;
    setItems(prev => [...prev, {
      productId: itemProductId,
      productName: itemProductName,
      quantity: parseInt(itemQty),
      costPrice: parseFloat(itemPrice),
      isNew: itemIsNew,
    }]);
    setItemProductName(""); setItemProductId(undefined); setItemIsNew(false);
    setItemQty("1"); setItemPrice("");
  };

  const resetForm = () => {
    setShowForm(false);
    setSupplierId(""); setSupplierInput(""); setInvoiceNumber("");
    setPaymentType("cash"); setPaidAmount("0"); setNotes(""); setItems([]);
    setItemProductName(""); setItemProductId(undefined); setItemIsNew(false);
    setItemQty("1"); setItemPrice("");
    setIncludeExistingDebt(false);
  };

  const openReturn = (purchase: any) => {
    setReturnItems([]);
    setReturnReason("");
    setReturnSuccess(null);
    setReturnPurchaseId(purchase.id);
  };

  const initReturnItems = (purchase: any) => {
    const alreadyRet: Record<number, number> = {};
    for (const ret of (returnPurchaseReturns ?? [])) {
      for (const ri of (Array.isArray(ret.items) ? ret.items : [])) {
        alreadyRet[ri.productId] = (alreadyRet[ri.productId] ?? 0) + ri.quantity;
      }
    }
    setReturnItems(
      purchase.items
        .map((i: any) => ({
          productId: i.productId, productName: i.productName,
          qty: 0, maxQty: Math.max(0, i.quantity - (alreadyRet[i.productId] ?? 0)),
          costPrice: i.costPrice,
        }))
        .filter((i: any) => i.maxQty > 0)
    );
  };

  const updateReturnQty = (idx: number, delta: number) => {
    setReturnItems(prev => prev.map((item, i) =>
      i !== idx ? item : { ...item, qty: Math.min(item.maxQty, Math.max(0, item.qty + delta)) }
    ));
  };

  const submitReturn = () => {
    const selected = returnItems.filter(i => i.qty > 0);
    if (!selected.length || !returnPurchaseId) return;
    returnMutation.mutate({
      id: returnPurchaseId,
      data: {
        items: selected.map(i => ({ productId: i.productId, productName: i.productName, quantity: i.qty })),
        reason: returnReason || undefined,
      },
    });
  };

  // ── computed ──────────────────────────────────────────────────────────────
  const filteredPurchases = (purchases ?? []).filter(p =>
    !search || p.supplierName.toLowerCase().includes(search.toLowerCase()) || (p.invoiceNumber ?? "").includes(search)
  );
  const itemsTotal   = items.reduce((s, i) => s + i.quantity * i.costPrice, 0);
  const previousDebt = (includeExistingDebt && supplierPendingDebt) ? supplierPendingDebt.pendingDebt : 0;
  const grandTotal   = itemsTotal + previousDebt;
  const returnTotal  = returnItems.reduce((s, i) => s + i.qty * i.costPrice, 0);
  const totalReturned = (purchaseReturns ?? []).reduce((s: number, r: any) => s + parseFloat(r.return_amount ?? 0), 0);
  const filteredSuppliers = (suppliers ?? []).filter(s =>
    !supplierInput || s.name.toLowerCase().includes(supplierInput.toLowerCase())
  );
  const addTotal = addItemsList.reduce((s, i) => s + i.quantity * i.costPrice, 0);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">المشتريات</h1>
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 ml-1" />تسجيل مشترى</Button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="بحث باسم المورد أو رقم الفاتورة..." value={search}
          onChange={e => setSearch(e.target.value)} className="pr-9" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
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
              {filteredPurchases.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedPurchaseId(p.id)}>
                  <TableCell className="font-medium">{p.supplierName}</TableCell>
                  <TableCell>{p.invoiceNumber ?? "-"}</TableCell>
                  <TableCell>{formatCurrency(p.totalAmount)}</TableCell>
                  <TableCell className="text-green-600">{formatCurrency(p.paidAmount)}</TableCell>
                  <TableCell className={
                    p.remainingAmount > 0.005 ? "text-red-500 font-bold" :
                    p.remainingAmount < -0.005 ? "text-blue-600 font-bold" : ""
                  }>
                    {p.remainingAmount > 0.005 ? `+ ${formatCurrency(p.remainingAmount)}` :
                     p.remainingAmount < -0.005 ? `- ${formatCurrency(Math.abs(p.remainingAmount))}` :
                     "✓ مسوَّى"}
                  </TableCell>
                  <TableCell><Badge variant="outline">{paymentTypeLabel(p.paymentType)}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDateTime(p.createdAt)}</TableCell>
                </TableRow>
              ))}
              {filteredPurchases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    {search ? "لا توجد نتائج للبحث" : "لا توجد مشتريات"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          INVOICE DETAIL DIALOG
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!selectedPurchaseId} onOpenChange={() => setSelectedPurchaseId(null)}>
        <DialogContent dir="rtl" className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>تفاصيل فاتورة الشراء</DialogTitle></DialogHeader>
          {purchaseDetail && (
            <div className="space-y-3">
              <div className="border rounded-lg p-4 bg-white text-gray-900 text-sm space-y-3">
                <div className="text-center pb-3 border-b">
                  <p className="font-bold text-base">فاتورة شراء — {purchaseDetail.supplierName}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(purchaseDetail.createdAt)}</p>
                  {purchaseDetail.invoiceNumber && (
                    <p className="text-xs font-mono mt-0.5">رقم: {purchaseDetail.invoiceNumber}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="grid grid-cols-3 text-xs font-bold text-gray-600 border-b pb-1">
                    <span>المنتج</span><span className="text-center">الكمية</span><span className="text-left">الإجمالي</span>
                  </div>
                  {purchaseDetail.items.map((item: any) => (
                    <div key={item.id} className="grid grid-cols-3 text-sm">
                      <span className="truncate">{item.productName}</span>
                      <span className="text-center">{item.quantity}</span>
                      <span className="text-left font-medium">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t-2 border-gray-300 pt-2 space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>إجمالي البضاعة</span>
                    <span>{formatCurrency(purchaseDetail.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-green-700 font-semibold">
                    <span>المدفوع للمورد</span>
                    <span>{formatCurrency(purchaseDetail.paidAmount)}</span>
                  </div>
                  {(() => {
                    const net = parseFloat(purchaseDetail.remainingAmount ?? 0);
                    if (net > 0.005) return (
                      <div className="flex justify-between font-bold text-red-700 border-t border-gray-200 pt-1">
                        <span>متبقي علينا للمورد</span><span>+ {formatCurrency(net)}</span>
                      </div>
                    );
                    if (net < -0.005) return (
                      <div className="flex justify-between font-bold text-blue-700 border-t border-gray-200 pt-1">
                        <span>💵 مسترد من المورد</span><span>- {formatCurrency(Math.abs(net))}</span>
                      </div>
                    );
                    return (
                      <div className="flex justify-between text-green-600 border-t border-gray-200 pt-1">
                        <span>✓ الحساب مسوَّى</span><span>{formatCurrency(0)}</span>
                      </div>
                    );
                  })()}
                </div>

                {purchaseReturns && purchaseReturns.length > 0 && (() => {
                  const netOwed = purchaseDetail.totalAmount - totalReturned;
                  const balance = netOwed - purchaseDetail.paidAmount;
                  const refundDue  = balance < -0.005 ? Math.abs(balance) : 0;
                  const stillOwed  = balance > 0.005 ? balance : 0;
                  return (
                    <div className="mt-2 pt-3 border-t-2 border-orange-300">
                      <p className="text-xs font-bold text-orange-700 mb-2 flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" /> مرتجعات هذه الفاتورة
                      </p>
                      <div className="space-y-1.5">
                        {purchaseReturns.map((ret: any, idx: number) => (
                          <div key={idx} className="bg-orange-50 rounded p-2 text-xs">
                            <div className="flex justify-between font-semibold text-orange-800 mb-1">
                              <span>{ret.return_number}</span>
                              <span>- {formatCurrency(parseFloat(ret.return_amount))}</span>
                            </div>
                            {Array.isArray(ret.items) && ret.items.map((ri: any, i: number) => (
                              <div key={i} className="flex justify-between text-orange-600 pr-2">
                                <span>{ri.productName} × {ri.quantity}</span><span>{formatCurrency(ri.total)}</span>
                              </div>
                            ))}
                            {ret.reason && <p className="text-orange-500 mt-1">السبب: {ret.reason}</p>}
                          </div>
                        ))}
                        <div className="border border-orange-200 rounded-lg overflow-hidden text-xs mt-1">
                          <div className="flex justify-between px-3 py-1.5 bg-gray-50">
                            <span>الإجمالي قبل المرتجع</span><span className="font-semibold">{formatCurrency(purchaseDetail.totalAmount)}</span>
                          </div>
                          <div className="flex justify-between px-3 py-1.5 bg-orange-50 text-orange-700 border-t border-orange-100">
                            <span>إجمالي المرتجعات</span><span className="font-semibold">- {formatCurrency(totalReturned)}</span>
                          </div>
                          <div className="flex justify-between px-3 py-1.5 bg-green-50 text-green-700 border-t border-orange-100">
                            <span>المدفوع للمورد</span><span className="font-semibold">{formatCurrency(purchaseDetail.paidAmount)}</span>
                          </div>
                          {refundDue > 0 ? (
                            <div className="flex justify-between font-bold text-blue-700 bg-blue-50 px-3 py-2 border-t border-blue-200">
                              <span>💵 مسترد من المورد</span><span>{formatCurrency(refundDue)}</span>
                            </div>
                          ) : stillOwed > 0 ? (
                            <div className="flex justify-between font-bold text-red-700 bg-red-50 px-3 py-2 border-t border-red-200">
                              <span>باقي علينا للمورد</span><span>+ {formatCurrency(stillOwed)}</span>
                            </div>
                          ) : (
                            <div className="flex justify-between font-bold text-green-700 bg-green-50 px-3 py-2 border-t border-green-200">
                              <span>✓ الحساب مسوَّى تماماً</span><span>{formatCurrency(0)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {purchaseDetail.notes && (
                  <p className="text-xs text-gray-500 border-t pt-2">ملاحظات: {purchaseDetail.notes}</p>
                )}
              </div>

              {/* Pay button — shown when there's remaining balance to supplier */}
              {purchaseDetail.remainingAmount > 0.005 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-orange-600">متبقي للمورد</p>
                    <p className="text-orange-700 font-bold text-lg">{formatCurrency(purchaseDetail.remainingAmount)}</p>
                  </div>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => { setPaymentPurchaseId(purchaseDetail.id); setPaymentPurchaseData(null); setPaymentAmount(""); }}
                  >
                    <Banknote className="w-4 h-4 ml-2" />
                    تسجيل دفعة
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedPurchaseId(null)}>
                  إغلاق
                </Button>
                <Button variant="outline" className="text-blue-500 border-blue-200"
                  onClick={() => { setSelectedPurchaseId(null); setAddItemsPurchaseId(purchaseDetail.id); }}>
                  <PackagePlus className="w-4 h-4 ml-1" />إضافة منتجات
                </Button>
                <Button variant="outline" className="text-orange-500 border-orange-200"
                  onClick={() => { setSelectedPurchaseId(null); openReturn(purchaseDetail); }}>
                  <RotateCcw className="w-4 h-4 ml-1" />مرتجع
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          PAYMENT DIALOG
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!paymentPurchaseId} onOpenChange={(open) => { if (!open) { setPaymentPurchaseId(null); setPaymentPurchaseData(null); setPaymentAmount(""); } }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-green-600" />
              تسجيل دفعة للمورد
            </DialogTitle>
          </DialogHeader>

          {paymentPurchaseData ? (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <Check className="w-10 h-10 text-green-500 mx-auto mb-2" />
                <p className="font-bold text-green-700">تم تسجيل الدفعة بنجاح</p>
              </div>
              <div className="border rounded-lg divide-y text-sm">
                <div className="flex justify-between px-3 py-2 text-muted-foreground">
                  <span>إجمالي المدفوع للمورد</span>
                  <span className="text-green-600 font-semibold">{formatCurrency(paymentPurchaseData.paidAmount)}</span>
                </div>
                {paymentPurchaseData.remainingAmount > 0.005 ? (
                  <div className="flex justify-between px-3 py-2.5 font-bold text-orange-700 bg-orange-50 rounded-b-lg">
                    <span>المتبقي للمورد</span>
                    <span>+ {formatCurrency(paymentPurchaseData.remainingAmount)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between px-3 py-2.5 font-bold text-green-700 bg-green-50 rounded-b-lg">
                    <span>✓ الحساب مسوَّى تماماً</span>
                    <span>{formatCurrency(0)}</span>
                  </div>
                )}
              </div>
              <Button className="w-full" onClick={() => { setPaymentPurchaseId(null); setPaymentPurchaseData(null); }}>إغلاق</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                const purchase = (purchases ?? []).find(p => p.id === paymentPurchaseId);
                return purchase ? (
                  <div className="bg-muted rounded-lg p-3 text-sm">
                    <p className="font-medium">{purchase.supplierName}</p>
                    {purchase.invoiceNumber && <p className="text-xs text-muted-foreground">{purchase.invoiceNumber}</p>}
                    <p className="text-orange-600 font-bold mt-0.5">المتبقي للمورد: {formatCurrency(purchase.remainingAmount)}</p>
                  </div>
                ) : null;
              })()}

              <div>
                <Label>المبلغ المدفوع (ج.م) *</Label>
                <Input
                  type="number" step="0.01" min="0.01"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 text-lg font-bold"
                  autoFocus
                />
              </div>

              {paymentAmount && parseFloat(paymentAmount) > 0 && (() => {
                const purchase = (purchases ?? []).find(p => p.id === paymentPurchaseId);
                if (!purchase) return null;
                const remaining = Math.max(0, purchase.remainingAmount - parseFloat(paymentAmount));
                return (
                  <div className={`rounded-lg p-3 text-sm border-2 ${remaining <= 0 ? "bg-green-50 border-green-300" : "bg-blue-50 border-blue-300"}`}>
                    <p className={`font-bold ${remaining <= 0 ? "text-green-700" : "text-blue-700"}`}>
                      {remaining <= 0 ? "✓ سيُسوَّى حساب المورد كاملاً" : `المتبقي للمورد بعد الدفعة: ${formatCurrency(remaining)}`}
                    </p>
                  </div>
                );
              })()}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setPaymentPurchaseId(null); setPaymentAmount(""); }}>إلغاء</Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || paymentMutation.isPending}
                  onClick={() => {
                    if (!paymentPurchaseId || !paymentAmount) return;
                    paymentMutation.mutate({ id: paymentPurchaseId, amount: parseFloat(paymentAmount) });
                  }}
                >
                  {paymentMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  تسجيل الدفعة
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          ADD ITEMS DIALOG
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!addItemsPurchaseId}
        onOpenChange={(open) => { if (!open) { setAddItemsPurchaseId(null); setAddItemsList([]); } }}>
        <DialogContent dir="rtl" className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-blue-500" />
              إضافة منتجات لفاتورة موجودة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">المنتج</Label>
                <ProductCombobox
                  products={products ?? []}
                  value={addNewProductName}
                  onSelect={({ id, name, costPrice, isNew }) => {
                    setAddNewProductId(id);
                    setAddNewProductName(name);
                    if (!isNew && costPrice) setAddNewPrice(costPrice.toString());
                  }}
                />
              </div>
              <div className="w-16 space-y-1">
                <Label className="text-xs">كمية</Label>
                <Input type="number" value={addNewQty} onChange={e => setAddNewQty(e.target.value)} />
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs">سعر التكلفة</Label>
                <Input type="number" step="0.01" value={addNewPrice} onChange={e => setAddNewPrice(e.target.value)} />
              </div>
              <Button type="button" onClick={() => {
                if (!addNewProductName.trim() || !addNewQty || !addNewPrice) return;
                const pid = addNewProductId ?? 0;
                setAddItemsList(prev => [...prev, {
                  productId: pid,
                  productName: addNewProductName,
                  quantity: parseInt(addNewQty),
                  costPrice: parseFloat(addNewPrice),
                }]);
                setAddNewProductName(""); setAddNewProductId(undefined);
                setAddNewQty("1"); setAddNewPrice("");
              }}><Plus className="w-4 h-4" /></Button>
            </div>

            {addItemsList.length > 0 && (
              <div className="space-y-1">
                {addItemsList.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted rounded px-3 py-1.5 text-sm">
                    <span className="flex-1 truncate">{item.productName}</span>
                    <span className="mx-2 text-xs text-muted-foreground">{item.quantity} × {formatCurrency(item.costPrice)} = {formatCurrency(item.quantity * item.costPrice)}</span>
                    <button onClick={() => setAddItemsList(prev => prev.filter((_, j) => j !== i))} className="text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-sm px-1 pt-1 border-t">
                  <span>الإضافة الكلية</span>
                  <span className="text-blue-600">{formatCurrency(addTotal)}</span>
                </div>
              </div>
            )}

            <Separator />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setAddItemsPurchaseId(null); setAddItemsList([]); }}>إلغاء</Button>
              <Button className="flex-1 bg-blue-500 hover:bg-blue-600"
                disabled={!addItemsList.length || addItemsMutation.isPending}
                onClick={() => {
                  if (!addItemsPurchaseId) return;
                  addItemsMutation.mutate({
                    id: addItemsPurchaseId,
                    data: { items: addItemsList.map(i => ({ productId: i.productId, quantity: i.quantity, costPrice: i.costPrice })) },
                  });
                }}>
                {addItemsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                إضافة للفاتورة ({formatCurrency(addTotal)})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          RETURN DIALOG
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!returnPurchaseId}
        onOpenChange={(open) => { if (!open) { setReturnPurchaseId(null); setReturnItems([]); setReturnSuccess(null); } }}>
        <DialogContent dir="rtl" className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-orange-500" />
              مرتجع مشتريات — {returnPurchaseDetail?.supplierName}
            </DialogTitle>
          </DialogHeader>

          {returnPurchaseDetail && (
            <div className="space-y-4">
              {returnSuccess ? (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <p className="font-bold text-green-700 text-lg">✓ تم تسجيل المرتجع</p>
                    <p className="text-green-600 text-sm mt-1">قيمة المرتجع: {formatCurrency(returnSuccess.returnAmount)}</p>
                  </div>
                  {(() => {
                    const allRets = (returnPurchaseReturns ?? []).reduce(
                      (s: number, r: any) => s + parseFloat(r.return_amount ?? 0), 0
                    );
                    const net = returnSuccess.purchaseTotal - allRets;
                    const balance = net - returnSuccess.paidAmount;
                    return (
                      <div className={`border-2 rounded-lg p-3 text-center ${balance < -0.005 ? "border-blue-300 bg-blue-50" : balance > 0.005 ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"}`}>
                        {balance < -0.005 ? (
                          <><p className="font-bold text-blue-700">💵 مسترد من المورد</p><p className="text-blue-600 text-xl font-bold">{formatCurrency(Math.abs(balance))}</p></>
                        ) : balance > 0.005 ? (
                          <><p className="font-bold text-red-700">باقي علينا للمورد</p><p className="text-red-600 text-xl font-bold">+ {formatCurrency(balance)}</p></>
                        ) : (
                          <p className="font-bold text-green-700 text-lg">✓ الحساب مسوَّى</p>
                        )}
                      </div>
                    );
                  })()}
                  <Button className="w-full" onClick={() => { setReturnPurchaseId(null); setReturnItems([]); setReturnSuccess(null); }}>إغلاق</Button>
                </div>
              ) : (
                <>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 text-sm flex justify-between">
                    <span className="text-orange-700">إجمالي الفاتورة</span>
                    <span className="font-bold text-orange-800">{formatCurrency(returnPurchaseDetail.totalAmount)}</span>
                  </div>

                  {returnItems.length === 0 && (() => {
                    const alreadyRet: Record<number, number> = {};
                    for (const ret of (returnPurchaseReturns ?? [])) {
                      for (const ri of (Array.isArray(ret.items) ? ret.items : [])) {
                        alreadyRet[ri.productId] = (alreadyRet[ri.productId] ?? 0) + ri.quantity;
                      }
                    }
                    const availableItems = returnPurchaseDetail.items.map((i: any) => ({
                      ...i, available: Math.max(0, i.quantity - (alreadyRet[i.productId] ?? 0)),
                      returned: alreadyRet[i.productId] ?? 0,
                    }));
                    const hasAny = availableItems.some((i: any) => i.available > 0);
                    return (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">الكميات المتاحة للإرجاع:</p>
                        <div className="space-y-1.5">
                          {availableItems.map((item: any) => (
                            <div key={item.productId}
                              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${item.available === 0 ? "bg-muted/40 opacity-50" : "bg-muted"}`}>
                              <span className={item.available === 0 ? "line-through text-muted-foreground" : "font-medium"}>{item.productName}</span>
                              <div className="text-xs text-left">
                                {item.returned > 0 && <span className="text-orange-500 block">تم إرجاع {item.returned}</span>}
                                <span className={item.available === 0 ? "text-muted-foreground" : "text-green-600 font-medium"}>متاح: {item.available}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {hasAny ? (
                          <Button className="w-full mt-3" onClick={() => initReturnItems(returnPurchaseDetail)}>
                            تحديد الكميات المرتجعة
                          </Button>
                        ) : (
                          <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-center text-sm text-green-700">
                            ✓ تم إرجاع جميع المنتجات
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
                              <span className="text-xs text-muted-foreground">متاح: {item.maxQty}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => updateReturnQty(idx, -1)} className="w-7 h-7 rounded border flex items-center justify-center hover:bg-muted">
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-10 text-center font-bold">{item.qty}</span>
                              <button onClick={() => updateReturnQty(idx, 1)} className="w-7 h-7 rounded border flex items-center justify-center hover:bg-muted">
                                <Plus className="w-3 h-3" />
                              </button>
                              <span className="text-xs text-muted-foreground mr-auto">= {formatCurrency(item.qty * item.costPrice)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <Label className="text-xs">سبب المرتجع (اختياري)</Label>
                        <Input value={returnReason} onChange={e => setReturnReason(e.target.value)}
                          placeholder="عيب، خطأ في الطلب..." className="h-8 mt-1 text-sm" />
                      </div>
                      {returnTotal > 0 && (() => {
                        const prevRet = (returnPurchaseReturns ?? []).reduce(
                          (s: number, r: any) => s + parseFloat(r.return_amount ?? 0), 0
                        );
                        const netOwed = returnPurchaseDetail.totalAmount - (prevRet + returnTotal);
                        const balance = netOwed - returnPurchaseDetail.paidAmount;
                        return (
                          <div className="border border-orange-200 rounded-lg overflow-hidden text-sm">
                            <div className="bg-orange-50 px-3 py-2 flex justify-between font-bold text-orange-700">
                              <span>هذا المرتجع</span><span>- {formatCurrency(returnTotal)}</span>
                            </div>
                            {balance > 0.005 ? (
                              <div className="px-3 py-2.5 flex justify-between font-bold text-red-700 bg-red-50 border-t border-red-200">
                                <span>باقي علينا للمورد بعد المرتجع</span><span>+ {formatCurrency(balance)}</span>
                              </div>
                            ) : balance < -0.005 ? (
                              <div className="px-3 py-2.5 flex justify-between font-bold text-blue-700 bg-blue-50 border-t border-blue-200">
                                <span>💵 مسترد من المورد</span><span>- {formatCurrency(Math.abs(balance))}</span>
                              </div>
                            ) : (
                              <div className="px-3 py-2.5 flex justify-between font-bold text-green-700 bg-green-50 border-t border-green-200">
                                <span>✓ الحساب سيُسوَّى تماماً</span><span>{formatCurrency(0)}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <Separator />
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setReturnItems([])}>رجوع</Button>
                        <Button className="flex-1 bg-orange-500 hover:bg-orange-600"
                          onClick={submitReturn}
                          disabled={returnTotal === 0 || returnMutation.isPending}>
                          {returnMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                          تأكيد المرتجع ({formatCurrency(returnTotal)})
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          NEW PURCHASE FORM DIALOG
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={showForm} onOpenChange={resetForm}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader><DialogTitle>تسجيل مشترى جديد</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!supplierInput.trim() || items.length === 0) {
              toast({ title: "يرجى كتابة اسم المورد وإضافة منتجات", variant: "destructive" });
              return;
            }
            createMutation.mutate({
              data: {
                supplierId: supplierId && supplierId !== "0" ? parseInt(supplierId) : undefined,
                supplierName: !supplierId || supplierId === "0" ? supplierInput.trim() : undefined,
                invoiceNumber: invoiceNumber || undefined,
                paymentType, paidAmount: parseFloat(paidAmount),
                notes: notes || undefined,
                items: items.map(i => ({
                  productId: i.productId,
                  productName: !i.productId ? i.productName : undefined,
                  quantity: i.quantity,
                  costPrice: i.costPrice,
                })),
                includeExistingDebt,
              } as any,
            });
          }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* ── Supplier combobox ── */}
              <div>
                <Label>المورد *</Label>
                <div className="relative mt-1" ref={supplierInputRef}>
                  <Input
                    value={supplierInput}
                    onChange={e => {
                      setSupplierInput(e.target.value);
                      setSupplierId("");
                      setShowSupplierDrop(true);
                      setIncludeExistingDebt(false);
                    }}
                    onFocus={() => setShowSupplierDrop(true)}
                    placeholder="اختر مورداً أو اكتب اسم جديد..."
                  />
                  {showSupplierDrop && supplierInput && (
                    <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto mt-1">
                      {filteredSuppliers.map(s => (
                        <button key={s.id} type="button"
                          className="w-full text-right px-3 py-2 hover:bg-muted text-sm flex items-center justify-between"
                          onMouseDown={() => {
                            setSupplierId(s.id.toString());
                            setSupplierInput(s.name);
                            setShowSupplierDrop(false);
                            setIncludeExistingDebt(false);
                          }}>
                          <span>{s.name}</span>
                          {s.totalDebt > 0 && <span className="text-red-500 text-xs">({formatCurrency(s.totalDebt)} دين)</span>}
                        </button>
                      ))}
                      {!filteredSuppliers.find(s => s.name.toLowerCase() === supplierInput.toLowerCase()) && (
                        <button type="button"
                          className="w-full text-right px-3 py-2 hover:bg-blue-50 text-sm text-blue-600 border-t flex items-center gap-1"
                          onMouseDown={() => { setSupplierId("0"); setShowSupplierDrop(false); }}>
                          <Plus className="w-3 h-3" /> مورد جديد: "{supplierInput}"
                        </button>
                      )}
                      {filteredSuppliers.length === 0 && supplierInput && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">لا يوجد مورد مطابق</div>
                      )}
                    </div>
                  )}
                  {supplierId && supplierId !== "0" && (
                    <p className="text-xs text-green-600 mt-0.5">✓ مورد موجود</p>
                  )}
                  {supplierId === "0" && (
                    <p className="text-xs text-blue-600 mt-0.5">✓ سيتم إنشاء مورد جديد تلقائياً</p>
                  )}
                </div>
              </div>

              <div><Label>رقم الفاتورة</Label><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="mt-1" /></div>
              <div>
                <Label>طريقة الدفع</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="credit">آجل</SelectItem>
                    <SelectItem value="partial">جزئي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>المبلغ المدفوع</Label><Input type="number" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="mt-1" /></div>
            </div>

            {supplierId && supplierId !== "0" && supplierPendingDebt && supplierPendingDebt.pendingDebt > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-orange-700 font-medium text-sm mb-2">
                  يوجد دين سابق: <span className="font-bold">{formatCurrency(supplierPendingDebt.pendingDebt)}</span>
                </p>
                <div className="flex items-center gap-2">
                  <Checkbox id="includeDebt" checked={includeExistingDebt}
                    onCheckedChange={(v) => setIncludeExistingDebt(!!v)} />
                  <label htmlFor="includeDebt" className="text-sm cursor-pointer">إضافة الدين السابق وتسويته في هذه الفاتورة</label>
                </div>
              </div>
            )}

            <div>
              <Label>المنتجات *</Label>
              <div className="flex gap-2 mt-1 items-end">
                <div className="flex-1">
                  <ProductCombobox
                    products={products ?? []}
                    value={itemProductName}
                    onSelect={({ id, name, costPrice, isNew }) => {
                      setItemProductId(id);
                      setItemProductName(name);
                      setItemIsNew(isNew);
                      if (!isNew && costPrice) setItemPrice(costPrice.toString());
                    }}
                    placeholder="ابحث أو أنشئ منتجاً..."
                  />
                </div>
                <Input type="number" placeholder="ك" value={itemQty} onChange={(e) => setItemQty(e.target.value)} className="w-16" />
                <div className="w-28">
                  <Input type="number" step="0.01" placeholder="سعر التكلفة" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} />
                </div>
                <Button type="button" onClick={addItem}><Plus className="w-4 h-4" /></Button>
              </div>
              {itemIsNew && itemProductName && (
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> سيتم إنشاء المنتج "{itemProductName}" تلقائياً عند التسجيل
                </p>
              )}
              {items.length > 0 && (
                <div className="mt-2 space-y-1">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-muted rounded px-3 py-1.5 text-sm">
                      <span className="flex items-center gap-1">
                        {item.isNew && <span className="text-xs bg-blue-100 text-blue-600 px-1 rounded">جديد</span>}
                        {item.productName}
                      </span>
                      <span>{item.quantity} × {formatCurrency(item.costPrice)} = {formatCurrency(item.quantity * item.costPrice)}</span>
                      <button type="button" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}
                        className="text-destructive mr-2"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <div className="border-t pt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">إجمالي المشتريات</span>
                      <span className="font-bold">{formatCurrency(itemsTotal)}</span>
                    </div>
                    {includeExistingDebt && previousDebt > 0 && (
                      <>
                        <div className="flex justify-between text-orange-600">
                          <span>الدين السابق</span><span className="font-bold">+ {formatCurrency(previousDebt)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-base border-t pt-1">
                          <span>الإجمالي الكلي</span><span className="text-primary">{formatCurrency(grandTotal)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div><Label>ملاحظات</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" /></div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={resetForm}>إلغاء</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}تسجيل
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

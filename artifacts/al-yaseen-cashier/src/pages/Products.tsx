import { useState } from "react";
import {
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Edit, Trash2, AlertTriangle, Loader2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProductForm {
  name: string; description: string; barcode: string; category: string;
  costPrice: string; sellingPrice: string; quantity: string; minStockLevel: string; unit: string;
}

const emptyForm: ProductForm = {
  name: "", description: "", barcode: "", category: "",
  costPrice: "", sellingPrice: "", quantity: "0", minStockLevel: "5", unit: "قطعة",
};

export default function Products() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: products, isLoading } = useListProducts({ search: search || undefined });
  const createMutation = useCreateProduct({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListProductsQueryKey() }); setShowForm(false); setForm(emptyForm); toast({ title: "تم إضافة المنتج" }); },
      onError: () => toast({ title: "خطأ في إضافة المنتج", variant: "destructive" }),
    },
  });
  const updateMutation = useUpdateProduct({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListProductsQueryKey() }); setShowForm(false); setEditingId(null); toast({ title: "تم تحديث المنتج" }); },
      onError: () => toast({ title: "خطأ في تحديث المنتج", variant: "destructive" }),
    },
  });
  const deleteMutation = useDeleteProduct({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListProductsQueryKey() }); setDeleteId(null); toast({ title: "تم حذف المنتج" }); },
      onError: () => toast({ title: "خطأ في حذف المنتج", variant: "destructive" }),
    },
  });

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (p: any) => {
    setForm({
      name: p.name, description: p.description ?? "", barcode: p.barcode ?? "",
      category: p.category ?? "", costPrice: p.costPrice.toString(),
      sellingPrice: p.sellingPrice.toString(), quantity: p.quantity.toString(),
      minStockLevel: p.minStockLevel.toString(), unit: p.unit,
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: form.name,
      description: form.description || undefined,
      barcode: form.barcode || undefined,
      category: form.category || undefined,
      costPrice: parseFloat(form.costPrice),
      sellingPrice: parseFloat(form.sellingPrice),
      quantity: parseInt(form.quantity),
      minStockLevel: parseInt(form.minStockLevel),
      unit: form.unit,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate({ data });
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">المنتجات</h1>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 ml-1" />
          إضافة منتج
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث عن منتج..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {(products ?? []).map((p) => (
            <Card key={p.id} className={`hover:shadow-md transition-shadow ${p.isLowStock ? "border-orange-300" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{p.name}</p>
                    {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
                  </div>
                  {p.isLowStock && <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mr-1" />}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div>
                    <p className="text-muted-foreground">سعر البيع</p>
                    <p className="font-bold text-primary">{formatCurrency(p.sellingPrice)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">الكمية</p>
                    <p className={`font-bold ${p.isLowStock ? "text-orange-500" : ""}`}>
                      {p.quantity} {p.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">التكلفة</p>
                    <p className="font-medium">{formatCurrency(p.costPrice)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">الحد الأدنى</p>
                    <p className="font-medium">{p.minStockLevel} {p.unit}</p>
                  </div>
                </div>

                {p.isLowStock && (
                  <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 text-xs w-full justify-center mb-2">
                    كمية منخفضة
                  </Badge>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(p)}>
                    <Edit className="w-3.5 h-3.5 ml-1" />
                    تعديل
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(p.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!products || products.length === 0) && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد منتجات</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>اسم المنتج *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <Label>الفئة</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="مثل: زيوت، قطع غيار" />
              </div>
              <div>
                <Label>الباركود</Label>
                <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
              </div>
              <div>
                <Label>سعر التكلفة (ج.م) *</Label>
                <Input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} required />
              </div>
              <div>
                <Label>سعر البيع (ج.م) *</Label>
                <Input type="number" step="0.01" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} required />
              </div>
              <div>
                <Label>الكمية *</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
              </div>
              <div>
                <Label>حد أدنى للتنبيه</Label>
                <Input type="number" value={form.minStockLevel} onChange={(e) => setForm({ ...form, minStockLevel: e.target.value })} />
              </div>
              <div>
                <Label>الوحدة</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="قطعة، لتر، كيلو..." />
              </div>
              <div className="col-span-2">
                <Label>الوصف</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button type="submit" disabled={isMutating}>
                {isMutating && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                {editingId ? "حفظ التعديلات" : "إضافة"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المنتج</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذه العملية.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse">
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

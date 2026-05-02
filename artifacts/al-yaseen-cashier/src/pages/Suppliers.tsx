import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  getListSuppliersQueryKey,
} from "@workspace/api-client-react";
import { apiClient } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Phone, Loader2, Truck, Search, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SupplierForm { name: string; phone: string; address: string; notes: string; }
const emptyForm: SupplierForm = { name: "", phone: "", address: "", notes: "" };

export default function Suppliers() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [debtSupplierId, setDebtSupplierId] = useState<number | null>(null);
  const [debtSupplierName, setDebtSupplierName] = useState("");
  const [debtForm, setDebtForm] = useState({ amount: "", notes: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: suppliers, isLoading } = useListSuppliers();
  const createMutation = useCreateSupplier({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListSuppliersQueryKey() }); setShowForm(false); setForm(emptyForm); toast({ title: "تم إضافة المورد" }); } } });
  const updateMutation = useUpdateSupplier({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListSuppliersQueryKey() }); setShowForm(false); setEditingId(null); toast({ title: "تم تحديث المورد" }); } } });
  const deleteMutation = useDeleteSupplier({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListSuppliersQueryKey() }); setDeleteId(null); toast({ title: "تم حذف المورد" }); } } });

  const addDebtMutation = useMutation({
    mutationFn: (data: any) => apiClient("/api/debts", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListSuppliersQueryKey() });
      setDebtSupplierId(null);
      setDebtSupplierName("");
      setDebtForm({ amount: "", notes: "" });
      toast({ title: "تم تسجيل دين المورد" });
    },
    onError: () => toast({ title: "خطأ في تسجيل الدين", variant: "destructive" }),
  });

  const openEdit = (s: any) => { setForm({ name: s.name, phone: s.phone ?? "", address: s.address ?? "", notes: s.notes ?? "" }); setEditingId(s.id); setShowForm(true); };
  const openDebt = (s: any) => { setDebtSupplierId(s.id); setDebtSupplierName(s.name); setDebtForm({ amount: "", notes: "" }); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: form.name, phone: form.phone || undefined, address: form.address || undefined, notes: form.notes || undefined };
    if (editingId) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate({ data });
  };

  const handleAddDebt = () => {
    if (!debtForm.amount || parseFloat(debtForm.amount) <= 0) { toast({ title: "المبلغ مطلوب", variant: "destructive" }); return; }
    addDebtMutation.mutate({
      type: "supplier",
      supplierId: debtSupplierId,
      totalAmount: parseFloat(debtForm.amount),
      paidAmount: 0,
      notes: debtForm.notes.trim() || `دين سابق للمورد ${debtSupplierName}`,
    });
  };

  const filteredSuppliers = (suppliers ?? []).filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search)
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">الموردين</h1>
        <Button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 ml-1" />إضافة مورد
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="بحث باسم المورد أو رقم الهاتف..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSuppliers.map((s) => (
            <Card key={s.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{s.name}</p>
                    {s.phone && <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{s.phone}</p>}
                    {s.address && <p className="text-xs text-muted-foreground mt-0.5">{s.address}</p>}
                  </div>
                </div>
                {s.totalDebt > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 mb-2 text-xs">
                    <p className="text-orange-600">الدين المستحق:</p>
                    <p className="text-orange-700 font-bold text-sm">{formatCurrency(s.totalDebt)}</p>
                  </div>
                )}
                {s.notes && <p className="text-xs text-muted-foreground mb-2">{s.notes}</p>}
                <Separator className="mb-3" />
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(s)}><Edit className="w-3.5 h-3.5 ml-1" />تعديل</Button>
                  <Button variant="outline" size="sm" className="flex-1 text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => openDebt(s)}>
                    <CreditCard className="w-3.5 h-3.5 ml-1" />دين سابق
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredSuppliers.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{search ? "لا يوجد موردين بهذا الاسم" : "لا يوجد موردين"}</p>
            </div>
          )}
        </div>
      )}

      {/* Supplier form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editingId ? "تعديل المورد" : "إضافة مورد جديد"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div><Label>اسم المورد *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><Label>رقم الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>ملاحظات</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editingId ? "حفظ" : "إضافة"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Debt dialog */}
      <Dialog open={!!debtSupplierId} onOpenChange={(open) => { if (!open) { setDebtSupplierId(null); setDebtSupplierName(""); } }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-orange-500" />
              تسجيل دين سابق للمورد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-3 text-sm">
              <p className="font-semibold">{debtSupplierName}</p>
            </div>
            <div>
              <Label>مبلغ الدين (ج.م) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={debtForm.amount}
                onChange={e => setDebtForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Input
                value={debtForm.notes}
                onChange={e => setDebtForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="سبب الدين أو تفاصيل إضافية"
              />
            </div>
            {debtForm.amount && parseFloat(debtForm.amount) > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                <p className="text-orange-700">سيتم تسجيل دين قيمته <span className="font-bold">{formatCurrency(parseFloat(debtForm.amount))}</span> على المورد <span className="font-bold">{debtSupplierName}</span></p>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDebtSupplierId(null)}>إلغاء</Button>
              <Button onClick={handleAddDebt} disabled={addDebtMutation.isPending} className="bg-orange-500 hover:bg-orange-600 text-white">
                {addDebtMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                تسجيل الدين
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader><AlertDialogTitle>حذف المورد</AlertDialogTitle><AlertDialogDescription>هل أنت متأكد؟</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse">
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

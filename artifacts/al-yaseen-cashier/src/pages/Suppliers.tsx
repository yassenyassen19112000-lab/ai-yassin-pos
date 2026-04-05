import { useState } from "react";
import {
  useListSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  getListSuppliersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Phone, Loader2, Truck, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SupplierForm { name: string; phone: string; address: string; notes: string; }
const emptyForm: SupplierForm = { name: "", phone: "", address: "", notes: "" };

export default function Suppliers() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: suppliers, isLoading } = useListSuppliers();
  const createMutation = useCreateSupplier({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListSuppliersQueryKey() }); setShowForm(false); setForm(emptyForm); toast({ title: "تم إضافة المورد" }); } } });
  const updateMutation = useUpdateSupplier({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListSuppliersQueryKey() }); setShowForm(false); setEditingId(null); toast({ title: "تم تحديث المورد" }); } } });
  const deleteMutation = useDeleteSupplier({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListSuppliersQueryKey() }); setDeleteId(null); toast({ title: "تم حذف المورد" }); } } });

  const openEdit = (s: any) => { setForm({ name: s.name, phone: s.phone ?? "", address: s.address ?? "", notes: s.notes ?? "" }); setEditingId(s.id); setShowForm(true); };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: form.name, phone: form.phone || undefined, address: form.address || undefined, notes: form.notes || undefined };
    if (editingId) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate({ data });
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
        <Input
          placeholder="بحث باسم المورد أو رقم الهاتف..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-9"
        />
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
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 mb-3 text-xs">
                    <p className="text-orange-600">الدين المستحق:</p>
                    <p className="text-orange-700 font-bold text-sm">{formatCurrency(s.totalDebt)}</p>
                  </div>
                )}
                {s.notes && <p className="text-xs text-muted-foreground mb-3">{s.notes}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(s)}><Edit className="w-3.5 h-3.5 ml-1" />تعديل</Button>
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

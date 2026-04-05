import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Phone, Users, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  createdAt: string;
}

export default function Customers() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["customers", search],
    queryFn: () => apiClient(`/api/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; phone?: string; notes?: string }) =>
      apiClient("/api/customers", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "تم إضافة العميل بنجاح" });
    },
    onError: () => toast({ title: "خطأ في إضافة العميل", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; phone?: string; notes?: string } }) =>
      apiClient(`/api/customers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "تم تحديث بيانات العميل" });
    },
    onError: () => toast({ title: "خطأ في تحديث العميل", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient(`/api/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "تم حذف العميل" });
    },
    onError: () => toast({ title: "خطأ في حذف العميل", variant: "destructive" }),
  });

  const resetForm = () => {
    setForm({ name: "", phone: "", notes: "" });
    setEditingCustomer(null);
  };

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({ name: customer.name, phone: customer.phone || "", notes: customer.notes || "" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast({ title: "اسم العميل مطلوب", variant: "destructive" }); return; }
    const data = { name: form.name.trim(), phone: form.phone.trim() || undefined, notes: form.notes.trim() || undefined };
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">العملاء</h1>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 ml-2" />
          إضافة عميل
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث باسم العميل..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(customers ?? []).map((customer) => (
            <Card key={customer.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base truncate">{customer.name}</p>
                    {customer.phone ? (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Phone className="w-3.5 h-3.5" />
                        <span dir="ltr">{customer.phone}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">لا يوجد رقم هاتف</p>
                    )}
                    {customer.notes && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{customer.notes}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">{formatDateTime(customer.createdAt)}</p>
                  </div>
                  <div className="flex gap-1 mr-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(customer)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`هل تريد حذف العميل "${customer.name}"؟`)) {
                          deleteMutation.mutate(customer.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!customers || customers.length === 0) && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>{search ? "لا يوجد عملاء بهذا الاسم" : "لا يوجد عملاء مسجلين"}</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "تعديل بيانات العميل" : "إضافة عميل جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اسم العميل *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="أدخل اسم العميل"
              />
            </div>
            <div>
              <Label>رقم الهاتف <span className="text-muted-foreground text-xs">(اختياري)</span></Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="01XXXXXXXXX"
                dir="ltr"
              />
            </div>
            <div>
              <Label>ملاحظات <span className="text-muted-foreground text-xs">(اختياري)</span></Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="أي ملاحظات عن العميل"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>إلغاء</Button>
              <Button onClick={handleSave} disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                {editingCustomer ? "حفظ التعديلات" : "إضافة العميل"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

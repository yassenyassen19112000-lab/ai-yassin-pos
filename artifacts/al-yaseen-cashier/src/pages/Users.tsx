import { useState } from "react";
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Loader2, Users as UsersIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserForm {
  username: string; password: string; name: string; role: string;
  permissions: Record<string, boolean>;
}

const defaultPermissions = {
  canViewDashboard: true,
  canManageProducts: false,
  canManageSuppliers: false,
  canMakeSales: true,
  canViewReports: false,
  canManageUsers: false,
  canManageDebts: false,
  canViewPurchases: false,
  canCreatePurchases: false,
  canManageExpenses: false,
};

const permissionLabels: Record<string, string> = {
  canViewDashboard: "عرض لوحة التحكم",
  canManageProducts: "إدارة المنتجات",
  canManageSuppliers: "إدارة الموردين",
  canMakeSales: "تنفيذ المبيعات",
  canViewReports: "عرض التقارير والمبيعات",
  canManageUsers: "إدارة المستخدمين",
  canManageDebts: "إدارة الديون",
  canViewPurchases: "عرض المشتريات",
  canCreatePurchases: "تسجيل مشتريات",
  canManageExpenses: "إدارة المصروفات",
};

const emptyForm: UserForm = { username: "", password: "", name: "", role: "cashier", permissions: { ...defaultPermissions } };

export default function Users() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: users, isLoading } = useListUsers();
  const createMutation = useCreateUser({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListUsersQueryKey() }); setShowForm(false); setForm(emptyForm); toast({ title: "تم إضافة المستخدم" }); } } });
  const updateMutation = useUpdateUser({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListUsersQueryKey() }); setShowForm(false); setEditingId(null); toast({ title: "تم تحديث المستخدم" }); } } });
  const deleteMutation = useDeleteUser({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: getListUsersQueryKey() }); setDeleteId(null); toast({ title: "تم حذف المستخدم" }); } } });

  const openEdit = (u: any) => {
    setForm({ username: u.username, password: "", name: u.name, role: u.role, permissions: { ...defaultPermissions, ...u.permissions } });
    setEditingId(u.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = { username: form.username, name: form.name, role: form.role, permissions: form.permissions };
    if (form.password) data.password = form.password;
    if (editingId) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate({ data: { ...data, password: form.password } });
  };

  const togglePermission = (key: string) => {
    setForm(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: !prev.permissions[key] } }));
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">المستخدمين</h1>
        <Button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 ml-1" />إضافة مستخدم
        </Button>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(users ?? []).map((u) => (
            <Card key={u.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-sm text-muted-foreground">@{u.username}</p>
                  </div>
                  <Badge className="mr-auto" variant={u.role === "admin" ? "default" : "outline"}>
                    {u.role === "admin" ? "مدير" : "كاشير"}
                  </Badge>
                </div>
                {u.role !== "admin" && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {Object.entries(u.permissions ?? {}).filter(([, v]) => v).map(([k]) => (
                      <span key={k} className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{permissionLabels[k] ?? k}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(u)}><Edit className="w-3.5 h-3.5 ml-1" />تعديل</Button>
                  {u.role !== "admin" && (
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteId(u.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {(!users || users.length === 0) && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <UsersIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />لا يوجد مستخدمين
            </div>
          )}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>{editingId ? "تعديل مستخدم" : "إضافة مستخدم جديد"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>الاسم *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>اسم المستخدم *</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></div>
              <div><Label>{editingId ? "كلمة مرور جديدة (اتركها فارغة للإبقاء)" : "كلمة المرور *"}</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingId} />
              </div>
              <div><Label>الدور</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="cashier">كاشير</SelectItem><SelectItem value="admin">مدير</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            {form.role !== "admin" && (
              <div>
                <Label className="mb-2 block">الصلاحيات</Label>
                <div className="space-y-2 bg-muted/50 rounded-lg p-3">
                  {Object.entries(permissionLabels).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        id={key}
                        checked={!!form.permissions[key]}
                        onCheckedChange={() => togglePermission(key)}
                      />
                      <label htmlFor={key} className="text-sm cursor-pointer">{label}</label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editingId ? "حفظ" : "إضافة"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader><AlertDialogTitle>حذف المستخدم</AlertDialogTitle><AlertDialogDescription>هل أنت متأكد من حذف هذا المستخدم؟</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse">
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

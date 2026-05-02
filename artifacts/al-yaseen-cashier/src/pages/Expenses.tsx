import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Loader2, TrendingDown, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = [
  { value: "salary", label: "رواتب" },
  { value: "rent", label: "إيجار" },
  { value: "utilities", label: "مرافق (كهرباء/مياه)" },
  { value: "transport", label: "مواصلات" },
  { value: "maintenance", label: "صيانة" },
  { value: "other", label: "أخرى" },
];

const CATEGORY_COLORS: Record<string, string> = {
  salary: "bg-blue-100 text-blue-700",
  rent: "bg-purple-100 text-purple-700",
  utilities: "bg-yellow-100 text-yellow-700",
  transport: "bg-green-100 text-green-700",
  maintenance: "bg-orange-100 text-orange-700",
  other: "bg-gray-100 text-gray-700",
};

interface Expense {
  id: number;
  description: string;
  amount: number;
  category: string;
  categoryLabel: string;
  notes: string | null;
  expenseDate: string;
  createdBy: string | null;
  createdAt: string;
}

interface ExpenseForm {
  description: string;
  amount: string;
  category: string;
  notes: string;
  expenseDate: string;
}

const emptyForm: ExpenseForm = {
  description: "",
  amount: "",
  category: "other",
  notes: "",
  expenseDate: new Date().toISOString().slice(0, 10),
};

export default function Expenses() {
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [filterCategory, setFilterCategory] = useState("all");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: expenses, isLoading } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: () => apiClient("/api/expenses"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiClient("/api/expenses", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setShowForm(false);
      setForm(emptyForm);
      toast({ title: "تم تسجيل المصروف" });
    },
    onError: () => toast({ title: "خطأ في التسجيل", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient(`/api/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setDeleteId(null);
      toast({ title: "تم حذف المصروف" });
    },
    onError: () => toast({ title: "خطأ في الحذف", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || !form.amount) {
      toast({ title: "الوصف والمبلغ مطلوبان", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      description: form.description.trim(),
      amount: parseFloat(form.amount),
      category: form.category,
      notes: form.notes.trim() || undefined,
      expenseDate: new Date(form.expenseDate).toISOString(),
    });
  };

  const filtered = (expenses ?? []).filter(e => filterCategory === "all" || e.category === filterCategory);

  const totalAll = (expenses ?? []).reduce((s, e) => s + e.amount, 0);
  const totalThisMonth = (expenses ?? []).filter(e => {
    const d = new Date(e.expenseDate);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, e) => s + e.amount, 0);

  const byCategory = CATEGORIES.map(c => ({
    ...c,
    total: (expenses ?? []).filter(e => e.category === c.value).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.total > 0);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">المصروفات</h1>
        <Button onClick={() => { setForm(emptyForm); setShowForm(true); }}>
          <Plus className="w-4 h-4 ml-1" />إضافة مصروف
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">هذا الشهر</span>
            </div>
            <p className="text-xl font-bold text-destructive">{formatCurrency(totalThisMonth)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">الإجمالي الكلي</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(totalAll)}</p>
          </CardContent>
        </Card>
        {byCategory.slice(0, 2).map(c => (
          <Card key={c.value}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLORS[c.value]}`}>{c.label}</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(c.total)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="كل الفئات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الفئات</SelectItem>
            {CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} مصروف</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الوصف</TableHead>
                <TableHead className="text-right">الفئة</TableHead>
                <TableHead className="text-right">المبلغ</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">ملاحظات</TableHead>
                <TableHead className="text-right w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.description}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${CATEGORY_COLORS[e.category] ?? "bg-gray-100 text-gray-700"}`}>
                      {e.categoryLabel}
                    </span>
                  </TableCell>
                  <TableCell className="font-bold text-destructive">{formatCurrency(e.amount)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDateTime(e.expenseDate)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.notes ?? "-"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0"
                      onClick={() => setDeleteId(e.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    <TrendingDown className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    لا توجد مصروفات مسجلة
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add expense dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-destructive" />
              إضافة مصروف جديد
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>الوصف *</Label>
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="مثال: راتب عمال شهر يناير"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>المبلغ (ج.م) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <Label>الفئة</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={form.expenseDate}
                onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="اختياري"
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                تسجيل المصروف
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المصروف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا المصروف؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse">
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

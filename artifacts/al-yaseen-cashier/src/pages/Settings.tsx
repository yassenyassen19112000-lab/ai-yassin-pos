import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, User, Shield, Store } from "lucide-react";

export default function Settings() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-2xl font-bold">الإعدادات</h1>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" />
              معلومات الحساب
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">الاسم</span>
              <span className="font-medium">{user?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">اسم المستخدم</span>
              <span className="font-mono">@{user?.username}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">الدور</span>
              <Badge variant={isAdmin ? "default" : "outline"}>
                {isAdmin ? "مدير" : "كاشير"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="w-4 h-4" />
              معلومات المتجر
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">اسم المتجر</span>
              <span className="font-medium">آل ياسين لاكسسوار الموتال</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">العملة</span>
              <span>جنيه مصري (ج.م)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">اللغة</span>
              <span>العربية</span>
            </div>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4" />
              الصلاحيات الممنوحة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isAdmin ? (
              <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
                لديك صلاحية مدير كاملة - يمكنك الوصول لجميع الأقسام وإدارة النظام
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(user?.permissions ?? {}).filter(([, v]) => v).map(([k]) => {
                  const labels: Record<string, string> = {
                    canViewDashboard: "عرض لوحة التحكم",
                    canManageProducts: "إدارة المنتجات",
                    canManageSuppliers: "إدارة الموردين",
                    canMakeSales: "تنفيذ المبيعات",
                    canViewReports: "عرض التقارير",
                    canManageUsers: "إدارة المستخدمين",
                    canManageDebts: "إدارة الديون",
                    canViewPurchases: "عرض المشتريات",
                    canCreatePurchases: "تسجيل مشتريات",
                  };
                  return <Badge key={k} variant="outline" className="text-xs">{labels[k] ?? k}</Badge>;
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

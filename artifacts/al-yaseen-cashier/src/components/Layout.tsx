import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, ShoppingCart, Package, Truck, Receipt,
  CreditCard, FileText, Users, Settings, LogOut, Menu, X,
  AlertTriangle, ChevronLeft, UserCheck
} from "lucide-react";
import { useGetLowStockProducts } from "@workspace/api-client-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard, permission: "canViewDashboard" },
  { href: "/pos", label: "نقطة البيع", icon: ShoppingCart, permission: "canMakeSales" },
  { href: "/customers", label: "العملاء", icon: UserCheck, permission: "canMakeSales" },
  { href: "/products", label: "المنتجات", icon: Package, permission: "canManageProducts" },
  { href: "/suppliers", label: "الموردين", icon: Truck, permission: "canManageSuppliers" },
  { href: "/purchases", label: "المشتريات", icon: Receipt, permission: "canViewPurchases" },
  { href: "/sales", label: "المبيعات", icon: FileText, permission: "canViewReports" },
  { href: "/debts", label: "الديون", icon: CreditCard, permission: "canManageDebts" },
  { href: "/reports", label: "التقارير", icon: FileText, permission: "canViewReports" },
  { href: "/users", label: "المستخدمين", icon: Users, permission: "canManageUsers" },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, can, isAdmin } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: lowStock } = useGetLowStockProducts();

  const visibleNavItems = navItems.filter(item => {
    if (!item.permission) return true;
    if (isAdmin) return true;
    return can(item.permission as any);
  });

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
            ي
          </div>
          <div>
            <p className="text-sidebar-foreground font-bold text-sm leading-tight">آل ياسين</p>
            <p className="text-sidebar-foreground/60 text-xs">لاكسسوار الموتال</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
              {item.href === "/products" && lowStock && lowStock.length > 0 && (
                <span className="mr-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {lowStock.length}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        {lowStock && lowStock.length > 0 && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-red-500/20 rounded-lg text-xs text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{lowStock.length} منتج على وشك النفاد</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-2 py-1 mb-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
            {user?.name?.charAt(0) ?? "م"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sidebar-foreground text-xs font-medium truncate">{user?.name}</p>
            <p className="text-sidebar-foreground/50 text-xs">{user?.role === "admin" ? "مدير" : "كاشير"}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background" dir="rtl">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - desktop */}
      <div className="hidden lg:flex w-56 shrink-0 bg-sidebar flex-col border-l border-sidebar-border">
        <SidebarContent />
      </div>

      {/* Sidebar - mobile */}
      <div className={cn(
        "fixed inset-y-0 right-0 z-40 w-56 bg-sidebar flex-col lg:hidden transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="absolute top-3 left-3">
          <button onClick={() => setSidebarOpen(false)} className="text-sidebar-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-card border-b border-border flex items-center px-4 gap-3 shrink-0">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-muted"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          {lowStock && lowStock.length > 0 && (
            <Link href="/products" className="flex items-center gap-1.5 text-xs text-orange-500 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full hover:bg-orange-100 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{lowStock.length} منتج نفد مخزونه</span>
            </Link>
          )}
          <div className="text-sm text-muted-foreground hidden sm:block">{user?.name}</div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

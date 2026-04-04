import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

interface Permissions {
  canViewDashboard: boolean;
  canManageProducts: boolean;
  canManageSuppliers: boolean;
  canMakeSales: boolean;
  canViewReports: boolean;
  canManageUsers: boolean;
  canManageDebts: boolean;
  canViewPurchases: boolean;
  canCreatePurchases: boolean;
}

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  permissions: Permissions;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  isLoading: boolean;
  isAdmin: boolean;
  can: (permission: keyof Permissions) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("authToken");
    const storedUser = localStorage.getItem("authUser");
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
      } catch {
        localStorage.removeItem("authToken");
        localStorage.removeItem("authUser");
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    setAuthTokenGetter(() => token);
  }, [token]);

  const login = (user: User, token: string) => {
    setUser(user);
    setToken(token);
    localStorage.setItem("authToken", token);
    localStorage.setItem("authUser", JSON.stringify(user));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
  };

  const can = (permission: keyof Permissions): boolean => {
    if (!user) return false;
    if (user.role === "admin") return true;
    return user.permissions[permission] ?? false;
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      isLoading,
      isAdmin: user?.role === "admin",
      can,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

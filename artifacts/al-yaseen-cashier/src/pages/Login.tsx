import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Lock, User } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        login(data.user as any, data.token);
        navigate("/dashboard");
      },
      onError: (err: any) => {
        setError(err?.data?.error || "اسم المستخدم أو كلمة المرور غير صحيحة");
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError("يرجى إدخال اسم المستخدم وكلمة المرور"); return; }
    setError("");
    loginMutation.mutate({ data: { username, password } });
  };

  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl font-black text-primary-foreground">ي</span>
          </div>
          <h1 className="text-2xl font-bold text-white">آل ياسين</h1>
          <p className="text-sidebar-foreground/60 text-sm mt-1">لاكسسوار الموتال</p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm font-medium">اسم المستخدم</Label>
                <div className="relative">
                  <User className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="أدخل اسم المستخدم"
                    className="pr-9 text-right"
                    autoComplete="username"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور"
                    className="pr-9 text-right"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-center">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : null}
                تسجيل الدخول
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground mt-4">
              المدير الافتراضي: admin / admin123
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

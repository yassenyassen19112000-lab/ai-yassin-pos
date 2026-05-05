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
          <div className="mx-auto mb-4 w-24 h-24 drop-shadow-2xl" style={{filter:"drop-shadow(0 0 18px rgba(251,191,36,0.35))"}}>
            <svg width="96" height="96" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="lg-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1a1033"/>
                  <stop offset="100%" stopColor="#0a0618"/>
                </linearGradient>
                <linearGradient id="lg-gold" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fef3c7"/>
                  <stop offset="40%" stopColor="#fbbf24"/>
                  <stop offset="100%" stopColor="#b45309"/>
                </linearGradient>
                <linearGradient id="lg-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fde68a"/>
                  <stop offset="100%" stopColor="#d97706"/>
                </linearGradient>
                <radialGradient id="lg-glow" cx="50%" cy="45%" r="50%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.22"/>
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/>
                </radialGradient>
              </defs>
              <rect width="512" height="512" rx="112" fill="url(#lg-bg)"/>
              <ellipse cx="256" cy="230" rx="175" ry="155" fill="url(#lg-glow)"/>
              <rect x="10" y="10" width="492" height="492" rx="104" fill="none" stroke="url(#lg-ring)" strokeWidth="2.5" strokeOpacity="0.5"/>
              <path d="M56 24 L28 24 Q18 24 18 34 L18 56" stroke="#fbbf24" strokeWidth="4" fill="none" strokeLinecap="round" strokeOpacity="0.6"/>
              <path d="M456 24 L484 24 Q494 24 494 34 L494 56" stroke="#fbbf24" strokeWidth="4" fill="none" strokeLinecap="round" strokeOpacity="0.6"/>
              <path d="M56 488 L28 488 Q18 488 18 478 L18 456" stroke="#fbbf24" strokeWidth="4" fill="none" strokeLinecap="round" strokeOpacity="0.6"/>
              <path d="M456 488 L484 488 Q494 488 494 478 L494 456" stroke="#fbbf24" strokeWidth="4" fill="none" strokeLinecap="round" strokeOpacity="0.6"/>
              <circle cx="256" cy="225" r="162" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeOpacity="0.13"/>
              <text x="260" y="325" textAnchor="middle"
                fontFamily="'Arabic Typesetting','Noto Naskh Arabic',Arial,sans-serif"
                fontSize="310" fontWeight="900" fill="url(#lg-gold)">ي</text>
              <line x1="130" y1="390" x2="382" y2="390" stroke="#fbbf24" strokeWidth="1" strokeOpacity="0.3"/>
              <text x="256" y="432" textAnchor="middle"
                fontFamily="'Arabic Typesetting','Noto Naskh Arabic',Arial,sans-serif"
                fontSize="44" fontWeight="700" fill="#fbbf24" opacity="0.88">آل ياسين</text>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">آل ياسين</h1>
          <p className="text-sidebar-foreground/55 text-sm mt-0.5">لاكسسوار الموتال</p>
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

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email({ message: "Neveljaven email naslov" }),
  password: z.string()
    .min(12, { message: "Geslo mora biti dolgo vsaj 12 znakov" })
    .regex(/[A-Z]/, { message: "Geslo mora vsebovati vsaj eno veliko črko" })
    .regex(/[a-z]/, { message: "Geslo mora vsebovati vsaj eno malo črko" })
    .regex(/[0-9]/, { message: "Geslo mora vsebovati vsaj eno številko" }),
  fullName: z.string()
    .min(2, { message: "Ime mora biti dolgo vsaj 2 znaka" })
    .max(100, { message: "Ime je predolgo (max 100 znakov)" })
    .optional(),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we're coming from a password recovery link
    const checkPasswordRecovery = () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');
      
      if (type === 'recovery') {
        setIsPasswordReset(true);
      }
    };

    // Check immediately on mount
    checkPasswordRecovery();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordReset(true);
      }
    });

    // Also listen for hash changes
    window.addEventListener('hashchange', checkPasswordRecovery);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('hashchange', checkPasswordRecovery);
    };
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validationData = isLogin 
        ? { email, password }
        : { email, password, fullName };
      
      authSchema.parse(validationData);

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        toast.success("Uspešna prijava!");
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;
        toast.success("Uspešna registracija! Dobrodošli!");
        navigate("/");
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          toast.error(err.message);
        });
      } else if (error.message?.includes("already registered")) {
        toast.error("Ta email je že registriran. Prosim prijavite se.");
      } else {
        toast.error(error.message || "Prišlo je do napake");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const emailSchema = z.string().email({ message: "Neveljaven email naslov" });
      emailSchema.parse(resetEmail);

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;
      
      toast.success("Poslali smo vam povezavo za ponastavitev gesla na email!");
      setShowResetDialog(false);
      setResetEmail("");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          toast.error(err.message);
        });
      } else {
        toast.error(error.message || "Prišlo je do napake");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error("Gesli se ne ujemata");
      return;
    }

    if (newPassword.length < 12) {
      toast.error("Geslo mora biti dolgo vsaj 12 znakov");
      return;
    }
    
    if (!/[A-Z]/.test(newPassword)) {
      toast.error("Geslo mora vsebovati vsaj eno veliko črko");
      return;
    }
    
    if (!/[a-z]/.test(newPassword)) {
      toast.error("Geslo mora vsebovati vsaj eno malo črko");
      return;
    }
    
    if (!/[0-9]/.test(newPassword)) {
      toast.error("Geslo mora vsebovati vsaj eno številko");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      
      toast.success("Geslo uspešno posodobljeno! Sedaj se lahko prijavite.");
      setIsPasswordReset(false);
      setNewPassword("");
      setConfirmPassword("");
      setIsLogin(true);
      // Clear the hash from URL
      window.history.replaceState(null, "", window.location.pathname);
    } catch (error: any) {
      toast.error(error.message || "Prišlo je do napake");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" 
         style={{ background: "var(--gradient-hero)" }}>
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-1 text-center pb-4">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Hokejska Liga
          </CardTitle>
          <CardDescription className="text-sm">
            {isPasswordReset 
              ? "Nastavite novo geslo" 
              : isLogin ? "Prijavite se v svoj račun" : "Ustvarite nov račun"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPasswordReset ? (
            <form onSubmit={handleUpdatePassword} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="text-sm">Novo geslo</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm">Potrdite geslo</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Posodabljanje..." : "Posodobi geslo"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setIsPasswordReset(false);
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                className="text-primary hover:underline transition-all text-xs w-full mt-2"
              >
                Nazaj na prijavo
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleAuth} className="space-y-3">
              {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-sm">Polno ime</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Janez Novak"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vas.email@primer.si"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm">Geslo</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Min. 12 znakov, 1 velika črka, 1 številka"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Nalaganje..." : isLogin ? "Prijava" : "Registracija"}
            </Button>
          </form>
          <div className="mt-3 text-center text-xs space-y-2">
            {isLogin && (
              <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="text-primary hover:underline transition-all block w-full"
                  >
                    Pozabljeno geslo?
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ponastavitev gesla</DialogTitle>
                    <DialogDescription>
                      Vnesite svoj email naslov in poslali vam bomo povezavo za ponastavitev gesla.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handlePasswordReset} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="resetEmail" className="text-sm">Email</Label>
                      <Input
                        id="resetEmail"
                        type="email"
                        placeholder="vas.email@primer.si"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Pošiljanje..." : "Pošlji povezavo"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline transition-all"
            >
              {isLogin
                ? "Nimate računa? Registrirajte se"
                : "Že imate račun? Prijavite se"}
              </button>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
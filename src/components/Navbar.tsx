import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Trophy, Menu, Shield, Users, Home, UserCircle, Award } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { useI18n, Language } from "@/lib/i18n";

interface NavbarProps {
  user: any;
}

export default function Navbar({ user }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang, setLang } = useI18n();
  const isOnLeaguesPage = location.pathname === "/";
  const [currentLeague, setCurrentLeague] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const validateAndFetchLeague = async () => {
      const leagueId = localStorage.getItem("currentLeagueId");
      if (!leagueId) return;
      
      // Verify membership before fetching league details
      const { data: memberData, error: memberError } = await supabase
        .from("league_members")
        .select("id")
        .eq("league_id", leagueId)
        .eq("user_id", user.id)
        .single();
      
      if (memberError || !memberData) {
        // User is no longer a member, clear the stored league
        localStorage.removeItem("currentLeagueId");
        setCurrentLeague(null);
        setIsAdmin(false);
        return;
      }
      
      // User is a valid member, fetch league details
      fetchCurrentLeague(leagueId);
      checkAdminStatus(leagueId);
    };
    
    if (user) {
      validateAndFetchLeague();
    }
  }, [user]);

  const fetchCurrentLeague = async (leagueId: string) => {
    try {
      const { data, error } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", leagueId)
        .single();

      if (error) throw error;
      setCurrentLeague(data);
    } catch (error) {
      console.error("Error fetching league:", error);
    }
  };

  const checkAdminStatus = async (leagueId: string) => {
    try {
      const { data, error } = await supabase
        .from("league_members")
        .select("role")
        .eq("league_id", leagueId)
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      setIsAdmin(data?.role === "admin" || data?.role === "super_user");
    } catch (error) {
      setIsAdmin(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(t("nav.signOutError"));
    } else {
      localStorage.removeItem("currentLeagueId");
      toast.success(t("nav.signOutSuccess"));
      navigate("/auth");
    }
  };

  const langOptions: { code: Language; label: string }[] = [
    { code: "si", label: "SI" },
    { code: "en", label: "EN" },
    { code: "de", label: "DE" },
  ];

  return (
    <nav className="border-b bg-card shadow-sm">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Trophy className="h-6 w-6 text-primary flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Playta
              </h1>
              {currentLeague && !isOnLeaguesPage && (
                <span className="text-xs text-muted-foreground truncate">
                  {currentLeague.name}
                </span>
              )}
            </div>
          </div>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <div className="flex flex-col gap-3 mt-6">
                {/* Language Selector */}
                <div className="flex items-center justify-center gap-1 mb-2">
                  {langOptions.map((opt) => (
                    <Button
                      key={opt.code}
                      variant={lang === opt.code ? "default" : "outline"}
                      size="sm"
                      className="flex-1 text-xs font-bold"
                      onClick={() => setLang(opt.code)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>

                {currentLeague && !isOnLeaguesPage && (
                  <>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider px-2">{currentLeague.name}</p>
                    <Button onClick={() => navigate("/league")} variant="outline" className="w-full justify-start">
                      <Home className="h-4 w-4 mr-2" />
                      {t("nav.leagueHome")}
                    </Button>
                    
                    <Button onClick={() => navigate("/profile")} variant="outline" className="w-full justify-start">
                      <UserCircle className="h-4 w-4 mr-2" />
                      {t("nav.leagueProfile")}
                    </Button>
                    
                    <Button onClick={() => navigate("/players")} variant="outline" className="w-full justify-start">
                      <Users className="h-4 w-4 mr-2" />
                      {t("nav.players")}
                    </Button>
                    
                    <Button onClick={() => navigate("/leaderboard")} variant="outline" className="w-full justify-start">
                      <Award className="h-4 w-4 mr-2" />
                      {t("nav.leaderboard")}
                    </Button>
                    
                    {isAdmin && (
                      <Button onClick={() => navigate("/admin")} variant="outline" className="w-full justify-start">
                        <Shield className="h-4 w-4 mr-2" />
                        {t("nav.adminPanel")}
                      </Button>
                    )}
                    
                    <div className="border-t my-1" />
                  </>
                )}
                
                <Button onClick={() => navigate("/")} variant="default" className="w-full justify-start">
                  <Trophy className="h-4 w-4 mr-2" />
                  {t("nav.myLeagues")}
                </Button>

                <Button onClick={() => navigate("/global-profile")} variant="outline" className="w-full justify-start">
                  <UserCircle className="h-4 w-4 mr-2" />
                  {t("nav.myAccount")}
                </Button>
                
                <SheetClose asChild>
                  <Button onClick={handleSignOut} variant="destructive" className="w-full justify-start">
                    <LogOut className="h-4 w-4 mr-2" />
                    {t("nav.signOut")}
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
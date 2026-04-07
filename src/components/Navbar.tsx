import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Trophy, Menu, Shield, Users, Home, UserCircle, Award } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";

interface NavbarProps {
  user: any;
}

export default function Navbar({ user }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
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
      toast.error("Napaka pri odjavi");
    } else {
      localStorage.removeItem("currentLeagueId");
      toast.success("Uspešna odjava");
      navigate("/auth");
    }
  };

  return (
    <nav className="border-b bg-card shadow-sm">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Trophy className="h-6 w-6 text-primary flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Hokejska Liga
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
                {currentLeague && !isOnLeaguesPage && (
                  <>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider px-2">{currentLeague.name}</p>
                    <Button onClick={() => navigate("/league")} variant="outline" className="w-full justify-start">
                      <Home className="h-4 w-4 mr-2" />
                      Domov lige
                    </Button>
                    
                    <Button onClick={() => navigate("/profile")} variant="outline" className="w-full justify-start">
                      <UserCircle className="h-4 w-4 mr-2" />
                      Profil v ligi
                    </Button>
                    
                    <Button onClick={() => navigate("/players")} variant="outline" className="w-full justify-start">
                      <Users className="h-4 w-4 mr-2" />
                      Tekmovalci
                    </Button>
                    
                    <Button onClick={() => navigate("/leaderboard")} variant="outline" className="w-full justify-start">
                      <Award className="h-4 w-4 mr-2" />
                      Lestvica
                    </Button>
                    
                    {isAdmin && (
                      <Button onClick={() => navigate("/admin")} variant="outline" className="w-full justify-start">
                        <Shield className="h-4 w-4 mr-2" />
                        Admin panel
                      </Button>
                    )}
                    
                    <div className="border-t my-1" />
                  </>
                )}
                
                <Button onClick={() => navigate("/")} variant="default" className="w-full justify-start">
                  <Trophy className="h-4 w-4 mr-2" />
                  Moje lige
                </Button>

                <Button onClick={() => navigate("/global-profile")} variant="outline" className="w-full justify-start">
                  <UserCircle className="h-4 w-4 mr-2" />
                  Moj račun
                </Button>
                
                <SheetClose asChild>
                  <Button onClick={handleSignOut} variant="destructive" className="w-full justify-start">
                    <LogOut className="h-4 w-4 mr-2" />
                    Odjava
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
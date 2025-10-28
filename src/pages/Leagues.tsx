import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Users, ArrowRight, Lock, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { z } from "zod";

const leagueSchema = z.object({
  name: z.string()
    .trim()
    .min(3, "Ime mora biti dolgo vsaj 3 znake")
    .max(100, "Ime je predolgo (max 100 znakov)")
    .regex(/^[a-zA-Z0-9čćžšđČĆŽŠĐ\s-]+$/, "Neveljavni znaki v imenu"),
  description: z.string()
    .trim()
    .max(500, "Opis je predolg (max 500 znakov)")
    .optional(),
  password: z.string()
    .trim()
    .min(4, "Geslo mora biti dolgo vsaj 4 znake")
    .max(50, "Geslo je predolgo (max 50 znakov)")
    .optional()
    .or(z.literal(''))
});

export default function Leagues() {
  const [user, setUser] = useState<User | null>(null);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [myLeagues, setMyLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [newLeagueDesc, setNewLeagueDesc] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<any>(null);
  const [enteredPassword, setEnteredPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchLeagues();
      fetchMyLeagues();
    }
  }, [user]);

  const fetchLeagues = async () => {
    try {
      const { data, error } = await supabase
        .from("public_leagues")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeagues(data || []);
    } catch (error: any) {
      toast.error("Napaka pri nalaganju lig");
    }
  };

  const fetchMyLeagues = async () => {
    try {
      const { data, error } = await supabase
        .from("league_members")
        .select("*, leagues(*)")
        .eq("user_id", user?.id);

      if (error) throw error;
      setMyLeagues(data || []);
    } catch (error: any) {
      toast.error("Napaka pri nalaganju vaših lig");
    }
  };

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validatedData = leagueSchema.parse({
        name: newLeagueName,
        description: newLeagueDesc || "",
      });

      const { error } = await supabase
        .from("leagues")
        .insert({
          name: validatedData.name,
          description: validatedData.description || null,
          created_by: user?.id,
        });

      if (error) throw error;
      toast.success("Liga uspešno ustvarjena!");
      setNewLeagueName("");
      setNewLeagueDesc("");
      setDialogOpen(false);
      fetchLeagues();
      fetchMyLeagues();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          toast.error(err.message);
        });
      } else {
        toast.error(error.message || "Napaka pri ustvarjanju lige");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinLeague = async (leagueId: string) => {
    const league = leagues.find(l => l.id === leagueId);
    
    // Check if league is password protected
    if (league?.has_password) {
      setSelectedLeague(league);
      setPasswordDialogOpen(true);
      return;
    }
    
    await joinLeague(leagueId);
  };

  const handlePasswordSubmit = async () => {
    if (!selectedLeague) return;
    
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Prosim, prijavite se");
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke('join-league', {
        body: { 
          leagueId: selectedLeague.id, 
          password: enteredPassword 
        }
      });

      if (error) {
        console.error("Error joining league:", error);
        toast.error("Napaka pri pridružitvi v ligo");
        return;
      }

      if (data.error) {
        if (data.error === 'Invalid password') {
          toast.error("Napačno geslo!");
        } else {
          toast.error(data.error);
        }
        return;
      }

      toast.success("Uspešno ste se pridružili ligi!");
      setPasswordDialogOpen(false);
      setEnteredPassword("");
      
      await fetchMyLeagues();
      await fetchLeagues();
    } catch (error) {
      console.error("Error joining league:", error);
      toast.error("Napaka pri pridružitvi v ligo");
    } finally {
      setLoading(false);
    }
  };

  const joinLeague = async (leagueId: string) => {
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Prosim, prijavite se");
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke('join-league', {
        body: { 
          leagueId, 
          password: null 
        }
      });

      if (error) {
        console.error("Error joining league:", error);
        toast.error("Napaka pri pridružitvi v ligo");
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Uspešno ste se pridružili ligi!");
      await fetchMyLeagues();
      await fetchLeagues();
    } catch (error: any) {
      toast.error(error.message || "Napaka pri pridružitvi v ligo");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLeague = async (leagueId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("leagues")
        .delete()
        .eq("id", leagueId);

      if (error) throw error;
      toast.success("Liga uspešno izbrisana!");
      fetchLeagues();
      fetchMyLeagues();
    } catch (error: any) {
      toast.error("Napaka pri brisanju lige");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLeague = (leagueId: string) => {
    localStorage.setItem("currentLeagueId", leagueId);
    navigate("/");
  };

  const isInLeague = (leagueId: string) => {
    return myLeagues.some(ml => ml.league_id === leagueId);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      <main className="px-4 py-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Lige</h2>
            <p className="text-sm text-muted-foreground">Izberite ligo ali ustvarite novo</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nova liga
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ustvari novo ligo</DialogTitle>
                <DialogDescription>Ustvarite novo ligo in postanite njen administrator</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateLeague} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Ime lige</Label>
                  <Input
                    id="name"
                    value={newLeagueName}
                    onChange={(e) => setNewLeagueName(e.target.value)}
                    placeholder="Npr. Liga Ljubljana"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Opis</Label>
                  <Textarea
                    id="description"
                    value={newLeagueDesc}
                    onChange={(e) => setNewLeagueDesc(e.target.value)}
                    placeholder="Kratek opis lige..."
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Ustvarjam..." : "Ustvari ligo"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {myLeagues.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">VAŠE LIGE</h3>
            <div className="space-y-2">
              {myLeagues.map((membership) => (
                <Card key={membership.id}>
                  <div className="flex items-center">
                    <div 
                      className="flex-1 cursor-pointer hover:bg-accent/50 transition-colors rounded-l-lg"
                      onClick={() => handleSelectLeague(membership.league_id)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <span>{membership.leagues.name}</span>
                          {membership.leagues.has_password && <Lock className="h-4 w-4 text-muted-foreground" />}
                          <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto" />
                        </CardTitle>
                        {membership.leagues.description && (
                          <CardDescription className="text-xs">{membership.leagues.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="pb-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span className="capitalize">Vaša vloga: {membership.role.replace('_', ' ')}</span>
                        </div>
                      </CardContent>
                    </div>
                    
                    {membership.leagues.created_by === user?.id && (
                      <div className="pr-3">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Izbriši ligo?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Ali ste prepričani, da želite izbrisati ligo "{membership.leagues.name}"? 
                                Ta akcija je nepovratna in bodo izbrisani vsi podatki, tekme in rezultati.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Prekliči</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteLeague(membership.league_id);
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Izbriši
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">VSE LIGE</h3>
          <div className="space-y-2">
            {leagues.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                Trenutno ni nobene lige. Ustvarite prvo!
              </p>
            ) : (
              leagues.map((league) => (
                <Card key={league.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {league.name}
                      {league.has_password && <Lock className="h-4 w-4 text-muted-foreground" />}
                    </CardTitle>
                    {league.description && (
                      <CardDescription className="text-xs">{league.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardFooter className="pt-3">
                    {isInLeague(league.id) ? (
                      <Button 
                        onClick={() => handleSelectLeague(league.id)} 
                        variant="outline" 
                        className="w-full"
                        size="sm"
                      >
                        Odpri ligo
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => handleJoinLeague(league.id)} 
                        disabled={loading}
                        className="w-full"
                        size="sm"
                      >
                        {league.has_password ? (
                          <>
                            <Lock className="h-4 w-4 mr-2" />
                            Pridruži se
                          </>
                        ) : (
                          "Pridruži se"
                        )}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Password Dialog */}
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vnesi geslo</DialogTitle>
              <DialogDescription>
                Liga "{selectedLeague?.name}" je zaščitena z geslom.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="password">Geslo</Label>
                <Input
                  id="password"
                  type="password"
                  value={enteredPassword}
                  onChange={(e) => setEnteredPassword(e.target.value)}
                  placeholder="Vnesite geslo"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handlePasswordSubmit();
                    }
                  }}
                />
              </div>
              <Button onClick={handlePasswordSubmit} className="w-full" disabled={!enteredPassword}>
                Potrdi
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

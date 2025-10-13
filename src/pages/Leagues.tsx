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
import { Plus, Users, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function Leagues() {
  const [user, setUser] = useState<User | null>(null);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [myLeagues, setMyLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [newLeagueDesc, setNewLeagueDesc] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
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
        .from("leagues")
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
      const { error } = await supabase
        .from("leagues")
        .insert({
          name: newLeagueName,
          description: newLeagueDesc,
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
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinLeague = async (leagueId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("league_members")
        .insert({
          league_id: leagueId,
          user_id: user?.id,
          role: "neplačan_član",
        });

      if (error) throw error;
      toast.success("Uspešno ste se pridružili ligi!");
      fetchMyLeagues();
    } catch (error: any) {
      toast.error(error.message);
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
                <Card key={membership.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => handleSelectLeague(membership.league_id)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>{membership.leagues.name}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
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
                    <CardTitle className="text-lg">{league.name}</CardTitle>
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
                        Pridruži se
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

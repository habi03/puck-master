import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, Users, Calendar, Plus, Lock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export default function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [currentLeagueId, setCurrentLeagueId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [leaguePassword, setLeaguePassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const navigate = useNavigate();

  const matchSchema = z.object({
    match_date: z.string().min(1, "Datum je obvezen"),
    match_time: z.string().min(1, "Ura je obvezna"),
    number_of_teams: z.coerce.number().min(2, "Vsaj 2 ekipi").max(10, "Največ 10 ekip")
  });

  const form = useForm<z.infer<typeof matchSchema>>({
    resolver: zodResolver(matchSchema),
    defaultValues: {
      match_date: "",
      match_time: "",
      number_of_teams: 2
    }
  });

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
    const leagueId = localStorage.getItem("currentLeagueId");
    if (leagueId) {
      setCurrentLeagueId(leagueId);
    } else {
      navigate("/leagues");
    }
  }, [navigate]);

  useEffect(() => {
    if (user && currentLeagueId) {
      checkAdminStatus();
      fetchMembers();
      fetchMatches();
      fetchLeagueSettings();
    }
  }, [user, currentLeagueId]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("league_members")
        .select("role")
        .eq("league_id", currentLeagueId)
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      setIsAdmin(data?.role === "admin");
      
      if (data?.role !== "admin") {
        toast.error("Nimate administratorskih pravic");
        navigate("/");
      }
    } catch (error: any) {
      toast.error("Napaka pri preverjanju pravic");
      navigate("/");
    }
  };

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("league_members")
        .select("*, profiles(*)")
        .eq("league_id", currentLeagueId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMembers(data || []);
    } catch (error: any) {
      toast.error("Napaka pri nalaganju članov");
    }
  };

  const fetchMatches = async () => {
    try {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("league_id", currentLeagueId)
        .order("match_date", { ascending: false });

      if (error) throw error;
      setMatches(data || []);
    } catch (error: any) {
      toast.error("Napaka pri nalaganju tekem");
    }
  };

  const fetchLeagueSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("leagues")
        .select("password")
        .eq("id", currentLeagueId)
        .single();

      if (error) throw error;
      setLeaguePassword(data?.password || "");
    } catch (error: any) {
      console.error("Error fetching league settings:", error);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: "admin" | "plačan_član" | "neplačan_član") => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("league_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;
      toast.success("Vloga uspešno posodobljena");
      fetchMembers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("league_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;
      toast.success("Član odstranjen iz lige");
      fetchMembers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMatch = async (values: z.infer<typeof matchSchema>) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("matches")
        .insert({
          league_id: currentLeagueId,
          match_date: values.match_date,
          match_time: values.match_time,
          number_of_teams: values.number_of_teams,
          created_by: user?.id
        });

      if (error) throw error;
      toast.success("Tekma uspešno ustvarjena");
      form.reset();
      setDialogOpen(false);
      fetchMatches();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("leagues")
        .update({ password: newPassword || null })
        .eq("id", currentLeagueId);

      if (error) throw error;
      toast.success(newPassword ? "Geslo nastavljeno" : "Geslo odstranjeno");
      setLeaguePassword(newPassword);
      setNewPassword("");
    } catch (error: any) {
      toast.error("Napaka pri posodabljanju gesla");
    } finally {
      setLoading(false);
    }
  };

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      <main className="px-4 py-4">
        <div className="mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Admin Panel
          </h2>
          <p className="text-sm text-muted-foreground">Upravljanje lige in članov</p>
        </div>

        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="members">Člani</TabsTrigger>
            <TabsTrigger value="matches">Tekme</TabsTrigger>
            <TabsTrigger value="settings">Nastavitve</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-3 mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Users className="h-4 w-4" />
              <span>{members.length} članov v ligi</span>
            </div>

            {members.map((member) => (
              <Card key={member.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{member.profiles?.full_name || member.profiles?.email || "Neznano ime"}</span>
                    <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                      {member.role.replace('_', ' ')}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">{member.profiles?.email}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pb-3">
                  <Select 
                    value={member.role} 
                    onValueChange={(value: "admin" | "plačan_član" | "neplačan_član") => handleUpdateRole(member.id, value)}
                    disabled={loading || member.user_id === user.id}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="plačan_član">Plačan član</SelectItem>
                      <SelectItem value="neplačan_član">Neplačan član</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {member.user_id !== user.id && (
                    <Button 
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={loading}
                      variant="destructive"
                      size="sm"
                      className="w-full"
                    >
                      Odstrani iz lige
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="matches" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{matches.length} tekem</span>
              </div>
              
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1">
                    <Plus className="h-4 w-4" />
                    Nova tekma
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="text-base">Ustvari novo tekmo</DialogTitle>
                    <DialogDescription className="text-xs">
                      Dodaj novo tekmo v ligo
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleCreateMatch)} className="space-y-3">
                      <FormField
                        control={form.control}
                        name="match_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Datum</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} className="text-sm" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="match_time"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Ura</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} className="text-sm" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="number_of_teams"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Število ekip</FormLabel>
                            <FormControl>
                              <Input type="number" min="2" max="10" {...field} className="text-sm" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      
                      <Button type="submit" className="w-full" size="sm" disabled={loading}>
                        Ustvari tekmo
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            {matches.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                Ni še nobene tekme
              </p>
            ) : (
              <div className="space-y-2">
                {matches.map((match) => (
                  <Card key={match.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Tekma</CardTitle>
                      <CardDescription className="text-xs">
                        {new Date(match.match_date).toLocaleDateString('sl-SI')} ob {match.match_time}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                      Število ekip: {match.number_of_teams}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Geslo lige
                </CardTitle>
                <CardDescription>
                  Zaščitite ligo z geslom. Samo uporabniki, ki poznajo geslo, se bodo lahko pridružili.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {leaguePassword && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-1">Trenutno geslo:</p>
                    <p className="text-sm text-muted-foreground font-mono">{leaguePassword}</p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="newPassword">
                    {leaguePassword ? "Novo geslo" : "Nastavi geslo"}
                  </Label>
                  <Input
                    id="newPassword"
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={leaguePassword ? "Vnesite novo geslo ali pustite prazno za odstranitev" : "Vnesite geslo za ligo"}
                  />
                  <p className="text-xs text-muted-foreground">
                    {leaguePassword 
                      ? "Pustite prazno, če želite odstraniti geslo"
                      : "Liga bo po nastavitvi gesla zaščitena"
                    }
                  </p>
                </div>

                <Button 
                  onClick={handleUpdatePassword} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Shranjujem..." : leaguePassword ? "Posodobi geslo" : "Nastavi geslo"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

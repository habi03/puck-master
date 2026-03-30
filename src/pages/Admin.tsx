import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, Users, Calendar, Plus, Lock, Pencil, Palette, CalendarDays, Trash2, Star } from "lucide-react";
import { DEFAULT_TEAM_COLORS } from "@/lib/teamColors";
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<any>(null);
  const [leaguePassword, setLeaguePassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [scoringDefaults, setScoringDefaults] = useState({
    points_attendance: "1",
    points_win: "3",
    points_penalty_win: "2",
    points_penalty_loss: "1",
  });
  const [teamColors, setTeamColors] = useState<string[]>([...DEFAULT_TEAM_COLORS]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [newSeasonName, setNewSeasonName] = useState("");
  const [seasonDialogOpen, setSeasonDialogOpen] = useState(false);
  const navigate = useNavigate();

  const matchSchema = z.object({
    match_date: z.string().min(1, "Datum je obvezen"),
    match_time: z.string().min(1, "Ura je obvezna"),
    number_of_teams: z.coerce.number().min(2, "Vsaj 2 ekipi").max(10, "Največ 10 ekip")
  });

  const editMatchSchema = z.object({
    match_date: z.string().min(1, "Datum je obvezen"),
    match_time: z.string().min(1, "Ura je obvezna"),
  });

  const form = useForm<z.infer<typeof matchSchema>>({
    resolver: zodResolver(matchSchema),
    defaultValues: {
      match_date: "",
      match_time: "",
      number_of_teams: 2
    }
  });

  const editForm = useForm<z.infer<typeof editMatchSchema>>({
    resolver: zodResolver(editMatchSchema),
    defaultValues: {
      match_date: "",
      match_time: "",
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
    const validateLeagueMembership = async () => {
      const leagueId = localStorage.getItem("currentLeagueId");
      if (!leagueId) {
        navigate("/leagues");
        return;
      }
      
      if (!user) return;
      
      // Verify membership
      const { data, error } = await supabase
        .from("league_members")
        .select("id")
        .eq("league_id", leagueId)
        .eq("user_id", user.id)
        .single();
      
      if (error || !data) {
        localStorage.removeItem("currentLeagueId");
        toast.error("Nimate več dostopa do te lige");
        navigate("/leagues");
        return;
      }
      
      setCurrentLeagueId(leagueId);
    };
    
    if (user) {
      validateLeagueMembership();
    }
  }, [navigate, user]);

  useEffect(() => {
    if (user && currentLeagueId) {
      checkAdminStatus();
      fetchMembers();
      fetchMatches();
      fetchLeagueSettings();
      fetchSeasons();
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
        .select("*")
        .eq("id", currentLeagueId)
        .single();

      if (error) throw error;
      setLeaguePassword(data?.password || "");
      
      const leagueAny = data as any;
      const getValue = (val: any, defaultVal: string) => {
        if (val === null || val === undefined) return defaultVal;
        return val.toString();
      };
      setScoringDefaults({
        points_attendance: getValue(leagueAny.points_attendance, "1"),
        points_win: getValue(leagueAny.points_win, "3"),
        points_penalty_win: getValue(leagueAny.points_penalty_win, "2"),
        points_penalty_loss: getValue(leagueAny.points_penalty_loss, "1"),
      });
      
      // Load team colors
      if (leagueAny.team_colors && Array.isArray(leagueAny.team_colors)) {
        setTeamColors(leagueAny.team_colors);
      } else {
        setTeamColors([...DEFAULT_TEAM_COLORS]);
      }
    } catch (error: any) {
      // Error fetching settings - continue silently
    }
  };

  const fetchSeasons = async () => {
    try {
      const { data, error } = await supabase
        .from("seasons")
        .select("*")
        .eq("league_id", currentLeagueId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSeasons(data || []);
    } catch (error: any) {
      toast.error("Napaka pri nalaganju sezon");
    }
  };

  const handleCreateSeason = async () => {
    if (!newSeasonName.trim()) {
      toast.error("Ime sezone je obvezno");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("seasons")
        .insert({
          league_id: currentLeagueId,
          name: newSeasonName.trim(),
          is_active: seasons.length === 0, // First season is active by default
        } as any);

      if (error) throw error;
      toast.success("Sezona ustvarjena");
      setNewSeasonName("");
      setSeasonDialogOpen(false);
      fetchSeasons();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetActiveSeason = async (seasonId: string) => {
    setLoading(true);
    try {
      // Deactivate all seasons for this league
      const { error: deactivateError } = await supabase
        .from("seasons")
        .update({ is_active: false } as any)
        .eq("league_id", currentLeagueId);

      if (deactivateError) throw deactivateError;

      // Activate the selected season
      const { error: activateError } = await supabase
        .from("seasons")
        .update({ is_active: true } as any)
        .eq("id", seasonId);

      if (activateError) throw activateError;

      toast.success("Aktivna sezona spremenjena");
      fetchSeasons();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSeason = async (seasonId: string) => {
    if (!confirm("Ali ste prepričani? Tekme v tej sezoni bodo ostale brez sezone.")) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("seasons")
        .delete()
        .eq("id", seasonId);

      if (error) throw error;
      toast.success("Sezona izbrisana");
      fetchSeasons();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateScoringDefaults = async () => {
    setLoading(true);
    try {
      const parseValue = (val: string, defaultVal: number) => {
        const parsed = parseInt(val);
        return Number.isNaN(parsed) ? defaultVal : parsed;
      };
      
      const updateData = {
        points_attendance: parseValue(scoringDefaults.points_attendance, 1),
        points_win: parseValue(scoringDefaults.points_win, 3),
        points_penalty_win: parseValue(scoringDefaults.points_penalty_win, 2),
        points_penalty_loss: parseValue(scoringDefaults.points_penalty_loss, 1),
      };

      const { error } = await supabase
        .from("leagues")
        .update(updateData as any)
        .eq("id", currentLeagueId);

      if (error) throw error;
      toast.success("Default točkovanje shranjeno");
    } catch (error: any) {
      toast.error("Napaka pri shranjevanju točkovanja");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTeamColors = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("leagues")
        .update({ team_colors: teamColors } as any)
        .eq("id", currentLeagueId);

      if (error) throw error;
      toast.success("Barve ekip shranjene");
    } catch (error: any) {
      toast.error("Napaka pri shranjevanju barv");
    } finally {
      setLoading(false);
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
      // Find active season
      const activeSeason = seasons.find(s => s.is_active);
      
      const { error } = await supabase
        .from("matches")
        .insert({
          league_id: currentLeagueId,
          match_date: values.match_date,
          match_time: values.match_time,
          number_of_teams: values.number_of_teams,
          created_by: user?.id,
          ...(activeSeason ? { season_id: activeSeason.id } : {}),
        } as any);

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
      // Validate password strength if provided
      if (newPassword && newPassword.trim() !== '') {
        if (newPassword.length < 8) {
          toast.error("Geslo mora biti dolgo vsaj 8 znakov");
          setLoading(false);
          return;
        }
        if (!/[A-Z]/.test(newPassword)) {
          toast.error("Geslo mora vsebovati vsaj eno veliko črko");
          setLoading(false);
          return;
        }
        if (!/[a-z]/.test(newPassword)) {
          toast.error("Geslo mora vsebovati vsaj eno malo črko");
          setLoading(false);
          return;
        }
        if (!/[0-9]/.test(newPassword)) {
          toast.error("Geslo mora vsebovati vsaj eno številko");
          setLoading(false);
          return;
        }
      }

      // Note: Password hashing now happens server-side
      const { error } = await supabase
        .from("leagues")
        .update({ password: newPassword && newPassword.trim() !== '' ? newPassword : null })
        .eq("id", currentLeagueId);

      if (error) throw error;
      toast.success(newPassword ? "Geslo nastavljeno" : "Geslo odstranjeno");
      setLeaguePassword(newPassword || "");
      setNewPassword("");
    } catch (error: any) {
      toast.error("Napaka pri posodabljanju gesla");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!confirm("Ali ste prepričani, da želite izbrisati to tekmo? Izbrisani bodo tudi vsi prijavljeni igralci in rezultati.")) {
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("matches")
        .delete()
        .eq("id", matchId);

      if (error) throw error;
      toast.success("Tekma uspešno izbrisana");
      fetchMatches();
    } catch (error: any) {
      toast.error("Napaka pri brisanju tekme");
    } finally {
      setLoading(false);
    }
  };

  const handleEditMatch = (match: any) => {
    setEditingMatch(match);
    editForm.reset({
      match_date: match.match_date,
      match_time: match.match_time.slice(0, 5),
    });
    setEditDialogOpen(true);
  };

  const handleUpdateMatch = async (values: z.infer<typeof editMatchSchema>) => {
    if (!editingMatch) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("matches")
        .update({
          match_date: values.match_date,
          match_time: values.match_time,
        })
        .eq("id", editingMatch.id);

      if (error) throw error;
      toast.success("Tekma uspešno posodobljena");
      setEditDialogOpen(false);
      setEditingMatch(null);
      fetchMatches();
    } catch (error: any) {
      toast.error("Napaka pri posodabljanju tekme");
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
                        {new Date(match.match_date).toLocaleDateString('sl-SI')} ob {match.match_time.slice(0, 5)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Število ekip: {match.number_of_teams}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleEditMatch(match)}
                          disabled={loading}
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1"
                        >
                          <Pencil className="h-3 w-3" />
                          Uredi
                        </Button>
                        <Button
                          onClick={() => handleDeleteMatch(match.id)}
                          disabled={loading}
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                        >
                          Izbriši
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {/* Edit Match Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-base">Uredi tekmo</DialogTitle>
                  <DialogDescription className="text-xs">
                    Spremeni datum in uro tekme
                  </DialogDescription>
                </DialogHeader>
                
                <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(handleUpdateMatch)} className="space-y-3">
                    <FormField
                      control={editForm.control}
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
                      control={editForm.control}
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
                    
                    <Button type="submit" className="w-full" size="sm" disabled={loading}>
                      {loading ? "Shranjujem..." : "Shrani spremembe"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
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

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  🏆 Default točkovanje
                </CardTitle>
                <CardDescription>
                  Privzete vrednosti točkovanja za nove tekme. Vsaka tekma lahko ima svoje točkovanje.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="points_attendance">Prisotnost</Label>
                    <Input
                      id="points_attendance"
                      type="number"
                      min="0"
                      value={scoringDefaults.points_attendance}
                      onChange={(e) => setScoringDefaults(prev => ({ ...prev, points_attendance: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="points_win">Zmaga (redni del)</Label>
                    <Input
                      id="points_win"
                      type="number"
                      min="0"
                      value={scoringDefaults.points_win}
                      onChange={(e) => setScoringDefaults(prev => ({ ...prev, points_win: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="points_penalty_win">Zmaga (penali)</Label>
                    <Input
                      id="points_penalty_win"
                      type="number"
                      min="0"
                      value={scoringDefaults.points_penalty_win}
                      onChange={(e) => setScoringDefaults(prev => ({ ...prev, points_penalty_win: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="points_penalty_loss">Poraz (penali)</Label>
                    <Input
                      id="points_penalty_loss"
                      type="number"
                      min="0"
                      value={scoringDefaults.points_penalty_loss}
                      onChange={(e) => setScoringDefaults(prev => ({ ...prev, points_penalty_loss: e.target.value }))}
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={handleUpdateScoringDefaults} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Shranjujem..." : "Shrani točkovanje"}
                </Button>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Barve ekip
                </CardTitle>
                <CardDescription>
                  Nastavite barve za posamezne ekipe (do 4 ekipe).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {teamColors.slice(0, 4).map((color, index) => (
                    <div key={index} className="space-y-2">
                      <Label>Ekipa {index + 1}</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => {
                            const newColors = [...teamColors];
                            newColors[index] = e.target.value;
                            setTeamColors(newColors);
                          }}
                          className="w-10 h-10 rounded cursor-pointer border border-border"
                        />
                        <Input
                          value={color}
                          onChange={(e) => {
                            const newColors = [...teamColors];
                            newColors[index] = e.target.value;
                            setTeamColors(newColors);
                          }}
                          className="font-mono text-sm"
                          placeholder="#000000"
                        />
                      </div>
                      <div 
                        className="h-8 rounded-md border flex items-center justify-center text-xs font-semibold"
                        style={{
                          backgroundColor: `${color}20`,
                          color: color,
                          borderColor: `${color}60`,
                        }}
                      >
                        Ekipa {index + 1}
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => setTeamColors([...DEFAULT_TEAM_COLORS])}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Ponastavi na privzete barve
                </Button>
                
                <Button 
                  onClick={handleUpdateTeamColors} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Shranjujem..." : "Shrani barve"}
                </Button>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Sezone
                </CardTitle>
                <CardDescription>
                  Upravljajte sezone lige. Aktivna sezona se privzeto izbere na domači strani.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{seasons.length} sezon</span>
                  <Dialog open={seasonDialogOpen} onOpenChange={setSeasonDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1">
                        <Plus className="h-4 w-4" />
                        Nova sezona
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle className="text-base">Ustvari novo sezono</DialogTitle>
                        <DialogDescription className="text-xs">
                          Dodaj novo sezono v ligo (npr. "Sezona 2024/25")
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Ime sezone</Label>
                          <Input
                            value={newSeasonName}
                            onChange={(e) => setNewSeasonName(e.target.value)}
                            placeholder="Sezona 2024/25"
                          />
                        </div>
                        <Button onClick={handleCreateSeason} className="w-full" size="sm" disabled={loading}>
                          {loading ? "Ustvarjam..." : "Ustvari sezono"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {seasons.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    Ni še nobene sezone. Ustvarite prvo sezono.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {seasons.map((season) => (
                      <div key={season.id} className={`flex items-center justify-between p-3 rounded-lg border ${season.is_active ? "border-primary bg-primary/5" : "border-border"}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{season.name}</span>
                          {season.is_active && (
                            <Badge variant="default" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Aktivna
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {!season.is_active && (
                            <Button
                              onClick={() => handleSetActiveSeason(season.id)}
                              disabled={loading}
                              variant="outline"
                              size="sm"
                            >
                              Aktiviraj
                            </Button>
                          )}
                          <Button
                            onClick={() => handleDeleteSeason(season.id)}
                            disabled={loading}
                            variant="destructive"
                            size="sm"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

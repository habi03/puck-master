import { useEffect, useMemo, useState } from "react";
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
import { Plus, Users, ArrowRight, Lock, Trash2, Search, Filter, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { ALL_SPORTS, getSportConfig, getSportEmoji, SportType } from "@/lib/sportConfig";
import { useI18n } from "@/lib/i18n";

const makeLeagueSchema = (t: (k: string) => string) => z.object({
  name: z.string()
    .trim()
    .min(3, t("leagues.nameMin"))
    .max(100, t("leagues.nameMax"))
    .regex(/^[a-zA-Z0-9čćžšđČĆŽŠĐ\s-]+$/, t("leagues.nameInvalid")),
  description: z.string()
    .trim()
    .max(500, t("leagues.descMax"))
    .optional(),
  password: z.string()
    .trim()
    .min(8, t("leagues.passwordMin"))
    .max(100, t("leagues.passwordMax"))
    .optional()
    .or(z.literal('')),
  seasonName: z.string()
    .trim()
    .min(1, t("leagues.seasonRequired"))
    .max(100, t("leagues.seasonMax")),
});

export default function Leagues() {
  const [user, setUser] = useState<User | null>(null);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [myLeagues, setMyLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [newLeagueDesc, setNewLeagueDesc] = useState("");
  const [newLeaguePassword, setNewLeaguePassword] = useState("");
  const [newSeasonName, setNewSeasonName] = useState("");
  const [newLeagueCity, setNewLeagueCity] = useState("");
  const [newLeagueCountry, setNewLeagueCountry] = useState("Slovenija");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSport, setSelectedSport] = useState<SportType>("hokej");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState<any>(null);
  const [enteredPassword, setEnteredPassword] = useState("");
  
  // Filters
  const [filterSport, setFilterSport] = useState<string>("all");
  const [filterCity, setFilterCity] = useState<string>("all");
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { t } = useI18n();

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
      toast.error(t("common.error"));
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
      toast.error(t("common.error"));
    }
  };

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validatedData = makeLeagueSchema(t).parse({
        name: newLeagueName,
        description: newLeagueDesc || "",
        password: newLeaguePassword || "",
        seasonName: newSeasonName,
      });

      // Create league
      const { data: leagueData, error } = await supabase
        .from("leagues")
        .insert({
          name: validatedData.name,
          description: validatedData.description || null,
          password: newLeaguePassword && newLeaguePassword.trim() !== '' ? newLeaguePassword : null,
          created_by: user?.id,
          sport_type: selectedSport,
          city: newLeagueCity.trim() || null,
          country: newLeagueCountry.trim() || 'Slovenija',
        } as any)
        .select("id")
        .single();

      if (error) throw error;

      // Create first season for this league
      const { error: seasonError } = await supabase
        .from("seasons")
        .insert({
          league_id: leagueData.id,
          name: validatedData.seasonName,
          is_active: true,
        } as any);

      if (seasonError) {
        console.error("Error creating season:", seasonError);
        toast.error(t("common.error"));
      }

      toast.success(t("leagues.leagueCreated"));
      setNewLeagueName("");
      setNewLeagueDesc("");
      setNewLeaguePassword("");
      setNewSeasonName("");
      setNewLeagueCity("");
      setNewLeagueCountry("Slovenija");
      setSelectedSport("hokej");
      setDialogOpen(false);
      setDialogOpen(false);
      fetchLeagues();
      fetchMyLeagues();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          toast.error(err.message);
        });
      } else {
        toast.error(error.message || t("common.error"));
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
        toast.error(t("common.error"));
        navigate("/auth");
        return;
      }

      const { data: result, error } = await supabase.functions.invoke('join-league', {
        body: { 
          leagueId: selectedLeague.id, 
          password: enteredPassword 
        }
      });

      if (error) {
        toast.error(t("common.error"));
        return;
      }

      if (result.error) {
        toast.error(t("common.error"));
        return;
      }

      toast.success(t("leagues.joinedSuccess"));
      setPasswordDialogOpen(false);
      setEnteredPassword("");
      
      await fetchMyLeagues();
      await fetchLeagues();
    } catch (error) {
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const joinLeague = async (leagueId: string) => {
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error(t("common.error"));
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
        toast.error(t("common.error"));
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success(t("leagues.joinedSuccess"));
      await fetchMyLeagues();
      await fetchLeagues();
    } catch (error: any) {
      toast.error(error.message || t("common.error"));
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
      toast.success(t("leagues.leagueDeleted"));
      fetchLeagues();
      fetchMyLeagues();
    } catch (error: any) {
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLeague = (leagueId: string) => {
    localStorage.setItem("currentLeagueId", leagueId);
    navigate("/league");
  };

  const isInLeague = (leagueId: string) => {
    return myLeagues.some(ml => ml.league_id === leagueId);
  };

  // Compute unique cities and countries for filter options
  const uniqueCities = useMemo(() => [...new Set(leagues.map((l: any) => l.city).filter(Boolean))].sort(), [leagues]);
  const uniqueCountries = useMemo(() => [...new Set(leagues.map((l: any) => l.country).filter(Boolean))].sort(), [leagues]);

  // Filtered leagues
  const filteredLeagues = useMemo(() => leagues.filter((league: any) => {
    if (filterSport !== "all" && league.sport_type !== filterSport) return false;
    if (filterCity !== "all" && league.city !== filterCity) return false;
    if (filterCountry !== "all" && league.country !== filterCountry) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (league.name || "").toLowerCase();
      const desc = (league.description || "").toLowerCase();
      if (!name.includes(q) && !desc.includes(q)) return false;
    }
    return true;
  }), [leagues, filterSport, filterCity, filterCountry, searchQuery]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      <main className="px-4 py-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{t("nav.myLeagues")}</h2>
            <p className="text-sm text-muted-foreground">{t("leagues.createDesc")}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t("leagues.newLeague")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("leagues.createTitle")}</DialogTitle>
                <DialogDescription>{t("leagues.createDesc")}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateLeague} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{t("leagues.sport")} <span className="text-destructive">•</span></Label>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_SPORTS.map((sport) => {
                      const config = getSportConfig(sport);
                      return (
                        <button
                          key={sport}
                          type="button"
                          onClick={() => setSelectedSport(sport)}
                          className={`flex items-center gap-2 rounded-lg border-2 p-3 text-left text-sm font-medium transition-colors ${
                            selectedSport === sport
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card hover:border-muted-foreground/50"
                          }`}
                        >
                          <span className="text-lg">
                            {sport === "hokej" ? "🏒" : sport === "nogomet" ? "⚽" : sport === "košarka" ? "🏀" : "🏐"}
                          </span>
                          <span>{config.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name">{t("leagues.leagueName")} <span className="text-destructive">•</span></Label>
                  <Input
                    id="name"
                    value={newLeagueName}
                    onChange={(e) => setNewLeagueName(e.target.value)}
                    placeholder="Npr. Liga Ljubljana"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">{t("leagues.description")}</Label>
                  <Textarea
                    id="description"
                    value={newLeagueDesc}
                    onChange={(e) => setNewLeagueDesc(e.target.value)}
                    placeholder=""
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="season-name">{t("leagues.seasonName")} <span className="text-destructive">•</span></Label>
                  <Input
                    id="season-name"
                    value={newSeasonName}
                    onChange={(e) => setNewSeasonName(e.target.value)}
                    placeholder="Npr. Sezona 2025/26"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="league-city">{t("leagues.city")}</Label>
                    <Input
                      id="league-city"
                      value={newLeagueCity}
                      onChange={(e) => setNewLeagueCity(e.target.value)}
                      placeholder="Npr. Ljubljana"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="league-country">{t("leagues.country")}</Label>
                    <Input
                      id="league-country"
                      value={newLeagueCountry}
                      onChange={(e) => setNewLeagueCountry(e.target.value)}
                      placeholder="Npr. Slovenija"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="league-password">{t("leagues.password")}</Label>
                  <Input
                    id="league-password"
                    type="password"
                    value={newLeaguePassword}
                    onChange={(e) => setNewLeaguePassword(e.target.value)}
                    placeholder={t("auth.minChars")}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("leagues.creating") : t("leagues.createLeague")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {myLeagues.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">{t("leagues.yourLeagues")}</h3>
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
                          <span>{getSportEmoji((membership.leagues as any).sport_type)}</span>
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
                          <span className="capitalize">{t("index.role")}: {membership.role.replace('_', ' ')}</span>
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
                              <AlertDialogTitle>{t("leagues.delete")}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("leagues.deleteConfirm")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("leagues.cancel")}</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteLeague(membership.league_id);
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {t("leagues.delete")}
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
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">{t("leagues.allLeagues")}</h3>
          
          {/* Search & Filters */}
          <div className="mb-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("leagues.search")}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filterSport} onValueChange={setFilterSport}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder={t("leagues.sport")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("leagues.allSports")}</SelectItem>
                  {ALL_SPORTS.map((sport) => (
                    <SelectItem key={sport} value={sport}>
                      {getSportEmoji(sport)} {getSportConfig(sport).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {uniqueCountries.length > 0 && (
                <Select value={filterCountry} onValueChange={setFilterCountry}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder={t("leagues.country")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("leagues.allCountries")}</SelectItem>
                    {uniqueCountries.map((country) => (
                      <SelectItem key={country} value={country}>{country}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {uniqueCities.length > 0 && (
                <Select value={filterCity} onValueChange={setFilterCity}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder={t("leagues.city")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("leagues.allCities")}</SelectItem>
                    {uniqueCities.map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {filteredLeagues.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                {leagues.length === 0 ? t("leagues.noLeaguesYet") : t("leagues.noMatchFilter")}
              </p>
            ) : (
              filteredLeagues.map((league) => (
                <Card key={league.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span>{getSportEmoji((league as any).sport_type)}</span>
                      {league.name}
                      {league.has_password && <Lock className="h-4 w-4 text-muted-foreground" />}
                    </CardTitle>
                    {league.description && (
                      <CardDescription className="text-xs">{league.description}</CardDescription>
                    )}
                    {((league as any).city || (league as any).country) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        <span>{[(league as any).city, (league as any).country].filter(Boolean).join(", ")}</span>
                      </div>
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
                        {t("leagues.enter")}
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
                            {t("leagues.join")}
                          </>
                        ) : (
                          t("leagues.join")
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
              <DialogTitle>{t("leagues.enterPassword")}</DialogTitle>
              <DialogDescription>
                {t("leagues.passwordRequired")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={enteredPassword}
                  onChange={(e) => setEnteredPassword(e.target.value)}
                  placeholder={t("leagues.enterPassword")}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handlePasswordSubmit();
                    }
                  }}
                />
              </div>
              <Button onClick={handlePasswordSubmit} className="w-full" disabled={!enteredPassword}>
                {t("common.save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

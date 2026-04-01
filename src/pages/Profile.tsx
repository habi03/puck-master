import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import { toast } from "sonner";
import { User, Trophy, Target, Calendar, Beer, Shield, Award, TrendingUp, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Season {
  id: string;
  name: string;
  is_active: boolean;
}

interface Stats {
  matchesPlayed: number;
  wins: number;
  goals: number;
  beersBrought: number;
  totalPoints: number;
  averageRating: number;
}

const emptyStats: Stats = { matchesPlayed: 0, wins: 0, goals: 0, beersBrought: 0, totalPoints: 0, averageRating: 0 };

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [currentLeagueId, setCurrentLeagueId] = useState<string | null>(null);
  const [membership, setMembership] = useState<any>(null);
  const [leagueName, setLeagueName] = useState("");
  const [leagueConfig, setLeagueConfig] = useState<any>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("all");
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [seasonStats, setSeasonStats] = useState<Array<Stats & { name: string }>>([]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

      const leagueId = localStorage.getItem("currentLeagueId");
      if (!leagueId) {
        navigate("/global-profile");
        return;
      }
      setCurrentLeagueId(leagueId);
      fetchData(session.user.id, leagueId);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/auth");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Re-fetch stats when season changes
  useEffect(() => {
    if (user && currentLeagueId && leagueConfig) {
      fetchStats(user.id, currentLeagueId, leagueConfig, selectedSeasonId);
    }
  }, [selectedSeasonId]);

  const fetchData = async (userId: string, leagueId: string) => {
    try {
      const [profileRes, memberRes, leagueRes, seasonsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("league_members").select("*").eq("league_id", leagueId).eq("user_id", userId).single(),
        supabase.from("leagues").select("name, points_attendance, points_win, points_penalty_win, points_penalty_loss").eq("id", leagueId).single(),
        supabase.from("seasons").select("id, name, is_active").eq("league_id", leagueId).order("created_at", { ascending: false }),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (memberRes.error || !memberRes.data) {
        localStorage.removeItem("currentLeagueId");
        navigate("/global-profile");
        return;
      }

      setProfile(profileRes.data);
      setMembership(memberRes.data);
      setLeagueName(leagueRes.data?.name || "");
      setLeagueConfig(leagueRes.data);
      setSeasons(seasonsRes.data || []);

      // Default to active season
      const activeSeason = (seasonsRes.data || []).find((s) => s.is_active);
      const defaultSeason = activeSeason ? activeSeason.id : "all";
      setSelectedSeasonId(defaultSeason);

      await fetchStats(userId, leagueId, leagueRes.data, defaultSeason);
    } catch (error) {
      console.error("Error fetching profile data:", error);
      toast.error("Napaka pri nalaganju profila");
    }
  };

  const fetchStats = async (userId: string, leagueId: string, config: any, seasonId: string) => {
    try {
      let matchesQuery = supabase
        .from("matches")
        .select("id, is_completed, points_attendance, points_win, points_penalty_win, points_penalty_loss, season_id")
        .eq("league_id", leagueId)
        .eq("is_completed", true);

      if (seasonId !== "all") {
        matchesQuery = matchesQuery.eq("season_id", seasonId);
      }

      const { data: matches } = await matchesQuery;

      if (!matches || matches.length === 0) {
        setStats(emptyStats);
        return;
      }

      const matchIds = matches.map((m) => m.id);

      const [participationsRes, goalsRes, resultsRes, ratingRes] = await Promise.all([
        supabase.from("match_participants").select("*").eq("player_id", userId).in("match_id", matchIds),
        supabase.from("goals").select("*").eq("player_id", userId).in("match_id", matchIds),
        supabase.from("match_results").select("*").in("match_id", matchIds),
        supabase.from("rating_aggregates").select("average_rating, beers_brought").eq("player_id", userId).single(),
      ]);

      const participations = participationsRes.data || [];
      const goals = goalsRes.data || [];
      const results = resultsRes.data || [];

      let matchesPlayed = 0;
      let wins = 0;
      let totalPoints = 0;
      let beersBrought = 0;

      for (const p of participations) {
        if (p.is_absent) continue;
        matchesPlayed++;
        if (p.brings_beer) beersBrought++;

        const match = matches.find((m) => m.id === p.match_id);
        if (!match) continue;

        const pa = match.points_attendance ?? config?.points_attendance ?? 1;
        totalPoints += pa;

        if (p.team_number) {
          const teamResults = results.filter((r) => r.match_id === p.match_id);
          const myTeamResult = teamResults.find((r) => r.team_number === p.team_number);

          if (myTeamResult) {
            const otherTeams = teamResults.filter((r) => r.team_number !== p.team_number);
            const maxOtherGoals = Math.max(...otherTeams.map((r) => r.goals_scored), 0);

            if (myTeamResult.goals_scored > maxOtherGoals) {
              wins++;
              if (myTeamResult.win_type === "penalty") {
                totalPoints += match.points_penalty_win ?? config?.points_penalty_win ?? 2;
              } else {
                totalPoints += match.points_win ?? config?.points_win ?? 3;
              }
            } else if (myTeamResult.goals_scored === maxOtherGoals) {
              const loser = teamResults.find(
                (r) => r.team_number !== p.team_number && r.win_type === "penalty"
              );
              if (loser) {
                totalPoints += match.points_penalty_loss ?? config?.points_penalty_loss ?? 1;
              }
            }
          }
        }
      }

      setStats({
        matchesPlayed,
        wins,
        goals: goals.length,
        beersBrought: seasonId === "all" ? (ratingRes.data?.beers_brought || 0) : beersBrought,
        totalPoints,
        averageRating: ratingRes.data?.average_rating || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const roleMap: Record<string, string> = {
    admin: "Admin",
    plačan_član: "Plačan član",
    neplačan_član: "Neplačan član",
  };

  if (!user || !profile || !membership) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <div className="container max-w-2xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <User className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Profil v ligi</h1>
        </div>

        {/* Profile overview */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.avatar_url} alt={profile.full_name || "Uporabnik"} />
                <AvatarFallback className="text-xl">
                  {profile.full_name ? profile.full_name[0].toUpperCase() : profile.email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-lg font-bold">{profile.full_name || profile.email.split("@")[0]}</h2>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={membership.role === "admin" ? "default" : "secondary"}>
                    {membership.role === "admin" && <Shield className="h-3 w-3 mr-1" />}
                    {roleMap[membership.role] || membership.role}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* League stats with season filter */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5 text-primary" />
                  {leagueName}
                </CardTitle>
                <CardDescription>Vaša statistika v tej ligi</CardDescription>
              </div>
              {seasons.length > 0 && (
                <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Sezona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Vse sezone</SelectItem>
                    {seasons.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} {s.is_active ? "●" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <StatItem icon={<Calendar className="h-4 w-4 text-primary" />} label="Tekme" value={stats.matchesPlayed} />
              <StatItem icon={<Award className="h-4 w-4 text-accent" />} label="Zmage" value={stats.wins} />
              <StatItem icon={<Target className="h-4 w-4 text-secondary" />} label="Goli" value={stats.goals} />
              <StatItem icon={<TrendingUp className="h-4 w-4 text-primary" />} label="Točke" value={stats.totalPoints} />
              <StatItem icon={<Beer className="h-4 w-4 text-accent" />} label="Pijače" value={stats.beersBrought} />
              <StatItem
                icon={<Trophy className="h-4 w-4 text-secondary" />}
                label="Ocena"
                value={stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "–"}
              />
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Permissions info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Dovoljenja
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <PermissionRow label="Prijava na tekme" allowed={true} />
              <PermissionRow label="Ogled lestvice" allowed={true} />
              <PermissionRow label="Ocenjevanje igralcev" allowed={true} />
              <PermissionRow label="Upravljanje tekem" allowed={membership.role === "admin"} />
              <PermissionRow label="Upravljanje članov" allowed={membership.role === "admin"} />
              <PermissionRow label="Nastavitve lige" allowed={membership.role === "admin"} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
      {icon}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

function PermissionRow({ label, allowed }: { label: string; allowed: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={allowed ? "default" : "outline"} className="text-xs">
        {allowed ? "Da" : "Ne"}
      </Badge>
    </div>
  );
}

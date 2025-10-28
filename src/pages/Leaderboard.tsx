import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Award, Target, UserCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LeaderboardEntry {
  player_id: string;
  player_name: string;
  position: string;
  attendance: number;
  wins: number;
  goals: number;
  saves: number;
  total_points: number;
  beers_brought: number;
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUser(user);
    
    const leagueId = localStorage.getItem("currentLeagueId");
    if (!leagueId) {
      navigate("/leagues");
      return;
    }

    // Verify membership
    const { data, error } = await supabase
      .from("league_members")
      .select("id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .single();
    
    if (error || !data) {
      localStorage.removeItem("currentLeagueId");
      navigate("/leagues");
      return;
    }

    fetchLeaderboard(leagueId);
  };

  const fetchLeaderboard = async (leagueId: string) => {
    try {
      setLoading(true);

      // Get all match participants with their profiles
      const { data: participants, error: participantsError } = await supabase
        .from("match_participants")
        .select(`
          player_id,
          position,
          team_number,
          match_id,
          matches!inner(id, league_id, is_completed)
        `)
        .eq("matches.league_id", leagueId)
        .eq("matches.is_completed", true)
        .eq("is_present", true);

      if (participantsError) throw participantsError;

      // Get all match results
      const { data: results, error: resultsError } = await supabase
        .from("match_results")
        .select("match_id, team_number, goals_scored");

      if (resultsError) throw resultsError;

      // Get all goals
      const { data: goals, error: goalsError } = await supabase
        .from("goals")
        .select("player_id, match_id");

      if (goalsError) throw goalsError;

      // Get all saves
      const { data: saves, error: savesError } = await supabase
        .from("saves")
        .select("player_id, match_id, saves_count");

      if (savesError) throw savesError;

      // Get profiles for all players
      const playerIds = [...new Set(participants?.map(p => p.player_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", playerIds);

      if (profilesError) throw profilesError;

      // Get beer counts from rating_aggregates
      const { data: beerData, error: beerError } = await supabase
        .from("rating_aggregates")
        .select("player_id, beers_brought")
        .in("player_id", playerIds);

      if (beerError) throw beerError;

      // Build leaderboard by player and position
      const leaderboardMap = new Map<string, LeaderboardEntry>();

      participants?.forEach(participant => {
        const key = `${participant.player_id}_${participant.position}`;
        const profile = profiles?.find(p => p.id === participant.player_id);
        const beerCount = beerData?.find(b => b.player_id === participant.player_id)?.beers_brought || 0;
        
        if (!leaderboardMap.has(key)) {
          leaderboardMap.set(key, {
            player_id: participant.player_id,
            player_name: profile?.full_name || "Neznano ime",
            position: participant.position,
            attendance: 0,
            wins: 0,
            goals: 0,
            saves: 0,
            total_points: 0,
            beers_brought: beerCount,
          });
        }

        const entry = leaderboardMap.get(key)!;
        
        // Count attendance (1 point per match)
        entry.attendance += 1;

        // Check if team won (3 points per win)
        const matchResults = results?.filter(r => r.match_id === participant.match_id) || [];
        if (matchResults.length > 0) {
          const teamResult = matchResults.find(r => r.team_number === participant.team_number);
          const otherResults = matchResults.filter(r => r.team_number !== participant.team_number);
          
          if (teamResult && otherResults.every(r => teamResult.goals_scored > r.goals_scored)) {
            entry.wins += 1;
          }
        }
      });

      // Count goals for players (1 point per goal)
      goals?.forEach(goal => {
        const participant = participants?.find(p => 
          p.player_id === goal.player_id && 
          p.match_id === goal.match_id && 
          p.position === "igralec"
        );
        
        if (participant) {
          const key = `${goal.player_id}_igralec`;
          const entry = leaderboardMap.get(key);
          if (entry) {
            entry.goals += 1;
          }
        }
      });

      // Count saves for goalkeepers (1 point per save)
      saves?.forEach(save => {
        const participant = participants?.find(p => 
          p.player_id === save.player_id && 
          p.match_id === save.match_id && 
          p.position === "vratar"
        );
        
        if (participant) {
          const key = `${save.player_id}_vratar`;
          const entry = leaderboardMap.get(key);
          if (entry) {
            entry.saves += save.saves_count;
          }
        }
      });

      // Calculate total points
      const leaderboardData = Array.from(leaderboardMap.values()).map(entry => ({
        ...entry,
        total_points: entry.attendance + (entry.wins * 3) + entry.goals + entry.saves,
      }));

      // Sort by total points
      leaderboardData.sort((a, b) => b.total_points - a.total_points);

      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const players = leaderboard.filter(e => e.position === "igralec");
  const goalkeepers = leaderboard.filter(e => e.position === "vratar");
  const combined = [...leaderboard].sort((a, b) => b.total_points - a.total_points);

  const renderLeaderboardTable = (entries: LeaderboardEntry[]) => (
    <div className="space-y-2">
      {entries.map((entry, index) => (
        <Card key={`${entry.player_id}_${entry.position}`} className={index < 3 ? "border-primary/50" : ""}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 ${
                  index === 0 ? "bg-yellow-500/20 text-yellow-600" :
                  index === 1 ? "bg-gray-400/20 text-gray-600" :
                  index === 2 ? "bg-orange-500/20 text-orange-600" :
                  "bg-muted"
                }`}>
                  <span className="text-xs font-bold">{index + 1}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{entry.player_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{entry.position}</p>
                </div>
              </div>
              <div className="text-center flex-shrink-0">
                <p className="font-bold text-lg text-primary">{entry.total_points}</p>
                <p className="text-xs text-muted-foreground">Točke</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between gap-2 pt-2 border-t text-xs">
              <div className="text-center">
                <p className="font-semibold">{entry.attendance}</p>
                <p className="text-muted-foreground">Prisotnosti</p>
              </div>
              <div className="text-center">
                <p className="font-semibold">{entry.wins}</p>
                <p className="text-muted-foreground">Zmage</p>
              </div>
              {entry.position === "igralec" && (
                <div className="text-center">
                  <p className="font-semibold">{entry.goals}</p>
                  <p className="text-muted-foreground">Goli</p>
                </div>
              )}
              {entry.position === "vratar" && (
                <div className="text-center">
                  <p className="font-semibold">{entry.saves}</p>
                  <p className="text-muted-foreground">Obrambe</p>
                </div>
              )}
              <div className="text-center">
                <p className="font-semibold">🍺 {entry.beers_brought}</p>
                <p className="text-muted-foreground">Pivo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {entries.length === 0 && (
        <p className="text-center text-muted-foreground py-8">Ni podatkov</p>
      )}
    </div>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <div className="container mx-auto px-4 py-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              Lestvica
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Točke: Prisotnost (1) + Zmaga ekipe (3) + Gol/Obramba (1)
            </p>
          </CardHeader>
        </Card>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">
              <Award className="h-4 w-4 mr-2" />
              Vsi
            </TabsTrigger>
            <TabsTrigger value="players">
              <UserCircle className="h-4 w-4 mr-2" />
              Igralci
            </TabsTrigger>
            <TabsTrigger value="goalkeepers">
              <Target className="h-4 w-4 mr-2" />
              Vratarji
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-4">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Nalaganje...</p>
            ) : (
              renderLeaderboardTable(combined)
            )}
          </TabsContent>
          
          <TabsContent value="players" className="mt-4">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Nalaganje...</p>
            ) : (
              renderLeaderboardTable(players)
            )}
          </TabsContent>
          
          <TabsContent value="goalkeepers" className="mt-4">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Nalaganje...</p>
            ) : (
              renderLeaderboardTable(goalkeepers)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Award, Target, UserCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LeaderboardEntry {
  player_id: string;
  player_name: string;
  position: string;
  attendance: number;
  wins: number;
  saves: number;
  total_points: number;
  beers_brought: number;
  goals_for: number; // Goals scored by player's team
  goals_against: number; // Goals conceded by goalkeeper's team
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScoring, setShowScoring] = useState(false);

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
        .select("match_id, team_number, goals_scored, win_type");

      if (resultsError) throw resultsError;

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
            saves: 0,
            total_points: 0,
            beers_brought: beerCount,
            goals_for: 0,
            goals_against: 0,
          });
        }

        const entry = leaderboardMap.get(key)!;
        
        // Count attendance (1 point per match)
        entry.attendance += 1;

        // Check if team won and calculate points based on win type
        const matchResults = results?.filter(r => r.match_id === participant.match_id) || [];
        if (matchResults.length > 0) {
          const teamResult = matchResults.find(r => r.team_number === participant.team_number);
          const otherResults = matchResults.filter(r => r.team_number !== participant.team_number);
          const winType = teamResult?.win_type || 'regulation';
          
          // Track goals for players (goals scored by their team)
          if (teamResult && participant.position === "igralec") {
            entry.goals_for += teamResult.goals_scored;
          }
          
          // Track goals against for goalkeepers (goals conceded by their team)
          if (teamResult && participant.position === "vratar") {
            const goalsAgainst = otherResults.reduce((sum, r) => sum + r.goals_scored, 0);
            entry.goals_against += goalsAgainst;
          }
          
          if (teamResult && otherResults.every(r => teamResult.goals_scored > r.goals_scored)) {
            // Team won
            entry.wins += 1;
            // Add win points to total: 3 for regulation, 2 for penalty shootout
            entry.total_points += winType === 'regulation' ? 3 : 2;
          } else if (teamResult && winType === 'penalty_shootout' && otherResults.some(r => teamResult.goals_scored < r.goals_scored)) {
            // Team lost after penalty shootout: 1 point
            entry.total_points += 1;
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

      // Calculate total points (win points already added in the loop above)
      const leaderboardData = Array.from(leaderboardMap.values()).map(entry => ({
        ...entry,
        total_points: entry.total_points + entry.attendance + entry.saves,
      }));

      // Sort by total points, then by goals (goals_for for players, goals_against for goalkeepers)
      leaderboardData.sort((a, b) => {
        // First sort by total points
        if (b.total_points !== a.total_points) {
          return b.total_points - a.total_points;
        }
        
        // If points are equal, use goals as tiebreaker
        if (a.position === "igralec" && b.position === "igralec") {
          // For players: more goals scored is better
          return b.goals_for - a.goals_for;
        } else if (a.position === "vratar" && b.position === "vratar") {
          // For goalkeepers: fewer goals conceded is better
          return a.goals_against - b.goals_against;
        }
        
        // Mixed positions (shouldn't happen in practice)
        return 0;
      });

      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const players = leaderboard.filter(e => e.position === "igralec");
  const goalkeepers = leaderboard.filter(e => e.position === "vratar");
  const combined = [...leaderboard];

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
                  <p className="font-semibold">{entry.goals_for}</p>
                  <p className="text-muted-foreground">Goli ekipe</p>
                </div>
              )}
              {entry.position === "vratar" && (
                <>
                  <div className="text-center">
                    <p className="font-semibold">{entry.saves}</p>
                    <p className="text-muted-foreground">Obrambe</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">{entry.goals_against}</p>
                    <p className="text-muted-foreground">Prejeti goli</p>
                  </div>
                </>
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
            <CardTitle 
              className="flex items-center justify-between cursor-pointer hover:text-primary transition-colors"
              onClick={() => setShowScoring(!showScoring)}
            >
              <div className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-primary" />
                Lestvica
              </div>
              {showScoring ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </CardTitle>
            {showScoring && (
              <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                <strong>Točkovanje:</strong><br />
                • Prisotnost: 1 točka<br />
                • Zmaga v rednem delu: 3 točke<br />
                • Zmaga po kazenskih strelih: 2 točki<br />
                • Poraz po kazenskih strelih: 1 točka<br />
                • Obramba (vratar): 1 točka<br /><br />
                <strong>Pri izenačenih točkah:</strong><br />
                • Igralci: več golov ekipe<br />
                • Vratarji: manj prejetih golov
              </p>
            )}
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


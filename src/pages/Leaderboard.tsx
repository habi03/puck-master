import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Award, Target, UserCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LeaderboardEntry {
  player_id: string;
  player_name: string;
  position: string;
  attendance: number;
  wins: number;
  total_points: number;
  beers_brought: number;
  goals_for: number; // Goals scored by player's team
  goals_against: number; // Goals conceded by goalkeeper's team
}

interface ScoringConfig {
  points_attendance: number;
  points_win: number;
  points_penalty_win: number;
  points_penalty_loss: number;
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScoring, setShowScoring] = useState(false);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("all");
  const [scoring, setScoring] = useState<ScoringConfig>({
    points_attendance: 1,
    points_win: 3,
    points_penalty_win: 2,
    points_penalty_loss: 1,
  });

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

    // Fetch seasons
    const { data: seasonsData } = await supabase
      .from("seasons")
      .select("*")
      .eq("league_id", leagueId)
      .order("created_at", { ascending: false });
    
    const seasonsList = seasonsData || [];
    setSeasons(seasonsList);
    
    const activeSeason = seasonsList.find((s: any) => s.is_active);
    if (activeSeason) {
      setSelectedSeasonId(activeSeason.id);
      fetchLeaderboard(leagueId, activeSeason.id);
    } else {
      setSelectedSeasonId("all");
      fetchLeaderboard(leagueId, "all");
    }
  };

  const handleSeasonChange = (seasonId: string) => {
    setSelectedSeasonId(seasonId);
    const leagueId = localStorage.getItem("currentLeagueId");
    if (leagueId) {
      fetchLeaderboard(leagueId, seasonId);
    }
  };

  const fetchLeaderboard = async (leagueId: string, seasonId: string = "all") => {
    try {
      setLoading(true);

      // Get league default scoring configuration
      const { data: leagueData, error: leagueError } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", leagueId)
        .single();

      if (leagueError) throw leagueError;
      
      const leagueAny = leagueData as any;
      const leagueDefaults: ScoringConfig = {
        points_attendance: leagueAny.points_attendance ?? 1,
        points_win: leagueAny.points_win ?? 3,
        points_penalty_win: leagueAny.points_penalty_win ?? 2,
        points_penalty_loss: leagueAny.points_penalty_loss ?? 1,
      };
      setScoring(leagueDefaults);

      // Get all completed matches with their scoring
      let matchesQuery = supabase
        .from("matches")
        .select("*")
        .eq("league_id", leagueId)
        .eq("is_completed", true);
      
      if (seasonId !== "all") {
        matchesQuery = matchesQuery.eq("season_id", seasonId);
      }
      
      const { data: matches, error: matchesError } = await matchesQuery;

      if (matchesError) throw matchesError;

      // Build a map of match_id to scoring config + flag if attendance was explicitly set
      const matchScoringMap = new Map<string, ScoringConfig & { attendanceExplicitlySet: boolean }>();
      matches?.forEach(m => {
        const mAny = m as any;
        matchScoringMap.set(m.id, {
          points_attendance: mAny.points_attendance ?? leagueDefaults.points_attendance,
          points_win: mAny.points_win ?? leagueDefaults.points_win,
          points_penalty_win: mAny.points_penalty_win ?? leagueDefaults.points_penalty_win,
          points_penalty_loss: mAny.points_penalty_loss ?? leagueDefaults.points_penalty_loss,
          attendanceExplicitlySet: mAny.points_attendance !== null,
        });
      });

      // Get match IDs for filtering participants
      const matchIds = matches?.map(m => m.id) || [];
      
      if (matchIds.length === 0) {
        setLeaderboard([]);
        setLoading(false);
        return;
      }

      // Get all match participants with their profiles
      const { data: participants, error: participantsError } = await supabase
        .from("match_participants")
        .select(`
          player_id,
          position,
          team_number,
          match_id
        `)
        .in("match_id", matchIds)
        .eq("is_present", true);

      if (participantsError) throw participantsError;

      // Get all match results
      const { data: results, error: resultsError } = await supabase
        .from("match_results")
        .select("match_id, team_number, goals_scored, win_type");

      if (resultsError) throw resultsError;

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
        
        // Get scoring config for this specific match
        const matchScoring = matchScoringMap.get(participant.match_id) || { ...leagueDefaults, attendanceExplicitlySet: false };
        
        if (!leaderboardMap.has(key)) {
          leaderboardMap.set(key, {
            player_id: participant.player_id,
            player_name: profile?.full_name || "Neznano ime",
            position: participant.position,
            attendance: 0,
            wins: 0,
            total_points: 0,
            beers_brought: beerCount,
            goals_for: 0,
            goals_against: 0,
          });
        }

        const entry = leaderboardMap.get(key)!;
        
        // Skip attendance count only if match explicitly has points_attendance = 0
        const skipAttendance = matchScoring.attendanceExplicitlySet && matchScoring.points_attendance === 0;
        if (!skipAttendance) {
          entry.attendance += 1;
          entry.total_points += matchScoring.points_attendance;
        }

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
            // Team won - use match-specific scoring
            entry.wins += 1;
            entry.total_points += winType === 'regulation' ? matchScoring.points_win : matchScoring.points_penalty_win;
          } else if (teamResult && winType === 'penalty_shootout' && otherResults.some(r => teamResult.goals_scored < r.goals_scored)) {
            // Team lost after penalty shootout - use match-specific scoring
            entry.total_points += matchScoring.points_penalty_loss;
          }
        }
      });

      // Points are now calculated per-match in the loop above
      const leaderboardData = Array.from(leaderboardMap.values());

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
                <div className="text-center">
                  <p className="font-semibold">{entry.goals_against}</p>
                  <p className="text-muted-foreground">Prejeti goli</p>
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
                • Prisotnost: {scoring.points_attendance} {scoring.points_attendance === 1 ? "točka" : "točke"}<br />
                • Zmaga v rednem delu: +{scoring.points_win} {scoring.points_win === 1 ? "točka" : "točke"}<br />
                • Zmaga po kazenskih strelih: +{scoring.points_penalty_win} {scoring.points_penalty_win === 1 ? "točka" : "točki"}<br />
                • Poraz po kazenskih strelih: +{scoring.points_penalty_loss} {scoring.points_penalty_loss === 1 ? "točka" : "točka"}<br /><br />
                <strong>Pri izenačenih točkah:</strong><br />
                • Igralci: več golov ekipe<br />
                • Vratarji: manj prejetih golov
              </p>
            )}
          </CardHeader>
        </Card>

        {seasons.length > 0 && (
          <div className="mb-4">
            <Select value={selectedSeasonId} onValueChange={handleSeasonChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Izberi sezono" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vse sezone</SelectItem>
                {seasons.map((season) => (
                  <SelectItem key={season.id} value={season.id}>
                    <span className="flex items-center gap-1.5">{season.name} {season.is_active && <span className="inline-block h-2 w-2 rounded-full bg-destructive animate-pulse" />}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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


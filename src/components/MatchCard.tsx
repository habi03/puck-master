import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, UserPlus, UserMinus, ChevronRight, Beer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { sl } from "date-fns/locale";
import { useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MatchCardProps {
  match: any;
  currentUser: any;
  participants: any[];
  onUpdate: () => void;
}

export default function MatchCard({ match, currentUser, participants, onUpdate }: MatchCardProps) {
  const navigate = useNavigate();
  const [position, setPosition] = useState<"igralec" | "vratar">("igralec");
  const [loading, setLoading] = useState(false);
  const [matchResults, setMatchResults] = useState<any[]>([]);
  const [matchSaves, setMatchSaves] = useState<any[]>([]);

  const userParticipation = participants.find(p => p.player_id === currentUser.id);
  const isSignedUp = !!userParticipation;
  const isCompleted = match.is_completed || false;

  useEffect(() => {
    if (isCompleted) {
      fetchMatchResults();
      fetchMatchSaves();
    }
  }, [isCompleted, match.id]);

  const fetchMatchResults = async () => {
    try {
      const { data, error } = await supabase
        .from("match_results")
        .select("*")
        .eq("match_id", match.id)
        .order("team_number", { ascending: true });

      if (error) throw error;
      setMatchResults(data || []);
    } catch (error: any) {
      console.error("Error fetching results:", error);
    }
  };

  const fetchMatchSaves = async () => {
    try {
      const { data, error } = await supabase
        .from("saves")
        .select("*")
        .eq("match_id", match.id);

      if (error) throw error;
      setMatchSaves(data || []);
    } catch (error: any) {
      console.error("Error fetching saves:", error);
    }
  };

  const handleSignUp = async () => {
    if (isCompleted) {
      toast.error("Tekma je zaključena - prijave so zaprte");
      return;
    }
    setLoading(true);
    try {
      // Check goalkeeper limit per team
      if (position === "vratar") {
        const goalkeepersCount = participants.filter(p => p.position === "vratar").length;
        if (goalkeepersCount >= match.number_of_teams) {
          toast.error(`Vseh ${match.number_of_teams} mest za vratarje je že zasedenih (en vratar na ekipo)`);
          setLoading(false);
          return;
        }
      }

      // Calculate combined rating at time of signup
      let combinedRating = 3.0; // Default middle value

      // Get peer rating
      const { data: ratingData } = await supabase
        .from("rating_aggregates")
        .select("average_rating")
        .eq("player_id", currentUser.id)
        .single();

      const peerRating = ratingData?.average_rating || 3.0;

      // Get leaderboard data for current league
      const { data: leagueData } = await supabase
        .from("matches")
        .select("league_id")
        .eq("id", match.id)
        .single();

      if (leagueData) {
        // Fetch all completed matches in this league
        const { data: completedMatches } = await supabase
          .from("matches")
          .select("id")
          .eq("league_id", leagueData.league_id)
          .eq("is_completed", true);

        const matchIds = completedMatches?.map(m => m.id) || [];

        if (matchIds.length > 0) {
          // Get participant data for leaderboard calculation
          const { data: allParticipants } = await supabase
            .from("match_participants")
            .select("player_id, position, team_number, match_id, is_present")
            .in("match_id", matchIds)
            .eq("is_present", true);

          const { data: allResults } = await supabase
            .from("match_results")
            .select("match_id, team_number, goals_scored");

          const { data: allGoals } = await supabase
            .from("goals")
            .select("player_id, match_id");

          const { data: allSaves } = await supabase
            .from("saves")
            .select("player_id, match_id, saves_count");

          // Calculate leaderboard scores
          const scores = new Map<string, number>();

          allParticipants?.forEach(p => {
            const key = `${p.player_id}_${p.position}`;
            if (!scores.has(key)) {
              scores.set(key, 0);
            }
            // Attendance: 1 point
            scores.set(key, scores.get(key)! + 1);

            // Team win: 3 points
            const matchResults = allResults?.filter(r => r.match_id === p.match_id) || [];
            const teamResult = matchResults.find(r => r.team_number === p.team_number);
            const otherResults = matchResults.filter(r => r.team_number !== p.team_number);
            if (teamResult && otherResults.every(r => teamResult.goals_scored > r.goals_scored)) {
              scores.set(key, scores.get(key)! + 3);
            }
          });

          // Goals for players
          allGoals?.forEach(g => {
            const p = allParticipants?.find(ap => ap.player_id === g.player_id && ap.match_id === g.match_id && ap.position === "igralec");
            if (p) {
              const key = `${g.player_id}_igralec`;
              scores.set(key, (scores.get(key) || 0) + 1);
            }
          });

          // Saves for goalkeepers
          allSaves?.forEach(s => {
            const p = allParticipants?.find(ap => ap.player_id === s.player_id && ap.match_id === s.match_id && ap.position === "vratar");
            if (p) {
              const key = `${s.player_id}_vratar`;
              scores.set(key, (scores.get(key) || 0) + s.saves_count);
            }
          });

          // Get player's leaderboard score
          const playerKey = `${currentUser.id}_${position}`;
          const playerScore = scores.get(playerKey) || 0;
          const maxScore = Math.max(...Array.from(scores.values()), 1);

          // Normalize leaderboard score to 1-5 scale
          const normalizedLeaderboardScore = (playerScore / maxScore) * 4 + 1; // Scale to 1-5

          // Calculate combined rating: 0.6 * peer + 0.4 * leaderboard
          combinedRating = 0.6 * peerRating + 0.4 * normalizedLeaderboardScore;
        }
      }

      const { error } = await supabase
        .from("match_participants")
        .insert({
          match_id: match.id,
          player_id: currentUser.id,
          position: position,
          combined_rating: combinedRating,
        });

      if (error) throw error;
      toast.success(`Uspešno ste se prijavili kot ${position}`);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (isCompleted) {
      toast.error("Tekma je zaključena - odjave niso mogoče");
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("match_participants")
        .delete()
        .eq("id", userParticipation.id);

      if (error) throw error;
      toast.success("Uspešno ste se odjavili");
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBringBeer = async () => {
    if (isCompleted) {
      toast.error("Tekma je zaključena");
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("match_participants")
        .update({ brings_beer: true })
        .eq("id", userParticipation.id);

      if (error) throw error;
      toast.success("Hvala! 🍺");
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBeer = async () => {
    if (isCompleted) {
      toast.error("Tekma je zaključena");
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("match_participants")
        .update({ brings_beer: false })
        .eq("id", userParticipation.id);

      if (error) throw error;
      toast.success("Preklic piva");
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const beerBringer = participants.find(p => p.brings_beer);

  const matchDate = new Date(match.match_date);
  const formattedDate = format(matchDate, "EEEE, d. MMMM yyyy", { locale: sl });

  return (
    <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer" onClick={() => navigate(`/match/${match.id}`)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Tekma</span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{match.number_of_teams} ekipe</Badge>
            {isCompleted && (
              <Badge variant="default" className="text-xs">Zaključena</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 flex-shrink-0" />
          <span className="capitalize text-xs">{formattedDate}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs">{match.match_time}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs">{participants.length} prijavljenih</span>
        </div>
        
        {beerBringer && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <Beer className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs font-semibold">
              Pivo: {currentUser.id === beerBringer.player_id ? 'Ti' : (beerBringer.profiles?.full_name || 'Nekdo')}
            </span>
          </div>
        )}
        
        {isCompleted && (
          <div className="pt-2 border-t mt-2 space-y-2">
            <div className="text-xs font-semibold mb-2 text-muted-foreground">Rezultat:</div>
            <div className="flex gap-3 justify-center">
              {Array.from({ length: match.number_of_teams }, (_, i) => i + 1).map((teamNum) => {
                const result = matchResults.find(r => r.team_number === teamNum);
                const goals = result?.goals_scored || 0;
                const teamColor = teamNum === 1 ? "bg-green-100 text-green-700 border-green-300" : 
                                 teamNum === 2 ? "bg-red-100 text-red-700 border-red-300" : 
                                 "bg-blue-100 text-blue-700 border-blue-300";
                return (
                  <div key={teamNum} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border ${teamColor}`}>
                    <span className="text-xs font-semibold">Ekipa {teamNum}</span>
                    <div className="text-2xl font-bold">
                      {goals}
                    </div>
                  </div>
                );
              }).reduce((prev, curr, idx) => {
                if (idx === 0) return [curr];
                return [...prev, <span key={`sep-${idx}`} className="text-2xl font-bold text-muted-foreground">:</span>, curr];
              }, [] as React.ReactNode[])}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2 pt-3">
        {!isCompleted ? (
          !isSignedUp ? (
            <>
              <Select value={position} onValueChange={(v: any) => setPosition(v)}>
                <SelectTrigger className="w-full" onClick={(e) => e.stopPropagation()}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="igralec">Igralec</SelectItem>
                  <SelectItem value="vratar">Vratar</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleSignUp();
                }} 
                disabled={loading} 
                className="w-full"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Prijavi se
              </Button>
            </>
          ) : (
            <>
              <Badge variant="outline" className="w-full justify-center py-1.5 text-xs">
                Prijavljeni kot: {userParticipation.position}
              </Badge>
              
              {!userParticipation.brings_beer && !beerBringer && (
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBringBeer();
                  }} 
                  disabled={loading} 
                  variant="secondary"
                  className="w-full"
                >
                  <Beer className="h-4 w-4 mr-2" />
                  JAZ PRINESEM PIVO
                </Button>
              )}
              
              {userParticipation.brings_beer && (
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelBeer();
                  }} 
                  disabled={loading} 
                  variant="outline"
                  className="w-full"
                >
                  <Beer className="h-4 w-4 mr-2" />
                  PREKLIČI PIVO
                </Button>
              )}
              
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleSignOut();
                }} 
                disabled={loading} 
                variant="destructive" 
                className="w-full"
              >
                <UserMinus className="h-4 w-4 mr-2" />
                Odjavi se
              </Button>
            </>
          )
        ) : (
          <Badge variant="secondary" className="w-full justify-center py-2 text-xs">
            Prijave zaprte - tekma zaključena
          </Badge>
        )}
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full gap-1 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/match/${match.id}`);
          }}
        >
          Podrobnosti
          <ChevronRight className="h-3 w-3" />
        </Button>
      </CardFooter>
    </Card>
  );
}
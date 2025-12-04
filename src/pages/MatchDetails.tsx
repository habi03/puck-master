import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Users, Shield, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Match = {
  id: string;
  match_date: string;
  match_time: string;
  number_of_teams: number;
  league_id: string;
  is_completed: boolean;
  team_algorithm: string | null;
};

type Participant = {
  id: string;
  player_id: string;
  position: string;
  team_number: number | null;
  is_present: boolean;
  combined_rating?: number;
  profiles: {
    full_name: string | null;
    email: string;
  };
  rating_aggregates: {
    average_rating: number;
  } | null;
};

export default function MatchDetails() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [algorithm, setAlgorithm] = useState<"serpentine" | "abba" | "first-last" | "greedy" | "dp">("serpentine");
  const [usedAlgorithm, setUsedAlgorithm] = useState<string | null>(null);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [teamGoals, setTeamGoals] = useState<{ [key: number]: number }>({});
  const [matchResults, setMatchResults] = useState<any[]>([]);
  const [winType, setWinType] = useState<"regulation" | "penalty_shootout">("regulation");

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
    if (matchId && user) {
    fetchMatch();
    fetchParticipants();
    fetchMatchResults();
    }
  }, [matchId, user]);

  useEffect(() => {
    if (match && user) {
      checkAdminStatus();
    }
  }, [match, user]);

  // Load existing results when dialog opens for completed matches
  useEffect(() => {
    if (resultsDialogOpen && match?.is_completed) {
      loadExistingResults();
    }
  }, [resultsDialogOpen, match?.is_completed]);

  const checkAdminStatus = async () => {
    if (!match) return;
    
    try {
      const { data, error } = await supabase
        .from("league_members")
        .select("role")
        .eq("league_id", match.league_id)
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      setIsAdmin(data?.role === "admin");
    } catch (error: any) {
      // Error checking status - continue
    }
  };

  const fetchMatch = async () => {
    try {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (error) throw error;
      setMatch(data);
      
      // Set algorithm from database if available
      if (data.team_algorithm) {
        setUsedAlgorithm(data.team_algorithm);
      }
    } catch (error: any) {
      toast.error("Napaka pri nalaganju tekme");
      navigate("/");
    }
  };

  const fetchParticipants = async () => {
    try {
      // Fetch current match participants
      const { data: participantsData, error } = await supabase
        .from("match_participants")
        .select("*")
        .eq("match_id", matchId)
        .order("team_number", { ascending: true, nullsFirst: false });

      if (error) throw error;
      
      // Get player IDs for this match
      const playerIds = participantsData?.map(p => p.player_id) || [];
      
      // Fetch profiles and ratings in parallel
      const [profilesResult, ratingsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", playerIds),
        supabase
          .from("rating_aggregates")
          .select("player_id, average_rating")
          .in("player_id", playerIds)
      ]);

      // Enrich participants with profile and rating data
      const enrichedParticipants = participantsData?.map((p) => {
        const profileData = profilesResult.data?.find(prof => prof.id === p.player_id);
        const ratingData = ratingsResult.data?.find(r => r.player_id === p.player_id);
        const average_rating = ratingData?.average_rating || 0;
        
        // Combined rating is simply the average rating from Tekmovalci tab
        const combined_rating = average_rating;
          
        return {
          ...p,
          profiles: profileData,
          rating_aggregates: ratingData,
          average_rating,
          combined_rating
        };
      }) || [];
      
      // Sort by combined rating
      const sorted = enrichedParticipants.sort((a, b) => {
        return (b.combined_rating || 0) - (a.combined_rating || 0);
      });
      
      setParticipants(sorted as Participant[]);
    } catch (error: any) {
      toast.error("Napaka pri nalaganju igralcev");
    }
  };

  const fetchMatchResults = async () => {
    try {
      const { data, error } = await supabase
        .from("match_results")
        .select("*")
        .eq("match_id", matchId)
        .order("team_number", { ascending: true });

      if (error) throw error;
      setMatchResults(data || []);
    } catch (error: any) {
      // Error fetching results - continue
    }
  };

  const loadExistingResults = () => {
    // Load team goals
    const existingTeamGoals: { [key: number]: number } = {};
    matchResults.forEach(result => {
      existingTeamGoals[result.team_number] = result.goals_scored;
    });
    setTeamGoals(existingTeamGoals);
  };

  const distributeTeams = async () => {
    if (!match) return;
    
    setLoading(true);
    try {
      // Separate goalkeepers and players
      const goalkeepers = participants.filter(p => p.position === "vratar");
      const players = participants.filter(p => p.position === "igralec");
      
      const numTeams = match.number_of_teams;
      const teams: Participant[][] = Array.from({ length: numTeams }, () => []);
      
      // Sort goalkeepers alphabetically by name
      const sortedGoalkeepers = [...goalkeepers].sort((a, b) => {
        const nameA = a.profiles?.full_name || "";
        const nameB = b.profiles?.full_name || "";
        return nameA.localeCompare(nameB);
      });
      
      // Distribute goalkeepers - first alphabetically to team 1, second to team 2, etc.
      sortedGoalkeepers.slice(0, numTeams).forEach((gk, index) => {
        teams[index].push(gk);
      });
      
      // Sort players by combined_rating (highest first)
      const sortedPlayers = [...players].sort((a, b) => 
        (b.combined_rating || 0) - (a.combined_rating || 0)
      );
      
      // Distribute players based on algorithm
      if (algorithm === "serpentine") {
        // Serpentine/Snake draft - proper implementation
        let teamIndex = 0;
        let direction = 1;
        
        sortedPlayers.forEach((player, playerIndex) => {
          teams[teamIndex].push(player);
          
          // Determine next team index for next player
          if (playerIndex < sortedPlayers.length - 1) {
            if (direction === 1) {
              if (teamIndex < numTeams - 1) {
                teamIndex++;
              } else {
                // Reached the end, reverse direction
                direction = -1;
                teamIndex--;
              }
            } else {
              if (teamIndex > 0) {
                teamIndex--;
              } else {
                // Reached the beginning, reverse direction
                direction = 1;
                teamIndex++;
              }
            }
          }
        });
      } else if (algorithm === "abba") {
        // ABBA pattern (best for 2 teams)
        let picks = 0;
        
        sortedPlayers.forEach((player) => {
          let teamIndex = 0;
          
          // ABBA pattern: 1-2-2-1-1-2-2-1...
          if (picks % 4 === 1 || picks % 4 === 2) {
            teamIndex = 1;
          } else {
            teamIndex = 0;
          }
          
          teams[teamIndex].push(player);
          picks++;
        });
      } else if (algorithm === "first-last") {
        // First-Last pattern: first and last to team 1, second and second-to-last to team 2, etc.
        let front = 0;
        let back = sortedPlayers.length - 1;
        let teamIndex = 0;
        
        while (front <= back) {
          // Add front player
          teams[teamIndex].push(sortedPlayers[front]);
          front++;
          
          // Add back player (if different from front)
          if (front <= back) {
            teams[teamIndex].push(sortedPlayers[back]);
            back--;
          }
          
          // Move to next team (round-robin)
          teamIndex = (teamIndex + 1) % numTeams;
        }
      } else if (algorithm === "greedy") {
        // Greedy balancing by ratings
        // Keep track of total ratings for each team
        const teamRatings: number[] = Array(numTeams).fill(0);
        
        // Add goalkeeper ratings to team totals
        teams.forEach((team, index) => {
          team.forEach(player => {
            teamRatings[index] += player.combined_rating || 0;
          });
        });
        
        // Distribute players - always add to team with lowest total rating
        sortedPlayers.forEach((player) => {
          // Find team with lowest rating
          let minRatingTeamIndex = 0;
          let minRating = teamRatings[0];
          
          for (let i = 1; i < numTeams; i++) {
            if (teamRatings[i] < minRating) {
              minRating = teamRatings[i];
              minRatingTeamIndex = i;
            }
          }
          
          // Add player to team with lowest rating
          teams[minRatingTeamIndex].push(player);
          teamRatings[minRatingTeamIndex] += player.combined_rating || 0;
        });
      } else if (algorithm === "dp") {
        // Dynamic Programming - Partition Problem (optimal for 2 teams)
        if (numTeams === 2) {
          // DP approach for optimal 2-team partition
          const n = sortedPlayers.length;
          const scaledRatings = sortedPlayers.map(p => Math.round((p.combined_rating || 0) * 100));
          const totalRating = scaledRatings.reduce((sum, r) => sum + r, 0);
          const target = Math.floor(totalRating / 2);
          
          // DP table: dp[j] = can we achieve sum j?
          const dp: boolean[] = Array(target + 1).fill(false);
          dp[0] = true;
          
          // For backtracking: store which players contributed to each sum
          const chosen: Set<number>[] = Array(target + 1).fill(null).map(() => new Set());
          
          // Fill DP table
          for (let i = 0; i < n; i++) {
            const rating = scaledRatings[i];
            // Go backwards to avoid using same player twice
            for (let j = target; j >= rating; j--) {
              if (dp[j - rating] && !dp[j]) {
                dp[j] = true;
                chosen[j] = new Set([...chosen[j - rating], i]);
              }
            }
          }
          
          // Find best achievable sum close to target
          let bestSum = target;
          while (bestSum >= 0 && !dp[bestSum]) {
            bestSum--;
          }
          
          // Get team 1 players
          const team1Players = chosen[bestSum];
          
          // Distribute players
          sortedPlayers.forEach((player, index) => {
            if (team1Players.has(index)) {
              teams[0].push(player);
            } else {
              teams[1].push(player);
            }
          });
        } else {
          // For more than 2 teams, fall back to greedy
          const teamRatings: number[] = Array(numTeams).fill(0);
          teams.forEach((team, index) => {
            team.forEach(player => {
              teamRatings[index] += player.combined_rating || 0;
            });
          });
          
          sortedPlayers.forEach((player) => {
            let minRatingTeamIndex = 0;
            let minRating = teamRatings[0];
            for (let i = 1; i < numTeams; i++) {
              if (teamRatings[i] < minRating) {
                minRating = teamRatings[i];
                minRatingTeamIndex = i;
              }
            }
            teams[minRatingTeamIndex].push(player);
            teamRatings[minRatingTeamIndex] += player.combined_rating || 0;
          });
        }
      }
      
      // Update database with team assignments
      const updates = teams.flatMap((team, teamNum) =>
        team.map(participant => ({
          id: participant.id,
          team_number: teamNum + 1
        }))
      );
      
      for (const update of updates) {
        const { error } = await supabase
          .from("match_participants")
          .update({ team_number: update.team_number })
          .eq("id", update.id);
          
        if (error) throw error;
      }
      
      // Store which algorithm was used
      const algorithmNames: Record<string, string> = {
        serpentine: "Serpentine (Kača)",
        abba: "ABBA",
        "first-last": "First-Last (Prvi-Zadnji)",
        greedy: "Greedy balansiranje",
        dp: "DP optimalen"
      };
      const algorithmName = algorithmNames[algorithm];
      setUsedAlgorithm(algorithmName);
      
      // Save algorithm to database
      const { error: algoError } = await supabase
        .from("matches")
        .update({ team_algorithm: algorithmName })
        .eq("id", matchId);
      
      if (algoError) console.error("Error saving algorithm:", algoError);
      
      toast.success("Ekipe uspešno razporejene");
      fetchParticipants();
    } catch (error: any) {
      toast.error("Napaka pri razporejanju ekip");
    } finally {
      setLoading(false);
    }
  };

  const clearTeams = async () => {
    setLoading(true);
    try {
      // Clear team assignments
      const { error } = await supabase
        .from("match_participants")
        .update({ team_number: null })
        .eq("match_id", matchId);
        
      if (error) throw error;
      
      // Clear algorithm from database
      await supabase
        .from("matches")
        .update({ team_algorithm: null })
        .eq("id", matchId);
      
      setUsedAlgorithm(null);
      toast.success("Ekipe počiščene");
      fetchParticipants();
    } catch (error: any) {
      toast.error("Napaka pri čiščenju ekip");
    } finally {
      setLoading(false);
    }
  };

  const saveMatchResults = async () => {
    if (!match) return;
    
    setLoading(true);
    try {
      // Delete existing results
      await supabase.from("match_results").delete().eq("match_id", matchId);

      // Insert match results for each team
      const resultsToInsert = Object.entries(teamGoals).map(([teamNum, goals]) => ({
        match_id: matchId,
        team_number: parseInt(teamNum),
        goals_scored: goals,
        win_type: winType
      }));

      if (resultsToInsert.length > 0) {
        const { error: resultsError } = await supabase
          .from("match_results")
          .insert(resultsToInsert);
        if (resultsError) throw resultsError;
      }

      // Mark match as completed
      const { error: matchError } = await supabase
        .from("matches")
        .update({ is_completed: true })
        .eq("id", matchId);
      
      if (matchError) throw matchError;

      toast.success("Rezultati shranjeni - tekma zaključena");
      setResultsDialogOpen(false);
      setTeamGoals({});
      fetchMatch();
      fetchMatchResults();
    } catch (error: any) {
      toast.error("Napaka pri shranjevanju rezultatov");
    } finally {
      setLoading(false);
    }
  };

  const cancelMatchResults = async () => {
    if (!match || !match.is_completed) return;
    
    setLoading(true);
    try {
      // Delete all match results
      await supabase.from("match_results").delete().eq("match_id", matchId);

      // Mark match as not completed (reopen it)
      const { error: matchError } = await supabase
        .from("matches")
        .update({ is_completed: false })
        .eq("id", matchId);
      
      if (matchError) throw matchError;

      toast.success("Rezultati preklicani - tekma ponovno odprta");
      
      // Clear state
      setTeamGoals({});
      
      // Refresh data
      fetchMatch();
      fetchMatchResults();
    } catch (error: any) {
      toast.error("Napaka pri preklicu rezultatov");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!match) return null;

  // Group participants by team
  const teams: { [key: number]: Participant[] } = {};
  const unassigned: Participant[] = [];
  
  participants.forEach(p => {
    if (p.team_number) {
      if (!teams[p.team_number]) teams[p.team_number] = [];
      teams[p.team_number].push(p);
    } else {
      unassigned.push(p);
    }
  });

  // Sort each team to show goalkeepers first
  Object.keys(teams).forEach(teamNum => {
    teams[parseInt(teamNum)].sort((a, b) => {
      if (a.position === "vratar" && b.position !== "vratar") return -1;
      if (a.position !== "vratar" && b.position === "vratar") return 1;
      return 0;
    });
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      <main className="px-4 py-4">
        <Button
          onClick={() => navigate("/")}
          variant="ghost"
          size="sm"
          className="mb-4 gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Nazaj
        </Button>

        <div className="mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            Tekma {new Date(match.match_date).toLocaleDateString('sl-SI')}
            {match.is_completed && (
              <Badge variant="secondary" className="text-xs">Zaključena</Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            Ura: {match.match_time.slice(0, 5)} • {match.number_of_teams} ekipe
          </p>
        </div>

        {match.is_completed && (
          <Card className="mb-4 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Rezultat tekme
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-4 mb-6 py-4">
                {Array.from({ length: match.number_of_teams }, (_, i) => i + 1).map((teamNum) => {
                  const result = matchResults.find(r => r.team_number === teamNum);
                  const goals = result?.goals_scored || 0;
                  return (
                    <div key={teamNum} className="flex flex-col items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Ekipa {teamNum}</span>
                      <div className="text-5xl font-bold text-primary">
                        {goals}
                      </div>
                    </div>
                  );
                }).reduce((prev, curr, idx) => {
                  if (idx === 0) return [curr];
                  return [...prev, <span key={`sep-${idx}`} className="text-5xl font-bold text-muted-foreground px-2">:</span>, curr];
                }, [] as React.ReactNode[])}
              </div>
              {matchResults.length > 0 && matchResults[0].win_type && (
                <div className="text-center text-sm text-muted-foreground border-t pt-3">
                  {matchResults[0].win_type === "regulation" ? "Redni del" : "Kazenski streli"}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <>
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Admin kontrole
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Algoritem razporejanja
                </label>
                <Select value={algorithm} onValueChange={(v: "serpentine" | "abba" | "first-last" | "greedy" | "dp") => setAlgorithm(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="serpentine">Serpentine (Kača)</SelectItem>
                    <SelectItem value="abba">ABBA</SelectItem>
                    <SelectItem value="first-last">Prvi-Zadnji</SelectItem>
                    <SelectItem value="greedy">Greedy balansiranje</SelectItem>
                    <SelectItem value="dp">DP optimalen (počasen)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={distributeTeams}
                  disabled={loading || participants.length === 0}
                  size="sm"
                  className="flex-1"
                >
                  Razporedi ekipe
                </Button>
                <Button 
                  onClick={clearTeams}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  Počisti ekipe
                </Button>
              </div>
            </CardContent>
          </Card>

          <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full gap-2 mb-2">
                <Target className="h-4 w-4" />
                {match.is_completed ? "Uredi rezultate" : "Vnesi rezultat tekme"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{match.is_completed ? "Uredi rezultate tekme" : "Vnos rezultata tekme"}</DialogTitle>
                <DialogDescription>
                  {match.is_completed ? "Posodobi število golov za vsako ekipo" : "Vnesi število golov za vsako ekipo"}
                </DialogDescription>
              </DialogHeader>

              <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                <Label className="text-sm font-semibold mb-3 block">Način zmage:</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="winType"
                      value="regulation"
                      checked={winType === "regulation"}
                      onChange={(e) => setWinType(e.target.value as "regulation")}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Končano v rednem delu</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="winType"
                      value="penalty_shootout"
                      checked={winType === "penalty_shootout"}
                      onChange={(e) => setWinType(e.target.value as "penalty_shootout")}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Končano po kazenskih strelih</span>
                  </label>
                </div>
              </div>

              <div className="space-y-6 mt-4">
                {Object.entries(teams).map(([teamNum, teamPlayers]) => {
                  const goalkeepers = teamPlayers.filter(p => p.position === "vratar");
                  
                  return (
                    <Card key={teamNum} className={`${
                      parseInt(teamNum) === 1 ? "bg-green-50 border-green-200" : 
                      parseInt(teamNum) === 2 ? "bg-red-50 border-red-200" : 
                      "bg-blue-50 border-blue-200"
                    }`}>
                      <CardHeader className="pb-3">
                        <CardTitle className={`text-sm flex items-center justify-between ${
                          parseInt(teamNum) === 1 ? "text-green-700" : 
                          parseInt(teamNum) === 2 ? "text-red-700" : 
                          "text-blue-700"
                        }`}>
                          <span className="font-bold">Ekipa {teamNum}</span>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`goals-${teamNum}`} className="text-xs font-normal">
                              Goli:
                            </Label>
                            <Input
                              id={`goals-${teamNum}`}
                              type="number"
                              min="0"
                              value={teamGoals[parseInt(teamNum)] || 0}
                              onChange={(e) => setTeamGoals(prev => ({
                                ...prev,
                                [parseInt(teamNum)]: parseInt(e.target.value) || 0
                              }))}
                              className="w-20 h-8"
                            />
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  onClick={saveMatchResults}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? "Shranjevanje..." : match.is_completed ? "Posodobi rezultate" : "Shrani rezultate"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setResultsDialogOpen(false);
                    // Clear form if not completed
                    if (!match.is_completed) {
                      setTeamGoals({});
                    }
                  }}
                  disabled={loading}
                >
                  Prekliči
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {match.is_completed && (
            <Button 
              variant="destructive" 
              className="w-full gap-2"
              onClick={cancelMatchResults}
              disabled={loading}
            >
              Prekliči rezultate in odpri tekmo
            </Button>
          )}
          </>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Users className="h-4 w-4" />
          <span>{participants.length} prijavljenih igralcev</span>
        </div>

        {Object.keys(teams).length > 0 && (
          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Ekipe</h3>
              {usedAlgorithm && (
                <Badge variant="outline" className="text-xs">
                  {usedAlgorithm}
                </Badge>
              )}
            </div>
                {Object.entries(teams).map(([teamNum, teamPlayers]) => (
              <Card key={teamNum} className={`${
                parseInt(teamNum) === 1 ? "bg-green-50 border-green-200" : 
                parseInt(teamNum) === 2 ? "bg-red-50 border-red-200" : 
                "bg-blue-50 border-blue-200"
              }`}>
                <CardHeader className="pb-2">
                  <CardTitle className={`text-sm ${
                    parseInt(teamNum) === 1 ? "text-green-700" : 
                    parseInt(teamNum) === 2 ? "text-red-700" : 
                    "text-blue-700"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">Ekipa {teamNum}</span>
                        <Badge variant="secondary" className="text-xs">
                          {teamPlayers.length} igralcev
                        </Badge>
                      </div>
                      <div className="text-xs font-normal text-muted-foreground">
                        Povprečje: {(() => {
                          const playersOnly = teamPlayers.filter(p => p.position === "igralec");
                          if (playersOnly.length === 0) return "N/A";
                          return (playersOnly.reduce((sum, p) => sum + (p.combined_rating || 0), 0) / playersOnly.length).toFixed(2);
                        })()}
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {/* Vratarji */}
                  {teamPlayers.filter(p => p.position === "vratar").map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-medium truncate">
                          {p.profiles?.full_name || p.profiles?.email.split('@')[0]}
                        </span>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {p.position}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isAdmin && (
                          <Select
                            value={p.team_number?.toString()}
                            onValueChange={async (value: string) => {
                              try {
                                const { error } = await supabase
                                  .from("match_participants")
                                  .update({ team_number: value === "unassigned" ? null : parseInt(value) })
                                  .eq("id", p.id);
                                if (error) throw error;
                                
                                // Mark as manual assignment
                                await supabase
                                  .from("matches")
                                  .update({ team_algorithm: "Ročno" })
                                  .eq("id", matchId);
                                setUsedAlgorithm("Ročno");
                                
                                toast.success("Ekipa posodobljena");
                                fetchParticipants();
                              } catch (error: any) {
                                toast.error("Napaka pri spreminjanju ekipe");
                              }
                            }}
                          >
                            <SelectTrigger className="h-6 w-16 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: match.number_of_teams }, (_, i) => (
                                <SelectItem key={i + 1} value={(i + 1).toString()}>
                                  E{i + 1}
                                </SelectItem>
                              ))}
                              <SelectItem value="unassigned">-</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Separator if there are goalkeepers */}
                  {teamPlayers.filter(p => p.position === "vratar").length > 0 && 
                   teamPlayers.filter(p => p.position === "igralec").length > 0 && (
                    <div className="border-t my-2" />
                  )}
                  
                  {/* Igralci */}
                  {teamPlayers.filter(p => p.position === "igralec").map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-medium truncate">
                          {p.profiles?.full_name || p.profiles?.email.split('@')[0]}
                        </span>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {p.position}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-muted-foreground">
                          ⭐ {p.combined_rating?.toFixed(2) || "N/A"}
                        </span>
                        {isAdmin && (
                          <Select
                            value={p.team_number?.toString()}
                            onValueChange={async (value: string) => {
                              try {
                                const { error } = await supabase
                                  .from("match_participants")
                                  .update({ team_number: value === "unassigned" ? null : parseInt(value) })
                                  .eq("id", p.id);
                                if (error) throw error;
                                
                                // Mark as manual assignment
                                await supabase
                                  .from("matches")
                                  .update({ team_algorithm: "Ročno" })
                                  .eq("id", matchId);
                                setUsedAlgorithm("Ročno");
                                
                                toast.success("Ekipa posodobljena");
                                fetchParticipants();
                              } catch (error: any) {
                                toast.error("Napaka pri spreminjanju ekipe");
                              }
                            }}
                          >
                            <SelectTrigger className="h-6 w-16 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: match.number_of_teams }, (_, i) => (
                                <SelectItem key={i + 1} value={(i + 1).toString()}>
                                  E{i + 1}
                                </SelectItem>
                              ))}
                              <SelectItem value="unassigned">-</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {unassigned.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">
              {Object.keys(teams).length > 0 ? "Nerazporejeni" : "Vsi prijavljeni"}
            </h3>
            <Card>
              <CardContent className="pt-4 space-y-2">
                {/* Vratarji */}
                {unassigned
                  .filter(p => p.position === "vratar")
                  .sort((a, b) => {
                    const nameA = a.profiles?.full_name || "";
                    const nameB = b.profiles?.full_name || "";
                    return nameA.localeCompare(nameB);
                  })
                  .map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-medium truncate">
                          {p.profiles?.full_name || p.profiles?.email.split('@')[0]}
                        </span>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {p.position}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isAdmin && (
                          <Select
                            value="unassigned"
                            onValueChange={async (value: string) => {
                              try {
                                const { error } = await supabase
                                  .from("match_participants")
                                  .update({ team_number: value === "unassigned" ? null : parseInt(value) })
                                  .eq("id", p.id);
                                if (error) throw error;
                                
                                // Mark as manual assignment
                                await supabase
                                  .from("matches")
                                  .update({ team_algorithm: "Ročno" })
                                  .eq("id", matchId);
                                setUsedAlgorithm("Ročno");
                                
                                toast.success("Ekipa posodobljena");
                                fetchParticipants();
                              } catch (error: any) {
                                toast.error("Napaka pri spreminjanju ekipe");
                              }
                            }}
                          >
                            <SelectTrigger className="h-6 w-16 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: match.number_of_teams }, (_, i) => (
                                <SelectItem key={i + 1} value={(i + 1).toString()}>
                                  E{i + 1}
                                </SelectItem>
                              ))}
                              <SelectItem value="unassigned">-</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  ))}
                
                {/* Separator if there are goalkeepers */}
                {unassigned.filter(p => p.position === "vratar").length > 0 && (
                  <Separator className="my-3" />
                )}
                
                {/* Igralci */}
                {unassigned
                  .filter(p => p.position === "igralec")
                  .sort((a, b) => (b.combined_rating || 0) - (a.combined_rating || 0))
                  .map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-medium truncate">
                          {p.profiles?.full_name || p.profiles?.email.split('@')[0]}
                        </span>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {p.position}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-muted-foreground">
                          ⭐ {p.combined_rating?.toFixed(2) || "N/A"}
                        </span>
                        {isAdmin && (
                          <Select
                            value="unassigned"
                            onValueChange={async (value: string) => {
                              try {
                                const { error } = await supabase
                                  .from("match_participants")
                                  .update({ team_number: value === "unassigned" ? null : parseInt(value) })
                                  .eq("id", p.id);
                                if (error) throw error;
                                
                                // Mark as manual assignment
                                await supabase
                                  .from("matches")
                                  .update({ team_algorithm: "Ročno" })
                                  .eq("id", matchId);
                                setUsedAlgorithm("Ročno");
                                
                                toast.success("Ekipa posodobljena");
                                fetchParticipants();
                              } catch (error: any) {
                                toast.error("Napaka pri spreminjanju ekipe");
                              }
                            }}
                          >
                            <SelectTrigger className="h-6 w-16 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: match.number_of_teams }, (_, i) => (
                                <SelectItem key={i + 1} value={(i + 1).toString()}>
                                  E{i + 1}
                                </SelectItem>
                              ))}
                              <SelectItem value="unassigned">-</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        )}

        {Object.keys(teams).length > 0 && (
          <div className="space-y-2 mt-6">
            <h3 className="text-sm font-semibold">
              Vsi prijavljeni igralci (Ocena iz Tekmovalcev)
            </h3>
            <Card>
              <CardContent className="pt-4 space-y-2">
                {/* Vratarji */}
                {participants
                  .filter(p => p.position === "vratar")
                  .sort((a, b) => {
                    const nameA = a.profiles?.full_name || "";
                    const nameB = b.profiles?.full_name || "";
                    return nameA.localeCompare(nameB);
                  })
                  .map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-medium truncate">
                        {p.profiles?.full_name || p.profiles?.email.split('@')[0]}
                      </span>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {p.position}
                      </Badge>
                      {p.team_number && (
                        <Badge className={`text-xs flex-shrink-0 ${
                          p.team_number === 1 ? "bg-green-100 text-green-700 border-green-300" : 
                          p.team_number === 2 ? "bg-red-100 text-red-700 border-red-300" : 
                          "bg-blue-100 text-blue-700 border-blue-300"
                        }`}>
                          Ekipa {p.team_number}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Separator if there are goalkeepers */}
                {participants.filter(p => p.position === "vratar").length > 0 && (
                  <Separator className="my-3" />
                )}
                
                {/* Igralci */}
                {participants
                  .filter(p => p.position === "igralec")
                  .sort((a, b) => (b.combined_rating || 0) - (a.combined_rating || 0))
                  .map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-medium truncate">
                        {p.profiles?.full_name || p.profiles?.email.split('@')[0]}
                      </span>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {p.position}
                      </Badge>
                      {p.team_number && (
                        <Badge className={`text-xs flex-shrink-0 ${
                          p.team_number === 1 ? "bg-green-100 text-green-700 border-green-300" : 
                          p.team_number === 2 ? "bg-red-100 text-red-700 border-red-300" : 
                          "bg-blue-100 text-blue-700 border-blue-300"
                        }`}>
                          Ekipa {p.team_number}
                        </Badge>
                      )}
                    </div>
                    <span className="text-muted-foreground flex-shrink-0">
                      ⭐ {p.combined_rating?.toFixed(2) || "N/A"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {participants.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Ni še prijavljenih igralcev
          </p>
        )}
      </main>
    </div>
  );
}

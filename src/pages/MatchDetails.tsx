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

type Match = {
  id: string;
  match_date: string;
  match_time: string;
  number_of_teams: number;
  league_id: string;
  is_completed: boolean;
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
  my_rating?: number | null;
};

export default function MatchDetails() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [algorithm, setAlgorithm] = useState<"serpentine" | "abba">("serpentine");
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [teamGoals, setTeamGoals] = useState<{ [key: number]: number }>({});
  const [playerGoals, setPlayerGoals] = useState<{ [key: number]: { [playerId: string]: number } }>({});
  const [matchResults, setMatchResults] = useState<any[]>([]);
  const [matchGoals, setMatchGoals] = useState<any[]>([]);
  const [matchSaves, setMatchSaves] = useState<any[]>([]);
  const [goalkeeperSaves, setGoalkeeperSaves] = useState<{ [key: number]: { [playerId: string]: number } }>({});

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
      fetchMatchGoals();
      fetchMatchSaves();
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
    } catch (error: any) {
      toast.error("Napaka pri nalaganju tekme");
      navigate("/");
    }
  };

  const fetchParticipants = async () => {
    try {
      const { data: participantsData, error } = await supabase
        .from("match_participants")
        .select("*")
        .eq("match_id", matchId)
        .order("team_number", { ascending: true, nullsFirst: false });

      if (error) throw error;
      
      // Fetch rating aggregates and my ratings separately
      const playersWithRatings = await Promise.all(
        (participantsData || []).map(async (p) => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", p.player_id)
            .single();
            
          const { data: ratingData } = await supabase
            .from("rating_aggregates")
            .select("average_rating")
            .eq("player_id", p.player_id)
            .single();
          
          // Fetch my rating for this player
          const { data: myRatingData } = await supabase
            .from("player_ratings")
            .select("rating")
            .eq("rated_player_id", p.player_id)
            .eq("rater_id", user?.id)
            .maybeSingle();
            
          return {
            ...p,
            profiles: profileData,
            rating_aggregates: ratingData,
            my_rating: myRatingData?.rating || null
          };
        })
      );
      
      // Sort by combined rating (highest to lowest), with fallback to peer rating
      const sorted = playersWithRatings.sort((a, b) => {
        const ratingA = a.combined_rating || a.rating_aggregates?.average_rating || 0;
        const ratingB = b.combined_rating || b.rating_aggregates?.average_rating || 0;
        return ratingB - ratingA;
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

  const fetchMatchGoals = async () => {
    try {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("match_id", matchId);

      if (error) throw error;
      
      // Fetch profiles for each goal
      const goalsWithProfiles = await Promise.all(
        (data || []).map(async (goal) => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", goal.player_id)
            .single();
          
          return {
            ...goal,
            profiles: profileData
          };
        })
      );
      
      setMatchGoals(goalsWithProfiles);
    } catch (error: any) {
      // Error fetching goals - continue
    }
  };

  const fetchMatchSaves = async () => {
    try {
      const { data, error } = await supabase
        .from("saves")
        .select("*")
        .eq("match_id", matchId);

      if (error) throw error;
      
      // Fetch profiles for each save
      const savesWithProfiles = await Promise.all(
        (data || []).map(async (save) => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", save.player_id)
            .single();
          
          return {
            ...save,
            profiles: profileData
          };
        })
      );
      
      setMatchSaves(savesWithProfiles);
    } catch (error: any) {
      // Error fetching saves - continue
    }
  };

  const loadExistingResults = () => {
    // Load team goals
    const existingTeamGoals: { [key: number]: number } = {};
    matchResults.forEach(result => {
      existingTeamGoals[result.team_number] = result.goals_scored;
    });
    setTeamGoals(existingTeamGoals);

    // Load player goals
    const existingPlayerGoals: { [key: number]: { [playerId: string]: number } } = {};
    matchGoals.forEach(goal => {
      if (!existingPlayerGoals[goal.team_number]) {
        existingPlayerGoals[goal.team_number] = {};
      }
      if (!existingPlayerGoals[goal.team_number][goal.player_id]) {
        existingPlayerGoals[goal.team_number][goal.player_id] = 0;
      }
      existingPlayerGoals[goal.team_number][goal.player_id]++;
    });
    setPlayerGoals(existingPlayerGoals);

    // Load goalkeeper saves
    const existingSaves: { [key: number]: { [playerId: string]: number } } = {};
    matchSaves.forEach(save => {
      if (!existingSaves[save.team_number]) {
        existingSaves[save.team_number] = {};
      }
      existingSaves[save.team_number][save.player_id] = save.saves_count;
    });
    setGoalkeeperSaves(existingSaves);
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
      
      // Distribute goalkeepers - only one per team
      goalkeepers.slice(0, numTeams).forEach((gk, index) => {
        teams[index].push(gk);
      });
      
      // Distribute players based on algorithm
      if (algorithm === "serpentine") {
        // Serpentine/Snake draft
        let teamIndex = 0;
        let direction = 1;
        
        players.forEach((player) => {
          teams[teamIndex].push(player);
          teamIndex += direction;
          
          if (teamIndex >= numTeams) {
            teamIndex = numTeams - 1;
            direction = -1;
          } else if (teamIndex < 0) {
            teamIndex = 0;
            direction = 1;
          }
        });
      } else if (algorithm === "abba") {
        // ABBA pattern (best for 2 teams)
        let picks = 0;
        
        players.forEach((player) => {
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
      const { error } = await supabase
        .from("match_participants")
        .update({ team_number: null })
        .eq("match_id", matchId);
        
      if (error) throw error;
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
    
    // Validate that total player goals match team goals for each team
    for (const [teamNum, goalCount] of Object.entries(teamGoals)) {
      const teamPlayerGoals = playerGoals[parseInt(teamNum)] || {};
      const totalPlayerGoals = Object.values(teamPlayerGoals).reduce((sum, goals) => sum + goals, 0);
      
      if (totalPlayerGoals !== goalCount) {
        toast.error(`Ekipa ${teamNum}: Vsota golov igralcev (${totalPlayerGoals}) se ne ujema s skupnimi goli ekipe (${goalCount})`);
        return;
      }
    }
    
    setLoading(true);
    try {
      // Delete existing results and goals
      await supabase.from("match_results").delete().eq("match_id", matchId);
      await supabase.from("goals").delete().eq("match_id", matchId);
      await supabase.from("saves").delete().eq("match_id", matchId);

      // Insert match results for each team
      const resultsToInsert = Object.entries(teamGoals).map(([teamNum, goals]) => ({
        match_id: matchId,
        team_number: parseInt(teamNum),
        goals_scored: goals
      }));

      if (resultsToInsert.length > 0) {
        const { error: resultsError } = await supabase
          .from("match_results")
          .insert(resultsToInsert);
        if (resultsError) throw resultsError;
      }

      // Insert individual goals (one row per goal)
      const goalsToInsert = Object.entries(playerGoals).flatMap(([teamNum, players]) =>
        Object.entries(players).flatMap(([playerId, goalCount]) =>
          Array(goalCount).fill(null).map(() => ({
            match_id: matchId,
            player_id: playerId,
            team_number: parseInt(teamNum)
          }))
        )
      );

      if (goalsToInsert.length > 0) {
        const { error: goalsError } = await supabase
          .from("goals")
          .insert(goalsToInsert);
        if (goalsError) throw goalsError;
      }

      // Insert goalkeeper saves
      const savesToInsert = Object.entries(goalkeeperSaves).flatMap(([teamNum, goalkeepers]) =>
        Object.entries(goalkeepers)
          .filter(([_, saves]) => saves > 0)
          .map(([playerId, saves]) => ({
            match_id: matchId,
            player_id: playerId,
            team_number: parseInt(teamNum),
            saves_count: saves
          }))
      );

      if (savesToInsert.length > 0) {
        const { error: savesError } = await supabase
          .from("saves")
          .insert(savesToInsert);
        if (savesError) throw savesError;
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
      setPlayerGoals({});
      setGoalkeeperSaves({});
      fetchMatch();
      fetchMatchResults();
      fetchMatchGoals();
      fetchMatchSaves();
    } catch (error: any) {
      toast.error("Napaka pri shranjevanju rezultatov");
    } finally {
      setLoading(false);
    }
  };

  const updatePlayerGoals = (teamNum: number, playerId: string, goals: number) => {
    setPlayerGoals(prev => {
      const teamPlayers = prev[teamNum] || {};
      
      return {
        ...prev,
        [teamNum]: {
          ...teamPlayers,
          [playerId]: goals
        }
      };
    });
  };

  const updateGoalkeeperSaves = (teamNum: number, playerId: string, saves: number) => {
    setGoalkeeperSaves(prev => {
      const teamGoalkeepers = prev[teamNum] || {};
      
      return {
        ...prev,
        [teamNum]: {
          ...teamGoalkeepers,
          [playerId]: saves
        }
      };
    });
  };

  const cancelMatchResults = async () => {
    if (!match || !match.is_completed) return;
    
    setLoading(true);
    try {
      // Delete all match results, goals, and saves
      await supabase.from("match_results").delete().eq("match_id", matchId);
      await supabase.from("goals").delete().eq("match_id", matchId);
      await supabase.from("saves").delete().eq("match_id", matchId);

      // Mark match as not completed (reopen it)
      const { error: matchError } = await supabase
        .from("matches")
        .update({ is_completed: false })
        .eq("id", matchId);
      
      if (matchError) throw matchError;

      toast.success("Rezultati preklicani - tekma ponovno odprta");
      
      // Clear state
      setTeamGoals({});
      setPlayerGoals({});
      setGoalkeeperSaves({});
      
      // Refresh data
      fetchMatch();
      fetchMatchResults();
      fetchMatchGoals();
      fetchMatchSaves();
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
            Ura: {match.match_time} • {match.number_of_teams} ekipe
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

              <div className="space-y-4 border-t pt-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Strelci golov:</h4>
                {Array.from({ length: match.number_of_teams }, (_, i) => i + 1).map((teamNum) => {
                  const result = matchResults.find(r => r.team_number === teamNum);
                  const goals = result?.goals_scored || 0;
                  const teamGoalsData = matchGoals.filter(g => g.team_number === teamNum);
                  const goalsByPlayer: { [playerId: string]: { count: number, name: string } } = {};
                  
                  teamGoalsData.forEach(goal => {
                    if (!goalsByPlayer[goal.player_id]) {
                      goalsByPlayer[goal.player_id] = {
                        count: 0,
                        name: goal.profiles?.full_name || goal.profiles?.email.split('@')[0] || 'Neznano'
                      };
                    }
                    goalsByPlayer[goal.player_id].count++;
                  });

                  // Get goalkeeper saves
                  const teamSaves = matchSaves.filter(s => s.team_number === teamNum);

                  return (
                    <div key={teamNum} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-sm px-2 py-1 rounded ${
                          teamNum === 1 ? "bg-green-100 text-green-700" : 
                          teamNum === 2 ? "bg-red-100 text-red-700" : 
                          "bg-blue-100 text-blue-700"
                        }`}>Ekipa {teamNum}</span>
                        <Badge variant="secondary" className="text-sm">
                          {goals} {goals === 1 ? 'gol' : goals === 2 ? 'gola' : 'golov'}
                        </Badge>
                      </div>
                      {Object.keys(goalsByPlayer).length > 0 ? (
                        <div className="pl-4 space-y-1.5">
                          {Object.entries(goalsByPlayer).map(([playerId, data]) => (
                            <div key={playerId} className="text-sm flex items-center gap-2">
                              <Target className="h-3.5 w-3.5 text-primary" />
                              <span>{data.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {data.count}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="pl-4 text-xs text-muted-foreground italic">
                          Brez zadetkov
                        </div>
                      )}
                      
                      {teamSaves.length > 0 && (
                        <div className="pl-4 pt-2 space-y-1.5 border-t mt-2">
                          <div className="text-xs font-semibold text-muted-foreground mb-1">Obrambe vratarjev:</div>
                          {teamSaves.map((save) => (
                            <div key={save.id} className="text-sm flex items-center gap-2">
                              <Shield className="h-3.5 w-3.5 text-green-600" />
                              <span>{save.profiles?.full_name || save.profiles?.email.split('@')[0] || 'Neznano'}</span>
                              <Badge variant="outline" className="text-xs bg-green-50">
                                {save.saves_count}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
                <Select value={algorithm} onValueChange={(v: "serpentine" | "abba") => setAlgorithm(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="serpentine">Serpentine (Kača)</SelectItem>
                    <SelectItem value="abba">ABBA</SelectItem>
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
                  {match.is_completed ? "Posodobi število golov in strelce za vsako ekipo" : "Vnesi število golov in strelce za vsako ekipo"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {Object.entries(teams).map(([teamNum, teamPlayers]) => {
                  const goalkeepers = teamPlayers.filter(p => p.position === "vratar");
                  const fieldPlayers = teamPlayers.filter(p => p.position === "igralec");
                  
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
                        {fieldPlayers.length > 0 && (
                          <div className="space-y-3">
                            <Label className="text-xs font-semibold text-muted-foreground">Strelci golov:</Label>
                            {fieldPlayers.map((player) => (
                              <div key={player.id} className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/50">
                                <Label
                                  htmlFor={`goals-${player.id}`}
                                  className="text-sm flex-1 cursor-pointer"
                                >
                                  {player.profiles?.full_name || player.profiles?.email.split('@')[0]}
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {player.position}
                                  </Badge>
                                </Label>
                                <Input
                                  id={`goals-${player.id}`}
                                  type="number"
                                  min="0"
                                  max="20"
                                  value={playerGoals[parseInt(teamNum)]?.[player.player_id] || 0}
                                  onChange={(e) => updatePlayerGoals(parseInt(teamNum), player.player_id, parseInt(e.target.value) || 0)}
                                  className="w-20 h-9 text-center"
                                  placeholder="0"
                                />
                              </div>
                            ))}
                            <div className="flex items-center justify-between pt-3 border-t">
                              <span className="text-sm font-medium">Skupaj golov igralcev:</span>
                              <Badge variant="secondary" className="text-base">
                                {Object.values(playerGoals[parseInt(teamNum)] || {}).reduce((sum, goals) => sum + goals, 0)}
                              </Badge>
                            </div>
                          </div>
                        )}

                        {goalkeepers.length > 0 && (
                          <div className="space-y-3 pt-3 border-t">
                            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                              <Shield className="h-4 w-4 text-green-600" />
                              Obrambe vratarjev:
                            </Label>
                            {goalkeepers.map((player) => (
                              <div key={player.id} className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/50 bg-green-50/50">
                                <Label
                                  htmlFor={`saves-${player.id}`}
                                  className="text-sm flex-1 cursor-pointer"
                                >
                                  {player.profiles?.full_name || player.profiles?.email.split('@')[0]}
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {player.position}
                                  </Badge>
                                </Label>
                                <Input
                                  id={`saves-${player.id}`}
                                  type="number"
                                  min="0"
                                  max="50"
                                  value={goalkeeperSaves[parseInt(teamNum)]?.[player.player_id] || 0}
                                  onChange={(e) => updateGoalkeeperSaves(parseInt(teamNum), player.player_id, parseInt(e.target.value) || 0)}
                                  className="w-20 h-9 text-center"
                                  placeholder="0"
                                />
                              </div>
                            ))}
                          </div>
                        )}
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
                      setPlayerGoals({});
                      setGoalkeeperSaves({});
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
            <h3 className="text-sm font-semibold">Ekipe</h3>
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
                    <span className="font-bold">Ekipa {teamNum}</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {teamPlayers.length} igralcev
                    </Badge>
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
                        {p.player_id !== user?.id && (
                          <Select
                            value={p.my_rating?.toString() || "0"}
                            onValueChange={async (value: string) => {
                              const rating = parseInt(value);
                              try {
                                const { data: existing } = await supabase
                                  .from("player_ratings")
                                  .select("id")
                                  .eq("rated_player_id", p.player_id)
                                  .eq("rater_id", user?.id)
                                  .maybeSingle();

                                if (existing) {
                                  const { error } = await supabase
                                    .from("player_ratings")
                                    .update({ rating, updated_at: new Date().toISOString() })
                                    .eq("id", existing.id);
                                  if (error) throw error;
                                } else {
                                  const { error } = await supabase
                                    .from("player_ratings")
                                    .insert({
                                      rated_player_id: p.player_id,
                                      rater_id: user?.id,
                                      rating
                                    });
                                  if (error) throw error;
                                }
                                toast.success("Ocena shranjena");
                                fetchParticipants();
                              } catch (error: any) {
                                toast.error("Napaka pri shranjevanju ocene");
                              }
                            }}
                          >
                            <SelectTrigger className="h-6 w-12 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">-</SelectItem>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                              <SelectItem value="3">3</SelectItem>
                              <SelectItem value="4">4</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {p.player_id === user?.id && (
                          <span className="text-muted-foreground text-xs">Ti</span>
                        )}
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
                        {p.player_id !== user?.id && (
                          <Select
                            value={p.my_rating?.toString() || "0"}
                            onValueChange={async (value: string) => {
                              const rating = parseInt(value);
                              try {
                                const { data: existing } = await supabase
                                  .from("player_ratings")
                                  .select("id")
                                  .eq("rated_player_id", p.player_id)
                                  .eq("rater_id", user?.id)
                                  .maybeSingle();

                                if (existing) {
                                  const { error } = await supabase
                                    .from("player_ratings")
                                    .update({ rating, updated_at: new Date().toISOString() })
                                    .eq("id", existing.id);
                                  if (error) throw error;
                                } else {
                                  const { error } = await supabase
                                    .from("player_ratings")
                                    .insert({
                                      rated_player_id: p.player_id,
                                      rater_id: user?.id,
                                      rating
                                    });
                                  if (error) throw error;
                                }
                                toast.success("Ocena shranjena");
                                fetchParticipants();
                              } catch (error: any) {
                                toast.error("Napaka pri shranjevanju ocene");
                              }
                            }}
                          >
                            <SelectTrigger className="h-6 w-12 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">-</SelectItem>
                              <SelectItem value="1">1</SelectItem>
                              <SelectItem value="2">2</SelectItem>
                              <SelectItem value="3">3</SelectItem>
                              <SelectItem value="4">4</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {p.player_id === user?.id && (
                          <span className="text-muted-foreground text-xs">Ti</span>
                        )}
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
                {unassigned.map((p) => (
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
                      {p.player_id !== user?.id && (
                        <Select
                          value={p.my_rating?.toString() || "0"}
                          onValueChange={async (value: string) => {
                            const rating = parseInt(value);
                            try {
                              const { data: existing } = await supabase
                                .from("player_ratings")
                                .select("id")
                                .eq("rated_player_id", p.player_id)
                                .eq("rater_id", user?.id)
                                .maybeSingle();

                              if (existing) {
                                const { error } = await supabase
                                  .from("player_ratings")
                                  .update({ rating, updated_at: new Date().toISOString() })
                                  .eq("id", existing.id);
                                if (error) throw error;
                              } else {
                                const { error } = await supabase
                                  .from("player_ratings")
                                  .insert({
                                    rated_player_id: p.player_id,
                                    rater_id: user?.id,
                                    rating
                                  });
                                if (error) throw error;
                              }
                              toast.success("Ocena shranjena");
                              fetchParticipants();
                            } catch (error: any) {
                              toast.error("Napaka pri shranjevanju ocene");
                            }
                          }}
                        >
                          <SelectTrigger className="h-6 w-12 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">-</SelectItem>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                            <SelectItem value="3">3</SelectItem>
                            <SelectItem value="4">4</SelectItem>
                            <SelectItem value="5">5</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {p.player_id === user?.id && (
                        <span className="text-muted-foreground text-xs">Ti</span>
                      )}
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
              Vsi prijavljeni igralci (Ocena = 0,6 × sotekmovalci + 0,4 × leaderboard)
            </h3>
            <Card>
              <CardContent className="pt-4 space-y-2">
                {/* Vratarji */}
                {participants.filter(p => p.position === "vratar").map((p) => (
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
                      ⭐ {p.combined_rating?.toFixed(1) || p.rating_aggregates?.average_rating?.toFixed(1) || "N/A"}
                    </span>
                  </div>
                ))}
                
                {/* Separator if there are goalkeepers */}
                {participants.filter(p => p.position === "vratar").length > 0 && (
                  <div className="border-t my-3" />
                )}
                
                {/* Igralci */}
                {participants.filter(p => p.position === "igralec").map((p) => (
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
                      ⭐ {p.combined_rating?.toFixed(1) || p.rating_aggregates?.average_rating?.toFixed(1) || "N/A"}
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

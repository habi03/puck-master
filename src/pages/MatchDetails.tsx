import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Users, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Match = {
  id: string;
  match_date: string;
  match_time: string;
  number_of_teams: number;
  league_id: string;
};

type Participant = {
  id: string;
  player_id: string;
  position: string;
  team_number: number | null;
  is_present: boolean;
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
  const [algorithm, setAlgorithm] = useState<"serpentine" | "abba">("serpentine");

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
    }
  }, [matchId, user]);

  useEffect(() => {
    if (match && user) {
      checkAdminStatus();
    }
  }, [match, user]);

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
      console.error("Error checking admin status:", error);
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
      
      // Fetch rating aggregates separately
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
            
          return {
            ...p,
            profiles: profileData,
            rating_aggregates: ratingData
          };
        })
      );
      
      // Sort by rating (highest to lowest)
      const sorted = playersWithRatings.sort((a, b) => {
        const ratingA = a.rating_aggregates?.average_rating || 0;
        const ratingB = b.rating_aggregates?.average_rating || 0;
        return ratingB - ratingA;
      });
      
      setParticipants(sorted as Participant[]);
    } catch (error: any) {
      toast.error("Napaka pri nalaganju igralcev");
    }
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
          <h2 className="text-lg font-bold">
            Tekma {new Date(match.match_date).toLocaleDateString('sl-SI')}
          </h2>
          <p className="text-sm text-muted-foreground">
            Ura: {match.match_time} • {match.number_of_teams} ekipe
          </p>
        </div>

        {isAdmin && (
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
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Users className="h-4 w-4" />
          <span>{participants.length} prijavljenih igralcev</span>
        </div>

        {Object.keys(teams).length > 0 && (
          <div className="space-y-3 mb-4">
            <h3 className="text-sm font-semibold">Ekipe</h3>
                {Object.entries(teams).map(([teamNum, teamPlayers]) => (
              <Card key={teamNum}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Ekipa {teamNum}
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {teamPlayers.length} igralcev
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {teamPlayers.map((p) => (
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
                          {p.rating_aggregates?.average_rating?.toFixed(1) || "N/A"}
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
                      <span className="text-muted-foreground">
                        {p.rating_aggregates?.average_rating?.toFixed(1) || "N/A"}
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
            <h3 className="text-sm font-semibold">Vsi prijavljeni igralci</h3>
            <Card>
              <CardContent className="pt-4 space-y-2">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-medium truncate">
                        {p.profiles?.full_name || p.profiles?.email.split('@')[0]}
                      </span>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {p.position}
                      </Badge>
                      {p.team_number && (
                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                          Ekipa {p.team_number}
                        </Badge>
                      )}
                    </div>
                    <span className="text-muted-foreground flex-shrink-0">
                      ⭐ {p.rating_aggregates?.average_rating?.toFixed(1) || "N/A"}
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

import { useState, useEffect, useMemo } from "react";
import { getTeamColorStyle, DEFAULT_TEAM_COLORS } from "@/lib/teamColors";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, UserPlus, UserMinus, ChevronRight, Beer, MoreVertical, Check, Pencil, Trash2, RefreshCw, Lock, Unlock, MapPin, UsersRound, FileText, Settings } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { sl } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [addPlayersDialogOpen, setAddPlayersDialogOpen] = useState(false);
  const [leagueMembers, setLeagueMembers] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<{ id: string; position: "igralec" | "vratar" }[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDate, setEditDate] = useState(match.match_date);
  const [editTime, setEditTime] = useState(match.match_time.slice(0, 5));
  const [removePlayersDialogOpen, setRemovePlayersDialogOpen] = useState(false);
  const [playersToRemove, setPlayersToRemove] = useState<string[]>([]);
  const [changePositionDialogOpen, setChangePositionDialogOpen] = useState(false);
  const [positionChanges, setPositionChanges] = useState<Record<string, "igralec" | "vratar">>({});
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationValue, setLocationValue] = useState(match.location || "");
  const [maxParticipantsDialogOpen, setMaxParticipantsDialogOpen] = useState(false);
  const [maxPlayersValue, setMaxPlayersValue] = useState<string>(match.max_players?.toString() || "");
  const [maxGoalkeepersValue, setMaxGoalkeepersValue] = useState<string>(match.max_goalkeepers?.toString() || "");
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notesValue, setNotesValue] = useState(match.notes || "");
  const [scoringDialogOpen, setScoringDialogOpen] = useState(false);
  const [scoringValues, setScoringValues] = useState({
    points_attendance: "1",
    points_win: "3",
    points_penalty_win: "2",
    points_penalty_loss: "1",
  });
  const [teamColors, setTeamColors] = useState<string[]>([...DEFAULT_TEAM_COLORS]);

  const userParticipation = participants.find(p => p.player_id === currentUser.id);
  const isSignedUp = !!userParticipation && !userParticipation.is_absent;
  const isMarkedAbsent = !!userParticipation && userParticipation.is_absent;
  const isCompleted = match.is_completed || false;

  useEffect(() => {
    checkAdminStatus();
    fetchTeamColors();
  }, [match.league_id, currentUser.id]);

  useEffect(() => {
    if (isCompleted) {
      fetchMatchResults();
      fetchMatchSaves();
    }
  }, [isCompleted, match.id]);

  const fetchTeamColors = async () => {
    try {
      const { data } = await supabase.from("leagues").select("*").eq("id", match.league_id).single();
      const leagueAny = data as any;
      if (leagueAny?.team_colors && Array.isArray(leagueAny.team_colors)) {
        setTeamColors(leagueAny.team_colors);
      }
    } catch {}
  };

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("league_members")
        .select("role")
        .eq("league_id", match.league_id)
        .eq("user_id", currentUser.id)
        .single();

      if (error) throw error;
      setIsAdmin(data?.role === "admin");
    } catch (error) {
      setIsAdmin(false);
    }
  };

  const fetchLeagueMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("league_members")
        .select("*, profiles(*)")
        .eq("league_id", match.league_id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setLeagueMembers(data || []);
    } catch (error: any) {
      toast.error("Napaka pri nalaganju članov");
    }
  };

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

  const handleOpenAddPlayers = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetchLeagueMembers();
    setSelectedPlayers([]);
    setAddPlayersDialogOpen(true);
  };

  const handleOpenEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditDate(match.match_date);
    setEditTime(match.match_time.slice(0, 5));
    setEditDialogOpen(true);
  };

  const handleUpdateMatch = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("matches")
        .update({
          match_date: editDate,
          match_time: editTime,
        })
        .eq("id", match.id);

      if (error) throw error;
      toast.success("Tekma uspešno posodobljena");
      setEditDialogOpen(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRemovePlayers = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPlayersToRemove([]);
    setRemovePlayersDialogOpen(true);
  };

  const togglePlayerToRemove = (playerId: string) => {
    setPlayersToRemove(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId) 
        : [...prev, playerId]
    );
  };

  const handleRemoveSelectedPlayers = async () => {
    if (playersToRemove.length === 0) {
      toast.error("Izberite vsaj enega igralca");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("match_participants")
        .delete()
        .eq("match_id", match.id)
        .in("player_id", playersToRemove);

      if (error) throw error;

      toast.success(`Uspešno odstranjenih ${playersToRemove.length} igralcev`);
      setRemovePlayersDialogOpen(false);
      setPlayersToRemove([]);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChangePosition = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Initialize with current positions
    const initialPositions: Record<string, "igralec" | "vratar"> = {};
    participants.forEach(p => {
      initialPositions[p.player_id] = p.position;
    });
    setPositionChanges(initialPositions);
    setChangePositionDialogOpen(true);
  };

  const handlePositionChange = (playerId: string, newPosition: "igralec" | "vratar") => {
    setPositionChanges(prev => ({ ...prev, [playerId]: newPosition }));
  };

  const handleSavePositionChanges = async () => {
    setLoading(true);
    try {
      // Find participants whose position changed
      const changedParticipants = participants.filter(p => 
        positionChanges[p.player_id] && positionChanges[p.player_id] !== p.position
      );

      if (changedParticipants.length === 0) {
        toast.info("Nobena pozicija ni bila spremenjena");
        setChangePositionDialogOpen(false);
        return;
      }

      // Update each changed participant
      for (const participant of changedParticipants) {
        const newPosition = positionChanges[participant.player_id];
        
        // Calculate new rating based on position
        let combinedRating = null;
        if (newPosition === "igralec") {
          combinedRating = 3.0;
          const { data: ratingData } = await supabase
            .from("rating_aggregates")
            .select("average_rating")
            .eq("player_id", participant.player_id)
            .single();
          if (ratingData?.average_rating) {
            combinedRating = ratingData.average_rating;
          }
        }

        const { error } = await supabase
          .from("match_participants")
          .update({ 
            position: newPosition,
            combined_rating: combinedRating
          })
          .eq("id", participant.id);

        if (error) throw error;
      }

      toast.success(`Uspešno spremenjenih ${changedParticipants.length} pozicij`);
      setChangePositionDialogOpen(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSignupsLocked = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const { error } = await supabase
        .from("matches")
        .update({ signups_locked: !match.signups_locked })
        .eq("id", match.id);

      if (error) throw error;
      toast.success(match.signups_locked ? "Prijave odklenjene" : "Prijave zaklenjene");
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLocation = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocationValue(match.location || "");
    setLocationDialogOpen(true);
  };

  const handleSaveLocation = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("matches")
        .update({ location: locationValue || null })
        .eq("id", match.id);

      if (error) throw error;
      toast.success("Lokacija shranjena");
      setLocationDialogOpen(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMaxParticipants = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMaxPlayersValue(match.max_players?.toString() || "");
    setMaxGoalkeepersValue(match.max_goalkeepers?.toString() || "");
    setMaxParticipantsDialogOpen(true);
  };

  const handleSaveMaxParticipants = async () => {
    setLoading(true);
    try {
      const maxPlayers = maxPlayersValue ? parseInt(maxPlayersValue) : null;
      const maxGoalkeepers = maxGoalkeepersValue ? parseInt(maxGoalkeepersValue) : null;
      const { error } = await supabase
        .from("matches")
        .update({ 
          max_players: maxPlayers,
          max_goalkeepers: maxGoalkeepers 
        } as any)
        .eq("id", match.id);

      if (error) throw error;
      toast.success("Omejitve shranjene");
      setMaxParticipantsDialogOpen(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNotes = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNotesValue(match.notes || "");
    setNotesDialogOpen(true);
  };

  const handleSaveNotes = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("matches")
        .update({ notes: notesValue || null })
        .eq("id", match.id);

      if (error) throw error;
      toast.success("Opomba shranjena");
      setNotesDialogOpen(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenScoring = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Fetch both match and league data
      const [matchRes, leagueRes] = await Promise.all([
        supabase.from("matches").select("*").eq("id", match.id).single(),
        supabase.from("leagues").select("*").eq("id", match.league_id).single()
      ]);

      if (matchRes.error) throw matchRes.error;
      if (leagueRes.error) throw leagueRes.error;
      
      const matchAny = matchRes.data as any;
      const leagueAny = leagueRes.data as any;
      
      // Use match value if set, otherwise use league default
      const getValue = (matchVal: any, leagueVal: any, defaultVal: string) => {
        if (matchVal !== null && matchVal !== undefined) return matchVal.toString();
        if (leagueVal !== null && leagueVal !== undefined) return leagueVal.toString();
        return defaultVal;
      };
      
      setScoringValues({
        points_attendance: getValue(matchAny.points_attendance, leagueAny.points_attendance, "1"),
        points_win: getValue(matchAny.points_win, leagueAny.points_win, "3"),
        points_penalty_win: getValue(matchAny.points_penalty_win, leagueAny.points_penalty_win, "2"),
        points_penalty_loss: getValue(matchAny.points_penalty_loss, leagueAny.points_penalty_loss, "1"),
      });
      // Load team colors
      if (leagueAny.team_colors && Array.isArray(leagueAny.team_colors)) {
        setTeamColors(leagueAny.team_colors);
      }
      setScoringDialogOpen(true);
    } catch (error: any) {
      toast.error("Napaka pri nalaganju točkovanja");
    }
  };

  const handleSaveScoring = async () => {
    setLoading(true);
    try {
      const parseValue = (val: string, defaultVal: number) => {
        const parsed = parseInt(val);
        return Number.isNaN(parsed) ? defaultVal : parsed;
      };
      
      const updateData = {
        points_attendance: parseValue(scoringValues.points_attendance, 1),
        points_win: parseValue(scoringValues.points_win, 3),
        points_penalty_win: parseValue(scoringValues.points_penalty_win, 2),
        points_penalty_loss: parseValue(scoringValues.points_penalty_loss, 1),
      };
      
      // Save to match instead of league
      const { error } = await supabase
        .from("matches")
        .update(updateData as any)
        .eq("id", match.id);

      if (error) throw error;
      toast.success("Točkovanje za tekmo shranjeno");
      setScoringDialogOpen(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePlayerSelection = (playerId: string, playerPosition: "igralec" | "vratar" = "igralec") => {
    setSelectedPlayers(prev => {
      const existing = prev.find(p => p.id === playerId);
      if (existing) {
        return prev.filter(p => p.id !== playerId);
      } else {
        return [...prev, { id: playerId, position: playerPosition }];
      }
    });
  };

  const updatePlayerPosition = (playerId: string, newPosition: "igralec" | "vratar") => {
    setSelectedPlayers(prev => 
      prev.map(p => p.id === playerId ? { ...p, position: newPosition } : p)
    );
  };

  const handleAddSelectedPlayers = async () => {
    if (selectedPlayers.length === 0) {
      toast.error("Izberite vsaj enega igralca");
      return;
    }

    setLoading(true);
    try {
      // Filter out players who are already participants
      const existingPlayerIds = participants.map(p => p.player_id);
      const newPlayers = selectedPlayers.filter(p => !existingPlayerIds.includes(p.id));

      if (newPlayers.length === 0) {
        toast.error("Vsi izbrani igralci so že prijavljeni");
        setLoading(false);
        return;
      }

      // Calculate ratings for each player
      const insertData = await Promise.all(newPlayers.map(async (player) => {
        let combinedRating = null;

        // Only calculate rating for players (not goalkeepers)
        if (player.position === "igralec") {
          combinedRating = 3.0; // Default middle value

          // Get peer rating
          const { data: ratingData } = await supabase
            .from("rating_aggregates")
            .select("average_rating")
            .eq("player_id", player.id)
            .single();

          if (ratingData?.average_rating) {
            combinedRating = ratingData.average_rating;
          }
        }

        return {
          match_id: match.id,
          player_id: player.id,
          position: player.position,
          combined_rating: combinedRating,
        };
      }));

      const { error } = await supabase
        .from("match_participants")
        .insert(insertData);

      if (error) throw error;

      toast.success(`Uspešno dodanih ${newPlayers.length} igralcev`);
      setAddPlayersDialogOpen(false);
      setSelectedPlayers([]);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (isCompleted) {
      toast.error("Tekma je zaključena - prijave so zaprte");
      return;
    }
    if (match.signups_locked) {
      toast.error("Prijave so zaklenjene");
      return;
    }
    // Check position-specific limits (exclude absent)
    const activeParticipants = participants.filter(p => !p.is_absent);
    const playersCount = activeParticipants.filter(p => p.position === "igralec").length;
    const goalkeepersCount = activeParticipants.filter(p => p.position === "vratar").length;
    
    if (position === "igralec") {
      if (match.max_players && playersCount >= match.max_players) {
        toast.error(`Doseženo maksimalno število igralcev (${match.max_players})`);
        return;
      }
    } else if (position === "vratar") {
      if (match.max_goalkeepers && goalkeepersCount >= match.max_goalkeepers) {
        toast.error(`Doseženo maksimalno število vratarjev (${match.max_goalkeepers})`);
        return;
      }
      // Also check the team limit
      if (goalkeepersCount >= match.number_of_teams) {
        toast.error(`Vseh ${match.number_of_teams} mest za vratarje je že zasedenih (en vratar na ekipo)`);
        return;
      }
    }
    
    setLoading(true);
    try {

      // Calculate combined rating at time of signup
      // Goalkeepers don't need ratings - they will be sorted alphabetically
      let combinedRating = null;

      // Only calculate rating for players (not goalkeepers)
      if (position === "igralec") {
        combinedRating = 3.0; // Default middle value

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

          // Sort players by their scores to get leaderboard positions
          const sortedPlayers = Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1]);
          
          // Find player's position in leaderboard (1-indexed)
          const playerKey = `${currentUser.id}_${position}`;
          const playerPosition = sortedPlayers.findIndex(([key]) => key === playerKey) + 1;
          const totalPlayers = sortedPlayers.length;

          // Calculate position bonus: 4 points for 1st, linearly decreasing to 0 for last
          let positionBonus = 0;
          if (playerPosition > 0 && totalPlayers > 1) {
            positionBonus = 4 - (4 * (playerPosition - 1) / (totalPlayers - 1));
          } else if (playerPosition === 1 && totalPlayers === 1) {
            positionBonus = 4; // Only player gets full bonus
          }

          // Calculate combined rating: 0.6 * peer rating + position bonus
          combinedRating = 0.6 * peerRating + positionBonus;
          }
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

  const handleMarkAbsent = async () => {
    if (isCompleted) {
      toast.error("Tekma je zaključena");
      return;
    }
    if (match.signups_locked) {
      toast.error("Prijave so zaklenjene");
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("match_participants")
        .insert({
          match_id: match.id,
          player_id: currentUser.id,
          position: "igralec",
          is_absent: true,
          combined_rating: null,
        });

      if (error) throw error;
      toast.success("Označeni ste kot odsotni");
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAbsent = async () => {
    if (isCompleted) {
      toast.error("Tekma je zaključena");
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("match_participants")
        .delete()
        .eq("id", userParticipation.id);

      if (error) throw error;
      toast.success("Preklic odsotnosti");
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

  const beerBringer = participants.filter(p => !p.is_absent).find(p => p.brings_beer);

  const matchDate = new Date(match.match_date);
  const formattedDate = format(matchDate, "EEEE, d. MMMM yyyy", { locale: sl });

  // Filter members who are not already participants
  const availableMembers = leagueMembers.filter(
    member => !participants.some(p => p.player_id === member.user_id)
  );

  return (
    <>
      <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer" onClick={() => navigate(`/match/${match.id}`)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg gap-2">
            <span className="shrink-0">Tekma</span>
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
              <Badge variant="secondary" className="text-xs">{match.number_of_teams} ekipe</Badge>
              {isCompleted && (
                <Badge variant="default" className="text-xs">Zaključena</Badge>
              )}
              {isAdmin && !isCompleted && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background border z-50">
                    <DropdownMenuItem onClick={handleOpenAddPlayers}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Dodaj igralce
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleOpenEdit}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Uredi datum/uro
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleOpenRemovePlayers}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Odstrani igralce
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleOpenChangePosition}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Spremeni pozicije
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleToggleSignupsLocked}>
                      {match.signups_locked ? (
                        <>
                          <Unlock className="h-4 w-4 mr-2" />
                          Odkleni prijave
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4 mr-2" />
                          Zakleni prijave
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleOpenLocation}>
                      <MapPin className="h-4 w-4 mr-2" />
                      Nastavi lokacijo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleOpenMaxParticipants}>
                      <UsersRound className="h-4 w-4 mr-2" />
                      Omeji prijave
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleOpenNotes}>
                      <FileText className="h-4 w-4 mr-2" />
                      Dodaj opombo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleOpenScoring}>
                      <Settings className="h-4 w-4 mr-2" />
                      Nastavi točkovanje
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
            <span className="text-xs">{match.match_time.slice(0, 5)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs">
              {(() => {
                const active = participants.filter(p => !p.is_absent);
                const playersCount = active.filter(p => p.position === "igralec").length;
                const goalkeepersCount = active.filter(p => p.position === "vratar").length;
                const playersText = `${playersCount}${match.max_players ? `/${match.max_players}` : ''} igralcev`;
                const goalkeepersText = `${goalkeepersCount}${match.max_goalkeepers ? `/${match.max_goalkeepers}` : ''} vratarjev`;
                return `${playersText}, ${goalkeepersText}`;
              })()}
            </span>
          </div>
          
          {match.location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs">{match.location}</span>
            </div>
          )}
          
          {match.signups_locked && !isCompleted && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <Lock className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs font-medium">Prijave zaklenjene</span>
            </div>
          )}
          
          {match.notes && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span className="text-xs line-clamp-2">{match.notes}</span>
            </div>
          )}
          
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
                  return (
                    <div key={teamNum} className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border" style={getTeamColorStyle(teamNum, teamColors)}>
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
              {matchResults.length > 0 && matchResults[0].win_type && (
                <div className="text-center text-xs text-muted-foreground mt-2">
                  {matchResults[0].win_type === "regulation" ? "Redni del" : "Kazenski streli"}
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-4 pt-3">
          {!isCompleted ? (
            !isSignedUp && !isMarkedAbsent ? (
              <div className="w-full space-y-4">
                <Select value={position} onValueChange={(v: any) => setPosition(v)}>
                  <SelectTrigger 
                    className="w-full touch-manipulation" 
                    onClick={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent 
                    className="touch-manipulation"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
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
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAbsent();
                  }} 
                  disabled={loading} 
                  variant="outline"
                  className="w-full"
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Odsoten
                </Button>
              </div>
            ) : isMarkedAbsent ? (
              <>
                <Badge variant="destructive" className="w-full justify-center py-1.5 text-xs">
                  Označeni kot odsotni
                </Badge>
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelAbsent();
                  }} 
                  disabled={loading} 
                  variant="outline"
                  className="w-full"
                >
                  Prekliči odsotnost
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

      {/* Dialog for adding players */}
      <Dialog open={addPlayersDialogOpen} onOpenChange={setAddPlayersDialogOpen}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] mx-auto" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Dodaj igralce na tekmo</DialogTitle>
            <DialogDescription>
              Izberite igralce, ki jih želite ročno dodati na tekmo.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            {availableMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Vsi člani lige so že prijavljeni na tekmo.
              </p>
            ) : (
              <div className="space-y-2">
                {availableMembers.map((member) => {
                  const isSelected = selectedPlayers.some(p => p.id === member.user_id);
                  const selectedPlayer = selectedPlayers.find(p => p.id === member.user_id);
                  
                  return (
                    <div
                      key={member.id}
                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border transition-colors gap-2 ${
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => togglePlayerSelection(member.user_id)}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {member.profiles?.full_name || member.profiles?.email || "Neznano ime"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {member.profiles?.email}
                          </p>
                        </div>
                      </div>
                      
                      {isSelected && (
                        <Select
                          value={selectedPlayer?.position || "igralec"}
                          onValueChange={(v: "igralec" | "vratar") => updatePlayerPosition(member.user_id, v)}
                        >
                          <SelectTrigger className="w-full sm:w-24 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="igralec">Igralec</SelectItem>
                            <SelectItem value="vratar">Vratar</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          
          {availableMembers.length > 0 && (
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setAddPlayersDialogOpen(false)}
              >
                Prekliči
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddSelectedPlayers}
                disabled={loading || selectedPlayers.length === 0}
              >
                {loading ? "Dodajam..." : `Dodaj (${selectedPlayers.length})`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog for editing match date/time */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)] mx-auto" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Uredi tekmo</DialogTitle>
            <DialogDescription>
              Spremenite datum in uro tekme.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date">Datum</Label>
              <Input
                id="edit-date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-time">Ura</Label>
              <Input
                id="edit-time"
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setEditDialogOpen(false)}
            >
              Prekliči
            </Button>
            <Button
              className="flex-1"
              onClick={handleUpdateMatch}
              disabled={loading}
            >
              {loading ? "Shranjujem..." : "Shrani"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog for removing players */}
      <Dialog open={removePlayersDialogOpen} onOpenChange={setRemovePlayersDialogOpen}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] mx-auto" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Odstrani igralce s tekme</DialogTitle>
            <DialogDescription>
              Izberite igralce, ki jih želite odstraniti s tekme.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Na tekmo ni prijavljen noben igralec.
              </p>
            ) : (
              <div className="space-y-2">
                {participants.map((participant) => {
                  const isSelected = playersToRemove.includes(participant.player_id);
                  
                  return (
                    <div
                      key={participant.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        isSelected ? "border-destructive bg-destructive/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => togglePlayerToRemove(participant.player_id)}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {participant.profiles?.full_name || participant.profiles?.email || "Neznano ime"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {participant.position === "vratar" ? "Vratar" : "Igralec"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          
          {participants.length > 0 && (
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setRemovePlayersDialogOpen(false)}
              >
                Prekliči
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleRemoveSelectedPlayers}
                disabled={loading || playersToRemove.length === 0}
              >
                {loading ? "Odstranjujem..." : `Odstrani (${playersToRemove.length})`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog for changing player positions */}
      <Dialog open={changePositionDialogOpen} onOpenChange={setChangePositionDialogOpen}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] mx-auto" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Spremeni pozicije igralcev</DialogTitle>
            <DialogDescription>
              Spremenite pozicije igralcev (igralec / vratar).
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Na tekmo ni prijavljen noben igralec.
              </p>
            ) : (
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {participant.profiles?.full_name || participant.profiles?.email || "Neznano ime"}
                      </p>
                    </div>
                    <Select
                      value={positionChanges[participant.player_id] || participant.position}
                      onValueChange={(v: "igralec" | "vratar") => handlePositionChange(participant.player_id, v)}
                    >
                      <SelectTrigger className="w-24 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border z-50">
                        <SelectItem value="igralec">Igralec</SelectItem>
                        <SelectItem value="vratar">Vratar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          {participants.length > 0 && (
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setChangePositionDialogOpen(false)}
              >
                Prekliči
              </Button>
              <Button
                className="flex-1"
                onClick={handleSavePositionChanges}
                disabled={loading}
              >
                {loading ? "Shranjujem..." : "Shrani"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog for location */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)] mx-auto" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Nastavi lokacijo</DialogTitle>
            <DialogDescription>
              Vnesite lokacijo ali igrišče tekme.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="location">Lokacija</Label>
              <Input
                id="location"
                placeholder="npr. Športni park, Igrišče pri šoli..."
                value={locationValue}
                onChange={(e) => setLocationValue(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setLocationDialogOpen(false)}>
              Prekliči
            </Button>
            <Button className="flex-1" onClick={handleSaveLocation} disabled={loading}>
              {loading ? "Shranjujem..." : "Shrani"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog for max participants */}
      <Dialog open={maxParticipantsDialogOpen} onOpenChange={setMaxParticipantsDialogOpen}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)] mx-auto" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Omeji število prijav</DialogTitle>
            <DialogDescription>
              Nastavite maksimalno število igralcev in vratarjev. Pustite prazno za brez omejitve.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="max-players">Maksimalno igralcev</Label>
              <Input
                id="max-players"
                type="number"
                min="1"
                placeholder="Brez omejitve"
                value={maxPlayersValue}
                onChange={(e) => setMaxPlayersValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-goalkeepers">Maksimalno vratarjev</Label>
              <Input
                id="max-goalkeepers"
                type="number"
                min="1"
                placeholder="Brez omejitve"
                value={maxGoalkeepersValue}
                onChange={(e) => setMaxGoalkeepersValue(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setMaxParticipantsDialogOpen(false)}>
              Prekliči
            </Button>
            <Button className="flex-1" onClick={handleSaveMaxParticipants} disabled={loading}>
              {loading ? "Shranjujem..." : "Shrani"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog for notes */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)] mx-auto" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Dodaj opombo</DialogTitle>
            <DialogDescription>
              Dodajte zapisek ali komentar k tekmi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Opomba</Label>
              <Textarea
                id="notes"
                placeholder="npr. Prinesite športno opremo, tekma bo v dvorani..."
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setNotesDialogOpen(false)}>
              Prekliči
            </Button>
            <Button className="flex-1" onClick={handleSaveNotes} disabled={loading}>
              {loading ? "Shranjujem..." : "Shrani"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog for scoring configuration */}
      <Dialog open={scoringDialogOpen} onOpenChange={setScoringDialogOpen}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)] mx-auto" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Nastavi točkovanje</DialogTitle>
            <DialogDescription>
              Določite koliko točk se dodeli za posamezne dogodke v ligi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="points-attendance">Prisotnost na tekmi</Label>
              <Input
                id="points-attendance"
                type="number"
                min="0"
                value={scoringValues.points_attendance}
                onChange={(e) => setScoringValues(prev => ({ ...prev, points_attendance: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="points-win">Zmaga (redni del)</Label>
              <Input
                id="points-win"
                type="number"
                min="0"
                value={scoringValues.points_win}
                onChange={(e) => setScoringValues(prev => ({ ...prev, points_win: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="points-penalty-win">Zmaga po kazenskih strelih</Label>
              <Input
                id="points-penalty-win"
                type="number"
                min="0"
                value={scoringValues.points_penalty_win}
                onChange={(e) => setScoringValues(prev => ({ ...prev, points_penalty_win: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="points-penalty-loss">Poraz po kazenskih strelih</Label>
              <Input
                id="points-penalty-loss"
                type="number"
                min="0"
                value={scoringValues.points_penalty_loss}
                onChange={(e) => setScoringValues(prev => ({ ...prev, points_penalty_loss: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setScoringDialogOpen(false)}>
              Prekliči
            </Button>
            <Button className="flex-1" onClick={handleSaveScoring} disabled={loading}>
              {loading ? "Shranjujem..." : "Shrani"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

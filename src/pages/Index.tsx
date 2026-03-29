import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import MatchCard from "@/components/MatchCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [currentLeagueId, setCurrentLeagueId] = useState<string | null>(null);
  const [currentMembership, setCurrentMembership] = useState<any>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("all");
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const validateLeagueMembership = async () => {
      const leagueId = localStorage.getItem("currentLeagueId");
      if (!leagueId) {
        navigate("/leagues");
        return;
      }
      
      if (!user) return;
      
      // Verify membership
      const { data, error } = await supabase
        .from("league_members")
        .select("id")
        .eq("league_id", leagueId)
        .eq("user_id", user.id)
        .single();
      
      if (error || !data) {
        localStorage.removeItem("currentLeagueId");
        toast.error("Nimate več dostopa do te lige");
        navigate("/leagues");
        return;
      }
      
      setCurrentLeagueId(leagueId);
    };
    
    if (user) {
      validateLeagueMembership();
    }
  }, [navigate, user]);

  useEffect(() => {
    if (user && currentLeagueId) {
      fetchProfile();
      fetchCurrentMembership();
      fetchSeasons();
      fetchMatches();
      fetchParticipants();
    }
  }, [user, currentLeagueId]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      toast.error("Napaka pri nalaganju profila");
    }
  };

  const fetchCurrentMembership = async () => {
    try {
      const { data, error } = await supabase
        .from("league_members")
        .select("*")
        .eq("league_id", currentLeagueId)
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      setCurrentMembership(data);
    } catch (error: any) {
      toast.error("Napaka pri nalaganju članstva");
    }
  };

  const fetchSeasons = async () => {
    try {
      const { data, error } = await supabase
        .from("seasons")
        .select("*")
        .eq("league_id", currentLeagueId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const seasonsList = data || [];
      setSeasons(seasonsList);
      
      // Default to active season
      const activeSeason = seasonsList.find((s: any) => s.is_active);
      if (activeSeason) {
        setSelectedSeasonId(activeSeason.id);
      } else {
        setSelectedSeasonId("all");
      }
    } catch (error: any) {
      // silently fail
    }
  };

  const fetchMatches = async () => {
    try {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("league_id", currentLeagueId)
        .order("match_date", { ascending: true })
        .order("match_time", { ascending: true });

      if (error) throw error;
      setMatches(data || []);
    } catch (error: any) {
      toast.error("Napaka pri nalaganju tekem");
    }
  };

  const fetchParticipants = async () => {
    try {
      // Fetch all match participants
      const { data: participantsData, error: participantsError } = await supabase
        .from("match_participants")
        .select("*");

      if (participantsError) throw participantsError;

      if (!participantsData || participantsData.length === 0) {
        setParticipants([]);
        return;
      }

      // Get unique player IDs
      const playerIds = [...new Set(participantsData.map(p => p.player_id))];

      // Fetch profiles for all participants
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", playerIds);

      if (profilesError) throw profilesError;

      // Merge profiles into participants
      const participantsWithProfiles = participantsData.map(participant => ({
        ...participant,
        profiles: profiles?.find(p => p.id === participant.player_id)
      }));

      setParticipants(participantsWithProfiles);
    } catch (error: any) {
      toast.error("Napaka pri nalaganju udeležencev");
    }
  };

  const handleUpdate = () => {
    fetchMatches();
    fetchParticipants();
    fetchCurrentMembership();
  };

  if (!user || !profile || !currentLeagueId || !currentMembership) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      <main className="px-4 py-4">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-1">
            Dobrodošli, {profile.full_name || user.email?.split('@')[0]}!
          </h2>
          <p className="text-sm text-muted-foreground">
            Vloga: <span className="font-semibold capitalize">{currentMembership.role.replace('_', ' ')}</span>
          </p>
        </div>

        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="upcoming">Prihajajoče tekme</TabsTrigger>
            <TabsTrigger value="completed">Zaključene tekme</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-3">
            {matches.filter(m => !m.is_completed).length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Trenutno ni razpisanih prihajajučih tekem.
              </p>
            ) : (
              matches.filter(m => !m.is_completed).map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  currentUser={profile}
                  participants={participants.filter(p => p.match_id === match.id)}
                  onUpdate={handleUpdate}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3">
            {matches.filter(m => m.is_completed).length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Ni še zaključenih tekem.
              </p>
            ) : (
              matches
                .filter(m => m.is_completed)
                .sort((a, b) => {
                  // Sort completed matches by date descending (newest first)
                  const dateCompare = new Date(b.match_date).getTime() - new Date(a.match_date).getTime();
                  if (dateCompare !== 0) return dateCompare;
                  // If dates are equal, sort by time descending
                  return b.match_time.localeCompare(a.match_time);
                })
                .map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    currentUser={profile}
                    participants={participants.filter(p => p.match_id === match.id)}
                    onUpdate={handleUpdate}
                  />
                ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
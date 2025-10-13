import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import MatchCard from "@/components/MatchCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [currentLeagueId, setCurrentLeagueId] = useState<string | null>(null);
  const [currentMembership, setCurrentMembership] = useState<any>(null);
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
    const leagueId = localStorage.getItem("currentLeagueId");
    if (!leagueId) {
      navigate("/leagues");
    } else {
      setCurrentLeagueId(leagueId);
    }
  }, [navigate]);

  useEffect(() => {
    if (user && currentLeagueId) {
      fetchProfile();
      fetchCurrentMembership();
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
      const { data, error } = await supabase
        .from("match_participants")
        .select("*");

      if (error) throw error;
      setParticipants(data || []);
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

        <Tabs defaultValue="matches" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="matches">Tekme</TabsTrigger>
            <TabsTrigger value="profile">Profil</TabsTrigger>
          </TabsList>
          
          <TabsContent value="matches" className="space-y-3 mt-4">
            {matches.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Trenutno ni razpisanih tekem.
              </p>
            ) : (
              matches.map((match) => (
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
          
          <TabsContent value="profile" className="mt-4">
            <div className="bg-card rounded-lg p-4 border">
              <h3 className="text-lg font-bold mb-3">Vaš profil</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold">Email:</span>
                  <p className="text-muted-foreground break-all">{profile.email}</p>
                </div>
                <div>
                  <span className="font-semibold">Polno ime:</span>
                  <p className="text-muted-foreground">{profile.full_name || "Ni nastavljeno"}</p>
                </div>
                <div>
                  <span className="font-semibold">Vloga:</span>
                  <p className="text-muted-foreground capitalize">{profile.role.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="font-semibold">Član od:</span>
                  <p className="text-muted-foreground">{new Date(profile.created_at).toLocaleDateString('sl-SI')}</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
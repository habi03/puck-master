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
    if (user) {
      fetchProfile();
      fetchMatches();
      fetchParticipants();
    }
  }, [user]);

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

  const fetchMatches = async () => {
    try {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
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
  };

  if (!user || !profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Dobrodošli, {profile.full_name || user.email}!
          </h2>
          <p className="text-muted-foreground">
            Status: <span className="font-semibold capitalize">{profile.role.replace('_', ' ')}</span>
          </p>
        </div>

        <Tabs defaultValue="matches" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="matches">Tekme</TabsTrigger>
            <TabsTrigger value="profile">Profil</TabsTrigger>
          </TabsList>
          
          <TabsContent value="matches" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {matches.length === 0 ? (
                <p className="col-span-full text-center text-muted-foreground py-8">
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
            </div>
          </TabsContent>
          
          <TabsContent value="profile" className="space-y-4">
            <div className="max-w-2xl">
              <h3 className="text-2xl font-bold mb-4">Vaš profil</h3>
              <div className="space-y-2 text-muted-foreground">
                <p><strong>Email:</strong> {profile.email}</p>
                <p><strong>Polno ime:</strong> {profile.full_name || "Ni nastavljeno"}</p>
                <p><strong>Vloga:</strong> <span className="capitalize">{profile.role.replace('_', ' ')}</span></p>
                <p><strong>Član od:</strong> {new Date(profile.created_at).toLocaleDateString('sl-SI')}</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface PlayerWithRating {
  id: string;
  full_name: string;
  email: string;
  average_rating: number;
  total_ratings: number;
  myRating?: number;
}

export default function Players() {
  const [user, setUser] = useState<User | null>(null);
  const [players, setPlayers] = useState<PlayerWithRating[]>([]);
  const [currentLeagueId, setCurrentLeagueId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithRating | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
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
      fetchPlayers();
    }
  }, [user, currentLeagueId]);

  const fetchPlayers = async () => {
    try {
      // Fetch all league members
      const { data: members, error: membersError } = await supabase
        .from("league_members")
        .select("user_id")
        .eq("league_id", currentLeagueId);

      if (membersError) throw membersError;

      const userIds = members.map(m => m.user_id);

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Fetch rating aggregates
      const { data: ratings, error: ratingsError } = await supabase
        .from("rating_aggregates")
        .select("player_id, average_rating, total_ratings")
        .in("player_id", userIds);

      if (ratingsError) throw ratingsError;

      // Fetch my ratings
      const { data: myRatings, error: myRatingsError } = await supabase
        .from("player_ratings")
        .select("rated_player_id, rating")
        .eq("rater_id", user?.id)
        .in("rated_player_id", userIds);

      if (myRatingsError) throw myRatingsError;

      // Combine data
      const playersData: PlayerWithRating[] = profiles
        .filter(p => p.id !== user?.id) // Don't show current user
        .map(profile => {
          const ratingData = ratings.find(r => r.player_id === profile.id);
          const myRating = myRatings.find(r => r.rated_player_id === profile.id);
          
          return {
            id: profile.id,
            full_name: profile.full_name || "Brez imena",
            email: profile.email,
            average_rating: ratingData?.average_rating || 0,
            total_ratings: ratingData?.total_ratings || 0,
            myRating: myRating?.rating,
          };
        })
        .sort((a, b) => b.average_rating - a.average_rating);

      setPlayers(playersData);
    } catch (error: any) {
      toast.error("Napaka pri nalaganju igralcev");
      console.error(error);
    }
  };

  const handleRatePlayer = (player: PlayerWithRating) => {
    setSelectedPlayer(player);
    setRating(player.myRating || 5);
    setDialogOpen(true);
  };

  const submitRating = async () => {
    if (!selectedPlayer || !user) return;

    try {
      const { error } = await supabase
        .from("player_ratings")
        .upsert({
          rater_id: user.id,
          rated_player_id: selectedPlayer.id,
          rating: rating,
        }, {
          onConflict: 'rater_id,rated_player_id'
        });

      if (error) throw error;

      toast.success("Ocena uspešno shranjena");
      setDialogOpen(false);
      fetchPlayers();
    } catch (error: any) {
      toast.error("Napaka pri shranjevanju ocene");
      console.error(error);
    }
  };

  if (!user || !currentLeagueId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      <main className="px-4 py-4">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-1">Tekmovalci</h2>
          <p className="text-sm text-muted-foreground">
            Ocenite vaše soigralce
          </p>
        </div>

        <div className="space-y-3">
          {players.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Ni tekmovalcev v tej ligi.
            </p>
          ) : (
            players.map((player) => (
              <Card key={player.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">
                        {player.full_name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground truncate">
                        {player.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Star className="h-4 w-4 fill-primary text-primary" />
                      <span className="font-bold text-sm">
                        {player.average_rating.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({player.total_ratings})
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between gap-2">
                    {player.myRating && (
                      <span className="text-xs text-muted-foreground">
                        Vaša ocena: {player.myRating}/10
                      </span>
                    )}
                    <Dialog open={dialogOpen && selectedPlayer?.id === player.id} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          onClick={() => handleRatePlayer(player)}
                          size="sm"
                          variant={player.myRating ? "outline" : "default"}
                          className="ml-auto"
                        >
                          {player.myRating ? "Uredi oceno" : "Oceni"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            Oceni igralca: {selectedPlayer?.full_name}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Ocena: {rating}/10</Label>
                            <Slider
                              value={[rating]}
                              onValueChange={(value) => setRating(value[0])}
                              min={1}
                              max={10}
                              step={1}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>1 - Najslabše</span>
                              <span>10 - Najboljše</span>
                            </div>
                          </div>
                          <Button onClick={submitRating} className="w-full">
                            Shrani oceno
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

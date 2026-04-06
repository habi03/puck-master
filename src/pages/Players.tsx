import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  avatar_url?: string;
  location?: string;
  birth_date?: string;
  role?: string;
  average_rating: number;
  total_ratings: number;
  myRating?: number;
}

interface Rater {
  id: string;
  full_name: string;
  avatar_url?: string;
  rating?: number;
}

export default function Players() {
  const [user, setUser] = useState<User | null>(null);
  const [players, setPlayers] = useState<PlayerWithRating[]>([]);
  const [currentLeagueId, setCurrentLeagueId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithRating | null>(null);
  const [rating, setRating] = useState<number>(5.0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<{ url: string; name: string; location?: string; birth_date?: string } | null>(null);
  const [isLeagueAdmin, setIsLeagueAdmin] = useState(false);
  const [isSuperUser, setIsSuperUser] = useState(false);
  const [ratersDialogOpen, setRatersDialogOpen] = useState(false);
  const [raters, setRaters] = useState<Rater[]>([]);
  const [ratersPlayerName, setRatersPlayerName] = useState<string>("");
  const [ratersPlayerId, setRatersPlayerId] = useState<string>("");
  const [editingRater, setEditingRater] = useState<Rater | null>(null);
  const [editRatingValue, setEditRatingValue] = useState<number>(5.0);
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
    const validateLeagueMembership = async () => {
      const leagueId = localStorage.getItem("currentLeagueId");
      if (!leagueId) {
        navigate("/");
        return;
      }
      
      if (!user) return;
      
      // Verify membership and check admin status
      const { data, error } = await supabase
        .from("league_members")
        .select("id, role")
        .eq("league_id", leagueId)
        .eq("user_id", user.id)
        .single();
      
      if (error || !data) {
        localStorage.removeItem("currentLeagueId");
        toast.error("Nimate več dostopa do te lige");
        navigate("/");
        return;
      }
      
      setCurrentLeagueId(leagueId);
      setIsLeagueAdmin(data.role === 'admin' || data.role === 'super_user');
      setIsSuperUser(data.role === 'super_user');
    };
    
    if (user) {
      validateLeagueMembership();
    }
  }, [navigate, user]);

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
        .select("id, full_name, email, avatar_url, location, birth_date")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Fetch rating aggregates
      const { data: ratings, error: ratingsError } = await supabase
        .from("rating_aggregates")
        .select("player_id, average_rating, total_ratings")
        .in("player_id", userIds);

      if (ratingsError) throw ratingsError;

      // Fetch league member roles
      const { data: memberRoles, error: rolesError } = await supabase
        .from("league_members")
        .select("user_id, role")
        .eq("league_id", currentLeagueId)
        .in("user_id", userIds);

      if (rolesError) throw rolesError;

      // Fetch my ratings
      const { data: myRatings, error: myRatingsError } = await supabase
        .from("player_ratings")
        .select("rated_player_id, rating")
        .eq("rater_id", user?.id)
        .in("rated_player_id", userIds);

      if (myRatingsError) throw myRatingsError;

      // Combine data
      const playersData: PlayerWithRating[] = profiles
        .map(profile => {
          const ratingData = ratings.find(r => r.player_id === profile.id);
          const myRating = myRatings.find(r => r.rated_player_id === profile.id);
          const memberRole = memberRoles.find(m => m.user_id === profile.id);
          
          const roleMap: { [key: string]: string } = {
            'admin': 'Admin',
            'super_user': 'Super User',
            'član': 'Član',
            'poskusni_član': 'Poskusni član',
          };
          
          return {
            id: profile.id,
            full_name: profile.full_name || "Brez imena",
            email: profile.email,
            avatar_url: profile.avatar_url || undefined,
            location: profile.location || undefined,
            birth_date: profile.birth_date || undefined,
            role: memberRole ? roleMap[memberRole.role] || memberRole.role : undefined,
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
    setRating(player.myRating || 5.0);
    setDialogOpen(true);
  };

  const handleAvatarClick = (player: PlayerWithRating) => {
    if (player.avatar_url) {
      setSelectedAvatar({ 
        url: player.avatar_url, 
        name: player.full_name,
        location: player.location,
        birth_date: player.birth_date
      });
      setAvatarDialogOpen(true);
    }
  };

  const handleRatingClick = async (player: PlayerWithRating) => {
    if (!isLeagueAdmin || player.total_ratings === 0) return;
    
    try {
      // Super user sees full ratings, admin sees only rater names
      const selectFields = isSuperUser ? "rater_id, rating" : "rater_id";
      const { data: ratingsData, error: ratingsError } = await supabase
        .from("player_ratings")
        .select(selectFields)
        .eq("rated_player_id", player.id);

      if (ratingsError) throw ratingsError;

      if (!ratingsData || ratingsData.length === 0) {
        setRaters([]);
        setRatersPlayerName(player.full_name);
        setRatersPlayerId(player.id);
        setRatersDialogOpen(true);
        return;
      }

      const raterIds = ratingsData.map((r: any) => r.rater_id);

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", raterIds);

      if (profilesError) throw profilesError;

      const ratersData: Rater[] = (profiles || []).map(p => {
        const ratingEntry = isSuperUser ? ratingsData.find((r: any) => r.rater_id === p.id) : null;
        return {
          id: p.id,
          full_name: p.full_name || "Brez imena",
          avatar_url: p.avatar_url || undefined,
          rating: ratingEntry ? (ratingEntry as any).rating : undefined,
        };
      });

      setRaters(ratersData);
      setRatersPlayerName(player.full_name);
      setRatersPlayerId(player.id);
      setRatersDialogOpen(true);
    } catch (error) {
      toast.error("Napaka pri nalaganju ocenjevalcev");
      console.error(error);
    }
  };

  const handleDeleteRating = async (raterId: string) => {
    if (!isSuperUser) return;
    try {
      const { error } = await supabase
        .from("player_ratings")
        .delete()
        .eq("rater_id", raterId)
        .eq("rated_player_id", ratersPlayerId);
      if (error) throw error;
      toast.success("Ocena izbrisana");
      setRatersDialogOpen(false);
      fetchPlayers();
    } catch (error) {
      toast.error("Napaka pri brisanju ocene");
      console.error(error);
    }
  };

  const handleEditRating = async () => {
    if (!isSuperUser || !editingRater) return;
    try {
      const { error } = await supabase
        .from("player_ratings")
        .update({ rating: editRatingValue })
        .eq("rater_id", editingRater.id)
        .eq("rated_player_id", ratersPlayerId);
      if (error) throw error;
      toast.success("Ocena posodobljena");
      setEditingRater(null);
      setRatersDialogOpen(false);
      fetchPlayers();
    } catch (error) {
      toast.error("Napaka pri posodabljanju ocene");
      console.error(error);
    }
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
                  <div className="flex items-start justify-between gap-3">
                    <div 
                      className={`flex items-center gap-3 flex-1 min-w-0 ${player.avatar_url ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                      onClick={() => handleAvatarClick(player)}
                    >
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={player.avatar_url} alt={player.full_name} />
                        <AvatarFallback>
                          {player.full_name ? player.full_name[0].toUpperCase() : player.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">
                          {player.full_name}
                        </CardTitle>
                        {player.role && (
                          <p className="text-xs text-muted-foreground">
                            {player.role}
                          </p>
                        )}
                      </div>
                    </div>
                    <div 
                      className={`flex items-center gap-1 flex-shrink-0 ${isLeagueAdmin && player.total_ratings > 0 ? 'cursor-pointer hover:opacity-70 transition-opacity' : ''}`}
                      onClick={() => handleRatingClick(player)}
                      title={isLeagueAdmin && player.total_ratings > 0 ? "Klikni za ogled ocenjevalcev" : undefined}
                    >
                      <Star className="h-4 w-4 fill-primary text-primary" />
                      <span className="font-bold text-sm">
                        {player.average_rating.toFixed(2)}
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
                    {player.id === user.id ? (
                      <span className="text-xs text-muted-foreground ml-auto italic">
                        To ste vi
                      </span>
                    ) : (
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
                              <Label>Ocena: {rating.toFixed(1)}/10</Label>
                              <Slider
                                value={[rating]}
                                onValueChange={(value) => setRating(Math.round(value[0] * 10) / 10)}
                                min={1}
                                max={10}
                                step={0.1}
                                className="w-full"
                              />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>1.0 - Najslabše</span>
                                <span>10.0 - Najboljše</span>
                              </div>
                            </div>
                            <Button onClick={submitRating} className="w-full">
                              Shrani oceno
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Avatar Preview Dialog */}
        <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedAvatar?.name}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center p-4">
              <img 
                src={selectedAvatar?.url} 
                alt={selectedAvatar?.name}
                className="max-w-full max-h-[60vh] rounded-lg object-contain"
              />
              <div className="mt-4 text-center space-y-1">
                <p className="font-semibold text-lg">{selectedAvatar?.name}</p>
                {selectedAvatar?.location && (
                  <p className="text-sm text-muted-foreground">{selectedAvatar.location}</p>
                )}
                {selectedAvatar?.birth_date && (
                  <p className="text-sm text-muted-foreground">
                    Rojstvo: {new Date(selectedAvatar.birth_date).toLocaleDateString('sl-SI')}
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Raters Dialog - Admin only */}
        <Dialog open={ratersDialogOpen} onOpenChange={(open) => { setRatersDialogOpen(open); if (!open) setEditingRater(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Ocenjevalci igralca: {ratersPlayerName}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              {raters.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm">
                  Ta igralec še nima ocen.
                </p>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {raters.map((rater) => (
                    <div key={rater.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={rater.avatar_url} alt={rater.full_name} />
                        <AvatarFallback>
                          {rater.full_name[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium flex-1">{rater.full_name}</span>
                      {isSuperUser && rater.rating !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-primary">{Number(rater.rating).toFixed(1)}</span>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingRater(rater); setEditRatingValue(Number(rater.rating)); }}>
                            <Star className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteRating(rater.id)}>
                            ✕
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* Inline edit rating for super user */}
              {editingRater && (
                <div className="mt-4 p-3 border rounded-lg space-y-3">
                  <Label className="text-sm">Uredi oceno za {editingRater.full_name}: {editRatingValue.toFixed(1)}/10</Label>
                  <Slider
                    value={[editRatingValue]}
                    onValueChange={(v) => setEditRatingValue(Math.round(v[0] * 10) / 10)}
                    min={1}
                    max={10}
                    step={0.1}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleEditRating} className="flex-1">Shrani</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingRater(null)} className="flex-1">Prekliči</Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

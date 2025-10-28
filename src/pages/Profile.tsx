import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Navbar from "@/components/Navbar";
import { toast } from "sonner";
import { User, LogOut, Upload } from "lucide-react";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Profile data
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [currentRole, setCurrentRole] = useState<string>("");
  const [currentLeagueName, setCurrentLeagueName] = useState<string>("");
  const [currentLeagueId, setCurrentLeagueId] = useState<string>("");
  const [isLeagueCreator, setIsLeagueCreator] = useState(false);
  
  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        setEmail(session.user.email || "");
        fetchProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setFullName(data.full_name || "");
      setLocation(data.location || "");
      setAvatarUrl(data.avatar_url || "");
      
      // Fetch current league membership
      const currentLeagueId = localStorage.getItem("currentLeagueId");
      if (currentLeagueId) {
        setCurrentLeagueId(currentLeagueId);
        
        const { data: memberData } = await supabase
          .from("league_members")
          .select("role, leagues(name)")
          .eq("league_id", currentLeagueId)
          .eq("user_id", userId)
          .single();
        
        if (memberData) {
          const roleMap: { [key: string]: string } = {
            'admin': 'Admin',
            'plačan_član': 'Plačan član',
            'neplačan_član': 'Neplačan član'
          };
          setCurrentRole(roleMap[memberData.role] || memberData.role);
          setCurrentLeagueName((memberData.leagues as any)?.name || "");
        }
        
        // Check if user is league creator
        const { data: leagueData } = await supabase
          .from("leagues")
          .select("created_by")
          .eq("id", currentLeagueId)
          .single();
        
        if (leagueData) {
          setIsLeagueCreator(leagueData.created_by === userId);
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          full_name: fullName,
          location: location,
          avatar_url: avatarUrl
        })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Profil uspešno posodobljen");
    } catch (error: any) {
      toast.error("Napaka pri posodabljanju profila");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("Izbrati morate sliko");
      }

      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Delete old avatar if exists
      if (avatarUrl) {
        const oldPath = avatarUrl.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("avatars").remove([`${user.id}/${oldPath}`]);
        }
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setAvatarUrl(data.publicUrl);

      // Update profile in database
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast.success("Profilna slika uspešno naložena");
    } catch (error: any) {
      toast.error(error.message || "Napaka pri nalaganju slike");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleLeaveLeague = async () => {
    if (!user || !currentLeagueId) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("league_members")
        .delete()
        .eq("league_id", currentLeagueId)
        .eq("user_id", user.id);

      if (error) throw error;
      
      localStorage.removeItem("currentLeagueId");
      toast.success("Uspešno ste se izpisali iz lige");
      navigate("/leagues");
    } catch (error: any) {
      toast.error("Napaka pri izpisu iz lige");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Gesli se ne ujemata");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Geslo mora biti dolgo vsaj 6 znakov");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      toast.success("Geslo uspešno spremenjeno");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error("Napaka pri spreminjanju gesla");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      <div className="container max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-2 mb-6">
          <User className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Moj Profil</h1>
        </div>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Osebni podatki</CardTitle>
            <CardDescription>Posodobite svoje podatke</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarUrl} alt={fullName || "Uporabnik"} />
                <AvatarFallback className="text-2xl">
                  {fullName ? fullName[0].toUpperCase() : email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-center gap-2">
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => document.getElementById("avatar-upload")?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Nalagam..." : "Naloži profilno sliko"}
                  </Button>
                </Label>
                <Input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground text-center">
                  PNG, JPG ali WEBP (max. 5MB)
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Emaila ni mogoče spremeniti
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Polno ime</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Vnesite svoje ime"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Kraj</Label>
              <Input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Vnesite svoj kraj"
              />
            </div>

            {currentLeagueName && (
              <div className="space-y-2">
                <Label htmlFor="role">Vloga v ekipi ({currentLeagueName})</Label>
                <Input
                  id="role"
                  type="text"
                  value={currentRole}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Vlogo lahko spreminja samo administrator ekipe
                </p>
              </div>
            )}

            <Button 
              onClick={handleUpdateProfile} 
              disabled={loading}
              className="w-full"
            >
              {loading ? "Shranjujem..." : "Shrani spremembe"}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* Leave League */}
        {currentLeagueName && !isLeagueCreator && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Izpis iz lige</CardTitle>
              <CardDescription>
                Zapustite ligo {currentLeagueName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <LogOut className="h-4 w-4 mr-2" />
                    Izpiši se iz lige
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Ste prepričani?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ali ste prepričani, da se želite izpisati iz lige "{currentLeagueName}"? 
                      Ta akcija je nepovratna in boste izgubili dostop do vseh podatkov v tej ligi.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Prekliči</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleLeaveLeague}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Izpiši se
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}

        {isLeagueCreator && currentLeagueName && (
          <Card className="border-muted">
            <CardHeader>
              <CardTitle>Ustanovitelj lige</CardTitle>
              <CardDescription>
                Ste ustanovitelj lige {currentLeagueName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Kot ustanovitelj lige se ne morete izpisati. Če želite prenehati upravljati ligo, 
                najprej dodelite administratorske pravice drugemu članu ali izbrišite ligo.
              </p>
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle>Spremeni geslo</CardTitle>
            <CardDescription>Nastavite novo geslo za svoj račun</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Novo geslo</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Vnesite novo geslo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Potrdi novo geslo</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ponovno vnesite novo geslo"
              />
            </div>

            <Button 
              onClick={handleChangePassword} 
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full"
              variant="secondary"
            >
              {loading ? "Spreminjam..." : "Spremeni geslo"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

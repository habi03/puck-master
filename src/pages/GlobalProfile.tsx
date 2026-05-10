import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { User, Upload, LogOut, Trophy, Shield, ArrowRight, KeyRound } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface LeagueMembership {
  id: string;
  league_id: string;
  role: string;
  league_name: string;
  is_creator: boolean;
}

export default function GlobalProfile() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Profile data
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Leagues
  const [memberships, setMemberships] = useState<LeagueMembership[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        setEmail(session.user.email || "");
        fetchProfile(session.user.id);
        fetchMemberships(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/auth");
      else setUser(session.user);
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
      setBirthDate(data.birth_date || "");
      setAvatarUrl(data.avatar_url || "");
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const fetchMemberships = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("league_members")
        .select("id, league_id, role, leagues(name, created_by)")
        .eq("user_id", userId);

      if (error) throw error;

      const mapped: LeagueMembership[] = (data || []).map((m: any) => ({
        id: m.id,
        league_id: m.league_id,
        role: m.role,
        league_name: m.leagues?.name || t("gp.unknownLeague"),
        is_creator: m.leagues?.created_by === userId,
      }));
      setMemberships(mapped);
    } catch (error) {
      console.error("Error fetching memberships:", error);
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
          birth_date: birthDate || null,
          avatar_url: avatarUrl,
        })
        .eq("id", user.id);
      if (error) throw error;
      toast.success(t("gp.profileUpdated"));
    } catch {
      toast.error(t("common.error"));
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

      if (avatarUrl) {
        const oldPath = avatarUrl.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("avatars").remove([`${user.id}/${oldPath}`]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      setAvatarUrl(data.publicUrl);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("id", user.id);
      if (updateError) throw updateError;

      toast.success(t("gp.avatarUploaded"));
    } catch (error: any) {
      toast.error(error.message || t("common.error"));
    } finally {
      setUploading(false);
    }
  };

  const handleLeaveLeague = async (membership: LeagueMembership) => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("league_members")
        .delete()
        .eq("league_id", membership.league_id)
        .eq("user_id", user.id);
      if (error) throw error;

      // Clear localStorage if leaving current league
      if (localStorage.getItem("currentLeagueId") === membership.league_id) {
        localStorage.removeItem("currentLeagueId");
      }

      toast.success(t("gp.leftLeague", { name: membership.league_name }));
      fetchMemberships(user.id);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t("gp.passwordsDontMatch"));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t("gp.passwordMinLength"));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success(t("gp.passwordChanged"));
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleEnterLeague = (leagueId: string) => {
    localStorage.setItem("currentLeagueId", leagueId);
    navigate("/league");
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      localStorage.removeItem("currentLeagueId");
      toast.success(t("nav.signOutSuccess"));
      navigate("/auth");
    } else {
      toast.error(t("nav.signOutError"));
    }
  };

  const roleMap: Record<string, string> = {
    admin: t("role.admin"),
    plačan_član: t("role.paidMember"),
    neplačan_član: t("role.unpaidMember"),
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Simple top bar for global profile */}
      <nav className="border-b bg-card shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            <h1 className="text-sm font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Playta
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <Trophy className="h-4 w-4 mr-1" />
              {t("gp.leaguesBtn")}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="container max-w-2xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <User className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{t("gp.title")}</h1>
        </div>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle>{t("gp.personalData")}</CardTitle>
            <CardDescription>{t("gp.updateData")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarUrl} alt={fullName || t("common.user")} />
                <AvatarFallback className="text-2xl">
                  {fullName ? fullName[0].toUpperCase() : email[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => document.getElementById("avatar-upload")?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? t("gp.uploading") : t("gp.uploadAvatar")}
                </Button>
                <Input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground">{t("gp.imageFormats")}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" value={email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">{t("gp.emailCantChange")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">{t("gp.fullName")}</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("gp.enterName")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">{t("gp.location")}</Label>
              <Input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("gp.enterLocation")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate">{t("gp.birthDate")}</Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>

            <Button onClick={handleUpdateProfile} disabled={loading} className="w-full">
              {loading ? t("gp.saving") : t("gp.saveChanges")}
            </Button>
          </CardContent>
        </Card>

        {/* Leagues section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              {t("gp.leagues")}
            </CardTitle>
            <CardDescription>{t("gp.leaguesDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {memberships.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm mb-3">{t("gp.noLeagues")}</p>
                <Button variant="default" onClick={() => navigate("/")}>
                  <Trophy className="h-4 w-4 mr-2" />
                  {t("gp.joinLeague")}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {memberships.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0">
                        {m.role === "admin" ? (
                          <Shield className="h-5 w-5 text-primary" />
                        ) : (
                          <Trophy className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{m.league_name}</p>
                        <Badge variant={m.role === "admin" ? "default" : "secondary"} className="text-xs mt-0.5">
                          {roleMap[m.role] || m.role}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleEnterLeague(m.league_id)}>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      {!m.is_creator && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                              <LogOut className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("gp.leaveLeague")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("gp.leaveConfirm", { name: m.league_name })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleLeaveLeague(m)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {t("gp.leaveBtn")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {t("gp.changePassword")}
            </CardTitle>
            <CardDescription>{t("gp.changePasswordDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("gp.newPassword")}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("gp.enterNewPassword")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("gp.confirmNewPassword")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("gp.reenterPassword")}
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full"
              variant="secondary"
            >
              {loading ? t("gp.changing") : t("gp.changePasswordBtn")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

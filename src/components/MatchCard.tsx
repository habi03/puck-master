import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, UserPlus, UserMinus } from "lucide-react";
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

interface MatchCardProps {
  match: any;
  currentUser: any;
  participants: any[];
  onUpdate: () => void;
}

export default function MatchCard({ match, currentUser, participants, onUpdate }: MatchCardProps) {
  const [position, setPosition] = useState<"igralec" | "vratar">("igralec");
  const [loading, setLoading] = useState(false);

  const userParticipation = participants.find(p => p.player_id === currentUser.id);
  const isSignedUp = !!userParticipation;

  const handleSignUp = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("match_participants")
        .insert({
          match_id: match.id,
          player_id: currentUser.id,
          position: position,
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

  const matchDate = new Date(match.match_date);
  const formattedDate = format(matchDate, "EEEE, d. MMMM yyyy", { locale: sl });

  return (
    <Card className="hover:shadow-lg transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-xl">Tekma</span>
          <Badge variant="secondary">{match.number_of_teams} ekipe</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span className="capitalize">{formattedDate}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{match.match_time}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{participants.length} prijavljenih igralcev</span>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        {!isSignedUp ? (
          <>
            <Select value={position} onValueChange={(v: any) => setPosition(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="igralec">Igralec</SelectItem>
                <SelectItem value="vratar">Vratar</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSignUp} disabled={loading} className="flex-1">
              <UserPlus className="h-4 w-4 mr-2" />
              Prijavi se
            </Button>
          </>
        ) : (
          <div className="flex flex-col gap-2 w-full">
            <Badge variant="outline" className="justify-center">
              Prijavljeni kot: {userParticipation.position}
            </Badge>
            <Button onClick={handleSignOut} disabled={loading} variant="destructive">
              <UserMinus className="h-4 w-4 mr-2" />
              Odjavi se
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
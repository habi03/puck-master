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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Tekma</span>
          <Badge variant="secondary" className="text-xs">{match.number_of_teams} ekipe</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 flex-shrink-0" />
          <span className="capitalize text-xs">{formattedDate}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs">{match.match_time}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs">{participants.length} prijavljenih</span>
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-2 pt-3">
        {!isSignedUp ? (
          <>
            <Select value={position} onValueChange={(v: any) => setPosition(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="igralec">Igralec</SelectItem>
                <SelectItem value="vratar">Vratar</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSignUp} disabled={loading} className="w-full">
              <UserPlus className="h-4 w-4 mr-2" />
              Prijavi se
            </Button>
          </>
        ) : (
          <>
            <Badge variant="outline" className="w-full justify-center py-1.5 text-xs">
              Prijavljeni kot: {userParticipation.position}
            </Badge>
            <Button onClick={handleSignOut} disabled={loading} variant="destructive" className="w-full">
              <UserMinus className="h-4 w-4 mr-2" />
              Odjavi se
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
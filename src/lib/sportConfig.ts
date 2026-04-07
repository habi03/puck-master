export type SportType = "hokej" | "nogomet" | "košarka" | "odbojka";

export interface SportConfig {
  key: SportType;
  label: string;
  icon: string; // lucide icon name
  positions: {
    player: string;
    goalkeeper: string | null; // null if sport has no goalkeeper
  };
  terminology: {
    goal: string; // single
    goals: string; // plural
    save: string;
    saves: string;
    assist: string;
    assists: string;
    match: string;
    matches: string;
  };
  hasGoalkeeper: boolean;
  defaultTeamColors: string[];
}

export const SPORT_CONFIGS: Record<SportType, SportConfig> = {
  hokej: {
    key: "hokej",
    label: "Hokej",
    icon: "hockey",
    positions: {
      player: "Igralec",
      goalkeeper: "Vratar",
    },
    terminology: {
      goal: "Gol",
      goals: "Goli",
      save: "Obramba",
      saves: "Obrambe",
      assist: "Asistenca",
      assists: "Asistence",
      match: "Tekma",
      matches: "Tekme",
    },
    hasGoalkeeper: true,
    defaultTeamColors: ["#22c55e", "#ef4444", "#3b82f6", "#eab308"],
  },
  nogomet: {
    key: "nogomet",
    label: "Nogomet",
    icon: "football",
    positions: {
      player: "Igralec",
      goalkeeper: "Vratar",
    },
    terminology: {
      goal: "Gol",
      goals: "Goli",
      save: "Obramba",
      saves: "Obrambe",
      assist: "Asistenca",
      assists: "Asistence",
      match: "Tekma",
      matches: "Tekme",
    },
    hasGoalkeeper: true,
    defaultTeamColors: ["#22c55e", "#ef4444", "#3b82f6", "#eab308"],
  },
  košarka: {
    key: "košarka",
    label: "Košarka",
    icon: "basketball",
    positions: {
      player: "Igralec",
      goalkeeper: null,
    },
    terminology: {
      goal: "Koš",
      goals: "Koši",
      save: "Blok",
      saves: "Bloki",
      assist: "Asistenca",
      assists: "Asistence",
      match: "Tekma",
      matches: "Tekme",
    },
    hasGoalkeeper: false,
    defaultTeamColors: ["#f97316", "#3b82f6", "#22c55e", "#eab308"],
  },
  odbojka: {
    key: "odbojka",
    label: "Odbojka",
    icon: "volleyball",
    positions: {
      player: "Igralec",
      goalkeeper: null,
    },
    terminology: {
      goal: "Točka",
      goals: "Točke",
      save: "Blok",
      saves: "Bloki",
      assist: "Asistenca",
      assists: "Asistence",
      match: "Tekma",
      matches: "Tekme",
    },
    hasGoalkeeper: false,
    defaultTeamColors: ["#eab308", "#3b82f6", "#22c55e", "#ef4444"],
  },
};

export const ALL_SPORTS: SportType[] = ["hokej", "nogomet", "košarka", "odbojka"];

export function getSportConfig(sportType: string | null | undefined): SportConfig {
  if (sportType && sportType in SPORT_CONFIGS) {
    return SPORT_CONFIGS[sportType as SportType];
  }
  return SPORT_CONFIGS.hokej;
}

/**
 * Get display label for a DB position value ("igralec" or "vratar")
 */
export function getPositionLabel(position: string, sportType?: string): string {
  const config = getSportConfig(sportType);
  if (position === "vratar") {
    return config.positions.goalkeeper || "Vratar";
  }
  return config.positions.player;
}

/**
 * Check if a sport supports goalkeepers
 */
export function sportHasGoalkeeper(sportType?: string): boolean {
  return getSportConfig(sportType).hasGoalkeeper;
}

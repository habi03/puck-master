import React from "react";

// Default team colors
export const DEFAULT_TEAM_COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#eab308"];

// For badges and small elements (light bg, colored text, semi-transparent border)
export function getTeamColorStyle(teamNum: number, colors: string[] = DEFAULT_TEAM_COLORS): React.CSSProperties {
  const hex = colors[(teamNum - 1) % colors.length] || DEFAULT_TEAM_COLORS[(teamNum - 1) % 4];
  return {
    backgroundColor: `${hex}20`,
    color: hex,
    borderColor: `${hex}60`,
  };
}

// For card backgrounds (very light bg, colored border)
export function getTeamCardStyle(teamNum: number, colors: string[] = DEFAULT_TEAM_COLORS): React.CSSProperties {
  const hex = colors[(teamNum - 1) % colors.length] || DEFAULT_TEAM_COLORS[(teamNum - 1) % 4];
  return {
    backgroundColor: `${hex}12`,
    borderColor: `${hex}40`,
  };
}

// Just the text color
export function getTeamTextColor(teamNum: number, colors: string[] = DEFAULT_TEAM_COLORS): React.CSSProperties {
  const hex = colors[(teamNum - 1) % colors.length] || DEFAULT_TEAM_COLORS[(teamNum - 1) % 4];
  return { color: hex };
}

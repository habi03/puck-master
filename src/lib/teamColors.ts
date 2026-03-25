// Default team colors
export const DEFAULT_TEAM_COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#eab308"];

// Convert hex to tailwind-compatible inline styles
export function getTeamColorStyle(teamNum: number, colors: string[] = DEFAULT_TEAM_COLORS): React.CSSProperties {
  const hex = colors[(teamNum - 1) % colors.length] || DEFAULT_TEAM_COLORS[(teamNum - 1) % 4];
  return {
    backgroundColor: `${hex}20`,
    color: hex,
    borderColor: `${hex}60`,
  };
}

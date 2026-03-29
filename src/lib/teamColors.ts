import React from "react";

// Default team colors
export const DEFAULT_TEAM_COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#eab308"];

// Parse hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return { r, g, b };
}

// Relative luminance (WCAG)
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Is a color too light to be visible on white?
function isLightColor(hex: string): boolean {
  return luminance(hex) > 0.6;
}

// Darken a hex color by a factor (0-1, where 0.5 = 50% darker)
function darkenHex(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const dr = Math.round(r * (1 - factor));
  const dg = Math.round(g * (1 - factor));
  const db = Math.round(b * (1 - factor));
  return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
}

// For badges and small elements (light bg, colored text, semi-transparent border)
export function getTeamColorStyle(teamNum: number, colors: string[] = DEFAULT_TEAM_COLORS): React.CSSProperties {
  const hex = colors[(teamNum - 1) % colors.length] || DEFAULT_TEAM_COLORS[(teamNum - 1) % 4];
  const light = isLightColor(hex);
  const textColor = light ? darkenHex(hex, 0.5) : hex;
  return {
    backgroundColor: `${hex}26`,
    color: textColor,
    borderColor: light ? `${darkenHex(hex, 0.3)}B3` : `${hex}99`,
    borderWidth: "2px",
    borderStyle: "solid",
  };
}

// For card backgrounds (very light bg, colored border)
export function getTeamCardStyle(teamNum: number, colors: string[] = DEFAULT_TEAM_COLORS): React.CSSProperties {
  const hex = colors[(teamNum - 1) % colors.length] || DEFAULT_TEAM_COLORS[(teamNum - 1) % 4];
  const light = isLightColor(hex);
  const borderHex = light ? darkenHex(hex, 0.3) : hex;
  return {
    backgroundColor: `${hex}1A`,
    borderColor: `${borderHex}99`,
    borderWidth: "2px",
    borderStyle: "solid",
  };
}

// Just the text color
export function getTeamTextColor(teamNum: number, colors: string[] = DEFAULT_TEAM_COLORS): React.CSSProperties {
  const hex = colors[(teamNum - 1) % colors.length] || DEFAULT_TEAM_COLORS[(teamNum - 1) % 4];
  const light = isLightColor(hex);
  return { color: light ? darkenHex(hex, 0.5) : hex };
}

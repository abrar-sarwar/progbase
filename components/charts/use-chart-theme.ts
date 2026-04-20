// Fixed, theme-neutral chart palette. Previously this hook watched the
// `.dark` class on <html> and re-rendered recharts on every theme flip —
// which made the View-Transition theme toggle visibly lag because the
// chart re-render happened mid-animation.
//
// Recharts reads color props at render time and applies them as SVG
// attributes, so CSS variables / CSS selectors don't cleanly override
// them. The simplest fix is to pick colors that read well in both modes
// and never recompute them. Violet-500 + zinc-500 at medium opacity
// satisfy contrast in light and dark without feeling mode-specific.

export const CHART_THEME = {
  grid: "rgba(113, 113, 122, 0.22)",
  axis: "rgba(113, 113, 122, 0.45)",
  tick: "rgba(113, 113, 122, 0.9)",
  accent: "#8b5cf6", // violet-500
  accentSoft: "rgba(139, 92, 246, 0.25)",
  tooltipBg: "#18181b",
  tooltipText: "#ffffff",
} as const;

export function useChartTheme() {
  return CHART_THEME;
}

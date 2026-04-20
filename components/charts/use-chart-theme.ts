"use client";

import { useEffect, useState } from "react";

export function useChartTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const update = () =>
      setDark(document.documentElement.classList.contains("dark"));
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => mo.disconnect();
  }, []);
  return {
    grid: dark ? "#27272a" : "#e4e4e7",
    axis: dark ? "#3f3f46" : "#d4d4d8",
    tick: dark ? "#a1a1aa" : "#52525b",
    accent: dark ? "#a78bfa" : "#7c3aed",
    accentSoft: dark ? "#3f3f46" : "#d4d4d8",
    tooltipBg: dark ? "#fafafa" : "#18181b",
    tooltipText: dark ? "#09090b" : "#ffffff",
  };
}

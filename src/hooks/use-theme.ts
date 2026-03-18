"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export const THEMES = ["dark", "light", "dim", "dusk"] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "maxion-theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function useThemeState(): ThemeContextValue {
  const [theme, setThemeState] = useState<Theme>("dark");

  // Read from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && THEMES.includes(stored)) {
      setThemeState(stored);
      document.documentElement.setAttribute("data-theme", stored);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  }, []);

  return { theme, setTheme };
}

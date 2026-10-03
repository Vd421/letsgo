// Light/dark mode. Dark is the default; the choice is remembered in the browser (localStorage).
// A "custom hook" = a reusable piece of React logic. Its name must start with "use".
import { useState } from "react";

export type Theme = "dark" | "light";
const STORAGE_KEY = "replay-theme";

function readSavedTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark"; // storage can be blocked (e.g. private windows)
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readSavedTheme);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    // index.css switches every colour token when <html data-theme="light"> is set.
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* not saved, but the switch still works for this visit */
    }
  }

  return { theme, toggleTheme };
}

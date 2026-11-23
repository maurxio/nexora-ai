import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const storageKey = 'nexora_theme';
const systemTheme = () =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
const readPreference = () => {
  try {
    const value = localStorage.getItem(storageKey);
    return ['light', 'dark'].includes(value) ? value : null;
  } catch {
    return null;
  }
};

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readPreference);
  const [system, setSystem] = useState(systemTheme);
  const theme = preference || system;

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = (event) => setSystem(event.matches ? 'dark' : 'light');
    const onStorage = (event) => {
      if (event.key === storageKey || event.key === null) setPreference(readPreference());
    };
    media.addEventListener('change', onSystemChange);
    window.addEventListener('storage', onStorage);
    return () => {
      media.removeEventListener('change', onSystemChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setPreference(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* Keep the theme usable when storage is unavailable. */
    }
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

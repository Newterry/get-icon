import { useEffect, useState } from 'react';
import { readTheme, saveTheme, type ThemePreference } from './preferences';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>(() => readTheme());

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const isDark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = (next: ThemePreference) => {
    saveTheme(next);
    setThemeState(next);
  };

  return { theme, setTheme };
}

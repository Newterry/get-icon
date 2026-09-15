export type ThemePreference = 'light' | 'dark' | 'system';
export type Locale = 'zh-CN' | 'en';

const THEME_KEY = 'get-icon:theme:v1';
const LOCALE_KEY = 'get-icon:locale:v1';
const LEGACY_THEME_KEY = 'favicon-extractor:theme:v2';
const LEGACY_LOCALE_KEY = 'favicon-extractor:locale:v1';

export function readTheme(): ThemePreference {
  const value = localStorage.getItem(THEME_KEY) ?? localStorage.getItem(LEGACY_THEME_KEY);
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function saveTheme(theme: ThemePreference): void {
  localStorage.setItem(THEME_KEY, theme);
}

export function readLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_KEY) ?? localStorage.getItem(LEGACY_LOCALE_KEY);
  if (stored === 'zh-CN' || stored === 'en') return stored;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

export function saveLocale(locale: Locale): void {
  localStorage.setItem(LOCALE_KEY, locale);
}

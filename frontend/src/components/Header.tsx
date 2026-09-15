import { Globe2, Laptop, Moon, Sun } from 'lucide-react';
import { useI18n } from '../i18n';
import type { ThemePreference } from '../preferences';

const themes: Array<{ value: ThemePreference; label: 'light' | 'dark' | 'system'; icon: typeof Sun }> = [
  { value: 'light', label: 'light', icon: Sun },
  { value: 'dark', label: 'dark', icon: Moon },
  { value: 'system', label: 'system', icon: Laptop },
];

export function Header({ theme, onThemeChange }: { theme: ThemePreference; onThemeChange: (theme: ThemePreference) => void }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label={t('appName')}>
        <span className="brand-mark"><img src="/app-icon.png" alt="" /></span>
        <span>{t('appName')}</span>
      </a>
      <div className="header-controls">
        <div className="language-switcher" aria-label={t('language')}>
          <Globe2 size={15} aria-hidden="true" />
          <button type="button" className={locale === 'zh-CN' ? 'active' : ''} onClick={() => setLocale('zh-CN')}>{t('chinese')}</button>
          <span>/</span>
          <button type="button" className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>EN</button>
        </div>
        <div className="theme-switcher" aria-label={t('theme')}>
          {themes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={theme === value ? 'active' : ''}
              aria-pressed={theme === value}
              aria-label={t(label)}
              title={t(label)}
              onClick={() => onThemeChange(value)}
            >
              <Icon size={15} /><span>{t(label)}</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

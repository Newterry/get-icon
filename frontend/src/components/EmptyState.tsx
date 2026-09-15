import { ScanSearch } from 'lucide-react';
import { useI18n } from '../i18n';

export function EmptyState() {
  const { t } = useI18n();
  return (
    <section className="empty-state">
      <div className="empty-visual"><img src="/app-icon.png" alt="" /><span><ScanSearch size={18} /></span></div>
      <h2>{t('emptyTitle')}</h2>
      <p>{t('emptyDescription')}</p>
    </section>
  );
}

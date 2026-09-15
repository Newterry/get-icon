import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useI18n } from '../i18n';

export function ErrorState({ message, code, onRetry }: { message: string; code?: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <section className="error-state" role="alert">
      <span><AlertTriangle size={25} /></span>
      <div><h2>{t('errorTitle')}</h2><p>{message}</p>{code ? <small>{code}</small> : null}</div>
      <button className="secondary action" onClick={onRetry}><RotateCcw size={17} />{t('retry')}</button>
    </section>
  );
}

import { Link2, Search } from 'lucide-react';
import { useI18n } from '../i18n';

interface SearchPanelProps {
  mode: 'single' | 'batch';
  value: string;
  batchValue: string;
  loading: boolean;
  onModeChange: (mode: 'single' | 'batch') => void;
  onValueChange: (value: string) => void;
  onBatchValueChange: (value: string) => void;
  onSubmit: () => void;
}

export function SearchPanel(props: SearchPanelProps) {
  const { t } = useI18n();
  const batchCount = new Set(props.batchValue.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)).size;
  return (
    <form className={`search-panel ${props.mode === 'batch' ? 'batch-search' : ''}`} onSubmit={(event) => { event.preventDefault(); props.onSubmit(); }}>
      <div className="mode-switch" aria-label={`${t('single')} / ${t('batch')}`}>
        <button type="button" className={props.mode === 'single' ? 'active' : ''} onClick={() => props.onModeChange('single')}>{t('single')}</button>
        <button type="button" className={props.mode === 'batch' ? 'active' : ''} onClick={() => props.onModeChange('batch')}>{t('batch')}</button>
      </div>
      {props.mode === 'single' ? (
        <label className="url-field">
          <Link2 size={20} />
          <input
            aria-label={t('urlLabel')}
            value={props.value}
            onChange={(event) => props.onValueChange(event.target.value)}
            placeholder={t('urlPlaceholder')}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
      ) : (
        <label className="batch-field">
          <span>{t('batchHelp')}</span>
          <textarea
            aria-label={t('batchLabel')}
            value={props.batchValue}
            onChange={(event) => props.onBatchValueChange(event.target.value)}
            placeholder={t('batchPlaceholder')}
            rows={5}
            spellCheck={false}
          />
          <small>{batchCount}/20</small>
        </label>
      )}
      <button className="primary" type="submit" disabled={props.loading}>
        <Search size={19} />{props.loading ? t('analyzing') : props.mode === 'single' ? t('analyze') : t('analyzeBatch')}
      </button>
    </form>
  );
}

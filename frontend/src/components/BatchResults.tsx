import { Download, ExternalLink, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { downloadUrl, proxyUrl } from '../api';
import { errorTranslationKey, useI18n } from '../i18n';
import type { BatchItem } from '../types';

export function BatchResults({ results, onSelect }: { results: BatchItem[]; onSelect: (input: string) => void }) {
  const { t } = useI18n();
  const successCount = results.filter((item) => item.success).length;
  const localizedError = (code: string, fallback: string): string => {
    const key = errorTranslationKey(code);
    return key ? t(key) : fallback;
  };
  return (
    <section className="surface batch-results">
      <div className="section-heading"><div><span>{t('batchResults')}</span><small>{t('batchSuccess', { success: successCount, total: results.length })}</small></div></div>
      <div className="batch-list">
        {results.map((item) => item.success ? (
          <article className="batch-row" key={item.input}>
            <div className="batch-icon"><img src={proxyUrl(item.best.url)} alt="" /></div>
            <div className="batch-site"><strong>{item.site.domain}</strong><span>{item.site.title || item.site.url}</span></div>
            <div className="batch-detail"><span>{item.best.vector ? t('vector') : `${item.best.width ?? '?'} × ${item.best.height ?? '?'}`}</span><small>{item.best.source}</small></div>
            <div className="batch-actions">
              <a href={downloadUrl(item.best.url, item.site.domain)}><Download size={16} />{t('download')}</a>
              <a href={item.best.url} target="_blank" rel="noreferrer"><ExternalLink size={16} />{t('open')}</a>
              <button onClick={() => onSelect(item.input)}><RotateCcw size={16} />{t('details')}</button>
            </div>
          </article>
        ) : (
          <article className="batch-row failed" key={item.input}>
            <div className="batch-icon"><ImageIcon size={21} /></div>
            <div className="batch-site"><strong>{item.input}</strong><span>{localizedError(item.error.code, item.error.message)}</span></div>
            <div className="batch-detail"><span>{t('failed')}</span><small>{item.error.code}</small></div>
            <div className="batch-actions"><button onClick={() => onSelect(item.input)}><RotateCcw size={16} />{t('retry')}</button></div>
          </article>
        ))}
      </div>
    </section>
  );
}

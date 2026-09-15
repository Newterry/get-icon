import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Check, Clipboard, Download, ExternalLink, Globe2, Image as ImageIcon,
  Link2, Palette, RotateCcw,
} from 'lucide-react';
import { downloadUrl, proxyUrl, type OutputFormat, type OutputSize } from '../api';
import { useI18n } from '../i18n';
import type { IconCandidate, IconResult, IconSource } from '../types';

const sourceTranslationKeys: Record<IconSource, 'sourceApple' | 'sourceManifest' | 'sourceFavicon' | 'sourceDiscovered' | 'sourceGoogle'> = {
  'apple-touch-icon': 'sourceApple',
  manifest: 'sourceManifest',
  favicon: 'sourceFavicon',
  discovered: 'sourceDiscovered',
  google: 'sourceGoogle',
};

function IconImage({
  icon,
  size,
  className = '',
  format = 'original',
  outputSize = 'original',
}: {
  icon: IconCandidate;
  size: number;
  className?: string;
  format?: OutputFormat;
  outputSize?: OutputSize;
}) {
  return (
    <img
      className={className}
      src={proxyUrl(icon.url, format, outputSize)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

interface ResultViewProps {
  result: IconResult;
  onCopy: (text: string, label?: string) => void;
  onRetry: () => void;
}

export function ResultView({ result, onCopy, onRetry }: ResultViewProps) {
  const { t } = useI18n();
  const { best, site } = result;
  const [format, setFormat] = useState<OutputFormat>('original');
  const [outputSize, setOutputSize] = useState<OutputSize>('original');
  const previewSizes = [16, 32, 64, 128, 256];
  const formatOptions: OutputFormat[] = ['original', 'png', 'webp', 'jpeg', 'avif'];
  const sizeOptions: OutputSize[] = ['original', 128, 256, 512];

  useEffect(() => {
    setFormat('original');
    setOutputSize('original');
  }, [best.url]);

  const selectedImageUrl = useMemo(() => proxyUrl(best.url, format, outputSize), [best.url, format, outputSize]);
  const copyableImageUrl = useMemo(() => new URL(selectedImageUrl, window.location.href).href, [selectedImageUrl]);

  const dimensions = (icon: IconCandidate): string => {
    if (icon.vector) return t('vector');
    if (icon.width && icon.height) return `${icon.width} × ${icon.height}`;
    return icon.declaredSizes || icon.format.toUpperCase();
  };

  return (
    <div className="result-stack">
      <section className="surface overview-card">
        <div className="section-heading">
          <div><span>{t('bestIcon')}</span><strong className="quality-tag"><Check size={13} />{t('bestQuality')}</strong></div>
          <button className="icon-text-button" type="button" onClick={onRetry}><RotateCcw size={15} />{t('refresh')}</button>
        </div>

        <div className="overview-main">
          <div className="best-pane">
            <div className="best-body">
              <div className="best-preview">
                <span className="scan-corner top-left" /><span className="scan-corner top-right" />
                <span className="scan-corner bottom-left" /><span className="scan-corner bottom-right" />
                <IconImage icon={best} size={180} className="best-image" format={format} outputSize={outputSize} />
              </div>
              <div className="best-info">
                <h2>{site.domain}</h2>
                {site.title ? <p className="site-title">{site.title}</p> : null}
                <div className="best-meta"><span>{dimensions(best)}</span><span>{t(sourceTranslationKeys[best.source])}</span></div>
                {site.themeColor ? <div className="theme-color"><Palette size={15} /><i style={{ background: site.themeColor }} />{site.themeColor}</div> : null}
                <div className="best-links">
                  <a href={site.url} target="_blank" rel="noreferrer"><Globe2 size={15} />{t('visitWebsite')}</a>
                  <button onClick={() => onCopy(site.domain, t('domain'))}><Clipboard size={15} />{t('copyDomain')}</button>
                </div>
              </div>
            </div>
            <div className="best-actions">
              <a className="primary action" href={downloadUrl(best.url, site.domain, format, outputSize)}><Download size={18} />{t('downloadBest')}</a>
              <button className="secondary action" onClick={() => onCopy(copyableImageUrl)}><Link2 size={17} />{t('copyImageLink')}</button>
              <a className="secondary action" href={selectedImageUrl} target="_blank" rel="noreferrer"><ExternalLink size={17} />{t('openNewTab')}</a>
            </div>
          </div>

          <div className="preview-pane">
            <div className="preview-heading"><strong>{t('multiSizePreview')}</strong><span>{t('previewNote')}</span></div>
            <div className="size-previews">
              {previewSizes.map((size) => (
                <div className="size-item" key={size}>
                  <div className="preview-box" style={{ '--preview-size': `${size}px` } as CSSProperties}>
                    <img src={selectedImageUrl} alt="" width={size} height={size} loading="lazy" />
                  </div>
                  <span>{size} × {size}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="output-controls">
          <fieldset>
            <legend>{t('outputFormat')}</legend>
            <div className="choice-group">
              {formatOptions.map((option) => (
                <button key={option} type="button" className={format === option ? 'active' : ''} aria-pressed={format === option} onClick={() => setFormat(option)}>
                  {option === 'original' ? t('original') : option.toUpperCase()}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{t('outputSize')}</legend>
            <div className="choice-group">
              {sizeOptions.map((option) => (
                <button key={option} type="button" className={outputSize === option ? 'active' : ''} aria-pressed={outputSize === option} onClick={() => setOutputSize(option)}>
                  {option === 'original' ? t('original') : option}
                </button>
              ))}
            </div>
          </fieldset>
          <small>{t('formatHint')}</small>
        </div>
      </section>

      <IconSources result={result} onCopy={onCopy} dimensions={dimensions} />

      {result.resources.length > 0 ? (
        <section className="surface resource-card">
          <div className="section-heading"><div><span>{t('otherResources')}</span></div></div>
          <p className="section-note">{t('resourcesNote')}</p>
          {result.resources.map((resource) => (
            <div className="resource-row" key={resource.url}>
              <ImageIcon size={18} /><strong>{resource.type === 'open-graph-image' ? t('ogImage') : resource.label}</strong><span>{resource.url}</span>
              <a href={resource.url} target="_blank" rel="noreferrer"><ExternalLink size={16} />{t('open')}</a>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function IconSources({
  result,
  onCopy,
  dimensions,
}: {
  result: IconResult;
  onCopy: (text: string) => void;
  dimensions: (icon: IconCandidate) => string;
}) {
  const { t } = useI18n();
  const missing = result.checks.filter((check) => check.count === 0);
  const missingMessage = (key: IconSource, status: string): string => {
    if (key === 'manifest') return t('manifestMissing');
    if (key === 'google' && status === 'skipped') return t('fallbackSkipped');
    return t('notFoundMessage');
  };

  return (
    <section className="surface sources-card">
      <div className="section-heading">
        <div><span>{t('iconSources')}</span><small>{t('sourceCount', { count: result.icons.length })}</small></div>
        {result.meta.cached ? <span className="cache-note">{t('cached')}</span> : null}
      </div>
      <div className="source-table" role="table" aria-label={t('iconSources')}>
        <div className="source-row source-header" role="row">
          <span>{t('source')}</span><span>{t('status')}</span><span>{t('address')}</span><span>{t('dimensions')}</span><span>{t('actions')}</span>
        </div>
        {result.icons.map((icon, index) => (
          <div className="source-row" role="row" key={icon.url}>
            <span className="source-name"><i><IconImage icon={icon} size={28} /></i>{t(sourceTranslationKeys[icon.source])}{index === 0 ? <b>{t('recommended')}</b> : null}</span>
            <span><em className="status found"><i />{t('found')}</em></span>
            <span className="source-url" title={icon.url}>{icon.url}</span>
            <span>{dimensions(icon)}</span>
            <span className="row-actions">
              <a title={t('download')} aria-label={t('download')} href={downloadUrl(icon.url, result.site.domain)}><Download size={16} /></a>
              <button title={t('copyUrl')} aria-label={t('copyUrl')} onClick={() => onCopy(icon.url)}><Clipboard size={16} /></button>
              <a title={t('openNewTab')} aria-label={t('openNewTab')} href={icon.url} target="_blank" rel="noreferrer"><ExternalLink size={16} /></a>
            </span>
          </div>
        ))}
        {missing.map((check) => (
          <div className="source-row missing-row" role="row" key={check.key}>
            <span className="source-name"><i><ImageIcon size={16} /></i>{t(sourceTranslationKeys[check.key])}</span>
            <span><em className={`status ${check.status}`}>{check.status === 'skipped' ? t('skipped') : t('notFound')}</em></span>
            <span className="source-url">{missingMessage(check.key, check.status)}</span><span>—</span><span className="row-actions">—</span>
          </div>
        ))}
      </div>
    </section>
  );
}

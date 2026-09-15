import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getIcon, getIcons } from './api';
import { BatchResults } from './components/BatchResults';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import { Header } from './components/Header';
import { LoadingState } from './components/LoadingState';
import { ResultView } from './components/ResultView';
import { SearchPanel } from './components/SearchPanel';
import { errorTranslationKey, useI18n } from './i18n';
import type { BatchItem, IconResult } from './types';
import { useTheme } from './useTheme';
import { useWebsiteIconTool } from './webmcp';

interface ErrorStateValue { message: string; code?: string }

export function App() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [value, setValue] = useState('');
  const [batchValue, setBatchValue] = useState('');
  const [result, setResult] = useState<IconResult | null>(null);
  const [batchResults, setBatchResults] = useState<BatchItem[] | null>(null);
  const [error, setError] = useState<ErrorStateValue | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [toast, setToast] = useState('');
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!loading) return;
    setActiveStep(0);
    const timer = window.setInterval(() => setActiveStep((step) => Math.min(step + 1, 3)), 950);
    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  const showError = useCallback((caught: unknown) => {
    if (caught instanceof DOMException && caught.name === 'AbortError') return;
    if (caught instanceof ApiError) {
      const translationKey = errorTranslationKey(caught.code);
      setError({ message: translationKey ? t(translationKey) : caught.message, code: caught.code });
    } else setError({ message: t('networkError'), code: 'NETWORK_ERROR' });
  }, [t]);

  const runSingle = useCallback(async (target: string): Promise<IconResult> => {
    const trimmed = target.trim();
    if (!trimmed) {
      const validationError = new ApiError('INVALID_URL', t('invalidSingle'));
      setError({ message: validationError.message, code: validationError.code });
      throw validationError;
    }
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setValue(trimmed);
    setMode('single');
    setLoading(true);
    setError(null);
    setBatchResults(null);
    try {
      const next = await getIcon(trimmed, controller.signal);
      setResult(next);
      return next;
    } catch (caught) {
      showError(caught);
      throw caught;
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }, [showError, t]);

  useWebsiteIconTool(runSingle);

  const runBatch = async () => {
    const urls = [...new Set(batchValue.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean))];
    if (urls.length === 0) {
      setError({ message: t('invalidBatch'), code: 'INVALID_BATCH' });
      return;
    }
    if (urls.length > 20) {
      setError({ message: t('batchLimit'), code: 'BATCH_LIMIT' });
      return;
    }
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await getIcons(urls, controller.signal);
      setBatchResults(response.results);
    } catch (caught) {
      showError(caught);
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  };

  const submit = () => {
    if (loading) return;
    if (mode === 'single') void runSingle(value).catch(() => undefined);
    else void runBatch();
  };

  const selectSite = (site: string) => {
    setValue(site);
    setMode('single');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    void runSingle(site).catch(() => undefined);
  };

  const copyText = async (text: string, label = t('copyImageLink')) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(t('copied', { label }));
      window.setTimeout(() => setToast(''), 1800);
    } catch {
      setToast(t('copyFailed'));
      window.setTimeout(() => setToast(''), 1800);
    }
  };

  return (
    <div className="app-shell">
      <Header theme={theme} onThemeChange={setTheme} />
      <main className="container">
        <section className="intro">
          <h1>{t('heroTitle')}</h1>
        </section>
        <SearchPanel
          mode={mode}
          value={value}
          batchValue={batchValue}
          loading={loading}
          onModeChange={(nextMode) => { setMode(nextMode); setError(null); }}
          onValueChange={setValue}
          onBatchValueChange={setBatchValue}
          onSubmit={submit}
        />

        <div className="content-area">
          {loading ? <LoadingState activeStep={activeStep} /> : null}
          {!loading && error ? <ErrorState message={error.message} code={error.code} onRetry={submit} /> : null}
          {!loading && !error && result ? <ResultView result={result} onCopy={copyText} onRetry={submit} /> : null}
          {!loading && !error && batchResults ? <BatchResults results={batchResults} onSelect={selectSite} /> : null}
          {!loading && !error && !result && !batchResults ? <EmptyState /> : null}
        </div>

        <footer><span>Get Icon</span><a href="/api/health" target="_blank" rel="noreferrer">{t('apiStatus')}</a><span>·</span><span>{t('cacheFooter')}</span></footer>
      </main>
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { readLocale, saveLocale, type Locale } from './preferences';

const zh = {
  appName: 'Get Icon',
  heroTitle: '输入任意网站，一键获取最高质量 Favicon',
  language: '语言',
  chinese: '中文',
  english: 'English',
  theme: '主题',
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
  single: '单个',
  batch: '批量',
  urlLabel: '网站地址',
  urlPlaceholder: '输入网站，如 apple.com',
  batchLabel: '批量网站地址',
  batchHelp: '每行一个网站，最多 20 个',
  batchPlaceholder: 'apple.com\ngithub.com\nopenai.com',
  analyze: '获取图标',
  analyzeBatch: '批量获取',
  analyzing: '正在分析…',
  emptyTitle: '准备提取网站图标',
  emptyDescription: '输入网站后，系统会分析网页、Manifest 与常见图标路径，并验证图标的真实格式和尺寸。',
  loadingTitle: '正在分析网站',
  loadingDescription: '正在从多个来源寻找分辨率最高的可用图标。',
  stepConnect: '正在连接网站',
  stepHtml: '正在解析 HTML',
  stepManifest: '正在检测 Manifest',
  stepQuality: '正在寻找高清图标',
  errorTitle: '暂时无法获取图标',
  retry: '重新尝试',
  networkError: '网络连接异常，请检查服务是否已启动。',
  dnsError: '无法解析该网站的域名，请检查地址是否正确。',
  timeoutError: '连接目标网站超时，请稍后重试。',
  httpError: '目标网站返回了异常的 HTTP 状态。',
  sslError: '目标网站的 SSL 证书或安全连接异常。',
  connectionError: '目标网站拒绝连接或提前断开。',
  fetchError: '无法连接目标网站。',
  noIconError: '没有找到可用的网站图标。',
  ssrfError: '出于安全原因，不能访问本机、内网或保留地址。',
  protocolError: '仅支持 HTTP 和 HTTPS 地址。',
  htmlError: '目标地址没有返回可分析的网页。',
  tooLargeError: '目标资源超过允许的大小。',
  rateLimitError: '请求过于频繁，请稍后再试。',
  imageError: '目标资源不是受支持的图片。',
  formatError: '不支持所选的输出格式。',
  sizeError: '输出尺寸必须在 16 到 1024 之间。',
  conversionError: '该图标无法转换为所选格式，请尝试 PNG 或原格式。',
  serverError: '服务器暂时无法完成请求，请稍后重试。',
  invalidSingle: '请输入要分析的网站地址。',
  invalidBatch: '请至少输入一个网站，每行一个。',
  batchLimit: '一次最多可以分析 20 个网站。',
  bestIcon: '最佳图标',
  bestQuality: '最佳质量',
  refresh: '重新获取',
  visitWebsite: '访问网站',
  copyDomain: '复制域名',
  domain: '域名',
  downloadBest: '下载最佳图标',
  copyImageLink: '复制图片链接',
  openNewTab: '新标签页打开',
  outputFormat: '输出格式',
  outputSize: '输出尺寸',
  original: '原格式',
  formatHint: 'JPEG 会使用白色背景；其他格式保留透明通道。',
  multiSizePreview: '多尺寸预览',
  previewNote: '基于所选输出格式等比缩放，快速检查不同使用场景。',
  iconSources: '图标来源',
  sourceCount: '共获取 {count} 个有效候选',
  cached: '来自 1 小时缓存',
  source: '来源',
  status: '状态',
  address: '地址',
  dimensions: '尺寸',
  actions: '操作',
  found: '已获取',
  skipped: '已跳过',
  notFound: '未找到',
  notFoundMessage: '未找到可用图标',
  manifestMissing: '页面未声明 Manifest',
  fallbackSkipped: '已找到网站自有图标，无需兜底',
  recommended: '推荐',
  download: '下载',
  copyUrl: '复制 URL',
  open: '打开',
  otherResources: '其他网站资源',
  resourcesNote: '以下资源不会参与最佳 Favicon 评选。',
  ogImage: 'Open Graph 图片',
  batchResults: '批量结果',
  batchSuccess: '{success}/{total} 个网站成功',
  details: '详情',
  failed: '获取失败',
  apiStatus: 'API 状态',
  cacheFooter: '缓存 1 小时',
  copied: '{label}已复制',
  copyFailed: '复制失败，请手动复制',
  sourceApple: 'Apple Touch Icon',
  sourceManifest: 'Manifest Icon',
  sourceFavicon: 'Favicon',
  sourceDiscovered: '自动探测',
  sourceGoogle: 'Google 兜底',
  vector: 'SVG / 矢量',
} as const;

type TranslationKey = keyof typeof zh;
type Parameters = Record<string, string | number>;

const en: Record<TranslationKey, string> = {
  appName: 'Get Icon',
  heroTitle: 'Find the highest-quality favicon for any website',
  language: 'Language',
  chinese: '中文',
  english: 'English',
  theme: 'Theme',
  light: 'Light',
  dark: 'Dark',
  system: 'System',
  single: 'Single',
  batch: 'Batch',
  urlLabel: 'Website address',
  urlPlaceholder: 'Enter a website, such as apple.com',
  batchLabel: 'Website addresses',
  batchHelp: 'One website per line, up to 20',
  batchPlaceholder: 'apple.com\ngithub.com\nopenai.com',
  analyze: 'Get icon',
  analyzeBatch: 'Get icons',
  analyzing: 'Analyzing…',
  emptyTitle: 'Ready to extract a website icon',
  emptyDescription: 'Enter a website to inspect its HTML, manifest and common icon paths, then verify each icon’s real format and dimensions.',
  loadingTitle: 'Analyzing website',
  loadingDescription: 'Checking multiple sources for the best available icon.',
  stepConnect: 'Connecting to website',
  stepHtml: 'Parsing HTML',
  stepManifest: 'Checking manifest',
  stepQuality: 'Finding high-resolution icons',
  errorTitle: 'Unable to get an icon',
  retry: 'Try again',
  networkError: 'Network error. Check that the service is running.',
  dnsError: 'The domain could not be resolved. Check the website address.',
  timeoutError: 'The website took too long to respond. Try again later.',
  httpError: 'The website returned an unexpected HTTP status.',
  sslError: 'The website has an SSL certificate or secure connection problem.',
  connectionError: 'The website refused the connection or disconnected early.',
  fetchError: 'The website could not be reached.',
  noIconError: 'No usable website icon was found.',
  ssrfError: 'Local, private and reserved network addresses are blocked for security.',
  protocolError: 'Only HTTP and HTTPS addresses are supported.',
  htmlError: 'The target address did not return an HTML page that can be analyzed.',
  tooLargeError: 'The target resource exceeds the allowed size.',
  rateLimitError: 'Too many requests. Please try again shortly.',
  imageError: 'The target resource is not a supported image.',
  formatError: 'The selected output format is not supported.',
  sizeError: 'Output size must be between 16 and 1024.',
  conversionError: 'This icon could not be converted. Try PNG or the original format.',
  serverError: 'The server could not complete the request. Please try again.',
  invalidSingle: 'Enter a website to analyze.',
  invalidBatch: 'Enter at least one website, one per line.',
  batchLimit: 'You can analyze up to 20 websites at once.',
  bestIcon: 'Best icon',
  bestQuality: 'Best quality',
  refresh: 'Refresh',
  visitWebsite: 'Visit website',
  copyDomain: 'Copy domain',
  domain: 'Domain',
  downloadBest: 'Download best icon',
  copyImageLink: 'Copy image link',
  openNewTab: 'Open in new tab',
  outputFormat: 'Output format',
  outputSize: 'Output size',
  original: 'Original',
  formatHint: 'JPEG uses a white background; other formats preserve transparency.',
  multiSizePreview: 'Multi-size preview',
  previewNote: 'Scales the selected output to preview common use cases.',
  iconSources: 'Icon sources',
  sourceCount: '{count} valid candidates found',
  cached: 'From 1-hour cache',
  source: 'Source',
  status: 'Status',
  address: 'Address',
  dimensions: 'Dimensions',
  actions: 'Actions',
  found: 'Found',
  skipped: 'Skipped',
  notFound: 'Not found',
  notFoundMessage: 'No usable icon found',
  manifestMissing: 'No manifest declared',
  fallbackSkipped: 'A first-party icon was found',
  recommended: 'Best',
  download: 'Download',
  copyUrl: 'Copy URL',
  open: 'Open',
  otherResources: 'Other website assets',
  resourcesNote: 'These assets are not included in favicon scoring.',
  ogImage: 'Open Graph image',
  batchResults: 'Batch results',
  batchSuccess: '{success}/{total} websites succeeded',
  details: 'Details',
  failed: 'Failed',
  apiStatus: 'API status',
  cacheFooter: '1-hour cache',
  copied: '{label} copied',
  copyFailed: 'Could not copy. Please copy it manually.',
  sourceApple: 'Apple Touch Icon',
  sourceManifest: 'Manifest Icon',
  sourceFavicon: 'Favicon',
  sourceDiscovered: 'Auto-discovered',
  sourceGoogle: 'Google fallback',
  vector: 'SVG / Vector',
};

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, parameters?: Parameters) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readLocale());
  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale(next) {
      saveLocale(next);
      setLocaleState(next);
    },
    t(key, parameters) {
      const template = (locale === 'zh-CN' ? zh : en)[key];
      return Object.entries(parameters ?? {}).reduce(
        (text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)),
        template,
      );
    },
  }), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === 'zh-CN' ? zh.appName : en.appName;
    document.querySelector('meta[name="description"]')?.setAttribute('content', locale === 'zh-CN' ? zh.heroTitle : en.heroTitle);
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}

export function errorTranslationKey(code?: string): TranslationKey | null {
  if (code === 'INVALID_URL') return 'invalidSingle';
  if (code === 'INVALID_BATCH') return 'invalidBatch';
  if (code === 'BATCH_LIMIT') return 'batchLimit';
  if (code === 'DNS_ERROR') return 'dnsError';
  if (code === 'TIMEOUT') return 'timeoutError';
  if (code === 'HTTP_ERROR' || code === 'TOO_MANY_REDIRECTS') return 'httpError';
  if (code === 'SSL_ERROR') return 'sslError';
  if (code === 'CONNECTION_ERROR') return 'connectionError';
  if (code === 'FETCH_ERROR') return 'fetchError';
  if (code === 'NO_ICON') return 'noIconError';
  if (code === 'SSRF_BLOCKED') return 'ssrfError';
  if (code === 'UNSUPPORTED_PROTOCOL') return 'protocolError';
  if (code === 'NOT_HTML') return 'htmlError';
  if (code === 'RESPONSE_TOO_LARGE') return 'tooLargeError';
  if (code === 'RATE_LIMITED') return 'rateLimitError';
  if (code === 'NOT_IMAGE') return 'imageError';
  if (code === 'INVALID_FORMAT') return 'formatError';
  if (code === 'INVALID_SIZE') return 'sizeError';
  if (code === 'CONVERSION_FAILED') return 'conversionError';
  if (code === 'INTERNAL_ERROR') return 'serverError';
  return null;
}

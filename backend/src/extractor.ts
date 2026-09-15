import * as cheerio from 'cheerio';
import { MemoryCache } from './cache.js';
import { mapWithConcurrency } from './concurrency.js';
import { AppError } from './errors.js';
import { secureGet } from './http.js';
import { inspectImage } from './image-metadata.js';
import { normalizeWebsiteUrl } from './security.js';
import type { IconCandidate, IconResult, IconSource, RawCandidate, SourceCheck, WebsiteResource } from './types.js';

const HTML_LIMIT = 2 * 1024 * 1024;
const MANIFEST_LIMIT = 512 * 1024;
const IMAGE_LIMIT = 8 * 1024 * 1024;
const DEFAULT_PATHS = [
  '/favicon.ico',
  '/favicon.png',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
] as const;

const SOURCE_LABELS: Record<IconSource, string> = {
  'apple-touch-icon': 'Apple Touch Icon',
  manifest: 'Web App Manifest',
  favicon: '页面 Favicon',
  discovered: '常见路径探测',
  google: 'Google Favicon 兜底',
};

const SOURCE_WEIGHT: Record<IconSource, number> = {
  manifest: 500_000,
  'apple-touch-icon': 450_000,
  favicon: 350_000,
  discovered: 200_000,
  google: 50_000,
};

const cache = new MemoryCache<IconResult>(60 * 60 * 1000);
const inFlight = new Map<string, Promise<IconResult>>();

function resolveHttpUrl(value: string | undefined, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim(), base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function collectHtmlCandidates(html: string, pageUrl: string): {
  candidates: RawCandidate[];
  manifestUrls: string[];
  title: string | null;
  themeColor: string | null;
  resources: WebsiteResource[];
} {
  const $ = cheerio.load(html);
  const candidates: RawCandidate[] = [];
  const manifestUrls: string[] = [];

  $('link[href]').each((_index, element) => {
    const rel = ($(element).attr('rel') ?? '').toLowerCase().split(/\s+/u);
    const href = resolveHttpUrl($(element).attr('href'), pageUrl);
    if (!href) return;
    const declaredSizes = $(element).attr('sizes');
    if (rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed')) {
      candidates.push({ url: href, source: 'apple-touch-icon', declaredSizes });
    } else if (rel.includes('manifest')) {
      manifestUrls.push(href);
    } else if (rel.includes('icon') || rel.includes('shortcut') || rel.includes('mask-icon')) {
      candidates.push({ url: href, source: 'favicon', declaredSizes });
    }
  });

  const title = $('title').first().text().replace(/\s+/gu, ' ').trim().slice(0, 300) || null;
  const themeColor = $('meta[name="theme-color"]').first().attr('content')?.trim().slice(0, 64) || null;
  const ogImage = resolveHttpUrl($('meta[property="og:image"]').first().attr('content'), pageUrl);
  const resources: WebsiteResource[] = ogImage
    ? [{ type: 'open-graph-image', label: 'Open Graph 图片', url: ogImage }]
    : [];
  return { candidates, manifestUrls: [...new Set(manifestUrls)], title, themeColor, resources };
}

async function collectManifestCandidates(manifestUrl: string): Promise<RawCandidate[]> {
  try {
    const response = await secureGet(manifestUrl, {
      maxBytes: MANIFEST_LIMIT,
      timeoutMs: 6_000,
      accept: 'application/manifest+json,application/json,text/plain;q=0.8,*/*;q=0.1',
    });
    if (response.status < 200 || response.status >= 300) return [];
    const parsed = JSON.parse(response.body.toString('utf8')) as { icons?: unknown };
    if (!Array.isArray(parsed.icons)) return [];
    return parsed.icons.flatMap((item): RawCandidate[] => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Record<string, unknown>;
      const url = resolveHttpUrl(typeof record.src === 'string' ? record.src : undefined, response.url);
      if (!url) return [];
      return [{
        url,
        source: 'manifest',
        declaredSizes: typeof record.sizes === 'string' ? record.sizes : undefined,
      }];
    });
  } catch {
    return [];
  }
}

async function probeCandidate(candidate: RawCandidate): Promise<IconCandidate | null> {
  try {
    const response = await secureGet(candidate.url, {
      maxBytes: IMAGE_LIMIT,
      timeoutMs: 6_000,
      accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.5',
    });
    if (response.status < 200 || response.status >= 300 || response.body.length === 0) return null;
    const metadata = await inspectImage(response.body, response.headers['content-type']);
    if (!metadata) return null;
    return {
      url: response.url,
      source: candidate.source,
      sources: candidate.sources ?? [candidate.source],
      width: metadata.width,
      height: metadata.height,
      type: metadata.type,
      format: metadata.format,
      vector: metadata.vector,
      ...(candidate.declaredSizes ? { declaredSizes: candidate.declaredSizes } : {}),
    };
  } catch {
    return null;
  }
}

function mergeCandidates(icons: Array<IconCandidate | null>): IconCandidate[] {
  const deduped = new Map<string, IconCandidate>();
  for (const icon of icons) {
    if (!icon) continue;
    const key = icon.url;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, icon);
      continue;
    }
    if (!existing.sources.includes(icon.source)) existing.sources.push(icon.source);
    if (SOURCE_WEIGHT[icon.source] > SOURCE_WEIGHT[existing.source]) existing.source = icon.source;
    existing.declaredSizes ??= icon.declaredSizes;
  }
  return [...deduped.values()];
}

function score(icon: IconCandidate): number {
  if (icon.vector) return 1_000_000_000 + SOURCE_WEIGHT[icon.source];
  const area = (icon.width ?? 0) * (icon.height ?? 0);
  return area + SOURCE_WEIGHT[icon.source];
}

function buildChecks(icons: IconCandidate[], manifestDiscovered: boolean, googleAttempted: boolean): SourceCheck[] {
  return (Object.keys(SOURCE_LABELS) as IconSource[]).map((key) => {
    const count = icons.filter((icon) => icon.sources.includes(key)).length;
    if (key === 'manifest' && !manifestDiscovered) {
      return { key, label: SOURCE_LABELS[key], status: 'not-found', count: 0, message: '页面未声明 Manifest' };
    }
    if (key === 'google' && !googleAttempted) {
      return { key, label: SOURCE_LABELS[key], status: 'skipped', count: 0, message: '已找到网站自有图标，无需兜底' };
    }
    return {
      key,
      label: SOURCE_LABELS[key],
      status: count > 0 ? 'found' : 'not-found',
      count,
      ...(count === 0 ? { message: '未找到可用图标' } : {}),
    };
  });
}

async function extractUncached(inputUrl: string): Promise<IconResult> {
  const started = Date.now();
  const normalized = normalizeWebsiteUrl(inputUrl);
  const page = await secureGet(normalized, { maxBytes: HTML_LIMIT, timeoutMs: 10_000 });
  if (page.status < 200 || page.status >= 400) {
    throw new AppError('HTTP_ERROR', `目标网站返回 HTTP ${page.status}。`, 502);
  }
  const finalUrl = new URL(page.url);
  const contentType = page.headers['content-type'] ?? '';
  if (!contentType.includes('html') && !page.body.toString('utf8', 0, 512).toLowerCase().includes('<html')) {
    throw new AppError('NOT_HTML', '目标地址没有返回可分析的网页。', 422);
  }

  const html = page.body.toString('utf8');
  const parsed = collectHtmlCandidates(html, finalUrl.href);
  const manifestGroups = await mapWithConcurrency(parsed.manifestUrls.slice(0, 3), 3, collectManifestCandidates);
  const manifestCandidates = manifestGroups.flat();
  const discovered: RawCandidate[] = DEFAULT_PATHS.map((path) => ({
    url: new URL(path, finalUrl.origin).href,
    source: 'discovered' as const,
  }));

  const rawCandidates = [...parsed.candidates, ...manifestCandidates, ...discovered];
  const rawDeduped = new Map<string, RawCandidate>();
  for (const candidate of rawCandidates) {
    const existing = rawDeduped.get(candidate.url);
    if (!existing) {
      rawDeduped.set(candidate.url, { ...candidate, sources: [candidate.source] });
      continue;
    }
    existing.sources ??= [existing.source];
    if (!existing.sources.includes(candidate.source)) existing.sources.push(candidate.source);
    if (SOURCE_WEIGHT[candidate.source] > SOURCE_WEIGHT[existing.source]) existing.source = candidate.source;
    existing.declaredSizes ??= candidate.declaredSizes;
  }

  const probed = await mapWithConcurrency([...rawDeduped.values()].slice(0, 36), 5, probeCandidate);
  let icons = mergeCandidates(probed);
  let googleAttempted = false;
  if (icons.length === 0) {
    googleAttempted = true;
    const googleUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(finalUrl.hostname)}&sz=256`;
    const fallback = await probeCandidate({ url: googleUrl, source: 'google', declaredSizes: '256x256' });
    if (fallback) icons = [fallback];
  }
  if (icons.length === 0) {
    throw new AppError('NO_ICON', '没有找到可用的网站图标。', 404);
  }

  icons.sort((a, b) => score(b) - score(a));
  const best = icons[0];
  if (!best) throw new AppError('NO_ICON', '没有找到可用的网站图标。', 404);

  return {
    success: true,
    site: {
      inputUrl: normalized.href,
      url: finalUrl.href,
      domain: finalUrl.hostname.replace(/^www\./u, ''),
      title: parsed.title,
      themeColor: parsed.themeColor,
    },
    best,
    icons,
    checks: buildChecks(icons, parsed.manifestUrls.length > 0, googleAttempted),
    resources: parsed.resources,
    meta: { cached: false, durationMs: Date.now() - started },
  };
}

export async function extractWebsiteIcon(inputUrl: string): Promise<IconResult> {
  const cacheKey = normalizeWebsiteUrl(inputUrl).href;
  const cached = cache.get(cacheKey);
  if (cached) {
    return { ...cached, meta: { ...cached.meta, cached: true, durationMs: 0 } };
  }

  const pending = inFlight.get(cacheKey);
  if (pending) return pending;
  const promise = extractUncached(inputUrl)
    .then((result) => {
      cache.set(cacheKey, result);
      const finalKey = result.site.url;
      if (finalKey !== cacheKey) cache.set(finalKey, result);
      return result;
    })
    .finally(() => inFlight.delete(cacheKey));
  inFlight.set(cacheKey, promise);
  return promise;
}

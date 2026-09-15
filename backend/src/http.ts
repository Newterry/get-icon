import type { LookupFunction } from 'node:net';
import { Agent, fetch } from 'undici';
import { Semaphore } from './concurrency.js';
import { AppError } from './errors.js';
import { normalizeWebsiteUrl, resolvePublicAddress } from './security.js';

const DEFAULT_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'accept-encoding': 'gzip, deflate, br',
} as const;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const outboundRequests = new Semaphore(positiveInteger(process.env.MAX_OUTBOUND_REQUESTS, 16));

export interface BufferedResponse {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > maxBytes) {
    await response.body?.cancel();
    throw new AppError('RESPONSE_TOO_LARGE', '目标资源超过允许的大小。', 413);
  }
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new AppError('RESPONSE_TOO_LARGE', '目标资源超过允许的大小。', 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

function mapNetworkError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const record = error as { name?: string; code?: string; cause?: { code?: string } };
  const code = record.cause?.code ?? record.code ?? '';
  if (record.name === 'AbortError' || code.includes('TIMEOUT')) {
    return new AppError('TIMEOUT', '连接目标网站超时，请稍后重试。', 504);
  }
  if (/CERT|SSL|TLS/u.test(code)) {
    return new AppError('SSL_ERROR', '目标网站的 SSL 证书或安全连接异常。', 502);
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return new AppError('DNS_ERROR', '无法解析该网站的域名。', 502);
  }
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET') {
    return new AppError('CONNECTION_ERROR', '目标网站拒绝连接或提前断开。', 502);
  }
  return new AppError('FETCH_ERROR', '无法连接目标网站。', 502);
}

export async function secureGet(
  input: string | URL,
  options: { maxBytes: number; timeoutMs?: number; accept?: string; maxRedirects?: number },
): Promise<BufferedResponse> {
  return outboundRequests.run(async () => {
    let current = input instanceof URL ? new URL(input) : normalizeWebsiteUrl(input);
    const timeoutMs = options.timeoutMs ?? 10_000;
    const maxRedirects = options.maxRedirects ?? 5;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
        const pinned = await resolvePublicAddress(current.hostname);
        const guardedLookup: LookupFunction = (_hostname, _lookupOptions, callback) => {
          if ('all' in _lookupOptions && _lookupOptions.all) {
            const callbackAll = callback as unknown as (
              error: NodeJS.ErrnoException | null,
              addresses: Array<{ address: string; family: number }>,
            ) => void;
            callbackAll(null, [pinned]);
            return;
          }
          callback(null, pinned.address, pinned.family);
        };
        const dispatcher = new Agent({
          connect: { lookup: guardedLookup, timeout: Math.min(timeoutMs, 7_000) },
          headersTimeout: timeoutMs,
          bodyTimeout: timeoutMs,
        });

        try {
          const response = await fetch(current, {
            dispatcher,
            redirect: 'manual',
            signal: controller.signal,
            headers: {
              ...DEFAULT_HEADERS,
              ...(options.accept ? { accept: options.accept } : {}),
            },
          });

          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            await response.body?.cancel();
            if (!location) throw new AppError('HTTP_ERROR', `目标网站返回了无效重定向（HTTP ${response.status}）。`, 502);
            if (redirects === maxRedirects) throw new AppError('TOO_MANY_REDIRECTS', '目标网站重定向次数过多。', 502);
            const next = new URL(location, current);
            if (next.protocol !== 'http:' && next.protocol !== 'https:') {
              throw new AppError('UNSUPPORTED_PROTOCOL', '目标网站重定向到了不安全的协议。', 403);
            }
            current = next;
            continue;
          }

          const body = await readLimitedBody(response as unknown as Response, options.maxBytes);
          return {
            url: response.url || current.href,
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            body,
          };
        } finally {
          await dispatcher.close();
        }
      }
      throw new AppError('TOO_MANY_REDIRECTS', '目标网站重定向次数过多。', 502);
    } catch (error) {
      throw mapNetworkError(error);
    } finally {
      clearTimeout(timeout);
    }
  });
}

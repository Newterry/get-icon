import type { BatchResponse, FailedResult, IconResult } from './types';

export type OutputFormat = 'original' | 'png' | 'webp' | 'jpeg' | 'avif';
export type OutputSize = 'original' | 128 | 256 | 512;

export class ApiError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

async function parseResponse<T extends object>(response: Response): Promise<T> {
  const data = await response.json() as T | FailedResult;
  if (!response.ok || ('success' in data && data.success === false)) {
    const failed = data as FailedResult;
    throw new ApiError(failed.error?.code ?? 'REQUEST_FAILED', failed.error?.message ?? '请求失败，请稍后重试。');
  }
  return data as T;
}

export async function getIcon(url: string, signal?: AbortSignal): Promise<IconResult> {
  const response = await fetch(`/api/icon?url=${encodeURIComponent(url)}`, { signal });
  return parseResponse<IconResult>(response);
}

export async function getIcons(urls: string[], signal?: AbortSignal): Promise<BatchResponse> {
  const response = await fetch('/api/icons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls }),
    signal,
  });
  return parseResponse<BatchResponse>(response);
}

function outputParameters(url: string, format: OutputFormat, size: OutputSize): URLSearchParams {
  const parameters = new URLSearchParams({ url });
  if (format !== 'original') parameters.set('format', format);
  if (size !== 'original') parameters.set('size', String(size));
  return parameters;
}

export function proxyUrl(url: string, format: OutputFormat = 'original', size: OutputSize = 'original'): string {
  return `/api/proxy-icon?${outputParameters(url, format, size).toString()}`;
}

export function downloadUrl(
  url: string,
  domain: string,
  format: OutputFormat = 'original',
  size: OutputSize = 'original',
): string {
  const parameters = outputParameters(url, format, size);
  parameters.set('domain', domain);
  return `/api/download?${parameters.toString()}`;
}

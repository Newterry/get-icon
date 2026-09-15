import { useEffect } from 'react';
import type { IconResult } from './types';

interface ModelContext {
  registerTool(tool: {
    name: string;
    title: string;
    description: string;
    inputSchema: object;
    annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
    execute: (input: unknown) => Promise<unknown>;
  }, options?: { signal?: AbortSignal }): void | Promise<void>;
}

declare global {
  interface Document {
    readonly modelContext?: ModelContext;
  }
}

export function useWebsiteIconTool(run: (url: string) => Promise<IconResult>): void {
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'get_website_icon',
      title: '获取网站图标',
      description: 'Analyze a public website and return its highest quality favicon or app icon while updating the visible page.',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string', description: 'Website domain or HTTP/HTTPS URL' } },
        required: ['url'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute(input) {
        if (!input || typeof input !== 'object' || typeof (input as { url?: unknown }).url !== 'string') {
          throw new Error('url must be a non-empty string');
        }
        const result = await run((input as { url: string }).url);
        return {
          domain: result.site.domain,
          websiteUrl: result.site.url,
          best: result.best,
          alternatives: result.icons.slice(1),
        };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [run]);
}

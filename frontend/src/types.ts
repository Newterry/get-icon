export type IconSource = 'apple-touch-icon' | 'manifest' | 'favicon' | 'discovered' | 'google';
export type CheckStatus = 'found' | 'not-found' | 'skipped' | 'error';

export interface IconCandidate {
  url: string;
  source: IconSource;
  sources: IconSource[];
  width: number | null;
  height: number | null;
  type: string;
  format: string;
  vector: boolean;
  declaredSizes?: string;
}

export interface SourceCheck {
  key: IconSource;
  label: string;
  status: CheckStatus;
  count: number;
  message?: string;
}

export interface IconResult {
  success: true;
  site: {
    inputUrl: string;
    url: string;
    domain: string;
    title: string | null;
    themeColor: string | null;
  };
  best: IconCandidate;
  icons: IconCandidate[];
  checks: SourceCheck[];
  resources: Array<{ type: 'open-graph-image'; label: string; url: string }>;
  meta: { cached: boolean; durationMs: number };
}

export interface FailedResult {
  success: false;
  error: { code: string; message: string };
}

export type BatchItem = (IconResult & { input: string }) | (FailedResult & { input: string });

export interface BatchResponse {
  success: true;
  results: BatchItem[];
}

export type IconSource =
  | 'apple-touch-icon'
  | 'manifest'
  | 'favicon'
  | 'discovered'
  | 'google';

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

export interface WebsiteResource {
  type: 'open-graph-image';
  label: string;
  url: string;
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
  resources: WebsiteResource[];
  meta: {
    cached: boolean;
    durationMs: number;
  };
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface RawCandidate {
  url: string;
  source: IconSource;
  sources?: IconSource[];
  declaredSizes?: string;
}

import { environment } from '../../../environments/environment';

export function apiEndpoint(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }

  const base = environment.apiUrl.replace(/\/+$/, '');
  const normalizedEndpoint = normalizeEndpoint(endpoint);

  return normalizedEndpoint ? `${base}${normalizedEndpoint}` : base;
}

function normalizeEndpoint(endpoint: string): string {
  const raw = endpoint.trim();
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;

  let path = withLeadingSlash;

  // Strip /v1 or /api/v1 prefix because environment.apiUrl already ends with /v1
  if (path === '/api/v1' || path.startsWith('/api/v1/')) {
    path = path.slice('/api/v1'.length) || '/';
  } else if (path === '/v1' || path.startsWith('/v1/')) {
    path = path.slice('/v1'.length) || '/';
  }

  if (!path || path === '/') {
    return '';
  }

  return path.startsWith('/') ? path : `/${path}`;
}
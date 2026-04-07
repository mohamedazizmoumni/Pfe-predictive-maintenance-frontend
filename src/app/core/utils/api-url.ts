/**
 * Returns base API URL
 * In development: uses relative path /api (proxied by Angular dev server to localhost:8080)
 * In production: uses relative path /api (proxied by your web server)
 */
export function apiUrl(): string {
  // Always use relative path - the proxy will handle forwarding to the backend
  return '/api';
}

/**
 * Full endpoint URL
 */
export function apiEndpoint(endpoint: string): string {
  const base = apiUrl();
  return `${base}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
}
/**
 * Returns base API URL
 */
export function apiUrl(): string {
  return typeof window !== 'undefined' ? '/api' : 'http://localhost:8080/api';
}

/**
 * Full endpoint URL
 */
export function apiEndpoint(endpoint: string): string {
  const base = apiUrl();
  return `${base}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
}
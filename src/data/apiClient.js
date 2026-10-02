const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = configuredBaseUrl ? configuredBaseUrl.replace(/\/+$/, '') : '';
export const isApiConfigured = Boolean(API_BASE_URL);

export async function apiRequest(path, options = {}) {
  if (!API_BASE_URL) throw new Error('Set VITE_API_BASE_URL to connect the blog API.');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof result === 'object' && result ? result.message || result.error : result;
    const error = new Error(message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result;
}

export function requestJson(method, body) {
  return { method, body: JSON.stringify(body) };
}
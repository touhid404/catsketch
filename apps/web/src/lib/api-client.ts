const configured = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
export const API_URL = configured ? `${configured}/api` : '/api';
export const SOCKET_URL = configured || window.location.origin;
export async function request<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Could not reach your space. Try again.');
  return data as T;
}

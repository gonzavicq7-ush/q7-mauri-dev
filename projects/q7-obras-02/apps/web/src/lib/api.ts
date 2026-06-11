const BASE = '/api/v1';

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.mensaje || `Error ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, data?: any) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: (path: string, data?: any) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
};

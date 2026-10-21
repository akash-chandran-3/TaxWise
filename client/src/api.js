// One place for every call to the backend. Adds the JWT and turns
// error responses into thrown Errors carrying the server's message.
export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204 No Content (used by DELETE) has no body to parse.
  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    const error = new Error(data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}

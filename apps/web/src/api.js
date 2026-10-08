export const API_URL = '';

export async function api(path, { method = 'GET', body, workspaceId, signal } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(workspaceId ? { 'X-Workspace-Id': workspaceId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || 'Something went wrong. Please try again.');
  return payload;
}

export async function apiUpload(path, file, workspaceId) {
  const data = new FormData();
  data.append('file', file);
  const response = await fetch(`${API_URL}${path}`, { method: 'POST', credentials: 'include', headers: workspaceId ? { 'X-Workspace-Id': workspaceId } : {}, body: data });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || 'The file could not be uploaded.');
  return payload;
}

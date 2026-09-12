export async function api<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Erro ${res.status}`)
  }
  return data as T
}

export function apiPost<T = unknown>(url: string, body?: unknown): Promise<T> {
  return api<T>(url, { method: 'POST', body: JSON.stringify(body ?? {}) })
}

export function apiPatch<T = unknown>(url: string, body?: unknown): Promise<T> {
  return api<T>(url, { method: 'PATCH', body: JSON.stringify(body ?? {}) })
}

export function apiDelete<T = unknown>(url: string): Promise<T> {
  return api<T>(url, { method: 'DELETE' })
}

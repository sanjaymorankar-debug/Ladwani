'use client'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message)
  }
}

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
  if (typeof window !== 'undefined') {
    if (token) window.localStorage.setItem('accessToken', token)
    else window.localStorage.removeItem('accessToken')
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken
  if (typeof window !== 'undefined') {
    accessToken = window.localStorage.getItem('accessToken')
  }
  return accessToken
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const token = getAccessToken()
  const res = await fetch(`/api/v1${path}`, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && retry && path !== '/auth/refresh') {
    const refreshed = await tryRefresh()
    if (refreshed) return request<T>(method, path, body, false)
  }

  const text = await res.text()
  const json = text ? JSON.parse(text) : null

  if (!res.ok) {
    throw new ApiError(json?.message ?? 'Request failed', res.status, json)
  }
  return json?.data as T
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
    if (!res.ok) return false
    const json = await res.json()
    setAccessToken(json?.data?.accessToken ?? null)
    return true
  } catch {
    return false
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

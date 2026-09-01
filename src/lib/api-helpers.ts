import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export interface AuthUser {
  userId: string
  email?: string
  mobile?: string
  roles: string[]
}

export function getAuthUser(req: NextRequest): AuthUser | null {
  const token = req.cookies.get('access_token')?.value
    ?? req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null
  return {
    userId: String(payload.userId ?? ''),
    email: payload.email ? String(payload.email) : undefined,
    mobile: payload.mobile ? String(payload.mobile) : undefined,
    roles: Array.isArray(payload.roles) ? payload.roles.map(String) : [],
  }
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function notFound(resource = 'Resource') {
  return NextResponse.json({ error: `${resource} not found` }, { status: 404 })
}

// Legacy helpers used by existing API routes
export const requireAuth = getAuthUser  // alias

export function requireRole(user: AuthUser | null, ...roles: string[]): boolean {
  if (!user) return false
  return roles.some((r) => user.roles.includes(r))
}

export function successResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function errorResponse(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

export function auditLog(data: Record<string, unknown>) {
  // Async fire-and-forget audit log helper
  // In production this would call prisma.auditLog.create
  console.log('[AUDIT]', JSON.stringify(data))
}

export function paginateQuery(req: NextRequest) {
  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20')))
  return { skip: (page - 1) * limit, take: limit, page, limit }
}

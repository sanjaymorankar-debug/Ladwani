import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, Download } from 'lucide-react'
import { getViewerScope } from '@/lib/scope'
import { queryDirectory } from '@/lib/directory'

/**
 * F33 — scoped members directory for Admin and the National / State /
 * District teams. Scope is applied in the database query (src/lib/directory.ts),
 * so the page can only ever render rows the viewer is entitled to.
 */
export default async function TeamDirectoryPage({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const session = await getServerSession(authOptions)
  const scope = await getViewerScope(session?.user?.id as string | undefined)
  if (scope.level === 'NONE') redirect('/dashboard')

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const result = await queryDirectory(scope, { q: searchParams.q, page })
  if (!result.ok) redirect('/dashboard')

  const pages = Math.max(1, Math.ceil(result.total / result.pageSize))
  const qs = (p: number) => `?${new URLSearchParams({ ...(searchParams.q ? { q: searchParams.q } : {}), page: String(p) })}`
  const scopeLabel = scope.level === 'ALL'
    ? (scope.isAdmin ? 'All members' : 'All members (view only)')
    : 'Members in your district / state'

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-display flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> Team Directory
          </h1>
          <p className="text-gray-500 text-sm">{scopeLabel} · {result.total} found</p>
        </div>
        {scope.canExport && (
          <a href={`/api/directory/export${searchParams.q ? `?q=${encodeURIComponent(searchParams.q)}` : ''}`}
            className="btn-secondary text-sm flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Export CSV
          </a>
        )}
      </div>

      <div className="card">
        <form className="flex gap-3 mb-4">
          <input type="search" name="q" defaultValue={searchParams.q ?? ''} placeholder="Search by name or Person ID..." className="form-input flex-1" />
          <button type="submit" className="btn-primary text-sm">Search</button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-100">
                <th className="pb-3 pr-4 font-semibold text-gray-700">Person</th>
                <th className="pb-3 pr-4 font-semibold text-gray-700">Gender / Age</th>
                <th className="pb-3 pr-4 font-semibold text-gray-700">Home area</th>
                <th className="pb-3 pr-4 font-semibold text-gray-700">Status</th>
                {scope.canSeeApprovalStatus && <th className="pb-3 pr-4 font-semibold text-gray-700">Pending reviews</th>}
                {scope.canSeeContact && <th className="pb-3 font-semibold text-gray-700">Contact</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {result.rows.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-gray-500">No members in your scope match.</td></tr>
              )}
              {result.rows.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50/50">
                  <td className="py-3 pr-4">
                    <Link href={`/members/${m.id}`} className="font-medium text-gray-900 hover:text-saffron-700">{m.name}</Link>
                    <div className="text-xs text-gray-400">{m.memberNumber}</div>
                  </td>
                  <td className="py-3 pr-4 text-gray-600">{m.gender.toLowerCase()}{m.age !== null ? ` · ${m.age}` : ''}</td>
                  <td className="py-3 pr-4 text-gray-600">{m.homeArea ?? '—'}</td>
                  <td className="py-3 pr-4 text-xs">
                    <div className={m.memberStatus === 'DECEASED' ? 'text-gray-500' : 'text-gray-700'}>{m.memberStatus === 'DECEASED' ? 'Late' : m.memberStatus}</div>
                    <div className="text-gray-400">Account: {m.accountStatus === 'NO_LOGIN' ? 'no login' : m.accountStatus}</div>
                  </td>
                  {scope.canSeeApprovalStatus && <td className="py-3 pr-4 text-gray-600">{m.pendingReviews ?? '—'}</td>}
                  {scope.canSeeContact && (
                    <td className="py-3 text-gray-600 text-xs"><div>{m.email ?? '—'}</div><div>{m.mobile ?? ''}</div></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex justify-between items-center pt-4 text-sm">
            {page > 1 ? <Link href={qs(page - 1)} className="text-saffron-600">← Previous</Link> : <span />}
            <span className="text-gray-500">Page {page} of {pages}</span>
            {page < pages ? <Link href={qs(page + 1)} className="text-saffron-600">Next →</Link> : <span />}
          </div>
        )}
      </div>
    </div>
  )
}

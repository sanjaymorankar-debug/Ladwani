'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft, CheckCircle2, Flag, GraduationCap, ShieldCheck, Users } from 'lucide-react'
import { timeAgo } from '@/lib/utils'

const TABS = [
  { kind: 'POST', label: 'Posts' },
  { kind: 'QUESTION', label: 'Problems / help' },
  { kind: 'KNOWLEDGE', label: 'Knowledge' },
  { kind: 'EVENT', label: 'Events' },
  { kind: 'POLL', label: 'Polls' },
  { kind: 'MEMBERS', label: 'Members' },
] as const

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.message ?? 'Something went wrong')
  return json
}

export default function GroupView({ groupId }: { groupId: string }) {
  const [info, setInfo] = useState<any>(null)
  const [tab, setTab] = useState<(typeof TABS)[number]['kind']>('POST')
  const [posts, setPosts] = useState<any[]>([])
  const [members, setMembers] = useState<{ members: any[]; mentors: any[] } | null>(null)

  const loadInfo = () => fetch(`/api/interest-groups/${groupId}`).then((r) => r.json()).then(setInfo)
  const loadTab = async () => {
    if (!info?.viewer?.isMember && !info?.viewer?.isStaff) return
    if (tab === 'MEMBERS') setMembers(await fetch(`/api/interest-groups/${groupId}/members`).then((r) => r.json()))
    else setPosts((await fetch(`/api/interest-groups/${groupId}/posts?kind=${tab}`).then((r) => r.json())).posts ?? [])
  }
  useEffect(() => { loadInfo() }, [groupId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadTab() }, [tab, info?.viewer?.isMember]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!info) return <div className="card text-sm text-gray-500">Loading…</div>
  if (!info.group) return <div className="card text-sm">Group not found.</div>
  const { group, viewer, moderation } = info
  const act = async (fn: () => Promise<any>) => {
    try {
      const r = await fn()
      if (r?.message) toast.success(r.message)
      await Promise.all([loadInfo(), loadTab()])
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link href="/interest-groups" className="text-sm text-gray-500 flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Interest groups</Link>
      <div className="card space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 font-display">{group.name}</h1>
            <p className="text-sm text-gray-500">{group.memberCount} member{group.memberCount === 1 ? '' : 's'}{group.parent ? <> · part of <Link className="underline" href={`/interest-groups/${group.parent.id}`}>{group.parent.name}</Link></> : null}</p>
            {group.description && <p className="text-sm text-gray-700 mt-1">{group.description}</p>}
          </div>
          {viewer.isMember
            ? <button className="btn-ghost text-sm text-red-600" onClick={() => confirm('Leave this group? You will not be added back automatically.') && act(() => send(`/api/interest-groups/${groupId}/membership`, 'DELETE'))}>Leave</button>
            : <button className="btn-primary text-sm" onClick={() => act(() => send(`/api/interest-groups/${groupId}/membership`, 'POST'))}>Join</button>}
        </div>
        {group.subGroups.length > 0 && (
          <p className="text-xs text-gray-500">District groups: {group.subGroups.map((s: any, i: number) => <span key={s.id}>{i ? ', ' : ''}<Link className="underline" href={`/interest-groups/${s.id}`}>{s.district}</Link></span>)}</p>
        )}
        {moderation.moderatorCount === 0 && (viewer.canAssignModerator || viewer.isStaff) && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm flex flex-wrap items-center justify-between gap-2">
            <span>This group needs a moderator.{moderation.suggestion ? ` Suggested: ${moderation.suggestion.name} (${moderation.suggestion.expert ? 'expert / mentor, ' : ''}${moderation.suggestion.posts} posts)` : ''}</span>
            {moderation.suggestion && viewer.canAssignModerator && (
              <button className="btn-secondary text-sm" onClick={() => act(() => send(`/api/interest-groups/${groupId}/moderators`, 'POST', { memberId: moderation.suggestion.memberId }))}>Make moderator</button>
            )}
          </div>
        )}
      </div>

      {viewer.mustAcceptRules && (
        <div className="card border-saffron-200 space-y-3" role="dialog" aria-label="Group rules">
          <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-saffron-600" /> Group rules</h2>
          <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">{(group.rules ?? '').split('\n').map((r: string) => <li key={r}>{r}</li>)}</ul>
          <button className="btn-primary text-sm" onClick={() => act(() => send(`/api/interest-groups/${groupId}/membership`, 'PATCH', { acceptRules: true }))}>I accept the rules</button>
        </div>
      )}

      {(viewer.isMember || viewer.isStaff) && !viewer.mustAcceptRules && (
        <>
          <div className="flex gap-1.5 overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.kind} onClick={() => setTab(t.kind)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm ${tab === t.kind ? 'bg-saffron-600 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>{t.label}</button>
            ))}
          </div>
          {tab === 'MEMBERS' ? (
            <MembersList data={members} canRemove={viewer.isModerator || viewer.isStaff}
              onRemove={(m) => confirm(`Remove ${m.name} from this group?`) && act(() => send(`/api/interest-groups/${groupId}/members/${m.memberId}`, 'DELETE', { reason: 'Removed by moderator' }))} />
          ) : (
            <>
              {(tab !== 'KNOWLEDGE' || viewer.isModerator || viewer.isStaff) && (
                <Composer kind={tab} onPost={(body) => act(() => send(`/api/interest-groups/${groupId}/posts`, 'POST', body))} />
              )}
              {posts.length === 0 && <p className="text-sm text-gray-500">Nothing here yet.</p>}
              {posts.map((p) => <PostItem key={p.id} post={p} canModerate={viewer.isModerator || viewer.isStaff} act={act} />)}
            </>
          )}
        </>
      )}
      {!viewer.isMember && !viewer.isStaff && (
        <p className="text-sm text-gray-500">Join the group to see its posts and members.</p>
      )}
    </div>
  )
}

function Composer({ kind, onPost }: { kind: string; onPost: (b: any) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [options, setOptions] = useState(['', ''])
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onPost({ kind, title, content, linkUrl: linkUrl || undefined, eventDate: eventDate || undefined, pollOptions: kind === 'POLL' ? options : undefined })
    setTitle(''); setContent(''); setLinkUrl(''); setEventDate(''); setOptions(['', ''])
  }
  const placeholder = kind === 'QUESTION' ? 'Describe your problem — others can answer' : kind === 'KNOWLEDGE' ? 'Guide or summary' : 'Share something with the group'
  return (
    <form onSubmit={submit} className="card space-y-2">
      {kind !== 'POST' && <input className="form-input" placeholder={kind === 'POLL' ? 'Question' : 'Title'} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />}
      {kind !== 'POLL' && <textarea className="form-input" rows={2} placeholder={placeholder} value={content} onChange={(e) => setContent(e.target.value)} aria-label="Text" />}
      {kind === 'KNOWLEDGE' && <input className="form-input" placeholder="Useful link (https://…)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} aria-label="Link" />}
      {kind === 'EVENT' && <input type="datetime-local" className="form-input" value={eventDate} onChange={(e) => setEventDate(e.target.value)} aria-label="Date and time" />}
      {kind === 'POLL' && (
        <div className="space-y-1.5">
          {options.map((o, i) => (
            <input key={i} className="form-input" placeholder={`Option ${i + 1}`} value={o} aria-label={`Option ${i + 1}`}
              onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
          {options.length < 6 && <button type="button" className="text-sm text-saffron-700" onClick={() => setOptions([...options, ''])}>+ Add option</button>}
        </div>
      )}
      <button className="btn-primary text-sm">{kind === 'QUESTION' ? 'Ask for help' : 'Post'}</button>
    </form>
  )
}

function PostItem({ post, canModerate, act }: { post: any; canModerate: boolean; act: (fn: () => Promise<any>) => Promise<void> }) {
  const [comments, setComments] = useState<any[] | null>(null)
  const [reply, setReply] = useState('')
  const loadComments = async () => setComments((await fetch(`/api/posts/${post.id}/comments`).then((r) => r.json())).comments ?? [])
  const totalVotes = post.poll?.options.reduce((s: number, o: any) => s + o.votes, 0) ?? 0
  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{post.author?.name ?? 'Member'} · {timeAgo(post.createdAt)}</span>
        <span className="flex gap-2">
          {post.status !== 'PUBLISHED' && <span className="badge-orange">{post.status === 'FLAGGED' ? 'Reported' : 'Awaiting moderator'}</span>}
          {post.kind === 'QUESTION' && (post.isSolved ? <span className="badge-green flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Solved</span> : <span className="badge-blue">Needs help</span>)}
        </span>
      </div>
      {post.title && <p className="font-semibold text-gray-900">{post.title}</p>}
      {post.content && <p className="text-sm text-gray-700 whitespace-pre-line">{post.content}</p>}
      {post.linkUrl && <a href={post.linkUrl} target="_blank" rel="noreferrer nofollow" className="text-sm text-saffron-700 underline break-all">{post.linkUrl}</a>}
      {post.photoIds?.map((id: string) => <img key={id} src={`/api/photos/${id}/file`} alt="" className="rounded-lg max-h-72" />)}
      {post.eventDate && <p className="text-sm">📅 {new Date(post.eventDate).toLocaleString()}</p>}
      {post.rsvp && (
        <div className="flex flex-wrap gap-2 text-sm">
          {['GOING', 'MAYBE', 'NOT_GOING'].map((r) => (
            <button key={r} className={`px-3 py-1 rounded-full border ${post.rsvp.mine === r ? 'bg-saffron-50 border-saffron-500' : 'border-gray-200'}`}
              onClick={() => act(() => send(`/api/posts/${post.id}/rsvp`, 'POST', { response: r }))}>
              {r === 'GOING' ? `Going (${post.rsvp.going})` : r === 'MAYBE' ? `Maybe (${post.rsvp.maybe})` : 'Not going'}
            </button>
          ))}
        </div>
      )}
      {post.poll && (
        <div className="space-y-1.5">
          {post.poll.options.map((o: any) => (
            <button key={o.id} className={`w-full text-left text-sm rounded-lg border px-3 py-1.5 relative overflow-hidden ${post.poll.myVote === o.id ? 'border-saffron-500' : 'border-gray-200'}`}
              onClick={() => act(() => send(`/api/posts/${post.id}/vote`, 'POST', { optionId: o.id }))}>
              <span className="absolute inset-y-0 left-0 bg-saffron-50" style={{ width: `${totalVotes ? (o.votes / totalVotes) * 100 : 0}%` }} />
              <span className="relative">{o.label} — {o.votes}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 pt-1">
        <button onClick={loadComments}>{post.kind === 'QUESTION' ? 'Answers' : 'Comments'} ({post.commentCount})</button>
        <button className="flex items-center gap-1" onClick={() => {
          const reason = prompt('What is wrong with this post?')
          if (reason) act(() => send(`/api/posts/${post.id}/report`, 'POST', { reason }))
        }}><Flag className="w-3 h-3" /> Report</button>
        {canModerate && post.status !== 'PUBLISHED' && <button className="text-green-700" onClick={() => act(() => send(`/api/posts/${post.id}/moderate`, 'PATCH', { action: 'approve' }))}>Approve</button>}
        {canModerate && <button className="text-red-600" onClick={() => act(() => send(`/api/posts/${post.id}/moderate`, 'PATCH', { action: 'hide' }))}>Remove</button>}
      </div>
      {comments && (
        <div className="space-y-2 border-t border-gray-100 pt-2">
          {comments.map((c) => (
            <div key={c.id} className={`text-sm rounded-lg p-2 ${post.solvedCommentId === c.id ? 'bg-green-50' : 'bg-gray-50'}`}>
              <span className="font-medium">{c.author?.member ? `${c.author.member.firstName} ${c.author.member.lastName ?? ''}` : 'Member'}: </span>{c.content}
              {post.kind === 'QUESTION' && post.isMine && !post.isSolved && (
                <button className="ml-2 text-xs text-green-700" onClick={() => act(() => send(`/api/posts/${post.id}/solve`, 'POST', { commentId: c.id }))}>Mark as solution</button>
              )}
            </div>
          ))}
          <form className="flex gap-2" onSubmit={async (e) => {
            e.preventDefault()
            if (!reply.trim()) return
            await act(() => send(`/api/posts/${post.id}/comments`, 'POST', { content: reply }))
            setReply('')
            await loadComments()
          }}>
            <input className="form-input text-sm" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={post.kind === 'QUESTION' ? 'Write an answer' : 'Write a comment'} aria-label="Reply" />
            <button className="btn-secondary text-sm">Send</button>
          </form>
        </div>
      )}
    </div>
  )
}

function MembersList({ data, canRemove, onRemove }: { data: { members: any[]; mentors: any[] } | null; canRemove: boolean; onRemove: (m: any) => void }) {
  if (!data) return <p className="text-sm text-gray-500">Loading…</p>
  return (
    <div className="space-y-4">
      {data.mentors.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><GraduationCap className="w-4 h-4 text-saffron-600" /> Mentors — can teach or guide</h3>
          <div className="flex flex-wrap gap-2">{data.mentors.map((m) => <span key={m.memberId} className="badge bg-amber-50 text-amber-800">{m.name}{m.level ? ` · ${m.level.toLowerCase()}` : ''}</span>)}</div>
        </div>
      )}
      <div className="card divide-y divide-gray-50">
        {data.members.map((m) => (
          <div key={m.memberId} className="flex items-center justify-between py-2 text-sm">
            <div className="flex items-center gap-3">
              {m.profilePhotoId
                ? <img src={`/api/photos/${m.profilePhotoId}/file?variant=thumbnail`} alt="" className="w-8 h-8 rounded-full object-cover" />
                : <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Users className="w-4 h-4 text-gray-400" /></div>}
              <div>
                <p className="font-medium text-gray-900">{m.name} {m.role === 'MODERATOR' && <span className="badge-blue text-xs ml-1">Moderator</span>}</p>
                <p className="text-xs text-gray-500">{[m.city, m.level && m.level.charAt(0) + m.level.slice(1).toLowerCase()].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            {canRemove && m.role !== 'MODERATOR' && <button className="text-xs text-red-600" onClick={() => onRemove(m)}>Remove</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

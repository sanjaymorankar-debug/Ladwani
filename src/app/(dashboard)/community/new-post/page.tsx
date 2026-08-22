'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { ArrowLeft, Loader2, Send } from 'lucide-react'
import toast from 'react-hot-toast'

const schema = z.object({
  postTypeId: z.string().min(1, 'Select a post type'),
  title: z.string().optional(),
  content: z.string().min(10, 'Write at least 10 characters'),
  visibility: z.enum(['LOCAL_AREA', 'CITY', 'STATE', 'COMMUNITY']).default('COMMUNITY'),
  eventDate: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function NewPostPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [postTypes, setPostTypes] = useState<any[]>([])

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { visibility: 'COMMUNITY' },
  })

  const selectedTypeId = watch('postTypeId')
  const selectedType = postTypes.find((pt) => pt.id === selectedTypeId)

  useEffect(() => {
    fetch('/api/post-types').then((r) => r.json()).then((d) => setPostTypes(d?.types ?? []))
  }, [])

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to create post')
      toast.success('Post published!')
      router.push('/community')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/community" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-xl font-bold text-gray-900">Create Post</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="card space-y-4">
          {/* Post type */}
          <div>
            <label className="form-label">Post Type *</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {postTypes.map((pt) => (
                <label key={pt.id} className={`cursor-pointer rounded-xl border-2 p-3 text-center transition-all ${
                  selectedTypeId === pt.id ? 'border-saffron-500 bg-saffron-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input {...register('postTypeId')} type="radio" value={pt.id} className="hidden" />
                  <div className="text-xl mb-1">{pt.icon ?? '📌'}</div>
                  <div className="text-xs font-medium text-gray-700 leading-tight">{pt.label}</div>
                </label>
              ))}
            </div>
            {errors.postTypeId && <p className="form-error">{errors.postTypeId.message}</p>}
          </div>

          {/* Title */}
          <div>
            <label className="form-label">Title (optional)</label>
            <input {...register('title')} className="form-input" placeholder="Brief title for your post..." />
          </div>

          {/* Content */}
          <div>
            <label className="form-label">Content *</label>
            <textarea
              {...register('content')}
              className="form-input min-h-[150px]"
              placeholder="Share your message with the community..."
            />
            {errors.content && <p className="form-error">{errors.content.message}</p>}
          </div>

          {/* Event date */}
          {selectedType?.code === 'EVENT' && (
            <div>
              <label className="form-label">Event Date & Time</label>
              <input {...register('eventDate')} type="datetime-local" className="form-input" />
            </div>
          )}

          {/* Visibility */}
          <div>
            <label className="form-label">Visibility</label>
            <select {...register('visibility')} className="form-input">
              <option value="COMMUNITY">Entire Community</option>
              <option value="STATE">State Level</option>
              <option value="CITY">City Level</option>
              <option value="LOCAL_AREA">Local Area Only</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/community" className="btn-secondary flex-1 py-3 text-center">Cancel</Link>
          <button type="submit" disabled={isLoading}
            className="btn-primary flex-1 py-3 flex items-center justify-center gap-2 disabled:opacity-70">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isLoading ? 'Publishing...' : 'Publish Post'}
          </button>
        </div>
      </form>
    </div>
  )
}

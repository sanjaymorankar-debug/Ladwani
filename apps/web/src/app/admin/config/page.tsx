'use client'

import { useEffect, useState } from 'react'
import { api } from '../../../lib/api-client'
import { errorMessage } from '../../../lib/auth-context'
import { RequireAuth, TopBar, Shell, ErrorBanner, StatusPill } from '../../../components/ui'

const AREA_TYPES = ['COUNTRY', 'STATE', 'DISTRICT', 'CITY', 'AREA', 'GROUP'] as const

interface PostType {
  id: string
  code: string
  label: string
  icon: string | null
  requiresApproval: boolean
  isActive: boolean
}

interface AssetCategory {
  id: string
  code: string
  label: string
  sortOrder: number
  isActive: boolean
}

interface AreaRow {
  id: string
  name: string
  type: string
  parentId: string | null
  isActive: boolean
}

export default function AdminConfigPage() {
  const [postTypes, setPostTypes] = useState<PostType[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [areas, setAreas] = useState<AreaRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [ptCode, setPtCode] = useState('')
  const [ptLabel, setPtLabel] = useState('')
  const [ptRequiresApproval, setPtRequiresApproval] = useState(false)

  const [acCode, setAcCode] = useState('')
  const [acLabel, setAcLabel] = useState('')

  const [areaName, setAreaName] = useState('')
  const [areaType, setAreaType] = useState<(typeof AREA_TYPES)[number]>('AREA')
  const [areaParentId, setAreaParentId] = useState('')

  function load() {
    api.get<PostType[]>('/config/post-types').then(setPostTypes).catch((err) => setError(errorMessage(err)))
    api.get<AssetCategory[]>('/config/asset-categories').then(setCategories).catch((err) => setError(errorMessage(err)))
    api.get<AreaRow[]>('/config/areas').then(setAreas).catch((err) => setError(errorMessage(err)))
  }

  useEffect(load, [])

  async function createPostType(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.post('/config/post-types', { code: ptCode, label: ptLabel, requiresApproval: ptRequiresApproval })
      setNotice(`Post type "${ptLabel}" created.`)
      setPtCode('')
      setPtLabel('')
      setPtRequiresApproval(false)
      load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function togglePostType(pt: PostType) {
    setError(null)
    try {
      await api.patch(`/config/post-types/${pt.id}`, { isActive: !pt.isActive })
      load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function createAssetCategory(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.post('/config/asset-categories', { code: acCode, label: acLabel })
      setNotice(`Asset category "${acLabel}" created.`)
      setAcCode('')
      setAcLabel('')
      load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function toggleAssetCategory(ac: AssetCategory) {
    setError(null)
    try {
      await api.patch(`/config/asset-categories/${ac.id}`, { isActive: !ac.isActive })
      load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function createArea(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.post('/config/areas', { name: areaName, type: areaType, parentId: areaParentId || undefined })
      setNotice(`Area "${areaName}" created.`)
      setAreaName('')
      setAreaParentId('')
      load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function toggleArea(area: AreaRow) {
    setError(null)
    try {
      await api.patch(`/config/areas/${area.id}`, { isActive: !area.isActive })
      load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <RequireAuth>
      <TopBar />
      <Shell>
        <h1>Configuration</h1>
        <ErrorBanner message={error} />
        {notice && <div className="card" style={{ borderColor: 'var(--success)', color: 'var(--success)', marginBottom: 16 }}>{notice}</div>}

        <div className="stack">
          <div className="card stack">
            <h3>Post types</h3>
            {postTypes.map((pt) => (
              <div key={pt.id} className="row" style={{ justifyContent: 'space-between' }}>
                <span>{pt.label} <span className="muted mono">({pt.code})</span>{pt.requiresApproval && ' · needs approval'}</span>
                <div className="row" style={{ alignItems: 'center' }}>
                  <StatusPill status={pt.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  <button className="btn btn-outline" onClick={() => togglePostType(pt)}>
                    {pt.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
            <form onSubmit={createPostType} className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="pt-code">Code</label>
                <input id="pt-code" value={ptCode} onChange={(e) => setPtCode(e.target.value)} placeholder="JOB" required />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="pt-label">Label</label>
                <input id="pt-label" value={ptLabel} onChange={(e) => setPtLabel(e.target.value)} placeholder="Job Posting" required />
              </div>
              <label className="row" style={{ gap: 8 }}>
                <input type="checkbox" checked={ptRequiresApproval} onChange={(e) => setPtRequiresApproval(e.target.checked)} />
                Needs approval
              </label>
              <button className="btn btn-accent" type="submit">Add</button>
            </form>
          </div>

          <div className="card stack">
            <h3>Asset categories</h3>
            {categories.map((ac) => (
              <div key={ac.id} className="row" style={{ justifyContent: 'space-between' }}>
                <span>{ac.label} <span className="muted mono">({ac.code})</span></span>
                <div className="row" style={{ alignItems: 'center' }}>
                  <StatusPill status={ac.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  <button className="btn btn-outline" onClick={() => toggleAssetCategory(ac)}>
                    {ac.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
            <form onSubmit={createAssetCategory} className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="ac-code">Code</label>
                <input id="ac-code" value={acCode} onChange={(e) => setAcCode(e.target.value)} placeholder="FARM_HOUSE" required />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="ac-label">Label</label>
                <input id="ac-label" value={acLabel} onChange={(e) => setAcLabel(e.target.value)} placeholder="Farm House" required />
              </div>
              <button className="btn btn-accent" type="submit">Add</button>
            </form>
          </div>

          <div className="card stack">
            <h3>Areas</h3>
            {areas.map((a) => (
              <div key={a.id} className="row" style={{ justifyContent: 'space-between' }}>
                <span>{a.name} <span className="muted mono">({a.type})</span></span>
                <div className="row" style={{ alignItems: 'center' }}>
                  <StatusPill status={a.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  <button className="btn btn-outline" onClick={() => toggleArea(a)}>
                    {a.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
            <form onSubmit={createArea} className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="area-name">Name</label>
                <input id="area-name" value={areaName} onChange={(e) => setAreaName(e.target.value)} placeholder="Pune" required />
              </div>
              <div className="field">
                <label htmlFor="area-type">Type</label>
                <select id="area-type" value={areaType} onChange={(e) => setAreaType(e.target.value as (typeof AREA_TYPES)[number])}>
                  {AREA_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="area-parent">Parent (optional)</label>
                <select id="area-parent" value={areaParentId} onChange={(e) => setAreaParentId(e.target.value)}>
                  <option value="">None</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-accent" type="submit">Add</button>
            </form>
          </div>
        </div>
      </Shell>
    </RequireAuth>
  )
}

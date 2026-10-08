'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Crosshair, Loader2, MapPin, X } from 'lucide-react'

// Leaflet touches `window`, so the map only ever renders in the browser.
const LocationMap = dynamic(() => import('./LocationMap'), {
  ssr: false,
  loading: () => <div className="h-64 w-full rounded-lg bg-gray-100 animate-pulse" />,
})

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/**
 * Geo-tag for an address: "Use my current location" (browser geolocation)
 * plus a map pin the user can drag or tap to adjust. Entirely optional — if
 * permission is denied or unavailable, the user just carries on with the
 * typed address; nothing here blocks saving.
 */
export default function LocationPicker({
  latitude, longitude, onChange, error,
}: {
  latitude: number | null
  longitude: number | null
  onChange: (lat: number | null, lng: number | null) => void
  error?: string
}) {
  const [showMap, setShowMap] = useState(latitude !== null)
  const [locating, setLocating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const set = (lat: number, lng: number) => onChange(round6(lat), round6(lng))

  const useMyLocation = () => {
    setNotice(null)
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setNotice('Location is not available on this device. Enter the address above, and tap the map to place a pin if you like.')
      setShowMap(true)
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        setShowMap(true)
        set(pos.coords.latitude, pos.coords.longitude)
      },
      (err) => {
        setLocating(false)
        setShowMap(true)
        setNotice(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. You can still enter the address manually, and tap the map to place a pin.'
            : 'Could not get your location. Enter the address manually, and tap the map to place a pin.'
        )
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={useMyLocation} disabled={locating}
          className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-60">
          {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
          {locating ? 'Locating…' : 'Use my current location'}
        </button>
        {!showMap && (
          <button type="button" onClick={() => setShowMap(true)} className="btn-ghost text-sm flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Pin on map
          </button>
        )}
        {latitude !== null && (
          <button type="button" onClick={() => onChange(null, null)} className="btn-ghost text-sm flex items-center gap-1.5 text-gray-600">
            <X className="w-3.5 h-3.5" /> Remove pin
          </button>
        )}
      </div>
      {notice && <p role="status" className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">{notice}</p>}
      {showMap && (
        <>
          <LocationMap latitude={latitude} longitude={longitude} onChange={set} />
          <p className="text-xs text-gray-500">
            {latitude !== null && longitude !== null
              ? <>Pinned at {latitude.toFixed(6)}, {longitude.toFixed(6)} — drag the pin or tap the map to adjust.</>
              : 'Tap the map to drop a pin at your address.'}
          </p>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

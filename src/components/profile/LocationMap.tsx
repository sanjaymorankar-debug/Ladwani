'use client'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import { useEffect, useMemo } from 'react'

// A plain CSS pin, so we don't depend on Leaflet's default marker images
// (which bundlers fail to resolve).
const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#ea580c;border:3px solid #fff;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
})

const INDIA_CENTER: [number, number] = [22.5, 79]

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

/** Re-centres when the pin moves from outside the map (e.g. "use my location"). */
function FollowPin({ position }: { position: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.setView(position, Math.max(map.getZoom(), 15))
  }, [position?.[0], position?.[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function LocationMap({
  latitude, longitude, onChange,
}: {
  latitude: number | null
  longitude: number | null
  onChange: (lat: number, lng: number) => void
}) {
  const position = latitude !== null && longitude !== null ? ([latitude, longitude] as [number, number]) : null
  const eventHandlers = useMemo(() => ({
    dragend: (e: L.LeafletEvent) => {
      const p = (e.target as L.Marker).getLatLng()
      onChange(p.lat, p.lng)
    },
  }), [onChange])

  return (
    <MapContainer
      center={position ?? INDIA_CENTER}
      zoom={position ? 15 : 4}
      scrollWheelZoom={false}
      className="h-64 w-full rounded-lg border border-gray-200 z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickToPlace onPick={onChange} />
      <FollowPin position={position} />
      {position && <Marker position={position} icon={pinIcon} draggable eventHandlers={eventHandlers} />}
    </MapContainer>
  )
}

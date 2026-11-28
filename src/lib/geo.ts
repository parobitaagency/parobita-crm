import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Pt = { lat: number; lng: number }
type Base = Pt & { name: string }

let cached: Base | null = (() => { try { return JSON.parse(localStorage.getItem('pb-base') || 'null') } catch { return null } })()

export function useBase(): Base | null {
  const [b, setB] = useState<Base | null>(cached)
  useEffect(() => {
    supabase.from('app_settings').select('base_name, base_lat, base_lng').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data?.base_lat) { cached = { name: data.base_name, lat: data.base_lat, lng: data.base_lng }; try { localStorage.setItem('pb-base', JSON.stringify(cached)) } catch { /* */ } setB(cached) }
    })
  }, [])
  return b
}

export function km(a: Pt | null | undefined, b: { lat?: number | null; lng?: number | null } | null | undefined) {
  if (!a || !b || b.lat == null || b.lng == null) return null
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

export const fmtKm = (k: number | null) => (k == null ? '' : k < 1 ? `${Math.round(k * 1000)} m` : `${k.toFixed(1).replace('.', ',')} km`)
// Şehir içi kaba süre tahmini (kuş uçuşu × 1,3 yol, ~38 km/sa)
export const fmtMin = (k: number | null) => (k == null ? '' : `~${Math.max(3, Math.round((k * 1.3 / 38) * 60))} dk`)

export function dirUrl(l: { business_name?: string; address?: string | null; lat?: number | null; lng?: number | null } | null | undefined) {
  if (!l) return null
  const dest = l.address ? `${l.business_name}, ${l.address}` : l.lat != null ? `${l.lat},${l.lng}` : l.business_name
  if (!dest) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`
}

export function shortDistrict(d: string | null | undefined) {
  return (d || '').split(/[(/]/)[0].trim()
}

// Koordinatı olmayan yeni leadleri arka planda bul (Photon / OpenStreetMap). Her açılışta en fazla birkaç tane.
let running = false
export async function geocodeMissing(rows: { id: string; address: string | null; district: string | null; lat?: number | null; geo_level?: string | null }[], onDone?: (id: string, p: Pt) => void) {
  if (running) return
  running = true
  try {
    const todo = rows.filter((r) => r.lat == null && !r.geo_level).slice(0, 12)
    for (const r of todo) {
      const qs: string[] = []
      if (r.address) {
        const a = r.address.replace(/\b(No|D|Kat|Daire)\s*:?\s*[\w/.-]+/gi, '').replace(/\d{5}\s*/g, '').replace(/\s{2,}/g, ' ').trim()
        qs.push(/Ankara/i.test(a) ? a : a + ', Ankara')
      }
      if (r.district) qs.push(r.district.split(/[(/]/)[0].trim() + ', Ankara')
      let p: Pt | null = null, level = 'none'
      for (const [i, q] of qs.entries()) {
        try {
          const res = await fetch('https://photon.komoot.io/api/?' + new URLSearchParams({ q, limit: '1', lat: '39.92', lon: '32.85', bbox: '32.4,39.6,33.2,40.15' }))
          const d = await res.json()
          const f = d.features?.[0]
          if (f && f.properties?.state === 'Ankara') { p = { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }; level = i === 0 && r.address ? 'address' : 'district'; break }
        } catch { /* ağ yok */ return }
        await new Promise((ok) => setTimeout(ok, 350))
      }
      await supabase.from('leads').update(p ? { lat: p.lat, lng: p.lng, geo_level: level } : { geo_level: 'none' }).eq('id', r.id)
      if (p && onDone) onDone(r.id, p)
    }
  } finally { running = false }
}

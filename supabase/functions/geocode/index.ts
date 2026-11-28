// Lead adreslerini OpenStreetMap (Photon) ile koordinata çevirir. pg_cron birkaç dakikada bir çağırır.
import { createClient } from 'npm:@supabase/supabase-js@2'

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const FIX: Record<string, string> = { GOP: 'Gaziosmanpaşa', 'Çankaya merkez': 'Kızılay', Tunalı: 'Kavaklıdere', 'Paris Cd.': 'Kavaklıdere', 'Bağlar Cd.': 'Murat Mahallesi' }

async function nominatim(q: string): Promise<[number, number] | null> {
  const { data: c } = await sb.from('geo_cache').select('lat,lng').eq('q', q).maybeSingle()
  if (c) return c.lat == null ? null : [c.lat, c.lng]
  const u = 'https://photon.komoot.io/api/?' + new URLSearchParams({ q, limit: '1', lat: '39.92', lon: '32.85', bbox: '32.4,39.6,33.2,40.15' })
  let p: [number, number] | null = null
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'parobita-crm/1.0' } })
    if (!r.ok) return null
    const d = await r.json()
    const f = d.features?.[0]
    if (f && f.properties?.state === 'Ankara') p = [Number(f.geometry.coordinates[1]), Number(f.geometry.coordinates[0])]
  } catch { return null }
  await sb.from('geo_cache').upsert({ q, lat: p?.[0] ?? null, lng: p?.[1] ?? null })
  await sleep(400)
  return p
}

function cleanAddress(a: string) {
  return a.replace(/\b(No|D|Kat|Daire)\s*:?\s*[\w/.-]+/gi, '').replace(/\d{5}\s*/g, '').replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim()
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('yetkisiz', { status: 401 })
  const started = Date.now()
  const url = new URL(req.url)
  if (url.searchParams.get('debug')) {
    const r = await fetch('https://photon.komoot.io/api/?q=Kavakl%C4%B1dere%20Ankara&limit=1', { headers: { 'User-Agent': 'parobita-crm/1.0' } }).catch((e) => ({ status: 0, text: async () => String(e) }))
    return new Response(String(r.status) + ' ' + (await r.text()).slice(0, 200))
  }
  const { data: rows } = await sb.from('leads').select('id,address,district').or('geo_level.is.null,geo_level.eq.district').order('geo_level', { nullsFirst: true }).order('created_at', { ascending: false }).limit(40)
  let done = 0
  for (const l of rows ?? []) {
    if (Date.now() - started > 100_000) break
    let p: [number, number] | null = null, level = 'none'
    if (l.address) {
      const a = cleanAddress(l.address)
      p = await nominatim(a.includes('Ankara') ? a : a + ', Ankara')
      if (!p) { // sokak bulunamazsa: mahalle + ilçe
        const parts = l.address.split(',').map((x: string) => x.trim())
        const ilce = (l.address.match(/([A-Za-zÇĞİÖŞÜçğıöşü]+)\/Ankara/) || [])[1] || ''
        p = await nominatim(`${parts[0]}, ${ilce}, Ankara`)
      }
      if (p) level = 'address'
    }
    if (!p && l.district) {
      const d = l.district.split(/[(/]/)[0].trim()
      p = await nominatim(`${FIX[d] ?? d.replace(' Mah.', '')}, Ankara`)
      if (p) level = 'district'
    }
    const upd: Record<string, unknown> = { geo_level: p ? level : 'none' }
    if (p) { upd.lat = p[0]; upd.lng = p[1] }
    // district seviyesinde olup adres bulunamadıysa mevcut koordinatı koru
    if (!p) delete upd.lat
    await sb.from('leads').update(upd).eq('id', l.id)
    done++
  }
  return new Response(JSON.stringify({ done }), { headers: { 'Content-Type': 'application/json' } })
})

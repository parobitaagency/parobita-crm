import { createClient } from '@supabase/supabase-js'
import { configureOffline, offlineFetch } from './offline'

// Publishable anahtar tarayıcıda durabilir; erişim satır kurallarıyla (RLS) korunur.
export const supabase = createClient(
  'https://lzxkowlecpiwvbwrjqxs.supabase.co',
  'sb_publishable_-cMxpW6ET4taE0in1oE7iw_sDDVtR4m',
  { global: { fetch: offlineFetch } },
)
configureOffline(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null)

export type LeadStatus = 'yeni' | 'acmadi' | 'sonra_ara' | 'red' | 'toplanti' | 'musteri' | 'wp' | 'uzun_vade' | 'gecersiz'

export interface Profile { id: string; full_name: string; role: 'owner' | 'caller' }

export interface Lead {
  id: string
  assigned_to: string | null
  business_name: string
  niche: string | null
  phone: string | null
  address: string | null
  district: string | null
  maps_url: string | null
  rating: number | null
  review_count: number | null
  status: LeadStatus
  call_back_at: string | null
  list_date: string | null
  sort_order: number | null
  notes: string | null
  updated_at: string
  lat?: number | null
  lng?: number | null
  geo_level?: string | null
  wa_sent_at?: string | null
}

export interface Meeting {
  id: string
  lead_id: string
  created_by: string | null
  attendees: string[]
  scheduled_at: string | null
  duration_min: number
  contact_name: string | null
  status: 'planli' | 'yapildi' | 'iptal' | 'gelmedi'
  result_entered: boolean
  notes: string | null
  leads?: Pick<Lead, 'business_name' | 'phone' | 'address' | 'district' | 'maps_url' | 'lat' | 'lng'>
}

export type Stage = 'toplanti' | 'demo' | 'teklif' | 'dusunuyor' | 'satis' | 'kayip'

export interface Deal {
  id: string
  lead_id: string
  stage: Stage
  package: string | null
  amount: number | null
  lost_reason: string | null
  next_followup_at: string | null
  followup_step: 'ara' | 'cat_kapi'
  closed_at: string | null
  owner_id: string | null
  notes: string | null
  updated_at: string
  leads?: Pick<Lead, 'business_name' | 'phone' | 'district'>
  payments?: { amount: number }[]
}

export const STATUS: Record<LeadStatus, { label: string; icon: string; tone: string }> = {
  yeni: { label: 'Aranmadı', icon: '', tone: 'gray' },
  acmadi: { label: 'Açmadı', icon: '⏸️', tone: 'yellow' },
  sonra_ara: { label: 'Sonra ara', icon: '⚠️', tone: 'orange' },
  red: { label: 'Red', icon: '❌', tone: 'red' },
  toplanti: { label: 'Toplantı', icon: '✅', tone: 'green' },
  musteri: { label: 'Müşteri', icon: '★', tone: 'blue' },
  wp: { label: 'WhatsApp bilgi', icon: '📲', tone: 'blue' },
  uzun_vade: { label: 'Uzun vade', icon: '⏳', tone: 'purple' },
  gecersiz: { label: 'Geçersiz no', icon: '🚫', tone: 'gray' },
}

export const STAGES: { key: Stage; label: string; tone: string }[] = [
  { key: 'toplanti', label: 'Toplantı', tone: 'gray' },
  { key: 'demo', label: 'Demo gösterildi', tone: 'blue' },
  { key: 'teklif', label: 'Teklif verildi', tone: 'purple' },
  { key: 'dusunuyor', label: 'Düşünüyor', tone: 'yellow' },
  { key: 'satis', label: 'Satış', tone: 'green' },
  { key: 'kayip', label: 'Kayıp', tone: 'red' },
]

export const PACKAGES: Record<string, { label: string; price: number }> = {
  baslangic: { label: 'Başlangıç', price: 5000 },
  profesyonel: { label: 'Profesyonel', price: 9000 },
  kurumsal: { label: 'Kurumsal', price: 20000 },
  ozel: { label: 'Özel', price: 0 },
}

export const LOST_REASONS: Record<string, string> = {
  fiyat: 'Fiyat',
  gerek_yok: 'Gerek görmedi',
  sahibi_yok: 'Sahibi yoktu',
  baska_firma: 'Başka firma',
  ulasilamadi: 'Ulaşılamadı',
  diger: 'Diğer',
}

export const tl = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' TL'

export const fmtDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'

export const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'

export const telHref = (p: string | null) => (p ? 'tel:' + p.replace(/[^\d+]/g, '') : undefined)

export interface CalEvent {
  id: string
  owner_id: string
  created_by: string | null
  title: string
  starts_at: string
  ends_at: string
  notes: string | null
  location: string | null
}

// WhatsApp: 0532... → 90532...
export const waNumber = (p: string | null | undefined) => {
  let d = (p ?? '').replace(/\D/g, '')
  if (d.startsWith('0')) d = '9' + d
  else if (d.length === 10) d = '90' + d
  return d
}
export const waText = (sender: string) =>
  `Merhaba, ben Parobita'dan ${sender}. Az önce telefonda konuştuğumuz gibi kısaca bilgi bırakıyorum 🙂\n\n` +
  `İşletmenize özel; telefonda ve Google'da şık görünen, sipariş/randevu/iletişimi kolaylaştıran web siteleri hazırlıyoruz. ` +
  `Hakkımızda: parobita.agency\n\nUygun olduğunuz bir gün 10 dakikanızı alıp size özel hazırladığımız tasarımı göstermek isteriz. Hangi gün/saat size uyar?`
export const waLink = (phone: string | null | undefined, sender: string) => `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(waText(sender))}`

// İnternet varken ana ekranların verisini önceden çek ki çevrimdışı açılınca hazır olsun.
// Sorgular sayfalardakiyle birebir aynı olmalı (önbellek adrese göre tutuluyor).
import { supabase } from './supabase'

const MEET_SEL = '*, leads(business_name, phone, address, district, maps_url)'

export async function prefetchAll(meId: string) {
  if (!navigator.onLine) return
  try {
    await Promise.all([
      supabase.from('leads').select('*', { count: 'exact' }).eq('assigned_to', meId).in('status', ['yeni', 'acmadi'])
        .order('status', { ascending: false }).order('list_date').order('sort_order').range(0, 99),
      supabase.from('leads').select('*', { count: 'exact' }).eq('assigned_to', meId).eq('status', 'sonra_ara')
        .order('call_back_at', { nullsFirst: true }).range(0, 99),
      supabase.from('meetings').select(MEET_SEL).eq('status', 'planli').order('scheduled_at', { nullsFirst: true }),
      supabase.from('meetings_awaiting_result').select('id'),
      supabase.from('deals').select('*, leads(business_name, phone, district), payments(amount)').order('updated_at', { ascending: false }),
      supabase.from('rivalry').select('*'),
      supabase.from('meetings').select(MEET_SEL).neq('status', 'iptal')
        .gte('scheduled_at', calFrom()).lte('scheduled_at', calTo()).order('scheduled_at'),
      supabase.from('events').select('*').gte('starts_at', calFrom()).lte('starts_at', calTo()).order('starts_at'),
      supabase.from('leads').select('niche').not('niche', 'is', null),
    ])
  } catch { /* önemli değil */ }
}

const DAY = 86400000
function calFrom() {
  const x = new Date(); x.setHours(0, 0, 0, 0); const wd = (x.getDay() + 6) % 7
  return new Date(x.getTime() - wd * DAY - 35 * DAY).toISOString().slice(0, 10)
}
function calTo() { return new Date(Date.now() + 90 * DAY).toISOString().slice(0, 10) }

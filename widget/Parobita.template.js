// Parobita CRM widget (Scriptable)
// Widget'ı ana ekrana ekle → basılı tut → Düzenle → Script: Parobita
// Parameter alanına şunlardan birini yaz:
//   ozet      → bugünkü aramalar, rakip, sıradaki toplantı (boş bırakırsan bu)
//   liste     → sıradaki aranacak işletmeler (dokununca arama seansı başlar)
//   toplanti  → yaklaşan toplantılar
//   ciro      → bu ayın cirosu, grafik, son satışlar
//   takvim    → Google Takvim gibi: bugünün tarihi + yaklaşan toplantı ve etkinlikler
// Kilit ekranında da çalışır (dikdörtgen ve yuvarlak boyut).

const TOKEN = "__TOKEN__"
const API = "https://lzxkowlecpiwvbwrjqxs.supabase.co/rest/v1/rpc/widget_data"
const KEY = "sb_publishable_-cMxpW6ET4taE0in1oE7iw_sDDVtR4m"
const CRM = "https://parobita-crm.parobitabusiness.workers.dev"
const CALL = "shortcuts://run-shortcut?name=Parobita%20Ara"

const mode = (args.widgetParameter || "ozet").trim().toLowerCase()
const fam = config.widgetFamily || "medium"
const dark = Device.isUsingDarkAppearance()

// Renkler: sakin, tek tonlu
const C = {
  bg1: dark ? new Color("#15171c") : new Color("#f4f6fa"),
  bg2: dark ? new Color("#0b0c0f") : new Color("#e6e9f0"),
  text: dark ? new Color("#f2f2f7") : new Color("#1c1c1e"),
  sub: dark ? new Color("#9a9aa3") : new Color("#6b6b73"),
  faint: dark ? new Color("#5c5c66") : new Color("#a1a1aa"),
  accent: new Color("#0a84ff"),
  green: new Color("#30d158"),
  red: new Color("#ff453a"),
  card: dark ? new Color("#ffffff", 0.06) : new Color("#ffffff", 0.7),
}

const tl = (n) => Math.round(Number(n || 0)).toLocaleString("tr-TR") + " TL"
const hm = (iso) => { const d = new Date(iso); return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) }
const dayLabel = (iso) => {
  const d = new Date(iso), now = new Date()
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - t0) / 86400000)
  if (diff === 0) return "Bugün"
  if (diff === 1) return "Yarın"
  return d.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric" })
}
const LEVELS = ["💰 Milyarder", "😐 Bahaneci", "🐢 Kaplumbağa", "🛋️ Koltuk Pezevengi", "🤡 Fakir"]
const level = (e) => LEVELS[Math.min(LEVELS.length - 1, Math.max(0, e || 0))]

async function load() {
  const fm = FileManager.local()
  const cache = fm.joinPath(fm.cacheDirectory(), "parobita_widget.json")
  try {
    const r = new Request(API)
    r.method = "POST"
    r.headers = { apikey: KEY, "Content-Type": "application/json" }
    r.body = JSON.stringify({ t: TOKEN })
    r.timeoutInterval = 10
    const d = await r.loadJSON()
    if (d && d.rivals) { fm.writeString(cache, JSON.stringify(d)); return { d, offline: false } }
  } catch (e) {}
  if (fm.fileExists(cache)) return { d: JSON.parse(fm.readString(cache)), offline: true }
  return { d: null, offline: true }
}

function base() {
  const w = new ListWidget()
  const g = new LinearGradient()
  g.colors = [C.bg1, C.bg2]
  g.locations = [0, 1]
  g.startPoint = new Point(0, 0)
  g.endPoint = new Point(1, 1)
  w.backgroundGradient = g
  w.setPadding(14, 15, 14, 15)
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000)
  return w
}
function txt(stack, s, size, color, weight = "regular", lines = 1) {
  const t = stack.addText(String(s))
  t.font = weight === "bold" ? Font.boldRoundedSystemFont(size) : weight === "semibold" ? Font.semiboldSystemFont(size) : weight === "mono" ? Font.boldMonospacedSystemFont(size) : Font.systemFont(size)
  t.textColor = color
  t.lineLimit = lines
  t.minimumScaleFactor = 0.7
  return t
}
function header(w, title, right) {
  const h = w.addStack()
  h.centerAlignContent()
  txt(h, title, 12, C.sub, "semibold")
  h.addSpacer()
  if (right) txt(h, right, 11, C.faint)
  w.addSpacer(6)
}

// ---------- ÖZET ----------
function ozet(d) {
  const w = base()
  w.url = CALL
  const me = d.rivals.find((r) => r.me) || d.rivals[0]
  const rival = d.rivals.find((r) => !r.me)
  header(w, "Parobita", d.now)
  const row = w.addStack()
  row.bottomAlignContent()
  txt(row, me.today, fam === "small" ? 40 : 44, C.text, "bold")
  row.addSpacer(6)
  const col = row.addStack(); col.layoutVertically()
  txt(col, "arama bugün", 12, C.sub)
  txt(col, level(me.ezik), 11, me.ezik > 0 ? C.red : C.green, "semibold")
  w.addSpacer(6)
  if (rival) {
    const r = w.addStack()
    const lead = me.today - rival.today
    txt(r, `${rival.name}: ${rival.today}`, 12, C.sub, "semibold")
    r.addSpacer(6)
    txt(r, lead > 0 ? `+${lead} öndesin` : lead < 0 ? `${-lead} gerideysin 😂` : "berabere", 12, lead >= 0 ? C.green : C.red, "semibold")
  }
  if (fam !== "small") {
    w.addSpacer(8)
    const m = d.meetings[0]
    const box = w.addStack(); box.backgroundColor = C.card; box.cornerRadius = 12; box.setPadding(8, 10, 8, 10); box.layoutVertically()
    if (m) { txt(box, `📅 ${dayLabel(m.at)} ${hm(m.at)} · ${m.name}`, 13, C.text, "semibold"); if (m.contact || m.district) txt(box, [m.contact, m.district].filter(Boolean).join(" · "), 11, C.sub) }
    else txt(box, `📞 Sırada ${d.queue} işletme var. Dokun, başla.`, 13, C.text, "semibold")
  } else {
    w.addSpacer()
    txt(w, `Sırada ${d.queue}`, 11, C.faint)
  }
  return w
}

// ---------- LİSTE ----------
function liste(d) {
  const w = base()
  w.url = CALL
  header(w, "📞 Sıradaki aramalar", `${d.queue} kaldı`)
  const n = fam === "large" ? 8 : fam === "medium" ? 3 : 2
  if (!d.next_leads.length) txt(w, "Liste boş 🎉", 14, C.sub)
  d.next_leads.slice(0, n).forEach((l, i) => {
    const r = w.addStack(); r.centerAlignContent()
    txt(r, `${i + 1}`, 11, C.faint, "mono"); r.addSpacer(8)
    const c = r.addStack(); c.layoutVertically()
    txt(c, l.name, fam === "small" ? 12 : 13, C.text, "semibold")
    if (fam !== "small") txt(c, [l.niche, l.district].filter((x) => x && x !== "Diğer").join(" · ") || " ", 11, C.sub)
    w.addSpacer(fam === "large" ? 7 : 5)
  })
  w.addSpacer()
  txt(w, "Dokun → arama seansı başlar", 10, C.accent, "semibold")
  return w
}

// ---------- TOPLANTI ----------
function toplanti(d) {
  const w = base()
  w.url = CRM + "/toplantilar"
  header(w, "📅 Toplantılar", d.meetings.length ? `${d.meetings.length} yaklaşan` : "")
  const n = fam === "large" ? 6 : fam === "medium" ? 3 : 2
  const items = d.meetings.slice(0, n)
  if (!items.length) { txt(w, "Yaklaşan toplantı yok", 14, C.sub, "semibold"); w.addSpacer(4); txt(w, "Arayıp doldur 📞", 12, C.faint); w.url = CALL }
  items.forEach((m) => {
    const r = w.addStack(); r.centerAlignContent()
    const t = r.addStack(); t.layoutVertically(); t.size = new Size(fam === "small" ? 44 : 56, 0)
    txt(t, hm(m.at), 14, C.accent, "bold"); txt(t, dayLabel(m.at), 10, C.sub)
    r.addSpacer(6)
    const c = r.addStack(); c.layoutVertically()
    txt(c, m.name, 13, C.text, "semibold")
    if (fam !== "small") txt(c, [m.contact, m.district].filter(Boolean).join(" · ") || " ", 11, C.sub)
    w.addSpacer(6)
  })
  if (fam === "large" && d.events.length) {
    w.addSpacer(4); txt(w, "Diğer etkinlikler", 11, C.faint, "semibold"); w.addSpacer(3)
    d.events.slice(0, 3).forEach((e) => txt(w, `${dayLabel(e.at)} ${hm(e.at)} · ${e.name}`, 12, C.sub))
  }
  w.addSpacer()
  return w
}

// ---------- CİRO ----------
function chart(days, wpx, hpx) {
  const dc = new DrawContext()
  dc.size = new Size(wpx, hpx); dc.opaque = false; dc.respectScreenScale = true
  const max = Math.max(1, ...days)
  const total = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const bw = wpx / total
  for (let i = 0; i < total; i++) {
    const v = days[i] || 0
    const h = v ? Math.max(4, (v / max) * (hpx - 2)) : 2
    const p = new Path()
    p.addRoundedRect(new Rect(i * bw + bw * 0.18, hpx - h, bw * 0.64, h), 2, 2)
    dc.addPath(p)
    dc.setFillColor(i < days.length ? (v ? C.accent : C.faint) : new Color(C.faint.hex, 0.35))
    dc.fillPath()
  }
  return dc.getImage()
}
function ciro(d) {
  const w = base()
  w.url = CRM + "/analiz"
  const ay = new Date().toLocaleDateString("tr-TR", { month: "long" })
  header(w, `💰 ${ay[0].toUpperCase() + ay.slice(1)} cirosu`, `${d.sales_month} satış`)
  txt(w, tl(d.rev_month), fam === "small" ? 24 : 30, C.text, "bold")
  const prev = Number(d.rev_prev)
  const delta = prev ? Math.round(((d.rev_month - prev) / prev) * 100) : null
  const sub = w.addStack()
  if (delta !== null) txt(sub, `${delta >= 0 ? "▲" : "▼"} %${Math.abs(delta)} geçen aya göre`, 11, delta >= 0 ? C.green : C.red, "semibold")
  else txt(sub, `Tahsilat ${tl(d.collected_month)}`, 11, C.sub)
  if (fam !== "small") {
    w.addSpacer(8)
    const img = w.addImage(chart(d.days || [], fam === "large" ? 300 : 290, fam === "large" ? 90 : 44))
    img.imageSize = new Size(fam === "large" ? 300 : 290, fam === "large" ? 90 : 44)
  }
  w.addSpacer(8)
  const pct = Math.min(1, Number(d.rev_total) / 1000000)
  const barW = fam === "small" ? 120 : 290
  const dc = new DrawContext(); dc.size = new Size(barW, 6); dc.opaque = false; dc.respectScreenScale = true
  let p = new Path(); p.addRoundedRect(new Rect(0, 0, barW, 6), 3, 3); dc.addPath(p); dc.setFillColor(new Color(C.faint.hex, 0.35)); dc.fillPath()
  p = new Path(); p.addRoundedRect(new Rect(0, 0, Math.max(6, barW * pct), 6), 3, 3); dc.addPath(p); dc.setFillColor(C.accent); dc.fillPath()
  w.addImage(dc.getImage()).imageSize = new Size(barW, 6)
  w.addSpacer(3)
  txt(w, `1M hedefi: ${tl(d.rev_total)} · %${Math.round(pct * 100)}`, 10, C.sub)
  if (fam === "large") {
    w.addSpacer(10); txt(w, "Son satışlar", 11, C.faint, "semibold"); w.addSpacer(4)
    d.last_sales.forEach((s) => {
      const r = w.addStack(); txt(r, s.name, 12, C.text, "semibold"); r.addSpacer(); txt(r, tl(s.amount), 12, C.sub); w.addSpacer(3)
    })
    w.addSpacer(4); txt(w, `Açık anlaşma: ${d.open_deals}`, 11, C.sub)
  }
  w.addSpacer()
  return w
}


// ---------- TAKVİM ----------
function takvim(d) {
  const w = base()
  w.url = CRM + "/toplantilar"
  const now = new Date()
  const items = (d.cal || []).filter((e) => new Date(e.until || e.at) >= new Date(now.getTime() - 30 * 60000))
  const dot = (kind) => (kind === "toplanti" ? C.accent : new Color("#8e5bc4"))
  const dayKey = (iso) => { const x = new Date(iso); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}` }
  const sameDay = (a, b) => dayKey(a) === dayKey(b)

  if (fam === "small") {
    txt(w, now.toLocaleDateString("tr-TR", { weekday: "long" }).toUpperCase(), 10, C.red, "semibold")
    txt(w, now.getDate(), 34, C.text, "bold")
    w.addSpacer(4)
    const today = items.filter((e) => sameDay(e.at, now.toISOString()))
    const list = today.length ? today : items
    if (!list.length) txt(w, "Etkinlik yok", 12, C.sub)
    list.slice(0, 2).forEach((e) => {
      const r = w.addStack(); r.centerAlignContent()
      const bar = r.addStack(); bar.size = new Size(3, 24); bar.backgroundColor = dot(e.kind); bar.cornerRadius = 1.5
      r.addSpacer(5)
      const c = r.addStack(); c.layoutVertically()
      txt(c, e.name.replace("Toplantı · ", ""), 11, C.text, "semibold")
      txt(c, (today.length ? "" : dayLabel(e.at) + " ") + hm(e.at), 10, C.sub)
      w.addSpacer(3)
    })
    w.addSpacer()
    return w
  }

  const row = w.addStack()
  // Sol: büyük tarih
  const left = row.addStack(); left.layoutVertically(); left.size = new Size(fam === "large" ? 0 : 84, 0)
  if (fam !== "large") {
    txt(left, now.toLocaleDateString("tr-TR", { weekday: "long" }).toUpperCase(), 10, C.red, "semibold")
    txt(left, now.getDate(), 38, C.text, "bold")
    txt(left, now.toLocaleDateString("tr-TR", { month: "long" }), 11, C.sub)
    left.addSpacer()
    row.addSpacer(10)
  }
  const right = fam === "large" ? w : row.addStack()
  if (fam !== "large") right.layoutVertically()
  if (fam === "large") {
    // Hafta şeridi
    const strip = w.addStack()
    const wd0 = (now.getDay() + 6) % 7
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - wd0)
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday.getTime() + i * 86400000)
      const cell = strip.addStack(); cell.layoutVertically(); cell.centerAlignContent(); cell.size = new Size(42, 44)
      const isToday = sameDay(day.toISOString(), now.toISOString())
      const has = items.some((e) => sameDay(e.at, day.toISOString()))
      const h = cell.addStack(); h.addSpacer(); txt(h, ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"][i], 9, C.sub); h.addSpacer()
      const n = cell.addStack(); n.addSpacer()
      const nb = n.addStack(); nb.size = new Size(26, 26); nb.cornerRadius = 13; nb.centerAlignContent()
      if (isToday) nb.backgroundColor = C.red
      const tt = nb.addText(String(day.getDate())); tt.font = Font.semiboldSystemFont(13); tt.textColor = isToday ? Color.white() : C.text
      n.addSpacer()
      const dd = cell.addStack(); dd.addSpacer(); const dt = dd.addText(has ? "•" : " "); dt.font = Font.boldSystemFont(10); dt.textColor = C.accent; dd.addSpacer()
    }
    w.addSpacer(8)
  }
  const max = fam === "large" ? 7 : 3
  if (!items.length) { txt(right, "Yaklaşan etkinlik yok", 13, C.sub, "semibold"); right.addSpacer(3); txt(right, "Takvim boş — ara, toplantı al 📞", 11, C.faint) }
  let lastDay = ""
  items.slice(0, max).forEach((e) => {
    const k = dayKey(e.at)
    if (k !== lastDay && (fam === "large" || !sameDay(e.at, now.toISOString()))) { txt(right, dayLabel(e.at).toUpperCase(), 9, C.faint, "semibold"); right.addSpacer(2) }
    lastDay = k
    const r = right.addStack(); r.centerAlignContent()
    const bar = r.addStack(); bar.size = new Size(3, 28); bar.backgroundColor = dot(e.kind); bar.cornerRadius = 1.5
    r.addSpacer(7)
    const c = r.addStack(); c.layoutVertically()
    txt(c, e.name, 12, C.text, "semibold")
    txt(c, [hm(e.at) + (e.until ? "–" + hm(e.until) : ""), e.place].filter(Boolean).join(" · "), 10, C.sub)
    right.addSpacer(5)
  })
  w.addSpacer()
  return w
}

// ---------- KİLİT EKRANI ----------
function lock(d) {
  const w = new ListWidget()
  const me = d.rivals.find((r) => r.me) || d.rivals[0]
  if (fam === "accessoryCircular") {
    w.addSpacer()
    const v = mode === "ciro" ? Math.round(d.rev_month / 1000) + "B" : String(me.today)
    const t = w.addText(v); t.font = Font.boldRoundedSystemFont(20); t.centerAlignText()
    const s = w.addText(mode === "ciro" ? "ciro" : "arama"); s.font = Font.systemFont(9); s.centerAlignText()
    w.addSpacer()
  } else if (fam === "accessoryInline") {
    w.addText(mode === "ciro" ? `💰 ${tl(d.rev_month)}` : `📞 ${me.today} arama · ${d.meetings[0] ? hm(d.meetings[0].at) + " " + d.meetings[0].name : "toplantı yok"}`)
  } else {
    if (mode === "ciro") { txt(w, "💰 Bu ay", 11, Color.white(), "semibold"); txt(w, tl(d.rev_month), 16, Color.white(), "bold"); txt(w, `${d.sales_month} satış`, 11, Color.white()) }
    else if (mode === "toplanti" || d.meetings[0]) { const m = d.meetings[0]; txt(w, "📅 Sıradaki toplantı", 11, Color.white(), "semibold"); txt(w, m ? `${dayLabel(m.at)} ${hm(m.at)}` : "Yok", 15, Color.white(), "bold"); txt(w, m ? m.name : "Ara, doldur", 11, Color.white()) }
    else { txt(w, "📞 Bugün", 11, Color.white(), "semibold"); txt(w, `${me.today} arama`, 16, Color.white(), "bold"); txt(w, `Sırada ${d.queue}`, 11, Color.white()) }
  }
  w.url = mode === "ciro" ? CRM + "/analiz" : CALL
  return w
}

const { d, offline } = await load()
let widget
if (!d) {
  widget = base(); txt(widget, "Parobita", 13, C.sub, "semibold"); widget.addSpacer(4); txt(widget, "Veri alınamadı. İnternete bağlanınca güncellenir.", 12, C.text, "regular", 3)
} else if (fam.startsWith("accessory")) widget = lock(d)
else widget = mode === "liste" ? liste(d) : mode === "toplanti" ? toplanti(d) : mode === "ciro" ? ciro(d) : mode === "takvim" ? takvim(d) : ozet(d)
if (d && offline && !fam.startsWith("accessory")) { widget.addSpacer(2); txt(widget, "çevrimdışı · son veri", 9, C.faint) }

if (config.runsInWidget) Script.setWidget(widget)
else {
  // Uygulama içinden çalıştırınca önizleme
  const a = new Alert()
  a.title = "Önizleme"
  ;["Özet", "Liste", "Toplantı", "Ciro", "Takvim"].forEach((x) => a.addAction(x))
  a.addCancelAction("Kapat")
  const i = await a.presentSheet()
  if (i >= 0 && d) {
    const pm = ["ozet", "liste", "toplanti", "ciro", "takvim"][i]
    const w2 = pm === "liste" ? liste(d) : pm === "toplanti" ? toplanti(d) : pm === "ciro" ? ciro(d) : pm === "takvim" ? takvim(d) : ozet(d)
    await w2.presentMedium()
  }
}
Script.complete()

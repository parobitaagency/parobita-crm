# CLAUDE.md — Parobita CRM

Yeni bir Claude oturumu bu dosyayı okuyunca, hiçbir şey bilmeden kaldığı yerden devam edebilmeli.
Yapı, Claude'un hafıza sistemiyle aynı: **/profile → /preferences → /areas → /people**, en sonda teknik başvuru.
Dil: Burak ile **Türkçe** konuş. Şifre, anahtar ya da token bu dosyada YOK. Nerede olduklarını "Gizli bilgiler" bölümü anlatıyor.

Son güncelleme: 28 Kasım 2026, 17:50 (Europe/Istanbul)

---

## /profile — Burak kim

- Burak Özbilen, 19 yaşında, Ankara. Girişimci, üniversite yerine iş yolunu seçti (2027'de YKS'ye girmeyi planlıyor).
- **Parobita Agency** (parobita.agency) kurucu ortağı. Ortağı **Korhan Yetimoğlu**, ortaklık 50/50 ve hukuken "Parobita Adi Ortaklığı".
- İş: Ankara'daki yerel işletmelere yapay zekâ ile hızlı üretilmiş web sitesi ve e-ticaret sitesi satmak.
- İngilizcesi neredeyse ana dil seviyesinde. Dışarıdayken telefonunda mobil internet yok, sadece Wi-Fi var. Bu yüzden CRM'de çevrimdışı mod var.
- Cihazlar: M2 MacBook Air ve iPhone (iOS 26+, Liquid Glass arayüzü, telefon dili İngilizce).

## /preferences — Burak'ın tercihleri ve kaçınılacaklar

- **İletişim:** Direkt konuşur, açık sözlü ve filtresiz geri bildirim ister, övgü istemez. Kısa cevap ver, sonucu söyle, yaptığın adımları uzun uzun anlatma.
- **Tasarım:**
  - "AI slop" istemez, yani rengarenk ve şablon görünüm olmasın.
  - CRM önce Notion sadeliğindeydi. 27 Kasım'da **Apple Liquid Glass** estetiğine geçildi: cam yüzeyler, yaylı iOS animasyonları, esneyen sekme hapı.
  - Arka planda kırmızı, pembe ya da sarı ışık istemiyor ("polis ışığı gibi"). Arka plan tek tonlu lacivert-gri.
- **Animasyon:** iPhone uygulaması gibi hissettirmeli. Işınlanan, yani animasyonsuz geçişleri sevmiyor.
- **Mac:**
  - Mac'inde asla sık aralıklı döngü (polling) çalıştırma. M2 Air'de "yüksek enerji" uyarısı çıktı.
  - Tarayıcı işlerinde Chrome değil Claude masaüstü uygulamasının **built-in browser**'ı kullanılır.
- **Mac'i uyutma adımı:** `/Users/parobita/ClaudeKapat/` klasörüne küçük bir dosya bırakmak, bir macOS kısayolunu tetikleyip tüm uygulamaları kapatıyor. Gece görevlerinde başta "bitince Mac'i kapatayım mı?" diye sor.
  - İstisna: günlük cold call görevi bu adımı her zaman yapar.
  - Bu sohbette Burak "çalıştırma, ben kapatırım" dedi, sohbet içinde kendiliğinden çalıştırma.
- **Lovable:** Kredi az harcanmalı. Lovable prompt'unu Burak kendisi yapıştırır. Sonraki değişiklikleri Claude GitHub repo üzerinden yapar.
- **Satış kuralları** (CRM metinlerinde ve WhatsApp mesajlarında uy):
  - Örnek site linki WhatsApp'tan atılmaz.
  - Fiyat, site gösterilmeden konuşulmaz.
  - Her müşteriye üç paket birden gösterilir.
- **Gizli bilgiler:** Asla repoya commit edilmez. Cron secret Supabase Vault'ta duruyor.
- **Satış kaydı kuralı (kalıcı):** Burak herhangi bir sohbette "şuna sattık" ya da "şu kadar aldık" derse ve CRM'de yoksa, `bot_record_sale` RPC'si ile CRM'e işle (ayrıntısı aşağıda).
- **Notion:** Tamamen bırakıldı. Notion'a hiçbir şey yazma, Notion'dan okuma.

---

## /areas/parobita-agency — İş modeli, hedef, kurallar

- **Hedef:** Bir yılda 1 milyon TL ciro. Önce Ankara bitirilecek, sonra diğer şehirler.
- **Paketler:** Başlangıç 5.000 TL, Profesyonel 9.000 TL, Kurumsal 20.000 TL. Her müşteriye üçü birden gösterilir, müşteri "alayım mı almayayım mı" değil "hangisini alayım" diye düşünsün.
- **Satış akışı:**
  1. Google Maps'ten sitesi olmayan işletme bulunur.
  2. Telefonla aranır (cold call).
  3. Toplantı alınır, toplantıdan önce demo site hazırlanır.
  4. Toplantıda site MacBook'tan gösterilir, ikisi birlikte gider.
- **Hafta planı:** Hedef, haftayı toplantılarla doldurmak. Müşteriye bir gün önceden hatırlatma yapılır.
- **Takip:** Önce aranır. Geçiştirirse habersiz ikinci ziyaret yapılır; Tonic Parfüm böyle satıldı.
- **Lead kuralları:**
  - Kesin yasak: alkol ve gece mekânları, hayvanla ilgili her şey, seramik/çömlek atölyeleri, kuaför, kuyumcu, emlak, klinik, kreş, zincir mağazalar ve benzerleri.
  - Hedef nişler: ürün satıp internetten satmayanlar (butik pastane, kahveci, çiçekçi, dekorasyon, atölyeler, butik giyim...).
  - Kaliteye göre A/B/C kademeleri var.
- **Ödemeler:** Her ödeme geldiği anda 50/50 bölünür, ortak kasa yok.
- **Satışlar** (CRM'de girili, toplam 79.000 TL):

  | İşletme | Paket | Tutar | Tarih |
  |---|---|---|---|
  | Scarlett Optik | Kurumsal | 20.000 TL | ~19 Ağu (yaklaşık) |
  | Optik Lenti | Kurumsal | 20.000 TL | ~1 Eyl (yaklaşık) |
  | Yaşar Optik | Kurumsal | 20.000 TL | ~15 Eyl (yaklaşık) |
  | Bilmiyorum Ki | Başlangıç | 5.000 TL | 30 Eki |
  | Tonic Parfüm | Profesyonel | 9.000 TL | 3 Kas |
  | Bergöz Çiçek Evi | Başlangıç | 5.000 TL, tamamı ödendi | 10 Kas |

- **Aktif müşteri adayları (28 Kas):** Sadece **O-X FİT** (Aziziye'de spor salonu) ve **Lufi Cocktails** (GOP). İkisi de "Demo gösterildi" aşamasında, takip tarihleri henüz girilmedi. Diğer bütün açık anlaşmalar Burak'ın talimatıyla "Kayıp" yapıldı.

## /areas/parobita-crm — Bu repo: kararlar, durum, sıradaki adımlar

### Neden var
- Notion aylık ücretliydi ve ekibin arama akışına uymuyordu. Burak "Notion'un yerine geçecek, ekip de kullanacak kendi uygulamamız olsun" dedi (27 Kasım 2026).
- Notion **tamamen bırakıldı**. Bütün Notion verisi yedeklendi: CRM'de `notion_archive` tablosu, Mac'te `~/Downloads/Notion_Yedek_2026-11-27.zip` (JSON ve CSV). Notion planını iptal etmek Burak'a kaldı.

### Alınan kararlar ve nedenleri

| Karar | Neden |
|---|---|
| Kendi PWA'mız: React + Supabase + Cloudflare Workers | Bedava, tam kontrol, ana ekrana eklenebiliyor. Lovable'a gerek yok, krediyi korur. |
| Supabase projesi Frankfurt'ta | Türkiye'ye yakın. İlk proje yanlışlıkla Singapur'da açılmıştı, yeniden açıldı. |
| Arama döngüsü **iOS Kısayolları** ile | Native uygulama için yılda $99 gerekiyordu. Kısayol onaysız arıyor ve sonuç menüsünü görüşmenin üstünde gösteriyor. |
| Kısayollar **Cherri** dilinde yazılıyor, Burak'ın Mac'inde imzalanıyor | iOS imzasız kısayolu kabul etmiyor. Claude Terminal'e yazamıyor (computer use'da sadece tıklama izni var), bu yüzden imzayı Burak çalıştırıyor. |
| Çevrimdışı katman | Burak'ın dışarıda mobil interneti yok. Okumalar önbellekten geliyor, yazmalar kuyruğa giriyor ve internet gelince gidiyor. |
| Maraton modu + kaçış cezası + rakip seviyeleri | Burak'ın erteleme alışkanlığına karşı. Rekabeti seviyorlar. |
| Gece kilidi 21:00–09:00 | Bir gece test sırasında 7 gerçek işletme yanlışlıkla arandı. |
| Saat dilimi: veritabanı `Europe/Istanbul` | UTC yüzünden gece eklenen kayıtlar önceki güne düşüyordu. |
| Sonuçlar 7 seçenekli: ✅ toplantı · 📲 wp · ⚠️ sonra_ara · ⏳ uzun_vade · ⏸️ acmadi · ❌ red · 🚫 gecersiz | Sadece "red / toplantı" ayrımı, "WhatsApp'tan bilgi at" ve "ileride" diyenleri kaybettiriyordu. |
| Sonucu girilmeden kapanan aramada "🔁 Tekrar ara" seçeneği | Lead yanmasın, gerçek toplantıyı da tekrar aramasın. |
| Arama seansı, Lead'ler sayfasındaki sıralama ve filtreyle arıyor (`profiles.call_prefs`) | Burak "listede gördüğüm sırayla arasın" dedi. "Yakından uzağa" sıralaması da var. |
| Konum bulma: Photon (OpenStreetMap) | Google API anahtarı yok. Nominatim ve Photon, Supabase edge IP'lerini engelliyor (403). Bu yüzden konum ya tarayıcıdan (CRM) ya da yerel scriptle bulunuyor. |
| "Masada kalan para" bildirimleri aylık, en az 30.000 TL | Burak'ın isteği. Küçük rakamlar motive etmiyordu. |

### Yapılanlar (çalışıyor)
- **Lead'ler:**
  - Geniş, yatay kayan tablo. İsme ya da numaraya dokununca arıyor.
  - Durum satırın içinden seçiliyor.
  - Filtreler: durum çipleri (sayılarıyla), semt, liste tarihi, sıralama (puan, yorum, isim, yakından uzağa ofise ya da konumuma göre), mesafe sütunu, yol tarifi linki.
- **Toplantılar:**
  - Liste ve Google Takvim benzeri takvim. Takvimde özel etkinlik de eklenebiliyor.
  - Eksik bilgi uyarısı (saat ya da yetkili adı yoksa).
  - Her toplantıda semt, mesafe ve ~dakika. Panelde 🧭 Yol tarifi (Google Maps) butonu.
- **Satışlar:** Pano, ödemeler, 1M hedef çubuğu.
- **Analiz:** Dönem ve kişi seçimi, önceki döneme göre değişim, ciro ve aktivite grafikleri, satış listesi, niş/semt/paket/kişi kırılımı, huni, arama saati ısı haritası, açık hat, kayıp sebepleri, içgörüler.
- **Bugün:**
  - Arama seansı başlat butonu, rakip kartı, istatistikler, bildirim aç/kapat.
  - 📲 WhatsApp bekleyenler listesi: "Gönder"e basınca hazır mesajla wa.me açılıyor.
  - Bugün tekrar aranacaklar listesi.
- **Bildirimler (Web Push):**
  - Eksik bilgi.
  - "Nasıl geçti?" toplantı bitince, sonuç girilene kadar tekrar eder.
  - Takip bildirimleri.
  - Sabah 09:10 ve akşam 20:10 satış özeti.
  - 20:30'da potansiyel kayıp.
  - Maratondan kaçış (rakibe 😂).
  - WhatsApp bekleyen.
  - Gerçek kişilerden motivasyon sözleri.
  - Sessiz saatler 22:30–08:30.
- **Çevrimdışı mod ve otomatik güncelleme:** Uygulama yeniden yüklemeye gerek kalmadan kendini güncelliyor.
- **Liquid Glass tasarımı:**
  - Yüzen kapsül sekme çubuğu. Hap esneyerek kayıyor, parmakla sürüklenebiliyor, mercek efekti var.
  - Sayfalar arasında sağa-sola kaydırma.
  - Alttan açılan sayfalar aşağı çekilince kapanıyor.
  - Kaydırınca beliren cam başlık.
- **iPhone kısayolları:**
  - **Parobita Ara:** Normal ve maraton (20/30/40/50/özel, en az 20, iki onay) modu. İnternetsiz modda telefondaki listeden arıyor. "⏹ Seansı bitir" önce son aramanın sonucunu soruyor.
  - **Parobita Senkron:** Tetikleyicileri içinde: Wi-Fi'ye katılınca ve 08:30.
  - **Maraton Kontrol:** Tetikleyicisi "Kestirmeler kapatılınca".
- **Scriptable widget'ı:** `widget/Parobita.template.js`. Parametreler: `ozet`, `liste`, `toplanti`, `ciro`, `takvim`. Kilit ekranında da çalışıyor.
- **Günlük lead bulma görevi:** "Günlük Cold Call Listesi" CRM'e yazıyor (bot_* RPC'leri). **Şu an DURAKLATILMIŞ.**
- **Satış Takibi Hatırlatıcı:** Notion tabanlı eski görev **KAPATILDI**, yerine `sales_digest` cron'u var.
- **Notion'dan taşınanlar:**
  - 1.024 lead (35 mükerrer birleştirildi).
  - 27 satış takibi kaydı, doğru aşamalarıyla.
  - Hariç tutulanlar, GOP, Çayyolu ve eski Leads listeleri `lead_blocklist` tablosuna (1.147 kayıt).

### Yarım kalanlar ve sıradaki adımlar
1. **Kısayolu imzala ve dağıt** (en son: 7 sonuç seçeneği + saat düzeltmesi). Burak Mac'te `bash ~/Downloads/parobita-imza/imzala.command` çalıştırır. Sonra kendi telefonuna `~/Downloads/ara-burak/Parobita Ara.shortcut`'ı, Korhan'a `~/Downloads/ara-korhan/Parobita Ara.shortcut`'ı yükler. **Senin dosyanı Korhan'a verme**, içinde kişiye özel token var.
2. **Açık soru:** Korhan "Fzt. Nur & Fzt. Gizem" kaydını toplantı olarak girmiş ama yetkili alanına "WP'den AT" yazmış. Bu kayıt toplantıdan çıkarılıp `wp` durumuna çevrilsin mi? Burak'a sor.
3. **Korhan'ın 4 toplantısının saati yok:** Kısayol hatası yüzünden saat kaydedilmedi. Toplantılar şunlar:
   - Pet Care: 29 Kas, muhtemelen 15:00
   - Filika Cafe: 29 Kas
   - Happypets: 1 Ara
   - Fzt. Nur: 28 Kas

   Doğru saatler Korhan'ın iPhone takviminde. Burak'tan al ya da Korhan CRM'den girsin.
4. **O-X FİT ve Lufi:** Bir sonraki takip tarihleri girilmedi.
5. **Optik satışlarının tarihleri yaklaşık.** Burak doğrusunu söylerse düzelt.
6. **Konum bulma:** 1.030 leadin ~365'i sokak düzeyinde, kalanı mahalle merkezinde. Hassaslaştırmak için `python3 scripts/geo_photon.py 1500` (Photon'a nazik ol, istek başına ~0,35 sn). Yeni leadlerin konumunu CRM tarayıcıda kendisi buluyor (`geocodeMissing`).
7. **Günlük lead görevi:** Burak açmak isterse etkinleştir. Prompt'a lead başına `lat`/`lng` göndermesini ekle; `bot_add_leads` bunları zaten kabul ediyor. Görev Burak'ın Mac'ine bağlı, prompt değişikliği Mac'te onay istiyor.
8. **Veteriner ve hayvanla ilgili leadler** eski listelerde duruyor, oysa bunlar yasak niş. Korhan'ın bazı toplantıları da veteriner. Bunların listeden çıkarılıp çıkarılmayacağı henüz kararlaştırılmadı.
9. **Arama ekranı istatistikleri:** Burak ve Korhan'ın test istatistikleri sıfırlandı. Test lead'leri (`source='test'`) tamamen silindi.
10. **Widget:** Scriptable kurulumu Burak'ta (parametre ve "Open URL" ayarı). Widget altındaki "Scriptable" yazısı ancak iOS ana ekranında "Büyük simgeler" seçilirse kalkıyor.

### Bilinen sınırlar (tekrar uğraşma)
- CRM'deki butondan kısayol açılınca **Kestirmeler uygulaması her zaman tam ekran açılıyor**. Kısayol hazırlığı bitince ana ekrana dönüyor.
- iOS, kısayoldan ana ekrana eklenmiş web uygulamasına **geri dönmeye izin vermiyor**. Link açılırsa Safari'de açılır.
- Menü dışına dokunmak kısayolu öldürüyor. Bunun telafisi: sonucu girilmemiş arama bir dahaki açılışta "🔁 Tekrar ara / sonuç seç" olarak geliyor, maraton da sunucu tarafında takip ediliyor.
- Kısayol başka bir kısayolu çalıştırırsa iOS her seferinde izin soruyor. Bu yüzden senkron mantığı Parobita Ara'nın içine gömüldü.
- Wi-Fi adını okumak her seferinde izin istiyor. Bu yüzden `isOnline()` (dış IP) kullanılıyor.
- Shortcuts'ta `formatDate(..., "ISO 8601")` sadece tarihi veriyor. Her zaman `"Custom", "yyyy-MM-dd'T'HH:mm:ssZZZZZ"` kullan.
- Safari'de gerçek Liquid Glass ışık kırılması (backdrop SVG filter) çalışmıyor. Bulanıklık, saydamlık ve kenar parıltısıyla taklit ediliyor.
- **Animasyon tuzakları:**
  - Bir ata elemanda `transform` animasyonu `fill-mode: both` ile kalırsa, içindeki `position: fixed` paneller bozuluyor. Sayfa animasyonları `backwards` kullanıyor.
  - iOS, dokunma başlarken DOM değişirse tıklamayı yutuyor. Bu yüzden TabBar navigasyonu `pointerup`'ta yapılıyor.

## /people

- **Korhan Yetimoğlu:** Ortak (50/50). Hem arıyor hem toplantıya gidiyor. Satıştan sonra ürünleri o yüklüyor, siteyi Burak yapıyor. Arayıcı ekibi kurma fikri ve sorumluluğu onda. CRM hesabı korhanyetimoglu68@gmail.com, rolü owner. Kendi kısayol tokenı var.
- **Burak** CRM'de burak@parobita.com, rolü owner.
- İkisi de `owner`. `caller` rolü ileride arayıcı ekip için var.

---

## Teknik başvuru

### Linkler ve hesaplar
| Ne | Nerede |
|---|---|
| Canlı uygulama | https://parobita-crm.parobitabusiness.workers.dev |
| GitHub | `parobitaagency/parobita-crm`. `main`'e push yapınca Cloudflare Workers otomatik yayınlıyor. |
| Cloudflare | Workers static assets, `wrangler.jsonc` (SPA fallback). Hesap parobitabusiness. |
| Supabase | Proje ref `lzxkowlecpiwvbwrjqxs`, eu-central-1 (Frankfurt). URL `https://lzxkowlecpiwvbwrjqxs.supabase.co` |
| Supabase publishable key | Herkese açık, uygulamada ve kısayollarda gömülü: `sb_publishable_-cMxpW6ET4taE0in1oE7iw_sDDVtR4m` |
| VAPID public key | `src/components/PushToggle.tsx` içinde. Private key edge function secret'larında. |
| Ofis (mesafe başlangıcı) | `app_settings` tablosu: Pylon Residence, Bağcılar Mah. 271. Sok., Çankaya (GOP) |
| Burak'ın Mac klasörleri | `~/Downloads` (bağlı klasör): `parobita-imza/` imzasız dosyalar ve `imzala.command`; `ara-burak/` ile `ara-korhan/` imzalı kısayollar ve widget; `Notion_Yedek_2026-11-27.zip` |

### Gizli bilgiler (değerleri burada YOK)
- **`.env`:** Repo kökünde, git'e girmez. İçinde `SB_REF`, `SB_PAT` (Supabase personal access token), `SB_SECRET` (service role), `SB_PUB` var. Değerleri Burak'tan iste ya da Supabase panelinden al.
- **Kısayol tokenları:** `profiles.shortcut_token` (kolon izinleriyle istemciden gizli). `select full_name, shortcut_token from profiles` ile servis rolüyle oku.
- **Bot tokenı:** `bot_config` tablosunda. "Günlük Cold Call Listesi" görevinin prompt'unda da var.
- **Cron secret:** Supabase Vault'ta `cron_secret` adıyla. Edge function'lar `x-cron-secret` başlığıyla doğruluyor.
- **Kullanıcı şifreleri:** Burak ve Korhan kendileri yönetiyor, hiçbir yere yazılmaz.

### Repo yapısı
```
src/
  App.tsx              Kabuk: kenar çubuğu, TabBar, sayfa kaydırma jesti, cam başlık, maraton kilidi
  main.tsx             autoupdate → ErrorBoundary → Router → SessionProvider
  styles.css           Temel (Notion çizgisi) · glass.css: Liquid Glass katmanı (v1–v4, en sondaki kazanır)
  lib/supabase.ts      İstemci (offlineFetch), tipler, STATUS/STAGES/PACKAGES, waLink/waText
  lib/offline.ts       GET önbelleği (pb-cache-v1) + yazma kuyruğu (pb-queue-v1)
  lib/session.tsx      me, people, badges, marathon
  lib/geo.ts           useBase, km, fmtKm/fmtMin, dirUrl, geocodeMissing (Photon)
  lib/prefetch.ts      Çevrimdışı için ön yükleme · lib/autoupdate.ts: SW güncellemesi
  pages/               Today, Leads, Meetings, Deals, Analytics, Login
  components/          TabBar (mercek hap), LiquidPill, Panel (aşağı çekip kapatma), LeadPanel,
                       MeetingPanel, EventPanel, CalendarView, Rivalry, PushToggle, OfflineBar, ErrorBoundary
public/push-sw.js      Push + notificationclick (vite-plugin-pwa importScripts)
supabase/NNN_*.sql     Göçler sırayla (001–027). 016 içindeki bot token <BOT_TOKEN> ile karartıldı.
supabase/functions/    push (Web Push gönderimi) · geocode (OSM engelliyor, KULLANILMIYOR, cron'u kaldırıldı)
shortcuts/             ara/senkron/kontrol.cherri (token: __SHORTCUT_TOKEN__), build.sh, imzala.command, actions/
widget/                Parobita.template.js (Scriptable, token: __TOKEN__ = shortcut_token)
scripts/               sql.py (Management API ile SQL), geo_photon.py (toplu konum bulma)
```

### Veritabanı
- **Tablolar:**
  - `profiles` (role owner/caller, shortcut_token, call_prefs)
  - `leads` (status: yeni/acmadi/sonra_ara/wp/uzun_vade/red/toplanti/musteri/gecersiz; call_back_at, wa_sent_at, lat/lng/geo_level, served_at/by, tier ust/orta/alt, source)
  - `calls` (outcome, client_ref unique)
  - `meetings`, `deals` (stage toplanti/demo/teklif/dusunuyor/satis/kayip, package, amount, closed_at), `payments`, `events`
  - `push_subscriptions`, `notifications` (dedupe_key), `marathons`, `quotes`
  - `lead_blocklist`, `notion_archive`, `daily_reports`, `bot_config`, `geo_cache`, `app_settings`
- **Görünümler:** `meetings_missing`, `meetings_awaiting_result`, `rivalry`.
- **Kısayol RPC'leri** (`t` = shortcut_token ile):
  - `sc_status`, `sc_next` (sırayı `call_queue(uid)` veriyor, `call_prefs`'e uyar, gece kilidi var, sonucu girilmemiş aramayı "pending" olarak döner)
  - `sc_result` (sonucu `apply_outcome` ile işler; `at_time` alanında "+2d / +1w / +3m / +1h" ya da ISO tarih kabul eder)
  - `sc_sync` (çevrimdışı sonuçlar ve liste), `sc_marathon_start`, `sc_marathon_end_empty`
- **Bot RPC'leri** (bot token ile): `bot_context`, `bot_check`, `bot_add_leads` (lat/lng kabul eder), `bot_block`, `bot_report`, `bot_record_sale`.
- **Widget RPC'si:** `widget_data(t)`.
- **Yardımcı fonksiyonlar:** `km()`, `parse_when()`, `apply_outcome()`, `call_queue()`.
- **Cron (pg_cron):**
  - Her dakika: `detect_escapes` (10 dk hareketsizlik = kaçış), `generate_notifications`, `send_push`, `event_notifications`
  - 5 dakikada bir: `potential_notifications`, `sales_digest`, `wa_notifications`
- **Yeni SQL fonksiyonu ekledikten sonra:** `notify pgrst, 'reload schema'`. Yoksa REST 404 döner.
- **Güvenlik:** RLS açık. Leads için `is_owner() or assigned_to = auth.uid()`. `profiles` tablosunda istemci sadece `full_name, phone, notify_quiet_*, call_prefs` kolonlarını güncelleyebilir.

### Satış kaydetme (sohbetten)
```bash
curl -s https://lzxkowlecpiwvbwrjqxs.supabase.co/rest/v1/rpc/bot_record_sale \
  -H "apikey: <publishable key>" -H "Content-Type: application/json" \
  -d '{"t":"<bot token>","name":"İşletme","amount":9000,"paid":9000,"on_date":"2026-11-28","pkg":"profesyonel","who":"burak","note":"..."}'
```

### Geliştirme döngüsü
```bash
npm i
npx tsc --noEmit -p . && npm run build                 # tip kontrolü + derleme
git push                                               # Cloudflare otomatik yayınlar; PWA birkaç dakikada kendini günceller
python3 scripts/sql.py supabase/0NN_yeni.sql           # göç uygula (sonra supabase/ altına commit et)
```
- **Ekran kontrolü:** `npx vite preview` + Playwright ile 390×844 (telefon) ve 1400×900 ekran görüntüsü al. Giriş için test hesabı yok, Burak'tan iste ya da Korhan'ın hesabıyla bakmak için izin al.
- **Kısayol değişikliği:**
  1. `shortcuts/*.cherri` düzenle.
  2. `CHERRI=... SHORTCUT_TOKEN_BURAK=... SHORTCUT_TOKEN_KORHAN=... ./shortcuts/build.sh`
  3. İmzasız dosyaları Burak'ın Mac'inde `~/Downloads/parobita-imza/` klasörüne koy (`ara_burak.shortcut`, `ara_korhan.shortcut`, `senkron_*.shortcut`).
  4. Burak `bash ~/Downloads/parobita-imza/imzala.command` çalıştırır.
- **Cherri notları:** `#include 'actions/...'` gerekiyor. Sözlük değerleri tipli. Metin içinde süslü parantezli JSON derlemeyi bozuyor; çevrimdışı dosyalar bu yüzden `¦` ile ayrılmış satırlar kullanıyor. `run()` bir girdi değişkeni istiyor.

---

## /areas — Diğer bağlam (kısaca)
- **Müşteri siteleri:** Lovable ile yapılıyor, sonra GitHub repo üzerinden düzenleniyor. Örnekler: Optik Lenti (optiklenti.com.tr), Yaşar Optik (yasaroptik1986.com), Bergöz. Önce Parobita domaininde yayınlanıyor, sonra müşterinin domainine taşınıyor.
- **Bu sohbette başlayan, CRM dışı konular:** Pet shop'lara otomatik site satışı vaat eden bir Instagram reel'i (sonuç: büyük ölçüde satış hunisi, yüz yüze satış doğru yol). Küçük leadler için WhatsApp ile demo gönderme fikri. Telefon ve SMS yapay zekâ asistanı fikirleri. Hiçbiri karara bağlanmadı.

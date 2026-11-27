// Uygulama her öne geldiğinde yeni sürümü kontrol et; yeni sürüm devraldığında sayfayı yenile.
if ('serviceWorker' in navigator) {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    location.reload()
  })
  const check = () => { navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {}) }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && navigator.onLine) check() })
  setInterval(() => { if (navigator.onLine) check() }, 15 * 60 * 1000)
}
export {}

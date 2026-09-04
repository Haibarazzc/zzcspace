// Frontend visitor tracker.
// Sends a "view" event on load and on section change, plus "depth" events as the visitor
// scrolls, to /api/track (Vercel function) which writes them to the server log.
// Every event carries a per-visit `vid` so all events from one visit join together.

const ENDPOINT = '/api/track'

function send(payload: Record<string, unknown>) {
  const json = JSON.stringify(payload)
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon(ENDPOINT, new Blob([json], { type: 'application/json' }))) return
    }
  } catch { /* fall through to fetch */ }
  try {
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: true }).catch(() => {})
  } catch { /* offline / unsupported: drop silently */ }
}

const THRESHOLDS = [25, 50, 75, 90, 100]

let started = false

export function initTracker() {
  if (started) return // StrictMode dev double-mount guard
  started = true

  const vid = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
  const ref = document.referrer || ''
  const pagePath = () => location.pathname + location.search + location.hash

  let maxDepth = 0
  const fired = new Set<number>()

  const sendView = () => send({ type: 'view', vid, page: pagePath(), ref })
  const fireDepth = (th: number) => {
    if (!fired.has(th)) {
      fired.add(th)
      send({ type: 'depth', vid, page: pagePath(), depth: th })
    }
  }

  // True percent-scrolled (not percent-visible), rAF-throttled
  let ticking = false
  const measure = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      const h = document.documentElement
      const max = h.scrollHeight - h.clientHeight
      const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((h.scrollTop / max) * 100))) : 0
      if (pct > maxDepth) {
        maxDepth = pct
        THRESHOLDS.forEach((t) => { if (t <= maxDepth) fireDepth(t) })
      }
    })
  }

  let sentExit = false
  const onExit = () => {
    if (sentExit) return
    sentExit = true
    send({ type: 'depth', vid, page: pagePath(), depth: maxDepth })
  }
  const onVis = () => {
    if (document.visibilityState === 'hidden') onExit()
    else sentExit = false // user came back; allow a fresh final-depth on next exit
  }

  sendView()
  addEventListener('scroll', measure, { passive: true })
  addEventListener('resize', measure)
  addEventListener('hashchange', sendView) // section navigation on the one-pager
  addEventListener('pagehide', onExit)
  document.addEventListener('visibilitychange', onVis)
  measure()
}

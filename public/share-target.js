// "Share to Statement Swipe" on Android: the service worker's side. The generated service worker
// (vite-plugin-pwa) loads this file first. When Android shares a statement to the installed app, it
// POSTs the file to /share-target (see share_target in vite.config.ts). We keep the file in on-device
// Cache Storage and open the app, which picks it up (src/lib/shareTarget.ts). Nothing leaves the phone.
// The names below are repeated in src/lib/shareTarget.ts. Keep them in sync.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || url.pathname !== '/share-target') return
  event.respondWith(
    (async () => {
      try {
        const file = (await event.request.formData()).get('statement')
        if (file && typeof file !== 'string') {
          const cache = await caches.open('statement-swipe-shared')
          const headers = { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) }
          await cache.put('/shared-file', new Response(file, { headers }))
        }
      } catch {
        // Couldn't read or keep the file; the app still opens, on the Import screen.
      }
      return Response.redirect('/?shared', 303)
    })(),
  )
})

// مخزن د/محمد سلامه — Service Worker: تشغيل بدون إنترنت + الإشعارات
const VERSION = "v1.4.1";
const SHELL = `shell-${VERSION}`;
const FILES = [
  "./", "./index.html", "./styles.css", "./app.js", "./config.js",
  "./vendor/supabase.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/badge-96.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

// ملفات التطبيق: من النت لو متاح (عشان التحديثات توصل)، ولو مفيش نت من النسخة المحفوظة
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // طلبات السحابة يتعامل معاها التطبيق نفسه
  e.respondWith((async () => {
    const cache = await caches.open(SHELL);
    try {
      const res = await fetch(req, { cache: "no-cache" });
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === "navigate") return (await cache.match("./index.html")) || Response.error();
      return Response.error();
    }
  })());
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: "مخزن د/محمد سلامه", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "مخزن د/محمد سلامه", {
    body: d.body || "",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    dir: "rtl",
    lang: "ar",
    icon: "icons/icon-192.png",
    badge: "icons/badge-96.png",
    data: { url: d.url || "./" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        c.postMessage({ type: "open", url: target });
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});

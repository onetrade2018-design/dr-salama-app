// مخزن د/محمد سلامه — Service Worker: تشغيل بدون إنترنت + الإشعارات
const VERSION = "v2.6.1";
const SHELL = `shell-${VERSION}`;
const FILES = [
  "./", "./index.html", "./styles.css", "./app.js", "./config.js",
  "./vendor/supabase.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/badge-96.png",
  "./plex-arabic-400.woff2", "./plex-arabic-500.woff2", "./plex-arabic-600.woff2", "./plex-arabic-700.woff2", "./plex-latin-400.woff2", "./plex-latin-500.woff2", "./plex-latin-600.woff2", "./plex-latin-700.woff2",
  "./m2.webp", "./m1.webp", "./m0.webp", "./n1.webp", "./n2.webp",
];

self.addEventListener("install", (e) => {
  // كل ملف لوحده: لو ملف واحد ناقص على السيرفر، التحديث يكمل عادي ومايقفش
  e.waitUntil(caches.open(SHELL)
    .then((c) => Promise.allSettled(FILES.map((f) => c.add(new Request(f, { cache: "reload" })))))
    .then(() => self.skipWaiting()));
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

// إعدادات السحابة (نفس ملف التطبيق) عشان نبعت إيصال الاستلام
self.window = self;
try { importScripts("config.js"); } catch (err) { /* */ }

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: "مخزن د/محمد سلامه", body: e.data ? e.data.text() : "" }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || "مخزن د/محمد سلامه", {
      body: d.body || "",
      tag: d.tag || undefined,
      renotify: !!d.tag,
      dir: "rtl",
      lang: "ar",
      icon: "icons/icon-192.png",
      badge: "icons/badge-96.png",
      data: { url: d.url || "./" },
    });
    // إيصال استلام: السيرفر يعرف إن الإشعار وصل، ولو ما وصلش بيعيد الإرسال
    const cfg = self.APP_CONFIG;
    if (!cfg || !d.tag) return;
    try {
      const sub = await self.registration.pushManager.getSubscription();
      await fetch(cfg.url + "/rest/v1/rpc/push_ack", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.key, Authorization: "Bearer " + cfg.key },
        body: JSON.stringify({ p_tag: d.tag, p_endpoint: sub ? sub.endpoint : null }),
      });
    } catch (err) { /* مفيش نت: السيرفر هيعيد الإرسال */ }
  })());
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

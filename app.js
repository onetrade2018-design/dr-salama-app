/* مخزن د/محمد سلامه — تطبيق الموبايل */
(function () {
  "use strict";

  const CFG = window.APP_CONFIG;
  const sb = window.supabase.createClient(CFG.url, CFG.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "drsalama-auth" },
  });

  const $app = document.getElementById("app");
  const state = { me: null, offlineSince: null, installPrompt: null };

  // ================= أدوات =================
  // الخط فيه زخرفة لكلمة "محمد" بتظهر غريبة — بنكسرها بحرف وصل خفي (للعرض بس)
  const noLig = (t) => String(t).replace(/محمد/g, "مح\u200dمد");
  const esc = (s) => noLig(String(s == null ? "" : s)).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
  const money = (n) => nf0.format(Math.round(Number(n) || 0));
  const qty = (n) => nf2.format(Number(n) || 0);
  const abs = Math.abs;

  function fmtDate(d) {
    if (!d) return "";
    const s = String(d).slice(0, 10).split("-");
    return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : String(d);
  }
  function cairoToday() {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }
  function addDays(iso, n) {
    const d = new Date(iso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function dayName(iso) {
    return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
      .format(new Date(iso + "T12:00:00Z"));
  }
  function ago(ts) {
    if (!ts) return "—";
    const m = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
    if (m < 1) return "دلوقتي";
    const unit = (n, one, two, few, many) => n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`;
    if (m < 60) return "من " + unit(m, "دقيقة", "دقيقتين", "دقايق", "دقيقة");
    const h = Math.round(m / 60);
    if (h < 24) return "من " + unit(h, "ساعة", "ساعتين", "ساعات", "ساعة");
    return "من " + unit(Math.round(h / 24), "يوم", "يومين", "أيام", "يوم");
  }
  function balInfo(b) {
    b = Number(b) || 0;
    if (abs(b) < 0.5) return { cls: "zero", label: "خالص", text: "0" };
    return b > 0 ? { cls: "owe", label: "عليه", text: money(b) } : { cls: "credit", label: "له", text: money(-b) };
  }
  function balHtml(b, big) {
    const i = balInfo(b);
    return `<span class="bal ${i.cls}" ${big ? 'style="font-size:inherit"' : ""}><span class="num">${i.text}</span></span> <span class="bal-label">${i.label}</span>`;
  }
  const ROLE = { admin: "مدير النظام", manager: "مدير", sales: "مندوب مبيعات", pending: "في انتظار الموافقة" };
  const MOVE = { purchase: "شراء", sale: "بيع", sale_return: "مرتجع بيع", purchase_return: "مرتجع شراء", adjust: "تسوية جرد" };
  const INV = { sale: "فاتورة بيع", sale_return: "مرتجع بيع", purchase: "فاتورة شراء", purchase_return: "مرتجع شراء" };
  const isBoss = () => state.me && (state.me.role === "admin" || state.me.role === "manager");
  const isAdmin = () => state.me && state.me.role === "admin";

  const I = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
    people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c2 .7 3.2 2.5 3.6 5.2"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/></svg>',
    report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3"/></svg>',
    cust: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.9-3.6 3.7-5.6 7-5.6s6.1 2 7 5.6"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h11v10H3zM14 9h4l3 3.5V16h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/></svg>',
  };

  function toast(msg, ms = 2800) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), ms);
  }

  // أيقونة الحساب: نوعه (عميل/مورد/الاتنين) ولونها حسب الرصيد + تصنيفه
  function kindAvatar(p) {
    const b = Number(p.balance) || 0;
    const cls = b >= 0.5 ? "k-owe" : b <= -0.5 ? "k-credit" : "k-zero";
    const ico = p.is_customer && p.is_supplier ? I.swap : p.is_supplier ? I.truck : I.cust;
    return `<div class="avatar ${cls}">${ico}${p.abc ? `<i class="abc ${esc(p.abc)}">${esc(p.abc)}</i>` : ""}</div>`;
  }
  // رسم صغير لحركة آخر 12 شهر
  function sparkSvg(vals, color) {
    vals = (vals || []).map((v) => Math.max(0, Number(v) || 0));
    if (vals.length < 2 || !vals.some((v) => v > 0)) return "";
    const W = 64, H = 24, max = Math.max(...vals), n = vals.length;
    const pts = vals.map((v, i) => [W - (i / (n - 1)) * W, H - 2 - (v / max) * (H - 5)]);   // الأحدث على الشمال
    const d = pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ");
    const last = pts[n - 1];
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" style="--sc:${color || "#F57C00"}" aria-hidden="true"><path class="a" d="${d} L0 ${H} L${W} ${H} Z"/><path class="l" d="${d}"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2"/></svg>`;
  }
  const monthVals = (m) => (m || []).map((x) => (x && typeof x === "object" ? (x.sold != null ? x.sold : x.v) : x));
  // الأرقام بتعدّ لحد قيمتها (مرة واحدة لما الصفحة تفتح)
  function countUp(root) {
    if (state.quiet || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    (root || document).querySelectorAll("[data-count]").forEach((el) => {
      const to = Number(el.dataset.count) || 0;
      if (!to) return;
      const t0 = performance.now(), D = 900;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
        el.textContent = money(to * e);
        if (k < 1 && el.isConnected) requestAnimationFrame(step);
      };
      el.textContent = "0";
      requestAnimationFrame(step);
    });
  }
  // اسحب الشاشة لتحت عشان تحدّث
  (function pullToRefresh() {
    let y0 = null, dy = 0;
    const el = document.createElement("div");
    el.className = "ptr"; el.innerHTML = I.refresh;
    document.body.appendChild(el);
    addEventListener("touchstart", (e) => { y0 = state.me && window.scrollY <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
    addEventListener("touchmove", (e) => {
      if (y0 == null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      if (window.scrollY > 0) { y0 = null; el.style.transform = ""; return; }
      el.style.transition = "none";
      el.style.transform = `translateY(${Math.min(dy * 0.45, 76) - 60}px) rotate(${Math.round(dy * 2)}deg)`;
    }, { passive: true });
    addEventListener("touchend", () => {
      if (y0 == null) return;
      el.style.transition = "";
      if (dy > 120) {
        el.classList.add("go"); el.style.transform = "translateY(18px)";
        state.force = true; route(true);
        setTimeout(() => { state.force = false; el.classList.remove("go"); el.style.transform = ""; }, 1300);
      } else el.style.transform = "";
      y0 = null; dy = 0;
    });
  })();

  // ================= الاتصال بالسحابة + الحفظ للعمل بدون إنترنت =================
  const CACHE_PREFIX = "c1:";
  function cacheGet(k) {
    try { const v = localStorage.getItem(CACHE_PREFIX + k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function cachePut(k, v) {
    const rec = JSON.stringify({ t: Date.now(), v });
    if (rec.length > 1500000) return; // الكشوفات الضخمة جداً ما نحفظهاش
    try { localStorage.setItem(CACHE_PREFIX + k, rec); }
    catch (e) { cachePrune(); try { localStorage.setItem(CACHE_PREFIX + k, rec); } catch (e2) { /* تجاهل */ } }
  }
  function cachePrune() {
    try {
      const items = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) {
          let t = 0; try { t = JSON.parse(localStorage.getItem(k)).t; } catch (e) { /* */ }
          items.push([k, t]);
        }
      }
      items.sort((a, b) => a[1] - b[1]).slice(0, Math.ceil(items.length / 2)).forEach(([k]) => localStorage.removeItem(k));
    } catch (e) { /* */ }
  }
  function cacheClear() {
    try { Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* */ }
  }

  class AppError extends Error {
    constructor(msg, kind) { super(msg); this.kind = kind; }
  }
  function isNetErr(err) {
    const m = String((err && (err.message || err.details)) || err || "");
    return !navigator.onLine || /Failed to fetch|NetworkError|Load failed|network|fetch/i.test(m);
  }

  // يرجع { data, stale, at }
  // swr: لو البيانات محفوظة على الموبايل بنعرضها فوراً، ونجيب الجديد في الخلفية ونحدّث الشاشة لو اتغير حاجة
  const SWR_FRESH_MS = 20000;
  const inflight = new Set();
  let rerenderT = null;
  function scheduleRerender() {
    clearTimeout(rerenderT);
    rerenderT = setTimeout(() => {
      const y = window.scrollY;
      route(true);
      setTimeout(() => window.scrollTo(0, y), 60);
    }, 200);
  }
  function refreshInBackground(fn, args, key, cached) {
    if (inflight.has(key)) return;
    inflight.add(key);
    const hash = location.hash;
    sb.rpc(fn, args).then(({ data, error }) => {
      inflight.delete(key);
      if (error) { if (isNetErr(error)) setOffline(true); return; }
      setOffline(false);
      const changed = JSON.stringify(data) !== JSON.stringify(cached.v);
      cachePut(key, data);
      if (changed && location.hash === hash) scheduleRerender();
    }).catch(() => { inflight.delete(key); setOffline(true); });
  }

  async function call(fn, args = {}, opts = {}) {
    const key = fn + ":" + JSON.stringify(args);
    if (opts.swr && !state.force) {
      const c = cacheGet(key);
      if (c) {
        if (Date.now() - c.t > SWR_FRESH_MS) refreshInBackground(fn, args, key, c);
        return { data: c.v, stale: false, cached: true, at: c.t };
      }
    }
    try {
      const { data, error } = await sb.rpc(fn, args);
      if (error) {
        if (isNetErr(error)) throw error;
        const msg = error.code === "42501" ? "غير مسموح لك تشوف البيانات دي"
          : /statement timeout|57014/i.test((error.message || "") + error.code) ? "السيرفر اتأخر في الرد — اسحب الصفحة لتحت أو جرب تاني بعد شوية"
          : (error.message || "حصل خطأ");
        throw new AppError(msg, "server");
      }
      if (opts.cache !== false) cachePut(key, data);
      setOffline(false);
      return { data, stale: false };
    } catch (err) {
      if (err instanceof AppError) throw err;
      const c = cacheGet(key);
      setOffline(true);
      if (c) return { data: c.v, stale: true, at: c.t };
      throw new AppError("مفيش إنترنت والبيانات دي مش محفوظة على الموبايل قبل كده", "offline");
    }
  }

  function setOffline(off) {
    const was = !!state.offlineSince;
    state.offlineSince = off ? state.offlineSince || Date.now() : null;
    if (was !== off) renderOfflineBar();
  }
  function renderOfflineBar() {
    const bar = document.getElementById("offline-bar");
    if (!bar) return;
    bar.hidden = !state.offlineSince;
    bar.textContent = "بدون إنترنت — بتشوف آخر بيانات اتحفظت على الموبايل";
  }
  window.addEventListener("online", () => { setOffline(false); route(); });
  window.addEventListener("offline", () => setOffline(true));

  function staleNote(r) {
    return r && r.stale ? `<div class="card soft small">بيانات محفوظة ${esc(ago(r.at))} — هتتحدث أول ما النت يرجع</div>` : "";
  }

  // ================= الشاشة الأساسية =================
  function shell({ title, back, nav = true, actions = "" }, body) {
    const tab = navTab();
    $app.innerHTML = `
      <header class="topbar">
        ${back ? `<button class="icon-btn" id="back" aria-label="رجوع">${I.back}</button>` : ""}
        <h1>${esc(title)}</h1>
        ${actions}
      </header>
      <div id="offline-bar" class="offline-bar" hidden></div>
      <main id="main" class="${nav ? "" : "no-nav"}${state.quiet ? "" : " enter"}">${body}</main>
      ${nav ? `<nav class="bottomnav">
        ${navLink("#/", "الرئيسية", I.home, tab === "home")}
        ${navLink("#/parties", "العملاء", I.people, tab === "parties")}
        ${navLink("#/items", "الأصناف", I.box, tab === "items")}
        ${isBoss() ? navLink("#/reports", "التقارير", I.report, tab === "report") : ""}
        ${navLink("#/me", "حسابي", I.user, tab === "me")}
      </nav>` : ""}`;
    renderOfflineBar();
    const b = document.getElementById("back");
    if (b) b.onclick = goBack;
    return document.getElementById("main");
  }
  function navLink(href, label, icon, on) {
    return `<a href="${href}" class="${on ? "on" : ""}"><span class="pill">${icon}</span>${label}</a>`;
  }
  function navTab() {
    const h = location.hash;
    if (h.startsWith("#/part")) return "parties";
    if (h.startsWith("#/item")) return "items";
    if (/^#\/(report|week|month|stock|turnover|customers|alerts|settings)/.test(h)) return "report";
    if (h.startsWith("#/me") || h.startsWith("#/user")) return "me";
    if (h.startsWith("#/invoice")) return "";
    return "home";
  }
  function goBack() {
    if (history.state && history.state.d > 0) history.back();
    else location.hash = "#/";
  }
  const skRow = '<div class="sk-row"><div class="sk c"></div><div class="grow"><div class="sk l1"></div><div class="sk l2"></div></div><div class="sk v"></div></div>';
  const loading = `<div class="skel"><div class="sk-card">${skRow.repeat(4)}</div></div>`;
  const loadingHero = `<div class="skel"><div class="sk hero"></div><div class="sk-card">${skRow.repeat(3)}</div></div>`;
  const errBox = (e) => `<div class="err">${esc(e.message || e)}</div>`;
  const empty = (msg) => `<div class="empty">${I.search}<div>${esc(msg)}</div></div>`;

  // ================= الدخول =================
  function renderAuth(mode = "login", msg = "") {
    $app.innerHTML = `
      <div class="auth-wrap">
        <div class="brand">
          <img src="icons/icon-192.png" alt="">
          <h1>مخزن د/مح&zwj;مد سلامه</h1>
          <div class="muted">الأرصدة والأصناف والتقرير اليومي</div>
        </div>
        <div class="tabs">
          <button data-m="login" class="${mode === "login" ? "on" : ""}">تسجيل الدخول</button>
          <button data-m="signup" class="${mode === "signup" ? "on" : ""}">حساب جديد</button>
        </div>
        ${msg}
        <form id="authf" class="card" novalidate>
          ${mode === "signup" ? `
            <label class="field"><span>الاسم</span><input class="input" name="name" required autocomplete="name"></label>
            <label class="field"><span>رقم الموبايل</span><input class="input" name="phone" type="tel" inputmode="tel" autocomplete="tel"></label>` : ""}
          <label class="field"><span>الإيميل</span><input class="input" name="email" type="email" required autocomplete="email" inputmode="email"></label>
          <label class="field"><span>كلمة السر</span><input class="input" name="password" type="password" required minlength="6" autocomplete="${mode === "signup" ? "new-password" : "current-password"}"></label>
          <div id="autherr"></div>
          <button class="btn" type="submit">${mode === "signup" ? "إنشاء الحساب" : "دخول"}</button>
        </form>
        ${mode === "signup" ? `<p class="muted small center">أول حساب يتعمل بيبقى مدير النظام. أي حساب بعد كده بيستنى موافقة المدير.</p>` : ""}
      </div>`;
    $app.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => renderAuth(b.dataset.m)));
    const f = document.getElementById("authf");
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(f);
      const email = String(fd.get("email") || "").trim();
      const password = String(fd.get("password") || "");
      const errEl = document.getElementById("autherr");
      errEl.innerHTML = "";
      if (!email || password.length < 6) { errEl.innerHTML = errBox("اكتب الإيميل وكلمة سر 6 حروف أو أكتر"); return; }
      const btn = f.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        if (mode === "signup") {
          const name = String(fd.get("name") || "").trim();
          if (!name) throw new Error("اكتب الاسم");
          const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name, phone: String(fd.get("phone") || "").trim() } } });
          if (error) throw error;
          if (!data.session) {
            renderAuth("login", `<div class="card soft">اتعمل الحساب ✅ افتح الإيميل بتاعك واضغط على رابط التأكيد، وبعدين ادخل من هنا.</div>`);
            return;
          }
        } else {
          const { error } = await sb.auth.signInWithPassword({ email, password });
          if (error) throw error;
        }
        await boot();
      } catch (e) {
        errEl.innerHTML = errBox(authMsg(e));
        btn.disabled = false;
      }
    };
  }
  function authMsg(e) {
    const m = String(e && e.message || e);
    if (/Invalid login credentials/i.test(m)) return "الإيميل أو كلمة السر غلط";
    if (/Email not confirmed/i.test(m)) return "لازم تأكد الإيميل الأول — افتح الرسالة اللي جاتلك";
    if (/already registered|already exists/i.test(m)) return "الإيميل ده عليه حساب بالفعل — ادخل من تسجيل الدخول";
    if (/Password should be/i.test(m)) return "كلمة السر لازم تكون 6 حروف أو أكتر";
    if (/rate limit/i.test(m)) return "محاولات كتير — استنى دقيقة وجرب تاني";
    if (isNetErr(e)) return "مفيش إنترنت";
    return m;
  }

  function renderPending() {
    $app.innerHTML = `
      <div class="auth-wrap">
        <div class="brand"><img src="icons/icon-192.png" alt=""><h1>مخزن د/مح&zwj;مد سلامه</h1></div>
        <div class="card center stack">
          <h2>حسابك مستني موافقة المدير</h2>
          <p class="muted">أول ما المدير يفعّل حسابك ويحدد صلاحيتك، هتقدر تدخل على البيانات.</p>
          <button class="btn" id="recheck">${I.refresh} تحديث</button>
          <button class="btn ghost" id="logout">تسجيل الخروج</button>
        </div>
      </div>`;
    document.getElementById("recheck").onclick = boot;
    document.getElementById("logout").onclick = logout;
  }

  async function logout() {
    try { await unsubscribePush(true); } catch (e) { /* */ }
    await sb.auth.signOut().catch(() => {});
    cacheClear();
    state.me = null;
    location.hash = "#/";
    renderAuth();
  }

  // ================= مشاركة كصورة (واتساب) =================
  const shareBtn = `<button class="icon-btn share" id="share" aria-label="مشاركة كصورة" disabled>${I.share}</button>`;
  function wireShare(fn) {
    const b = document.getElementById("share");
    if (!b) return;
    b.disabled = false;
    b.onclick = async () => {
      if (b.dataset.busy) return;
      b.dataset.busy = "1";
      try { await fn(); } catch (e) { if (e && e.name !== "AbortError") toast("ماقدرتش أعمل الصورة: " + (e.message || e)); }
      delete b.dataset.busy;
    };
  }
  let logoImg = null;
  function loadLogo() {
    if (logoImg) return Promise.resolve(logoImg);
    return new Promise((res) => { const im = new Image(); im.onload = () => res((logoImg = im)); im.onerror = () => res(null); im.src = "icons/icon-192.png"; });
  }
  // spec: { title, sub, hero:{label,value,note,color}, badge:{text,color}, kpis:[{l,v,s,c}], lists:[{title, rows:[{l,s,v,c}]}], file }
  async function shareImage(spec) {
    const F = '"Plex Arabic", "Noto Sans Arabic", Tahoma, sans-serif';
    try { await Promise.all([document.fonts.load(`700 40px ${F}`), document.fonts.load(`400 30px ${F}`), document.fonts.load(`600 30px ${F}`)]); } catch (e) { /* */ }
    const logo = await loadLogo();
    const W = 1080, P = 56, GAP = 24;
    const kpis = spec.kpis || [], lists = (spec.lists || []).filter((l) => l.rows && l.rows.length);
    const kRows = Math.ceil(kpis.length / 2);
    let H = 300 + (spec.hero ? 250 + GAP : 0) + (kpis.length ? kRows * (176 + GAP) : 0);
    lists.forEach((l) => (H += 90 + l.rows.length * 96 + GAP));
    H += 110;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const x = cv.getContext("2d");
    x.direction = "rtl";
    const font = (w, sz) => (x.font = `${w} ${sz}px ${F}`);
    const rr = (X, Y, w, h, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
    const fit = (t, maxW) => { t = String(t == null ? "" : t); if (x.measureText(t).width <= maxW) return t; while (t.length > 1 && x.measureText(t + "…").width > maxW) t = t.slice(0, -1); return t + "…"; };
    const txt = (t, X, Y, align, color, ltr) => { x.fillStyle = color; x.textAlign = align; x.direction = ltr ? "ltr" : "rtl"; x.fillText(ltr ? "\u2066" + t + "\u2069" : noLig(t), X, Y); x.direction = "rtl"; };
    // الخلفية
    x.fillStyle = "#EEF2F7"; x.fillRect(0, 0, W, H);
    // الهيدر الكحلي
    const g = x.createLinearGradient(W, 0, 0, 260); g.addColorStop(0, "#1D4E86"); g.addColorStop(0.55, "#12345C"); g.addColorStop(1, "#0B2140");
    x.fillStyle = g; x.fillRect(0, 0, W, 260);
    x.strokeStyle = "rgba(255,255,255,.04)"; x.lineWidth = 1;
    for (let i = 0; i < W; i += 36) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 260); x.stroke(); }
    for (let i = 0; i < 260; i += 36) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
    const og = x.createLinearGradient(W, 0, 0, 0); og.addColorStop(0, "#F57C00"); og.addColorStop(0.6, "#FFB04D"); og.addColorStop(1, "rgba(255,176,77,0)");
    x.fillStyle = og; x.fillRect(0, 0, W, 8);
    if (logo) { x.save(); rr(W - P - 104, 64, 104, 104, 26); x.clip(); x.drawImage(logo, W - P - 104, 64, 104, 104); x.restore(); }
    font(700, 52); txt(fit(spec.title, W - 2 * P - 140), W - P - 128, 118, "right", "#FFFFFF");
    font(400, 30); txt(fit(spec.sub || "", W - 2 * P - 140), W - P - 128, 166, "right", "rgba(255,255,255,.72)");
    font(600, 26); txt("مخزن د/محمد سلامه", W - P, 226, "right", "#FFA347");
    if (spec.badge) {
      font(700, 30);
      const tw = x.measureText(noLig(spec.badge.text)).width, nw = spec.badge.num ? x.measureText(spec.badge.num).width + 14 : 0, bw = tw + nw + 56;
      rr(P, 196, bw, 50, 25); x.fillStyle = spec.badge.color; x.fill();
      txt(spec.badge.text, P + bw - 28, 231, "right", "#FFFFFF");
      if (spec.badge.num) txt(spec.badge.num, P + 28, 231, "left", "#FFFFFF", true);
    }
    let y = 300;
    const card = (X, Y, w, h) => { x.save(); x.shadowColor = "rgba(15,40,75,.10)"; x.shadowBlur = 24; x.shadowOffsetY = 6; rr(X, Y, w, h, 26); x.fillStyle = "#FFFFFF"; x.fill(); x.restore(); };
    if (spec.hero) {
      const h = spec.hero; card(P, y, W - 2 * P, 250);
      x.fillStyle = "#F57C00"; rr(W - P - 10, y + 40, 10, 170, 5); x.fill();
      font(600, 32); txt(h.label, W - P - 44, y + 74, "right", "#687586");
      font(700, 96); txt(h.value, W - P - 44, y + 178, "right", h.color || "#0B2140", true);
      if (h.note) { font(600, 30); txt(fit(h.note, 420), P + 40, y + 178, "left", h.noteColor || "#687586"); }
      y += 250 + GAP;
    }
    const cw = (W - 2 * P - GAP) / 2;
    kpis.forEach((k, i) => {
      const col = i % 2, X = col === 0 ? W - P - cw : P, Y = y + Math.floor(i / 2) * (176 + GAP);
      card(X, Y, cw, 176);
      font(600, 28); txt(fit(k.l, cw - 60), X + cw - 30, Y + 52, "right", "#687586");
      font(700, 52); txt(k.v, X + cw - 30, Y + 118, "right", k.c || "#1F2A37", true);
      if (k.s) { font(600, 26); txt(fit(k.s, cw - 60), X + cw - 30, Y + 156, "right", k.sc || "#687586"); }
    });
    if (kpis.length) y += kRows * (176 + GAP);
    lists.forEach((l) => {
      const h = 90 + l.rows.length * 96; card(P, y, W - 2 * P, h);
      x.fillStyle = "#F57C00"; rr(W - P - 40, y + 34, 8, 30, 4); x.fill();
      font(700, 34); txt(l.title, W - P - 58, y + 62, "right", "#1F2A37");
      l.rows.forEach((r, i) => {
        const ry = y + 90 + i * 96;
        x.fillStyle = "#E3E9F1"; x.fillRect(P + 30, ry, W - 2 * P - 60, 2);
        font(700, 34); const vw = x.measureText(String(r.v)).width;
        txt(String(r.v), P + 36, ry + 60, "left", r.c || "#1F2A37", true);
        font(600, 32); txt(fit(r.l, W - 2 * P - 120 - vw), W - P - 36, ry + (r.s ? 46 : 60), "right", "#1F2A37");
        if (r.s) { font(400, 25); txt(fit(r.s, W - 2 * P - 120 - vw), W - P - 36, ry + 82, "right", "#687586"); }
      });
      y += h + GAP;
    });
    const now = new Date(), stamp = `${fmtDate(cairoToday())} ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo" }).format(now)}`;
    font(400, 26); txt(`اتعمل من تطبيق مخزن د/محمد سلامه • ${stamp}`, W / 2, H - 50, "center", "#8A97A8");
    const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
    const file = new File([blob], (spec.file || "report") + ".png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: spec.title });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast("الصورة اتحفظت — ابعتها من الصور على واتساب");
    }
    return cv;
  }
  const pctTxt = (c, p) => { c = Number(c) || 0; p = Number(p) || 0; if (!p) return c ? "جديد" : ""; const v = Math.round((c - p) / p * 100); return v === 0 ? "زي اللي فات" : `${v > 0 ? "▲" : "▼"} ${Math.abs(v)}%`; };
  const pctCol = (c, p) => ((Number(c) || 0) >= (Number(p) || 0) ? "#2E7D32" : "#C62828");
  function shareDaily(d, date) {
    const t = d.totals || {};
    const sales = (d.sales || []).slice().sort((a, b) => (b.total || 0) - (a.total || 0)).slice(0, 6);
    const cols = (d.collections || []).slice().sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 5);
    return shareImage({
      title: "التقرير اليومي", sub: dayName(date), file: "daily-" + date,
      hero: { label: "المبيعات", value: money(t.sales), color: "#E2580C", note: `${t.sales_count || 0} فاتورة • آجل ${money(t.sales_credit)}` },
      kpis: [
        { l: "التحصيلات من العملاء", v: money(t.collections), c: "#2E7D32", s: `${t.collections_count || 0} سند` },
        { l: "المشتريات", v: money(t.purchases), s: `${t.purchases_count || 0} فاتورة` },
        { l: "سداد للموردين", v: money(t.supplier_payments), c: "#D9480F" },
        { l: "المرتجعات", v: money(t.sales_returns), s: `مرتجع شراء ${money(t.purchase_returns)}` },
      ],
      lists: [
        { title: "أكبر فواتير البيع", rows: sales.map((v) => ({ l: v.party, s: `فاتورة ${v.no} • ${(v.lines || []).length} صنف`, v: money(v.total) })) },
        { title: "أكبر التحصيلات", rows: cols.map((v) => ({ l: v.party, s: v.kind || "", v: money(v.amount), c: "#2E7D32" })) },
      ],
    });
  }
  function sharePeriod(w, isWeek, label, prevLabel) {
    const t = w.totals || {}, pv = w.prev || {};
    const ps = ["sales", "collections"].filter((k) => Number(pv[k]) > 0).map((k) => ((Number(t[k]) || 0) - Number(pv[k])) / Number(pv[k]) * 100);
    const avg = ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0;
    const lv = LV[lvOf(avg)];
    return shareImage({
      title: isWeek ? "التقرير الأسبوعي" : "التقرير الشهري", sub: label, file: (isWeek ? "week-" : "month-") + (w.prev_end || ""),
      badge: ps.length ? { text: lv.t, num: signPct(avg), color: lv.c } : null,
      hero: { label: "المبيعات", value: money(t.sales), color: "#E2580C", note: `${prevLabel}: ${money(pv.sales)}  ${pctTxt(t.sales, pv.sales)}`, noteColor: pctCol(t.sales, pv.sales) },
      kpis: [
        { l: "التحصيلات", v: money(t.collections), c: "#2E7D32", s: `${pctTxt(t.collections, pv.collections)} • قبلها ${money(pv.collections)}`, sc: pctCol(t.collections, pv.collections) },
        { l: "المشتريات", v: money(t.purchases), s: `${pctTxt(t.purchases, pv.purchases)} • قبلها ${money(pv.purchases)}` },
        { l: "فواتير البيع", v: String(t.sales_count || 0), s: `${t.customers || 0} عميل` },
        { l: "سداد للموردين", v: money(t.supplier_payments), c: "#D9480F" },
      ],
      lists: [
        { title: "أكبر العملاء", rows: (w.top_customers || []).slice(0, 5).map((c) => ({ l: c.name, s: `${c.invoices} فاتورة`, v: money(c.sales) })) },
        { title: "أكتر الأصناف مبيعاً", rows: (w.top_items || []).slice(0, 5).map((i) => ({ l: i.name, s: `اتباع ${qty(i.qty)} ${i.unit || ""}`, v: money(i.value) })) },
      ],
    });
  }
  async function shareParty(p, key) {
    let an = null;
    try { an = (await call("party_analysis", { p_key: key }, { swr: true })).data; } catch (e) { /* */ }
    const c = an && an.customer, bi = balInfo(p.balance);
    const hs = c && (c.last_inv || c.balance) ? healthScore(c) : null;
    const kpis = [];
    if (c) {
      kpis.push({ l: "مشترياته آخر 12 شهر", v: money(c.value_12), s: `${c.inv_12 || 0} فاتورة` });
      kpis.push({ l: "آخر دفعة", v: c.last_pay ? fmtDate(c.last_pay) : "—", s: c.pay_status === "overdue" ? `متأخر — ما دفعش من ${c.oldest_days} يوم` : `المهلة ${c.grace_days} يوم`, sc: c.pay_status === "overdue" ? "#C62828" : "#2E7D32" });
    }
    const st = (p.statement || []).slice(0, 7);
    return shareImage({
      title: p.name, sub: [p.customer_code ? `كود عميل ${p.customer_code}` : "", p.supplier_code ? `كود مورد ${p.supplier_code}` : ""].filter(Boolean).join(" • ") || "كشف حساب",
      file: "account-" + (p.customer_code || p.supplier_code || "x"),
      badge: hs ? { text: `صحة العميل: ${hs.label}`, num: String(hs.sc), color: hs.color } : null,
      hero: { label: bi.cls === "zero" ? "الحساب" : bi.label, value: bi.cls === "zero" ? "خالص" : bi.text, color: bi.cls === "owe" ? "#E2580C" : "#1E7FD8", note: p.last_date ? `آخر حركة ${fmtDate(p.last_date)}` : "" },
      kpis,
      lists: [{ title: "آخر الحركات", rows: st.map((m) => ({ l: `${m.kind || "حركة"}${m.ref ? " #" + m.ref : ""}`, s: fmtDate(m.d), v: m.debit > 0 ? "+" + money(m.debit) : "−" + money(m.credit), c: m.debit > 0 ? "#D9480F" : "#2E7D32" })) }],
    });
  }

  // ================= الرئيسية =================
  async function viewHome() {
    const today = cairoToday();
    const hr = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Cairo" }).format(new Date()));
    const greet = hr < 12 ? "صباح الخير" : "مساء الخير";
    const boss = isBoss();
    const main = shell({ title: "مخزن د/محمد سلامه" }, `
      <section class="hero-card home-hero">
        <div class="hh-top">
          <div class="grow"><div class="lbl">${greet}، ${esc(state.me.name || "")}</div><div class="hh-date">${esc(dayName(today))}</div></div>
          <button class="sync-pill" id="syncp" type="button"><i class="status-dot"></i><span>بنشوف آخر تحديث…</span></button>
        </div>
        ${boss ? `<div id="hhBody"><div class="hh-main"><div class="lbl">مبيعات النهارده</div><div class="big num">—</div></div></div>` : `<div class="hh-role"><span class="tag">${esc(ROLE[state.me.role] || "")}</span></div>`}
      </section>
      <form class="search" id="qform" role="search">
        ${I.search}
        <input class="input" id="q" type="search" placeholder="ابحث عن عميل أو مورد أو صنف" autocomplete="off">
      </form>
      <div id="qres"></div>
      <div id="alerts"></div>
      <div id="install"></div>
      <div id="push"></div>
      <div id="today"></div>`);
    const qi = document.getElementById("q");
    const homeBlocks = ["alerts", "install", "push", "today"].map((x) => document.getElementById(x));
    let qt, qseq = 0;
    const qsearch = async () => {
      const v = qi.value.trim();
      const box = document.getElementById("qres");
      if (!box) return;
      homeBlocks.forEach((b) => (b.hidden = !!v));
      if (!v) { box.innerHTML = ""; return; }
      const my = ++qseq;
      box.innerHTML = loading;
      const [pr, ir] = await Promise.all([
        call("search_parties", { p_q: v, p_limit: 6 }).catch((e) => ({ err: e })),
        call("search_items", { p_q: v, p_limit: 6 }).catch((e) => ({ err: e })),
      ]);
      if (my !== qseq || !document.getElementById("qres")) return;
      const ps = pr.data || [], is = ir.data || [];
      if (pr.err && ir.err) { box.innerHTML = errBox(pr.err); return; }
      box.innerHTML = (!ps.length && !is.length) ? empty("مفيش نتايج") : `
        ${ps.length ? `<div class="section-title"><span>العملاء والموردين</span><a class="small" href="#/parties" data-keep="${boss ? "t-parties-q" : "q-parties"}">الكل</a></div><div class="list">${ps.map(partyRow).join("")}</div>` : ""}
        ${is.length ? `<div class="section-title"><span>الأصناف</span><a class="small" href="#/items" data-keep="t-items-q">الكل</a></div><div class="list">${is.map(itemRow).join("")}</div>` : ""}`;
    };
    qi.oninput = () => { clearTimeout(qt); qt = setTimeout(qsearch, 300); };
    document.getElementById("qres").onclick = (e) => {
      const a = e.target.closest("[data-keep]");
      if (a) sessionStorage.setItem(a.dataset.keep, qi.value.trim());
    };
    document.getElementById("qform").onsubmit = (e) => { e.preventDefault(); clearTimeout(qt); qsearch(); qi.blur(); };

    renderInstallCard();
    if (boss) renderPushCard(document.getElementById("push"));

    // حالة المزامنة: سطر صغير جوه اللوحة
    call("app_sync_status", {}, { swr: true }).then((r) => {
      const st = r.data || {};
      const mins = st.last_sync ? (Date.now() - new Date(st.last_sync).getTime()) / 60000 : 1e9;
      const cls = mins <= 15 ? "ok" : mins <= 120 ? "warn" : "bad";
      const el = document.getElementById("syncp");
      if (!el) return;
      el.className = "sync-pill " + cls;
      el.innerHTML = `<i class="status-dot ${cls}"></i><span>${cls === "ok" ? "محدّث" : "آخر تحديث"} ${esc(ago(st.last_sync))}</span>`;
      el.onclick = () => toast(cls === "bad" ? "جهاز الحسابات ما بعتش بيانات من فترة — ممكن يكون مقفول أو النت فاصل عنده" : `آخر بيانات وصلت من جهاز الحسابات ${ago(st.last_sync)}`, 4000);
    }).catch(() => {});

    if (!boss) return;
    call("alerts_list", {}, { swr: true }).then((r) => {
      const a = r.data || {}, el = document.getElementById("alerts");
      if (!el) return;
      const parts = [
        [a.overdue_customers, "متأخر سداد", "o"], [a.below_safety, "تحت الأمان", "o"], [a.out_no_restock, "خلص", "r"],
        [a.supplier_dues, "مستحق لمورد", "b"], [a.late_buyers, "متأخر شراء", "g"], [a.season_soon, "موسمه قرب", "g"],
      ].filter(([l]) => l && l.length);
      if (!parts.length) { el.innerHTML = `<div class="alert-strip ok"><span class="as-ico">${hubIcon.bell}</span><div class="grow"><b>مفيش تنبيهات</b><div class="small muted">كل حاجة تمام دلوقتي</div></div></div>`; return; }
      el.innerHTML = `<a class="alert-strip" href="#/alerts"><span class="as-ico">${hubIcon.bell}</span>
        <div class="as-pills">${parts.map(([l, t, c]) => `<span class="ap ${c}"><b class="num">${l.length}</b>${t}</span>`).join("")}</div>${I.chev}</a>`;
    }).catch(() => {});

    const el = document.getElementById("today");
    el.innerHTML = `
      <div class="section-title"><span>تفاصيل النهارده</span><a class="small" href="#/report/${addDays(today, -1)}">الأيام اللي فاتت</a></div>
      <div id="todayBody">${loading}</div>`;
    const lastWeek = addDays(today, -7), yest = addDays(today, -1);
    const [tr, lw, ys] = await Promise.all([
      call("daily_report", { p_date: today }, { swr: true }).catch((e) => ({ err: e })),
      call("daily_report", { p_date: lastWeek }, { swr: true }).catch(() => ({})),
      call("daily_report", { p_date: yest }, { swr: true }).catch(() => ({})),
    ]);
    const box = document.getElementById("todayBody");
    if (!box) return;
    if (tr.err) { box.innerHTML = errBox(tr.err); return; }
    box.innerHTML = reportBody(tr, today, false, { noHero: true });
    const t = (tr.data && tr.data.totals) || {}, lt = (lw.data && lw.data.totals) || {}, yt = (ys.data && ys.data.totals) || {};
    const custs = new Set(((tr.data && tr.data.sales) || []).map((x) => x.party)).size;
    const hb = document.getElementById("hhBody");
    if (!hb) return;
    const wd = WEEKDAY(lastWeek);
    if (!t.sales_count && !t.collections_count) {
      hb.innerHTML = `<div class="hh-main"><div class="lbl">مبيعات النهارده</div><div class="hh-empty">لسه مافيش فواتير النهارده</div></div>
        <div class="hh-stats">
          <div><span>مبيعات امبارح</span><b class="num">${money(yt.sales)}</b></div>
          <div><span>تحصيلات امبارح</span><b class="num">${money(yt.collections)}</b></div>
          <div><span>${esc(wd)} اللي فات</span><b class="num">${money(lt.sales)}</b></div>
        </div>`;
      return;
    }
    const ref = Number(lt.sales) || 0, pct = ref > 0 ? Math.round((Number(t.sales) || 0) / ref * 100) : null;
    hb.innerHTML = `
      <div class="hh-main">
        <div class="lbl">مبيعات النهارده</div>
        <div class="big num" data-count="${Math.round(Number(t.sales) || 0)}">${money(t.sales)}</div>
        ${pct != null ? `<div class="hh-prog"><div class="bar"><i style="width:${Math.min(100, pct)}%"></i></div>
          <span>${pct >= 100 ? `عدّينا ${esc(wd)} اللي فات (<b class="num">${pct}%</b>)` : `<b class="num">${pct}%</b> من مبيعات ${esc(wd)} اللي فات`} • <span class="num">${money(ref)}</span></span></div>` : ""}
      </div>
      <div class="hh-stats">
        <div><span>التحصيلات</span><b class="num" data-count="${Math.round(Number(t.collections) || 0)}">${money(t.collections)}</b></div>
        <div><span>فواتير</span><b class="num">${t.sales_count || 0}</b></div>
        <div><span>عملاء</span><b class="num">${custs}</b></div>
      </div>`;
    countUp(hb);
  }

  // ================= العملاء والموردين =================
  function initial(name) {
    const n = String(name || "").replace(/^\s*(شركة|شركه|مؤسسة|مؤسسه|مكتب|معمل|عيادة|عياده|مركز|د|دكتور|دكتوره)\s*[\/.]?\s*/, "").replace(/^ال(?=\S{2})/, "").trim();
    return n.charAt(0) || "؟";
  }
  function partyRow(p) {
    const kind = p.is_customer && p.is_supplier ? "عميل ومورد" : p.is_supplier ? "مورد" : "عميل";
    const code = p.customer_code || p.supplier_code || "";
    return `<a class="list-item" href="#/party/${encodeURIComponent(p.key)}">
      ${kindAvatar(p)}
      <div class="grow">
        <div class="title ellipsis">${esc(p.name)}</div>
        <div class="sub">${kind} • كود <span class="num">${esc(code)}</span>${p.last_date ? ` • آخر حركة ${fmtDate(p.last_date)}` : ""}</div>
      </div>
      <div class="end">${balHtml(p.balance)}</div>
    </a>`;
  }

  function viewPartiesSimple() {
    const filters = [["all", "الكل"], ["owe", "عليهم فلوس"], ["credit", "ليهم فلوس"], ["c", "عملاء"], ["s", "موردين"]];
    let filter = sessionStorage.getItem("f-parties") || "all";
    const main = shell({ title: "العملاء والموردين" }, `
      <div class="search">${I.search}<input class="input" id="q" type="search" placeholder="اسم، كود، أو رقم موبايل" autocomplete="off"></div>
      <div class="chips" id="chips">${filters.map(([k, l]) => `<button class="chip ${k === filter ? "on" : ""}" data-f="${k}">${l}</button>`).join("")}</div>
      <div id="res">${loading}</div>`);
    const q = document.getElementById("q");
    q.value = sessionStorage.getItem("q-parties") || "";
    let data = [], stale = null, seq = 0;
    const draw = () => {
      const res = document.getElementById("res");
      if (!res) return;
      const rows = data.filter((p) =>
        filter === "all" ? true : filter === "owe" ? p.balance >= 0.5 : filter === "credit" ? p.balance <= -0.5 :
        filter === "c" ? p.is_customer : p.is_supplier);
      res.innerHTML = staleNote(stale) + (rows.length ? `<div class="list">${rows.map(partyRow).join("")}</div>` : empty("مفيش نتايج"));
    };
    const load = async () => {
      const my = ++seq;
      const v = q.value.trim();
      sessionStorage.setItem("q-parties", v);
      try {
        const r = await call("search_parties", { p_q: v, p_limit: v ? 60 : 120 });
        if (my !== seq) return;
        data = r.data || []; stale = r; draw();
      } catch (e) { const res = document.getElementById("res"); if (my === seq && res) res.innerHTML = errBox(e); }
    };
    let t; q.oninput = () => { clearTimeout(t); t = setTimeout(load, 300); };
    document.getElementById("chips").onclick = (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      filter = b.dataset.f; sessionStorage.setItem("f-parties", filter);
      document.querySelectorAll("#chips .chip").forEach((c) => c.classList.toggle("on", c === b));
      draw();
    };
    load();
  }

  async function viewParty(key) {
    const main = shell({ title: "كشف حساب", back: true, actions: shareBtn }, loadingHero);
    let r;
    try { r = await call("party_detail", { p_key: key }, { swr: true }); }
    catch (e) { main.innerHTML = errBox(e); return; }
    const p = r.data;
    document.querySelector(".topbar h1").textContent = p.name;
    const kind = p.is_customer && p.is_supplier ? "عميل ومورد" : p.is_supplier ? "مورد" : "عميل";
    const bi = balInfo(p.balance);
    const st = p.statement || [];
    const linked = p.is_customer && p.is_supplier;
    main.innerHTML = `
      ${staleNote(r)}
      <div class="hero-card item-hero party-hero">
        <div class="lbl">${kind}</div>
        <div class="ih-row">
          <div class="ih-name">${esc(p.name)}</div>
          <div class="ih-stock bal-${bi.cls}"><b class="num">${bi.cls === "zero" ? "0" : bi.text}</b><span>${bi.cls === "zero" ? "خالص" : bi.label}</span></div>
        </div>
        <div class="meta">
          ${p.customer_code ? `<span>كود عميل <b class="num">${esc(p.customer_code)}</b></span>` : ""}
          ${p.supplier_code ? `<span>كود مورد <b class="num">${esc(p.supplier_code)}</b></span>` : ""}
          ${p.phone ? `<a href="tel:${esc(p.phone)}" class="num">${esc(p.phone)}</a>` : ""}
          ${p.city ? `<span>${esc(p.city)}</span>` : ""}
        </div>
        <div class="meta">
          ${p.last_date ? `<span>آخر حركة ${fmtDate(p.last_date)}</span>` : ""}
          ${p.grace_days ? `<span>مهلة السداد ${esc(p.grace_days)} يوم</span>` : ""}
          ${p.credit_limit ? `<span>حد الائتمان <span class="num">${money(p.credit_limit)}</span></span>` : ""}
        </div>
      </div>
      <div id="pana"></div>
      <div class="section-title"><span>كشف الحساب</span><small>${st.length} حركة • الأحدث فوق</small></div>
      <div class="list" id="stmt"></div>
      <div class="more" id="more"></div>`;
    renderPartyAnalysis(document.getElementById("pana"), key);
    wireShare(() => shareParty(p, key));
    const PAGE = 60;
    let shown = 0;
    const stmt = document.getElementById("stmt");
    const more = document.getElementById("more");
    const drawMore = () => {
      const part = st.slice(shown, shown + PAGE);
      stmt.insertAdjacentHTML("beforeend", part.map((m) => stmtRow(m, linked)).join(""));
      shown += part.length;
      more.innerHTML = shown < st.length ? `<button class="btn ghost">عرض ${Math.min(PAGE, st.length - shown)} حركة أقدم</button>` : "";
      const b = more.querySelector("button"); if (b) b.onclick = drawMore;
    };
    if (!st.length) stmt.outerHTML = empty("مفيش حركات");
    else drawMore();
  }

  function stmtRow(m, linked) {
    let type = null;
    if (m.ref && m.kind === "فاتورة") type = m.side === "s" ? "purchase" : "sale";
    else if (m.ref && m.kind === "مرتجع") type = m.side === "s" ? "purchase_return" : "sale_return";
    const amt = m.debit > 0 ? `<span class="minus num">+${money(m.debit)}</span>` : `<span class="plus num">−${money(m.credit)}</span>`;
    const bi = balInfo(m.bal);
    const sideTag = linked ? `<span class="tag ${m.side === "s" ? "gray" : ""}">${m.side === "s" ? "كمورد" : "كعميل"}</span>` : "";
    const inner = `
      <div class="t">${esc(m.kind || "حركة")}${m.ref ? ` <span class="num muted">#${esc(m.ref)}</span>` : ""} ${sideTag}</div>
      <div class="amt">${amt}</div>
      <div class="d">${fmtDate(m.d)}${m.descr ? " • " + esc(m.descr) : ""}${type ? " • اضغط للتفاصيل" : ""}</div>
      <div class="run">الرصيد <span class="num">${bi.text}</span> ${bi.cls === "zero" ? "" : bi.label}</div>`;
    return type ? `<a class="mv" href="#/invoice/${type}/${encodeURIComponent(m.ref)}">${inner}</a>` : `<div class="mv">${inner}</div>`;
  }


  // ================= قوايم مرتبة (العملاء والموردين / الأصناف) =================
  function rankAvatar(i) { return `<div class="avatar rank${i < 3 ? " top" : ""}">${i + 1}</div>`; }

  function tabbedList({ title, tabs, storeKey, placeholder, searchFn, searchRow, loadTab }) {
    let tab = sessionStorage.getItem(storeKey) || tabs[0][0];
    if (!tabs.some((t) => t[0] === tab)) tab = tabs[0][0];
    shell({ title }, `
      <div class="search">${I.search}<input class="input" id="q" type="search" placeholder="${esc(placeholder)}" autocomplete="off"></div>
      <div class="tabs tabs-${tabs.length}" id="ltabs">${tabs.map(([k, l]) => `<button data-k="${k}" class="${k === tab ? "on" : ""}">${l}</button>`).join("")}</div>
      <div id="res">${loading}</div>`);
    const q = document.getElementById("q");
    const qKey = storeKey + "-q";
    q.value = sessionStorage.getItem(qKey) || "";
    let seq = 0, t;
    const load = async () => {
      const my = ++seq, v = q.value.trim();
      sessionStorage.setItem(qKey, v);
      const res = document.getElementById("res");
      document.getElementById("ltabs").style.display = v ? "none" : "";
      try {
        let html;
        if (v) {
          const r = await call(searchFn, { p_q: v, p_limit: 60 });
          html = staleNote(r) + ((r.data || []).length ? `<div class="list">${r.data.map(searchRow).join("")}</div>` : empty("مفيش نتايج"));
        } else {
          html = await loadTab(tab);
        }
        if (my === seq && document.getElementById("res")) document.getElementById("res").innerHTML = html;
      } catch (e) { if (my === seq && res && document.body.contains(res)) res.innerHTML = errBox(e); }
    };
    q.oninput = () => { clearTimeout(t); t = setTimeout(load, 300); };
    document.getElementById("ltabs").onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      tab = b.dataset.k; sessionStorage.setItem(storeKey, tab);
      document.querySelectorAll("#ltabs button").forEach((x) => x.classList.toggle("on", x === b));
      document.getElementById("res").innerHTML = loading;
      load();
    };
    load();
  }

  function viewItems() {
    const boss = isBoss();
    const row = {
      top: (i, n) => `<a class="list-item" href="#/item/${encodeURIComponent(i.code)}">${rankAvatar(n)}
        <div class="grow"><div class="title ellipsis">${esc(i.name)}</div>
        <div class="sub">اتباع <b class="num">${qty(i.sold_365)}</b> ${esc(i.unit || "")} في سنة • آخر 3 شهور <span class="num">${qty(i.sold_90)}</span> • رصيد <span class="num ${i.stock <= 0 ? "minus" : ""}">${qty(i.stock)}</span></div></div>
        <div class="end">${i.value_365 != null ? `<div class="bal val-pill num">${money(i.value_365)}</div><div class="bal-label">مبيعات سنة</div>` : `<div class="bal val-pill num">${qty(i.sold_365)}</div><div class="bal-label">اتباع</div>`}</div></a>`,
      dead: (i, n) => `<a class="list-item" href="#/item/${encodeURIComponent(i.code)}">${rankAvatar(n)}
        <div class="grow"><div class="title ellipsis">${esc(i.name)}</div>
        <div class="sub">رصيد <b class="num">${qty(i.stock)}</b> ${esc(i.unit || "")} • ${i.last_sale ? `آخر بيع ${fmtDate(i.last_sale)}` : "ما اتباعش خالص"}</div></div>
        <div class="end">${i.stock_value != null ? `<div class="bal owe num">${money(i.stock_value)}</div><div class="bal-label">قيمة واقفة</div>` : `<div class="bal num">${qty(i.stock)}</div>`}</div></a>`,
      risk: (i, n) => `<a class="list-item" href="#/item/${encodeURIComponent(i.code)}">${rankAvatar(n)}
        <div class="grow"><div class="title ellipsis">${esc(i.name)}</div>
        <div class="sub">${tagStatus(i.status)} رصيد <b class="num">${qty(i.stock)}</b> ${esc(i.unit || "")}${i.days_cover != null ? ` • يكفي <span class="num">${qty(i.days_cover)}</span> يوم` : ""} • اتباع <span class="num">${qty(i.sold_365)}</span> في سنة</div></div>
        <div class="end">${i.suggest_qty > 0 ? `<div class="bal owe num">${qty(i.suggest_qty)}</div><div class="bal-label">اطلب</div>` : `<div class="bal val-pill num">${money(i.value_365)}</div><div class="bal-label">مبيعات سنة</div>`}</div></a>`,
      out: (i, n) => `<a class="list-item" href="#/item/${encodeURIComponent(i.code)}">${rankAvatar(n)}
        <div class="grow"><div class="title ellipsis">${esc(i.name)}</div>
        <div class="sub"><span class="tag red">خلص</span> ${i.days_out > 0 ? `${daysTxt(i.days_out)} • ` : ""}اتباع <span class="num">${qty(i.sold_365)}</span> ${esc(i.unit || "")} في سنة${i.last_sale ? ` • آخر بيع ${fmtDate(i.last_sale)}` : ""}</div></div>
        <div class="end">${i.suggest_qty > 0 ? `<div class="bal owe num">${qty(i.suggest_qty)}</div><div class="bal-label">اطلب</div>` : `<div class="bal val-pill num">${money(i.value_365)}</div><div class="bal-label">مبيعات سنة</div>`}</div></a>`,
      turnover: (i, n) => `<a class="list-item" href="#/item/${encodeURIComponent(i.code)}">${rankAvatar(n)}
        <div class="grow"><div class="title ellipsis">${esc(i.name)}</div>
        <div class="sub">بيع شهري <span class="num">${qty(i.avg_month)}</span> • رصيد <span class="num ${i.stock <= 0 ? "minus" : ""}">${qty(i.stock)}</span>${i.days_cover != null && i.stock > 0 ? ` • يكفي <span class="num">${qty(i.days_cover)}</span> يوم` : ""}</div></div>
        <div class="end"><div class="bal val-pill num">${turnTxt(i.turnover_365)}</div><div class="bal-label">مرة في السنة</div></div></a>`,
    };
    const notes = {
      top: "مترتبين من الأكثر مبيعاً للأقل (قيمة المبيعات آخر 12 شهر)",
      dead: "عليهم رصيد وما اتباعوش من شهر أو أكتر (المدة بتتغير من إعدادات التحليل) — مترتبين بقيمة البضاعة الواقفة",
      risk: "لسه فيهم رصيد بس نزلوا تحت مخزون الأمان أو وصلوا حد الطلب — مترتبين بالأكثر مبيعاً، والرقم على الشمال هو الكمية المقترحة للطلب",
      out: "رصيدهم خلص (صفر أو بالسالب) — مترتبين بالأكثر مبيعاً عشان تجيب المهم الأول",
      turnover: "أسرع أصناف بتتباع وتتجدد في المخزن (معدل الدوران آخر 12 شهر)",
    };
    tabbedList({
      title: "الأصناف",
      tabs: [["top", "الأكثر مبيعاً"], ["risk", "قرب يخلص"], ["out", "خلص"], ["dead", "الراكد"]],
      storeKey: "t-items", placeholder: "اسم الصنف، الكود، أو الباركود",
      searchFn: "search_items", searchRow: itemRow,
      loadTab: async (k) => {
        const r = await call("items_list", { p_kind: k, p_limit: k === "out" ? 200 : 150 }, { swr: true });
        const list = r.data || [];
        return staleNote(r) + `<p class="small muted" style="margin:0 4px 8px">${notes[k]}</p>`
          + (list.length ? `<div class="list">${list.map((i, n) => row[k](i, n)).join("")}</div>` : empty(k === "risk" || k === "dead" || k === "out" ? "مفيش أصناف هنا 👌" : "مفيش بيانات"));
      },
    });
  }

  function viewParties() {
    if (!isBoss()) return viewPartiesSimple();
    const partyLine = (x, sub, amt, cls) => `<a class="list-item" href="#/party/${encodeURIComponent(x.key)}">
      <div class="avatar ${cls === "owe" ? "k-late" : cls === "credit" ? "k-credit" : x.kind === "stopped" ? "k-stop" : "k-late"}">${cls === "owe" ? I.clock : cls === "credit" ? I.truck : x.kind === "stopped" ? I.pause : I.clock}</div><div class="grow"><div class="title ellipsis">${esc(x.name)}</div><div class="sub">${sub}</div></div>
      ${amt != null ? `<div class="end"><div class="bal ${cls || ""} num">${money(amt)}</div></div>` : ""}</a>`;
    const section = (title, list, row, note) => !list || !list.length ? "" : `
      <div class="section-title"><span>${title}</span><small>${list.length}</small></div>
      ${note ? `<p class="small muted" style="margin:-4px 4px 8px">${note}</p>` : ""}
      <div class="list">${list.slice(0, 30).map(row).join("")}</div>
      ${list.length > 30 ? `<p class="small muted center">بيظهر أول 30 — الباقي في تحليل العملاء</p>` : ""}`;
    tabbedList({
      title: "العملاء والموردين",
      tabs: [["owe", "عليهم فلوس"], ["credit", "ليهم فلوس"], ["alerts", "تنبيهات"], ["elite", "النخبة"]],
      storeKey: "t-parties", placeholder: "اسم، كود، أو رقم موبايل",
      searchFn: "search_parties", searchRow: partyRow,
      loadTab: async (k) => {
        if (k === "elite") return eliteTab();
        if (k === "owe" || k === "credit") {
          const r = await call("top_balances", { p_kind: k === "owe" ? "customers" : "suppliers", p_limit: 150 }, { swr: true });
          const d = r.data || {}, list = d.list || [];
          return staleNote(r) + `<div class="card row" style="padding:12px 16px"><div class="grow"><div class="small muted">${k === "owe" ? "إجمالي اللي على العملاء" : "إجمالي اللي للموردين"}</div>
              <div class="bal ${k === "owe" ? "owe" : "credit"} num" style="font-size:22px">${money(d.total)}</div></div><span class="tag">${d.count || 0} ${k === "owe" ? "عميل" : "مورد"}</span></div>
            ${list.length ? `<div class="list">${list.map(partyRow).join("")}</div>` : empty("مفيش أرصدة")}`;
        }
        const [al, st] = await Promise.all([
          call("alerts_list", {}, { swr: true }),
          call("customer_analysis", { p_filter: "stopped", p_q: "", p_limit: 100 }, { swr: true }),
        ]);
        const a = al.data || {}, stopped = (st.data && st.data.customers) || [];
        const quiet = [...(a.late_buyers || []).map((x) => ({ ...x, kind: "late" })),
                       ...stopped.map((c) => ({ key: c.key, name: c.name, days: c.days_since_inv, avg_gap: c.avg_gap, value_12: c.value_12, kind: "stopped" }))];
        const html = [
          section("متأخرين في السداد", a.overdue_customers, (x) => partyLine(x, `ما دفعش من <span class="num">${x.days}</span> يوم • المهلة ${x.grace} يوم`, x.amount, "owe"),
                  "عملاء عليهم فلوس وما دفعوش أي دفعة من حسابهم أكتر من مهلة السداد — والمبلغ هو رصيدهم كله"),
          section("مستحق للموردين", a.supplier_dues, (x) => partyLine(x, `أقدم فاتورة من <span class="num">${x.days}</span> يوم • المهلة ${x.grace} يوم`, x.amount, "credit")),
          section("بقالهم فترة ما اشتروش", quiet, (x) => partyLine(x,
            `${x.kind === "stopped" ? `<span class="tag red">وقف</span>` : `<span class="tag">متأخر عن عادته</span>`} آخر فاتورة من <span class="num">${x.days}</span> يوم${x.avg_gap ? ` • عادته كل <span class="num">${Math.round(x.avg_gap)}</span> يوم` : ""}`)),
        ].join("");
        return staleNote(al) + (html || empty("مفيش تنبيهات دلوقتي 👌"));
      },
    });
  }

  // ---------- عملاء النخبة: ترتيب أحسن العملاء ----------
  const CLASS = { A: { t: "كلاس A", n: "ذهبي" }, B: { t: "كلاس B", n: "فضي" }, C: { t: "كلاس C", n: "برونزي" } };
  async function eliteTab() {
    const r = await call("elite_customers", { p_limit: 300 }, { swr: true });
    const list = r.data || [];
    if (!list.length) return staleNote(r) + empty("مفيش بيانات كفاية لترتيب العملاء لسه");
    const f = sessionStorage.getItem("elite-f") || "all";
    const counts = { A: 0, B: 0, C: 0 };
    list.forEach((c) => (counts[c.abc] = (counts[c.abc] || 0) + 1));
    const why = (c) => {
      const p = [];
      p.push(c.pay_status === "overdue" ? `<span class="minus">متأخر في السداد</span>` : `<span class="plus">ملتزم في السداد</span>`);
      if (c.buy_status === "stopped") p.push(`<span class="minus">وقف شراء</span>`);
      else if (c.buy_status === "late") p.push(`<span class="minus">متأخر عن عادته</span>`);
      else if (c.avg_gap) p.push(`بيشتري كل <span class="num">${c.avg_gap}</span> يوم`);
      p.push(`<span class="num">${c.inv_12}</span> فاتورة`);
      return p.join(" • ");
    };
    const row = (c, i) => `<a class="list-item elite-row" href="#/party/${encodeURIComponent(c.key)}">
        <div class="medal ${c.abc}${i < 3 ? " top" : ""}"><span class="num">${c.rank}</span></div>
        <div class="grow"><div class="title ellipsis">${esc(c.name)}</div><div class="sub">${why(c)}</div></div>
        <div class="end"><div class="score-pill s${c.score >= 85 ? 3 : c.score >= 65 ? 2 : 1}"><b class="num">${c.score}</b><small>/100</small></div>
          <div class="bal-label"><span class="num">${money(c.value_12)}</span> في السنة</div></div></a>`;
    const groups = ["A", "B", "C"].filter((k) => f === "all" || f === k).map((k) => {
      const g = list.filter((c) => c.abc === k);
      if (!g.length) return "";
      return `<div class="class-head ${k}"><span class="ch-badge">${k}</span><div class="grow"><b>${CLASS[k].t} — ${CLASS[k].n}</b><div class="small">${g.length} عميل</div></div></div>
        <div class="list">${g.map((c, i) => row(c, i)).join("")}</div>`;
    }).join("");
    setTimeout(() => {
      const ch = document.getElementById("elitef");
      if (ch) ch.onclick = (e) => { const b = e.target.closest(".chip"); if (!b) return; sessionStorage.setItem("elite-f", b.dataset.f); document.getElementById("ltabs").querySelector("button.on").click(); };
    }, 0);
    return staleNote(r) + `
      <div class="elite-intro"><div class="ei-ico">★</div><div class="grow"><b>عملاء النخبة</b>
        <div class="small">مرتبين بالكلاس، وجوه كل كلاس بدرجة من 100: انتظام الشراء (35) + الالتزام في السداد (35) + حجم التعامل (30)</div></div></div>
      <div class="chips" id="elitef">${[["all", "الكل"], ["A", `ذهبي A (${counts.A || 0})`], ["B", `فضي B (${counts.B || 0})`], ["C", `برونزي C (${counts.C || 0})`]]
        .map(([k, l]) => `<button class="chip ${k === f ? "on" : ""}" data-f="${k}">${l}</button>`).join("")}</div>
      ${groups}`;
  }

  // ================= الفاتورة =================
  async function viewInvoice(type, no) {
    const main = shell({ title: `${INV[type] || "فاتورة"} ${no}`, back: true }, loadingHero);
    let r;
    try { r = await call("invoice_detail", { p_type: type, p_no: no }, { swr: true }); }
    catch (e) { main.innerHTML = errBox(e); return; }
    const v = r.data;
    const showCost = !(state.me.role === "sales" && type.startsWith("purchase"));
    main.innerHTML = `
      ${staleNote(r)}
      <div class="hero-card">
        <div class="lbl">${esc(INV[type])} رقم <span class="num">${esc(v.no)}</span></div>
        <div class="big num">${money(v.total)}</div>
        <div class="meta">
          <span>${fmtDate(v.date)}</span>
          ${v.pay ? `<span class="tag">${v.pay === "Credit" ? "آجل" : "نقدي"}</span>` : ""}
          ${v.store ? `<span>${esc(v.store)}</span>` : ""}
          ${v.user ? `<span>بواسطة ${esc(v.user)}</span>` : ""}
        </div>
      </div>
      <div class="card">
        <div class="row between">
          <div class="grow"><div class="muted small">${type.startsWith("purchase") ? "المورد" : "العميل"}</div><div style="font-weight:800">${esc(v.party)}</div></div>
          <button class="btn small soft" id="openparty">كشف الحساب</button>
        </div>
      </div>
      <div class="card">
        <table class="tbl">
          <thead><tr><th>الصنف</th><th class="n">الكمية</th>${showCost ? `<th class="n">السعر</th><th class="n">الإجمالي</th>` : ""}</tr></thead>
          <tbody>${(v.lines || []).map((l) => `
            <tr>
              <td><a href="#/item/${encodeURIComponent(l.code)}">${esc(l.name)}</a></td>
              <td class="n">${qty(l.qty)}</td>
              ${showCost ? `<td class="n">${qty(l.price)}</td><td class="n">${money(l.total)}</td>` : ""}
            </tr>`).join("")}</tbody>
          ${showCost ? `<tfoot>${discRows(v, 2)}<tr><td>${discRows(v, 2) ? "الصافي" : "الإجمالي"}</td><td class="n">${qty((v.lines || []).reduce((a, l) => a + (Number(l.qty) || 0), 0))}</td><td></td><td class="n">${money(v.total)}</td></tr></tfoot>` : ""}
        </table>
      </div>`;
    document.getElementById("openparty").onclick = async () => {
      try {
        const res = await call("search_parties", { p_q: v.party_code || v.party, p_limit: 20 });
        const isSupp = type.startsWith("purchase");
        const hit = (res.data || []).find((p) => (isSupp ? p.supplier_code : p.customer_code) === v.party_code) || (res.data || [])[0];
        if (hit) location.hash = "#/party/" + encodeURIComponent(hit.key);
        else toast("مش لاقي الحساب");
      } catch (e) { toast(e.message); }
    };
  }

  // ================= الأصناف =================
  function itemRow(i) {
    const s = Number(i.stock) || 0;
    return `<a class="list-item" href="#/item/${encodeURIComponent(i.code)}">
      <div class="grow">
        <div class="title ellipsis">${esc(i.name)}</div>
        <div class="sub">كود <span class="num">${esc(i.code)}</span>${i.subgroup ? " • " + esc(i.subgroup) : ""}${i.price ? ` • سعر <span class="num">${qty(i.price)}</span>` : ""}</div>
      </div>
      <div class="end"><div class="bal ${s > 0 ? "credit" : s < 0 ? "owe" : "zero"} num">${qty(s)}</div><div class="bal-label">${esc(i.unit || "رصيد")}</div></div>
    </a>`;
  }

  function viewItemsSimple() {
    const filters = [["all", "الكل"], ["in", "متوفر"], ["zero", "رصيد صفر"]];
    let filter = sessionStorage.getItem("f-items") || "all";
    shell({ title: "الأصناف" }, `
      <div class="search">${I.search}<input class="input" id="q" type="search" placeholder="اسم الصنف، الكود، أو الباركود" autocomplete="off"></div>
      <div class="chips" id="chips">${filters.map(([k, l]) => `<button class="chip ${k === filter ? "on" : ""}" data-f="${k}">${l}</button>`).join("")}</div>
      <div id="res">${loading}</div>`);
    const q = document.getElementById("q");
    q.value = sessionStorage.getItem("q-items") || "";
    let data = [], stale = null, seq = 0;
    const draw = () => {
      const rows = data.filter((i) => filter === "all" ? true : filter === "in" ? i.stock > 0 : Number(i.stock) <= 0);
      const res = document.getElementById("res");
      if (!res) return;
      res.innerHTML = staleNote(stale) + (rows.length ? `<div class="list">${rows.map(itemRow).join("")}</div>` : empty("مفيش نتايج"));
    };
    const load = async () => {
      const my = ++seq;
      const v = q.value.trim();
      sessionStorage.setItem("q-items", v);
      try {
        const r = await call("search_items", { p_q: v, p_limit: v ? 80 : 150 });
        if (my !== seq) return;
        data = r.data || []; stale = r; draw();
      } catch (e) { const res = document.getElementById("res"); if (my === seq && res) res.innerHTML = errBox(e); }
    };
    let t; q.oninput = () => { clearTimeout(t); t = setTimeout(load, 300); };
    document.getElementById("chips").onclick = (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      filter = b.dataset.f; sessionStorage.setItem("f-items", filter);
      document.querySelectorAll("#chips .chip").forEach((c) => c.classList.toggle("on", c === b));
      draw();
    };
    load();
  }

  async function viewItem(code) {
    const main = shell({ title: "كارت صنف", back: true }, loadingHero);
    let days = Number(sessionStorage.getItem("item-days") || 365);
    let r;
    try { r = await call("item_card", { p_code: code, p_days: days }, { swr: true }); }
    catch (e) { main.innerHTML = errBox(e); return; }
    const v = r.data;
    document.querySelector(".topbar h1").textContent = v.name;
    const stores = Object.entries(v.stock_by_store || {});
    const lp = v.last_purchase;
    const periods = [[90, "3 شهور"], [365, "سنة"], [3650, "من الأول"]];
    main.innerHTML = `
      ${staleNote(r)}
      <div class="hero-card item-hero">
        <div class="lbl">الرصيد الحالي</div>
        <div class="ih-row">
          <div class="ih-name">${esc(v.name)}</div>
          <div class="ih-stock ${Number(v.stock) <= 0 ? "zero" : ""}"><b class="num">${qty(v.stock)}</b><span>${esc(v.unit || "رصيد")}</span></div>
        </div>
        <div class="meta">
          <span>كود <b class="num">${esc(v.code)}</b></span>
          ${v.subgroup ? `<span>${esc(v.subgroup)}</span>` : ""}
          ${v.origin ? `<span>${esc(v.origin)}</span>` : ""}
        </div>
        ${stores.length > 1 ? `<div class="meta">${stores.map(([s, q]) => `<span class="tag">${esc(s)}: <span class="num">${qty(q)}</span></span>`).join("")}</div>` : ""}
      </div>
      <div id="ana"></div>
      <div class="kpis">
        <div class="kpi"><div class="k-label">سعر البيع</div><div class="k-value num">${qty(v.price)}</div>${v.price2 && v.price2 !== v.price ? `<div class="k-sub">سعر 2: <span class="num">${qty(v.price2)}</span></div>` : ""}</div>
        ${lp ? `<div class="kpi"><div class="k-label">آخر سعر شراء</div><div class="k-value num">${qty(lp.price)}</div><div class="k-sub">${fmtDate(lp.d)} • ${esc(lp.party || "")}</div></div>`
             : v.cost != null ? `<div class="kpi"><div class="k-label">التكلفة</div><div class="k-value num">${qty(v.cost)}</div></div>` : ""}
      </div>
      <div class="section-title"><span>حركة الصنف</span><small>${(v.moves || []).length} حركة</small></div>
      <div class="chips" id="per">${periods.map(([d, l]) => `<button class="chip ${d === days ? "on" : ""}" data-d="${d}">${l}</button>`).join("")}</div>
      <div class="list" id="moves"></div>
      <div class="more" id="more"></div>`;
    document.getElementById("per").onclick = (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      sessionStorage.setItem("item-days", b.dataset.d);
      viewItem(code);
    };
    renderItemAnalysis(document.getElementById("ana"), code);
    const moves = v.moves || [];
    const box = document.getElementById("moves");
    const more = document.getElementById("more");
    if (!moves.length) { box.outerHTML = empty("مفيش حركات في الفترة دي"); return; }
    let shown = 0;
    const PAGE = 60;
    const drawMore = () => {
      const part = moves.slice(shown, shown + PAGE);
      box.insertAdjacentHTML("beforeend", part.map(moveRow).join(""));
      shown += part.length;
      if (shown >= moves.length) {
        more.innerHTML = `<div class="muted small center">رصيد أول المدة (${fmtDate(v.from)}): <span class="num">${qty(v.opening)}</span></div>`;
      } else {
        more.innerHTML = `<button class="btn ghost">عرض ${Math.min(PAGE, moves.length - shown)} حركة أقدم</button>`;
        more.querySelector("button").onclick = drawMore;
      }
    };
    drawMore();
  }
  function moveRow(m) {
    const q = Number(m.qty) || 0;
    const inner = `
      <div class="t">${esc(MOVE[m.type] || m.type)} ${m.doc ? `<span class="num muted">#${esc(m.doc)}</span>` : ""}</div>
      <div class="amt ${q >= 0 ? "plus" : "minus"}"><span class="num">${q >= 0 ? "+" : "−"}${qty(abs(q))}</span></div>
      <div class="d">${fmtDate(m.d)}${m.party ? " • " + esc(m.party) : ""}${m.price != null ? ` • بسعر <span class="num">${qty(m.price)}</span>` : ""}</div>
      <div class="run">الرصيد <span class="num">${qty(m.bal)}</span></div>`;
    return m.type !== "adjust" && m.doc ? `<a class="mv" href="#/invoice/${m.type}/${encodeURIComponent(m.doc)}">${inner}</a>` : `<div class="mv">${inner}</div>`;
  }

  // ================= التقرير اليومي =================
  async function viewReport(date) {
    if (!isBoss()) { location.hash = "#/"; return; }
    date = date || cairoToday();
    const today = cairoToday();
    const main = shell({ title: "التقرير اليومي", back: true, actions: shareBtn }, `
      <div class="date-nav">
        <button class="icon-btn" style="color:var(--accent)" id="prev" aria-label="اليوم اللي قبله">${I.back}</button>
        <input class="input" type="date" id="dt" value="${date}" max="${today}">
        <button class="icon-btn" style="color:var(--accent);transform:scaleX(-1)" id="next" aria-label="اليوم اللي بعده" ${date >= today ? "disabled" : ""}>${I.back}</button>
      </div>
      <div id="rep">${loading}</div>`);
    document.getElementById("prev").onclick = () => (location.hash = "#/report/" + addDays(date, -1));
    document.getElementById("next").onclick = () => { if (date < today) location.hash = "#/report/" + addDays(date, 1); };
    document.getElementById("dt").onchange = (e) => { if (e.target.value) location.hash = "#/report/" + e.target.value; };

    let r;
    try { r = await call("daily_report", { p_date: date }, { swr: true }); }
    catch (e) { document.getElementById("rep").innerHTML = errBox(e); return; }
    document.getElementById("rep").innerHTML = reportBody(r, date, true);
    countUp(document.getElementById("rep"));
    wireShare(() => shareDaily(r.data || {}, date));
  }

  function reportBody(r, date, withDay, opts) {
    opts = opts || {};
    const d = r.data || {};
    const t = d.totals || {};
    const nothing = !t.sales_count && !t.purchases_count && !t.collections_count && !t.supplier_payments_count &&
                    !(d.sales_returns || []).length && !(d.purchase_returns || []).length && !(d.expenses || []).length;
    const lastSync = d.last_sync ? `<div class="muted small center" style="margin:8px 0 16px">آخر تحديث من جهاز الحسابات ${esc(ago(d.last_sync))}</div>` : "";
    return `
      ${staleNote(r)}
      ${withDay ? `<div class="muted center" style="margin:-4px 0 10px;font-weight:700">${esc(dayName(date))}</div>` : ""}
      <div class="kpis">
        ${opts.noHero ? `<div class="kpi"><div class="k-label">المبيعات</div><div class="k-value num">${money(t.sales)}</div><div class="k-sub">${t.sales_count || 0} فاتورة • آجل <span class="num">${money(t.sales_credit)}</span></div></div>` : `<div class="kpi hero">
          <div class="k-label">المبيعات</div>
          <div class="k-value num" data-count="${Math.round(Number(t.sales) || 0)}">${money(t.sales)}</div>
          <div class="k-sub">${t.sales_count || 0} فاتورة • آجل <span class="num">${money(t.sales_credit)}</span> • نقدي <span class="num">${money(t.sales_cash)}</span></div>
        </div>`}
        <div class="kpi"><div class="k-label">التحصيلات من العملاء</div><div class="k-value num plus">${money(t.collections)}</div><div class="k-sub">${t.collections_count || 0} سند</div></div>
        <div class="kpi"><div class="k-label">المشتريات</div><div class="k-value num">${money(t.purchases)}</div><div class="k-sub">${t.purchases_count || 0} فاتورة</div></div>
        <div class="kpi"><div class="k-label">سداد للموردين</div><div class="k-value num minus">${money(t.supplier_payments)}</div><div class="k-sub">${t.supplier_payments_count || 0} سند</div></div>
        <div class="kpi"><div class="k-label">مرتجعات</div><div class="k-value num">${money(t.sales_returns)}</div><div class="k-sub">مرتجع شراء <span class="num">${money(t.purchase_returns)}</span></div></div>
        <div class="kpi"><div class="k-label">الخزنة</div><div class="k-value num" style="font-size:16px">وارد ${money(t.cash_in)}</div><div class="k-sub">صادر <span class="num">${money(t.cash_out)}</span></div></div>
        <div class="kpi"><div class="k-label">المصروفات</div><div class="k-value num">${money(t.expenses)}</div><div class="k-sub">${(d.expenses || []).length} بند</div></div>
        <div class="kpi"><div class="k-label">حركة المخزن</div><div class="k-value num" style="font-size:16px">وارد ${(d.items_in || []).length} صنف</div><div class="k-sub">صادر <span class="num">${(d.items_out || []).length}</span> صنف</div></div>
      </div>
      ${nothing ? empty("مفيش حركات مسجلة لسه") : ""}
      ${invSection("فواتير البيع", d.sales, "sale", true)}
      ${paySection("التحصيلات من العملاء", d.collections, "plus")}
      ${invSection("فواتير الشراء", d.purchases, "purchase", false)}
      ${paySection("سداد للموردين", d.supplier_payments, "minus")}
      ${invSection("مرتجعات البيع", d.sales_returns, "sale_return", false)}
      ${invSection("مرتجعات الشراء", d.purchase_returns, "purchase_return", false)}
      ${itemsSection("أصناف واردة", d.items_in, true)}
      ${itemsSection("أصناف صادرة", d.items_out, false)}
      ${expSection(d.expenses)}
      ${lastSync}`;
  }
  // سطور الخصم لو الفاتورة عليها خصم (الإجمالي قبل الخصم - الصافي)
  function discRows(v, pad, extra) {
    const g = Number(v.gross), t = Number(v.total);
    if (!(g > 0) || !(g - t >= 0.5)) return "";
    const blanks = "<td></td>".repeat(pad), after = "<td></td>".repeat(extra || 0);
    return `<tr><td>قبل الخصم</td>${blanks}<td class="n">${money(g)}</td>${after}</tr>
      <tr><td>خصم</td>${blanks}<td class="n minus">${money(g - t)}</td>${after}</tr>`;
  }
  function invSection(title, list, type, showPay) {
    if (!list || !list.length) return "";
    const total = list.reduce((a, x) => a + (Number(x.total) || 0), 0);
    return `<div class="section-title"><span>${title}</span><small>${list.length} • <span class="num">${money(total)}</span></small></div>
      ${list.map((inv) => `
        <details class="inv">
          <summary>
            <div class="grow">
              <div style="font-weight:700" class="ellipsis">${esc(inv.party)}</div>
              <div class="small muted">رقم <span class="num">${esc(inv.no)}</span>${showPay && inv.pay ? ` • ${inv.pay === "Credit" ? "آجل" : "نقدي"}` : ""} • ${(inv.lines || []).length} صنف</div>
            </div>
            <div class="bal num">${money(inv.total)}</div>
            ${I.chev}
          </summary>
          <div class="body">
            <table class="tbl">
              <thead><tr><th>الصنف</th><th class="n">الكمية</th><th class="n">السعر</th><th class="n">الإجمالي</th><th class="n">الرصيد دلوقتي</th></tr></thead>
              <tbody>${(inv.lines || []).map((l) => `
                <tr>
                  <td><a href="#/item/${encodeURIComponent(l.code)}">${esc(l.item)}</a></td>
                  <td class="n">${qty(l.qty)}</td><td class="n">${qty(l.price)}</td><td class="n">${money(l.total)}</td>
                  <td class="n ${Number(l.stock) <= 0 ? "minus" : ""}">${qty(l.stock)}</td>
                </tr>`).join("")}</tbody>
              ${discRows(inv, 2, 1) ? `<tfoot>${discRows(inv, 2, 1)}<tr><td>الصافي</td><td></td><td></td><td class="n">${money(inv.total)}</td><td></td></tr></tfoot>` : ""}
            </table>
            <a class="btn small ghost" style="margin-top:10px" href="#/invoice/${type}/${encodeURIComponent(inv.no)}">فتح الفاتورة</a>
          </div>
        </details>`).join("")}`;
  }
  // حركة الأصناف في اليوم: كل صنف دخل/خرج كام وبكام ومن/لمين + رصيده دلوقتي + آخر سعر شراء قبل كده
  const LINE_TYPE = { purchase: "شراء", sale: "بيع", sale_return: "مرتجع بيع", purchase_return: "مرتجع شراء", adjust: "تسوية جرد" };
  function itemsSection(title, list, incoming) {
    if (!list || !list.length) return "";
    const total = list.reduce((a, x) => a + (Number(x.total) || 0), 0);
    return `<div class="section-title"><span>${title}</span><small>${list.length} صنف • <span class="num">${money(total)}</span></small></div>
      ${list.map((it) => {
        const parties = [...new Set((it.lines || []).map((l) => l.party).filter(Boolean))];
        const unit = it.unit ? " " + esc(it.unit) : "";
        const last = it.last;
        return `<details class="inv">
          <summary>
            <div class="grow">
              <div style="font-weight:700" class="ellipsis">${esc(it.name)}</div>
              <div class="small muted ellipsis">${incoming ? "دخل" : "خرج"} <b class="num ${incoming ? "plus" : "minus"}">${qty(it.qty)}</b>${unit} • ${incoming ? "من" : "لـ"} ${esc(parties.slice(0, 2).join("، "))}${parties.length > 2 ? ` +${parties.length - 2}` : ""}</div>
            </div>
            <div class="bal num">${money(it.total)}</div>
            ${I.chev}
          </summary>
          <div class="body">
            <table class="tbl">
              <thead><tr><th>${incoming ? "من" : "لمين"}</th><th class="n">الكمية</th><th class="n">سعر القطعة</th><th class="n">الإجمالي</th></tr></thead>
              <tbody>${(it.lines || []).map((l) => `
                <tr>
                  <td>${esc(l.party || "")}<div class="small muted">${esc(LINE_TYPE[l.type] || "")}${l.doc && l.type !== "adjust" ? ` <a class="num" href="#/invoice/${l.type}/${encodeURIComponent(l.doc)}">#${esc(l.doc)}</a>` : ""}</div></td>
                  <td class="n">${qty(l.qty)}</td><td class="n">${l.price != null ? qty(l.price) : "—"}</td><td class="n">${l.total != null ? money(l.total) : "—"}</td>
                </tr>`).join("")}</tbody>
              ${(it.lines || []).length > 1 ? `<tfoot><tr><td>الإجمالي</td><td class="n">${qty(it.qty)}</td><td></td><td class="n">${money(it.total)}</td></tr></tfoot>` : ""}
            </table>
            <div class="stat-boxes">
              <div class="stat-box">
                <div class="sb-l">الرصيد دلوقتي</div>
                <div class="sb-v num ${Number(it.stock) <= 0 ? "minus" : ""}">${qty(it.stock)}${unit}</div>
                <div class="sb-s">${incoming ? "بعد اللي دخل" : "بعد اللي خرج"}</div>
              </div>
              <div class="stat-box alt">
                <div class="sb-l">آخر سعر شراء قبل كده</div>
                ${last ? `<div class="sb-v num">${qty(last.price)} <small>للقطعة</small></div>
                  <div class="sb-s">من ${esc(last.party || "")}<br>${fmtDate(last.d)} • كمية <span class="num">${qty(last.qty)}</span>${unit}</div>`
                  : `<div class="sb-v">—</div><div class="sb-s">أول مرة يتشرى</div>`}
              </div>
            </div>
            <a class="btn small ghost" style="margin-top:10px" href="#/item/${encodeURIComponent(it.code)}">كارت الصنف</a>
          </div>
        </details>`;
      }).join("")}`;
  }

  function paySection(title, list, cls) {
    if (!list || !list.length) return "";
    const total = list.reduce((a, x) => a + (Number(x.amount) || 0), 0);
    return `<div class="section-title"><span>${title}</span><small>${list.length} • <span class="num">${money(total)}</span></small></div>
      <div class="list">${list.map((p) => `
        <div class="mv">
          <div class="t">${esc(p.party)}</div>
          <div class="amt ${cls}">${money(p.amount)}</div>
          <div class="d">${esc(p.kind || "")}${p.no ? ` • سند <span class="num">${esc(p.no)}</span>` : ""}</div>
          <div class="run">الرصيد دلوقتي ${balHtml(p.balance)}</div>
        </div>`).join("")}</div>`;
  }
  function expSection(list) {
    if (!list || !list.length) return "";
    const total = list.reduce((a, x) => a + (Number(x.amount) || 0), 0);
    return `<div class="section-title"><span>المصروفات</span><small><span class="num">${money(total)}</span></small></div>
      <div class="list">${list.map((x) => `
        <div class="mv"><div class="t">${esc(x.item || "مصروف")}</div><div class="amt minus">${money(x.amount)}</div>
        <div class="d">${esc(x.note || "")}</div><div></div></div>`).join("")}</div>`;
  }

  // ================= حسابي + الإشعارات =================
  function viewMe() {
    const main = shell({ title: "حسابي" }, `
      <div class="card">
        <div class="row">
          <div class="avatar">${esc((state.me.name || "؟").charAt(0))}</div>
          <div class="grow"><div style="font-weight:800">${esc(state.me.name)}</div><div class="small muted">${esc(state.me.email || "")}</div></div>
          <span class="tag">${esc(ROLE[state.me.role] || "")}</span>
        </div>
      </div>
      <div id="install"></div>
      ${isBoss() ? `<div class="section-title"><span>الإشعارات</span></div><div id="push"></div>
        <div class="section-title"><span>آخر الإشعارات اللي اتبعتت</span><small>من السيرفر</small></div><div id="pushlog">${loading}</div>` : ""}
      ${isAdmin() ? `<div class="section-title"><span>الإدارة</span></div>
        <div class="list"><a class="list-item" href="#/users"><div class="avatar">${I.people}</div><div class="grow"><div class="title">المستخدمين والصلاحيات</div><div class="sub">موافقة الحسابات الجديدة وتحديد عملاء كل مندوب</div></div>${I.chev}</a>
        <a class="list-item" href="#/settings"><div class="avatar">${hubIcon.gear}</div><div class="grow"><div class="title">إعدادات التحليل</div><div class="sub">مهلة السداد، مدة التوريد، وإعادة الحساب</div></div>${I.chev}</a></div>` : ""}
      <div class="section-title"><span>التطبيق</span></div>
      <div class="card stack">
        <button class="btn ghost" id="clear">مسح البيانات المحفوظة على الموبايل</button>
        <button class="btn danger" id="logout">تسجيل الخروج</button>
        <div class="small muted center">الإصدار ${esc(CFG.version)}</div>
      </div>`);
    renderInstallCard();
    if (isBoss()) {
      renderPushCard(document.getElementById("push"), true);
      call("recent_pushes", { p_limit: 12 }).then((r) => {
        const el = document.getElementById("pushlog");
        if (!el) return;
        const list = r.data || [];
        const at = (ts) => new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" }).format(new Date(ts));
        el.innerHTML = list.length ? `<div class="list">${list.map((x) => `<div class="mv">
            <div class="t">${esc(x.title)}</div><div class="amt small muted">${esc(at(x.at))}</div>
            <div class="d ellipsis">${esc(x.body || "")}</div><div class="run">${x.acked_at ? `<span class="plus">✓ وصل الموبايل ${esc(at(x.acked_at).split("،").pop().trim())}</span>`
              : x.kind === "event" ? "" : x.n === 0 ? `<span class="minus">مفيش موبايل مشترك</span>` : `<span class="muted">اتبعت${x.resends ? ` (واتعاد ${x.resends} مرة)` : ""}</span>`}</div></div>`).join("")}</div>
            <p class="small muted" style="margin:8px 4px 0">«وصل الموبايل» معناها إن الموبايل استلم الإشعار فعلاً. لو ما وصلش خلال ربع ساعة، السيرفر بيبعته تاني لحد 3 مرات.</p>`
          : empty("لسه مفيش إشعارات اتبعتت");
      }).catch((e) => { const el = document.getElementById("pushlog"); if (el) el.innerHTML = errBox(e); });
    }
    document.getElementById("logout").onclick = logout;
    document.getElementById("clear").onclick = () => { cacheClear(); toast("اتمسحت البيانات المحفوظة"); };
  }

  function renderInstallCard() {
    const el = document.getElementById("install");
    if (!el) return;
    const standalone = matchMedia("(display-mode: standalone)").matches;
    if (standalone || !state.installPrompt) { el.innerHTML = ""; return; }
    el.innerHTML = `<div class="card soft row"><div class="grow"><b>ثبّت التطبيق على الموبايل</b><div class="small">يفتح من أيقونة على الشاشة الرئيسية زي أي تطبيق</div></div><button class="btn small" id="inst">تثبيت</button></div>`;
    document.getElementById("inst").onclick = async () => {
      const p = state.installPrompt; state.installPrompt = null;
      p.prompt(); await p.userChoice.catch(() => {}); renderInstallCard();
    };
  }

  const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  function b64ToBytes(s) {
    const pad = "=".repeat((4 - (s.length % 4)) % 4);
    const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }
  async function fnCall(body) {
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(CFG.url + "/functions/v1/daily-report", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CFG.key, Authorization: "Bearer " + (session ? session.access_token : CFG.key) },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "حصل خطأ في السيرفر");
    return j;
  }
  async function currentSub() {
    if (!pushSupported()) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }
  async function saveSub(sub) {
    const j = sub.toJSON();
    const { error } = await sb.from("push_subscriptions").upsert({
      endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200),
    }, { onConflict: "endpoint" });
    if (error) throw error;
  }
  async function subscribePush() {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("لازم توافق على الإشعارات من الموبايل");
    const { publicKey } = await fnCall({ action: "vapid" });
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
    await saveSub(sub);
  }
  async function unsubscribePush(silent) {
    const sub = await currentSub();
    if (!sub) return;
    await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    if (!silent) await sub.unsubscribe();
  }
  async function renderPushCard(el, full) {
    if (!el) return;
    if (!pushSupported()) {
      if (full) el.innerHTML = `<div class="card soft small">الموبايل ده مش بيدعم الإشعارات من المتصفح. افتح التطبيق من Chrome وثبّته.</div>`;
      return;
    }
    const sub = await currentSub().catch(() => null);
    const on = !!sub && Notification.permission === "granted";
    if (on) { saveSub(sub).catch(() => {}); }
    if (!full && on) { el.innerHTML = ""; return; }
    if (!full) {
      el.innerHTML = `<div class="card soft row"><div class="grow"><b>فعّل إشعار التقرير اليومي</b><div class="small">هيوصلك ملخص اليوم كل يوم الساعة 12 بالليل</div></div><button class="btn small" id="pon">تفعيل</button></div>`;
    } else {
      el.innerHTML = `
        <div class="card stack">
          <div class="row">
            <div class="grow"><b>إشعارات التقارير</b><div class="small muted">اليومي كل يوم 12 بالليل • الأسبوعي الخميس 12 بالليل • الشهري آخر يوم في الشهر 12 بالليل • تنبيه المتأخرين في السداد الخميس وآخر الشهر • وإشعارات فورية لما عميل يعدي مهلة السداد أو صنف يوصل حد الطلب أو الأمان أو يخلص</div></div>
            <label class="switch"><input type="checkbox" id="ptoggle" ${on ? "checked" : ""}><span></span></label>
          </div>
          ${Notification.permission === "denied" ? `<div class="small" style="color:var(--danger)">الإشعارات مقفولة للموقع ده. افتح إعدادات Chrome ← إعدادات المواقع ← الإشعارات، واسمح بيها.</div>` : ""}
          ${on ? `<button class="btn soft" id="ptest">تجربة إشعار التقرير اليومي</button><button class="btn soft" id="ptestw">تجربة إشعار التقرير الأسبوعي</button><button class="btn soft" id="ptestm">تجربة إشعار التقرير الشهري</button><button class="btn soft" id="ptesto">تجربة تنبيه المتأخرين في السداد</button>` : ""}
        </div>`;
    }
    const pon = el.querySelector("#pon");
    if (pon) pon.onclick = async () => {
      pon.disabled = true;
      try { await subscribePush(); toast("اتفعّل ✅ هيوصلك التقرير كل يوم 12 بالليل"); renderPushCard(el, full); }
      catch (e) { toast(e.message || String(e)); pon.disabled = false; }
    };
    const tg = el.querySelector("#ptoggle");
    if (tg) tg.onchange = async () => {
      tg.disabled = true;
      try {
        if (tg.checked) { await subscribePush(); toast("اتفعّل ✅"); }
        else { await unsubscribePush(false); toast("اتقفلت الإشعارات"); }
      } catch (e) { toast(e.message || String(e)); }
      renderPushCard(el, full);
    };
    [["#ptestw", "test_weekly"], ["#ptestm", "test_monthly"], ["#ptesto", "test_overdue"]].forEach(([sel, action]) => {
      const b = el.querySelector(sel);
      if (!b) return;
      b.onclick = async () => {
        b.disabled = true;
        try {
          const r = await fnCall({ action });
          toast(r.note ? r.note : r.sent ? "اتبعت ✅ هيظهر الإشعار خلال ثواني" : "ما اتبعتش — جرب تقفل الإشعارات وتفتحها تاني");
        } catch (e) { toast(e.message || String(e)); }
        b.disabled = false;
      };
    });
    const pt = el.querySelector("#ptest");
    if (pt) pt.onclick = async () => {
      pt.disabled = true;
      try {
        const r = await fnCall({ action: "test" });
        toast(r.sent ? "اتبعت ✅ هيظهر الإشعار خلال ثواني" : "ما اتبعتش — جرب تقفل الإشعارات وتفتحها تاني");
      } catch (e) { toast(e.message || String(e)); }
      pt.disabled = false;
    };
  }

  // ================= المستخدمين (للمدير) =================
  async function viewUsers() {
    if (!isAdmin()) { location.hash = "#/"; return; }
    const main = shell({ title: "المستخدمين", back: true }, loading);
    const { data, error } = await sb.from("profiles").select("id, full_name, phone, email, role, is_active, created_at").order("created_at");
    if (error) { main.innerHTML = errBox(isNetErr(error) ? "مفيش إنترنت" : error.message); return; }
    const pend = data.filter((u) => u.role === "pending" || !u.is_active);
    const act = data.filter((u) => !(u.role === "pending" || !u.is_active));
    const row = (u) => `<a class="list-item" href="#/user/${u.id}">
        <div class="avatar">${esc((u.full_name || "؟").charAt(0))}</div>
        <div class="grow"><div class="title ellipsis">${esc(u.full_name || u.email)}</div><div class="sub ellipsis">${esc(u.email || "")}${u.phone ? " • " + esc(u.phone) : ""}</div></div>
        <span class="tag ${u.is_active ? "" : "red"}">${u.is_active ? esc(ROLE[u.role]) : u.role === "pending" ? "مستني موافقة" : "موقوف"}</span>
      </a>`;
    main.innerHTML = `
      ${pend.length ? `<div class="section-title"><span>محتاجين موافقة</span><small>${pend.length}</small></div><div class="list">${pend.map(row).join("")}</div>` : ""}
      <div class="section-title"><span>الحسابات المفعلة</span><small>${act.length}</small></div>
      <div class="list">${act.map(row).join("")}</div>
      <p class="small muted" style="margin:16px 4px">أي حد عايز يستخدم التطبيق يفتح نفس الرابط ويعمل "حساب جديد"، وبعدين تفعّله من هنا وتحدد صلاحيته.</p>`;
  }

  async function viewUser(id) {
    if (!isAdmin()) { location.hash = "#/"; return; }
    const main = shell({ title: "صلاحيات المستخدم", back: true }, loading);
    const { data: u, error } = await sb.from("profiles").select("*").eq("id", id).single();
    if (error) { main.innerHTML = errBox(error.message); return; }
    const self = u.id === state.me.id;
    main.innerHTML = `
      <div class="card">
        <div style="font-weight:800;font-size:18px">${esc(u.full_name || "")}</div>
        <div class="small muted">${esc(u.email || "")}${u.phone ? ` • <a href="tel:${esc(u.phone)}">${esc(u.phone)}</a>` : ""}</div>
      </div>
      <div class="card">
        <label class="field"><span>الصلاحية</span>
          <select class="input" id="role" ${self ? "disabled" : ""}>
            <option value="admin">مدير النظام — كل حاجة + إدارة المستخدمين</option>
            <option value="manager">مدير — كل البيانات والتقارير</option>
            <option value="sales">مندوب مبيعات — عملاءه بس</option>
            <option value="pending">في انتظار الموافقة</option>
          </select>
        </label>
        <div class="row between" style="min-height:48px">
          <b>الحساب مفعّل</b>
          <label class="switch"><input type="checkbox" id="active" ${u.is_active ? "checked" : ""} ${self ? "disabled" : ""}><span></span></label>
        </div>
        ${self ? `<div class="small muted">ده حسابك — ما ينفعش تغيّر صلاحيتك بنفسك.</div>` : `<button class="btn" id="save" style="margin-top:12px">حفظ</button>`}
      </div>
      <div id="cust"></div>`;
    document.getElementById("role").value = u.role;
    if (!self) document.getElementById("save").onclick = async () => {
      let role = document.getElementById("role").value;
      let active = document.getElementById("active").checked;
      if (role === "pending" && active) { toast("اختار صلاحية الأول"); return; }
      const { error: e2 } = await sb.from("profiles").update({ role, is_active: active }).eq("id", id);
      if (e2) toast(e2.message); else { toast("اتحفظ ✅"); viewUser(id); }
    };
    if (u.role === "sales") renderAssigned(id);
  }

  async function renderAssigned(uid) {
    const el = document.getElementById("cust");
    el.innerHTML = `<div class="section-title"><span>عملاء المندوب</span></div>${loading}`;
    const { data, error } = await sb.from("user_customers").select("customer_code").eq("user_id", uid);
    if (error) { el.innerHTML = errBox(error.message); return; }
    const codes = data.map((x) => x.customer_code);
    const named = await Promise.all(codes.map(async (c) => {
      try { const r = await call("search_parties", { p_q: c, p_limit: 10 }); const p = (r.data || []).find((x) => x.customer_code === c); return { code: c, name: p ? p.name : "" }; }
      catch (e) { return { code: c, name: "" }; }
    }));
    el.innerHTML = `
      <div class="section-title"><span>عملاء المندوب</span><small>${codes.length}</small></div>
      <div class="list">${named.length ? named.map((n) => `
        <div class="list-item"><div class="grow"><div class="title ellipsis">${esc(n.name || "عميل")}</div><div class="sub">كود <span class="num">${esc(n.code)}</span></div></div>
        <button class="btn small danger" data-del="${esc(n.code)}">شيل</button></div>`).join("") : `<div class="list-item muted">لسه ما اتحددلوش عملاء — مش هيشوف أي حساب</div>`}</div>
      <div class="section-title"><span>إضافة عميل</span></div>
      <div class="search">${I.search}<input class="input" id="cq" type="search" placeholder="ابحث باسم العميل أو الكود"></div>
      <div id="cres"></div>`;
    el.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      const { error: e } = await sb.from("user_customers").delete().eq("user_id", uid).eq("customer_code", b.dataset.del);
      if (e) toast(e.message); else renderAssigned(uid);
    }));
    const cq = document.getElementById("cq");
    let t;
    cq.oninput = () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const v = cq.value.trim();
        const box = document.getElementById("cres");
        if (!v) { box.innerHTML = ""; return; }
        try {
          const r = await call("search_parties", { p_q: v, p_limit: 20 }, { cache: false });
          const list = (r.data || []).filter((p) => p.is_customer && !codes.includes(p.customer_code));
          box.innerHTML = list.length ? `<div class="list">${list.map((p) => `
            <button class="list-item" data-add="${esc(p.customer_code)}"><div class="grow"><div class="title ellipsis">${esc(p.name)}</div><div class="sub">كود <span class="num">${esc(p.customer_code)}</span></div></div><span class="tag green">+ إضافة</span></button>`).join("")}</div>` : empty("مفيش عملاء بالاسم ده");
          box.querySelectorAll("[data-add]").forEach((b) => (b.onclick = async () => {
            const { error: e } = await sb.from("user_customers").insert({ user_id: uid, customer_code: b.dataset.add });
            if (e) toast(e.message); else { toast("اتضاف ✅"); renderAssigned(uid); }
          }));
        } catch (e) { box.innerHTML = errBox(e); }
      }, 300);
    };
  }

  // ================= التحليل (المرحلة 4) =================
  const STATUS = {
    out: ["نفد", "red"], negative: ["رصيد سالب", "red"], below_safety: ["تحت الأمان", "red"], reorder: ["وقت الطلب", ""],
    over: ["زيادة عن الحد", "gray"], dead: ["راكد", "gray"], ok: ["تمام", "green"], inactive: ["مش نشط", "gray"], excluded: ["مستبعد", "gray"],
  };
  const MOVEMENT = { fast: "سريع الحركة", medium: "متوسط الحركة", slow: "بطيء الحركة", dead: "راكد", inactive: "مش نشط", new: "صنف جديد" };
  const PATTERN = { regular: "منتظم", invoice_to_invoice: "فاتورة بفاتورة", seasonal: "موسمي", deal: "صفقات", new: "عميل جديد", none: "ما اشتراش السنة دي" };
  const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const tagStatus = (s) => (STATUS[s] ? `<span class="tag ${STATUS[s][1]}">${STATUS[s][0]}</span>` : "");
  const tagAbc = (a) => (a ? `<span class="tag ${a === "A" ? "" : "gray"}">فئة ${esc(a)}</span>` : "");
  const turnTxt = (t) => (t == null ? "—" : Number(t) > 50 ? "+50" : nf2.format(Math.round(Number(t) * 10) / 10));
  const daysTxt = (d) => (d >= 365 ? "من أكتر من سنة" : `من <span class="num">${d}</span> يوم`);
  const numOrNull = (v) => { const s = String(v == null ? "" : v).trim(); if (!s) return null; const n = Number(s); return isFinite(n) ? n : null; };
  const monthName = (ym) => { const [y, m] = String(ym).split("-"); return `${MONTHS[Number(m) - 1] || ""} ${y || ""}`; };
  const hubIcon = {
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 1112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9"/><path d="M10 20a2 2 0 004 0"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
  };

  // رسم أعمدة بسيط لآخر 12 شهر (لون واحد، اضغط على أي عمود يظهر رقمه)
  function barChart(points, title, unit, opts) {
    if (!points || !points.length) return "";
    const capOf = (opts && opts.cap) || ((p) => monthName(p.m));
    const lblOf = (opts && opts.label) || ((p) => Number(String(p.m).split("-")[1]));
    const max = Math.max(...points.map((p) => Number(p.v) || 0), 0);
    const id = "ch" + Math.random().toString(36).slice(2, 8);
    const last = points[points.length - 1];
    return `<div class="chart" id="${id}">
      <div class="chart-head"><span class="chart-title">${esc(title)}</span><span class="chart-val" data-cap>${esc(capOf(last))}: <b class="num">${qty(last.v)}</b> ${esc(unit || "")}</span></div>
      <div class="bars" role="list">${points.map((p, i) => {
        const h = max > 0 ? Math.max(2, Math.round((Number(p.v) || 0) / max * 100)) : 2;
        return `<button class="bar ${i === points.length - 1 ? "on" : ""} ${(Number(p.v) || 0) <= 0 ? "zero" : ""}" role="listitem" data-c="${esc(capOf(p))}" data-v="${esc(p.v)}" aria-label="${esc(capOf(p))}: ${qty(p.v)}"><span style="height:${h}%"></span></button>`;
      }).join("")}</div>
      <div class="bars-x">${points.map((p) => `<span>${esc(lblOf(p))}</span>`).join("")}</div>
    </div>`;
  }
  function wireCharts(root, unit) {
    root.querySelectorAll(".chart").forEach((ch) => {
      const cap = ch.querySelector("[data-cap]");
      const pick = (b) => {
        ch.querySelectorAll(".bar").forEach((x) => x.classList.toggle("on", x === b));
        cap.innerHTML = `${esc(b.dataset.c)}: <b class="num">${qty(b.dataset.v)}</b> ${esc(unit || "")}`;
      };
      ch.querySelectorAll(".bar").forEach((b) => { b.onclick = () => pick(b); b.onmouseenter = () => pick(b); });
    });
  }

  function hubRow(href, title, sub, icon, badge) {
    return `<a class="list-item" href="${href}"><div class="avatar">${icon}</div>
      <div class="grow"><div class="title">${title}</div><div class="sub">${sub}</div></div>
      ${badge != null ? `<span class="tag ${badge > 0 ? "red" : "green"}" data-badge>${badge}</span>` : ""}${I.chev}</a>`;
  }

  async function viewReports() {
    if (!isBoss()) { location.hash = "#/"; return; }
    let kind = sessionStorage.getItem("top-kind") || "customers";
    const kinds = [["customers", "العملاء"], ["suppliers", "الموردين"], ["stock", "المخزن"]];
    const main = shell({ title: "التقارير والأرصدة" }, `
      <div class="section-title"><span>أكبر الأرصدة</span><small id="toptot"></small></div>
      <div class="tabs" id="ktabs">${kinds.map(([k, l]) => `<button data-k="${k}" class="${k === kind ? "on" : ""}">${l}</button>`).join("")}</div>
      <div id="toplist">${loading}</div>
      <div class="section-title"><span>التقارير والتحليل</span></div>
      <div class="list">
        ${hubRow("#/week", "التقرير الأسبوعي", "مقارنة بالأسبوع اللي فات، أكبر العملاء والأصناف، أعمار الديون", I.report)}
        ${hubRow("#/month", "التقرير الشهري", "مقارنة بالشهر اللي فات في المبيعات والتحصيلات وكل الأرقام", I.report)}
        ${hubRow("#/report/" + addDays(cairoToday(), -1), "تقارير الأيام اللي فاتت", "حركة أي يوم: مبيعات وتحصيلات ومشتريات", I.report)}
        ${hubRow("#/alerts", "التنبيهات", "اللي محتاج تصرف دلوقتي", hubIcon.bell)}
        ${hubRow("#/turnover", "معدل دوران المخزون", "الأصناف مترتبة من الأعلى دوراناً للأقل", I.refresh)}
        ${hubRow("#/stock", "تحليل المخزن", "نقطة الطلب، الراكد والزيادة", I.box)}
        ${hubRow("#/customers", "تحليل العملاء", "الانتظام، التصنيف، المتأخرين في السداد والشراء", I.people)}
        ${isAdmin() ? hubRow("#/settings", "إعدادات التحليل", "مدة التوريد، مهلة السداد، وإعادة الحساب", hubIcon.gear) : ""}
      </div>
      <div id="hubk">${loading}</div>`);
    const loadTop = async () => {
      const box = document.getElementById("toplist"), tot = document.getElementById("toptot");
      if (!box) return;
      box.innerHTML = loading; tot.textContent = "";
      try {
        const r = await call("top_balances", { p_kind: kind, p_limit: 20 }, { swr: true });
        if (!document.getElementById("toplist")) return;
        const d = r.data || {}, list = d.list || [];
        const label = kind === "customers" ? "إجمالي اللي على العملاء" : kind === "suppliers" ? "إجمالي اللي للموردين" : "قيمة المخزون بالتكلفة";
        tot.innerHTML = `${label}: <span class="num">${money(d.total)}</span>`;
        const rows = kind === "stock"
          ? list.map((i) => `<a class="list-item" href="#/item/${encodeURIComponent(i.code)}"><div class="grow"><div class="title ellipsis">${esc(i.name)}</div>
              <div class="sub">رصيد <span class="num">${qty(i.stock)}</span> ${esc(i.unit || "")}${i.subgroup ? " • " + esc(i.subgroup) : ""}</div></div>
              <div class="end"><div class="bal num">${money(i.value)}</div><div class="bal-label">قيمة</div></div></a>`).join("")
          : list.map(partyRow).join("");
        const more = kind === "stock" ? `<a class="btn ghost more" href="#/stock" data-f="all">كل الأصناف (${d.count || 0})</a>`
          : `<a class="btn ghost more" href="#/parties" data-f="${kind === "customers" ? "owe" : "credit"}">الكل (${d.count || 0})</a>`;
        box.innerHTML = staleNote(r) + (list.length ? `<div class="list">${rows}</div>${more}` : empty("مفيش أرصدة"));
        const m = box.querySelector("[data-f]");
        if (m) m.onclick = () => {
          if (kind === "stock") sessionStorage.setItem("f-stock", "all");
          else { sessionStorage.setItem("f-parties", m.dataset.f); sessionStorage.setItem("q-parties", ""); }
        };
      } catch (e) { const b2 = document.getElementById("toplist"); if (b2) b2.innerHTML = errBox(e); }
    };
    document.getElementById("ktabs").onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      kind = b.dataset.k; sessionStorage.setItem("top-kind", kind);
      document.querySelectorAll("#ktabs button").forEach((x) => x.classList.toggle("on", x === b));
      loadTop();
    };
    loadTop();
    const [st, cu] = await Promise.all([
      call("stock_analysis", { p_status: "attention", p_q: "", p_limit: 1 }, { swr: true }).catch((e) => ({ err: e })),
      call("customer_analysis", { p_filter: "overdue", p_q: "", p_limit: 1 }, { swr: true }).catch((e) => ({ err: e })),
    ]);
    const el = document.getElementById("hubk");
    if (!el) return;
    if (st.err && cu.err) { el.innerHTML = errBox(st.err); return; }
    const s = (st.data && st.data.summary) || {}, c = (cu.data && cu.data.summary) || {};
    const need = s.attention || 0;
    el.innerHTML = `
      <div class="section-title"><span>نظرة سريعة</span><small>${st.data ? "آخر حساب " + esc(ago(st.data.computed_at)) : ""}</small></div>
      <div class="kpis">
        <a class="kpi" href="#/stock"><div class="k-label">أصناف محتاجة تصرف</div><div class="k-value num">${need}</div><div class="k-sub">نفد ${s.out || 0} • تحت الأمان ${s.below_safety || 0} • وقت الطلب ${s.reorder || 0}</div></a>
        <a class="kpi" href="#/stock"><div class="k-label">دوران المخزن (سنوي)</div><div class="k-value num">${turnTxt(s.turnover_365)}</div><div class="k-sub">مرة في السنة</div></a>
        <a class="kpi" href="#/stock"><div class="k-label">قيمة المخزون بالتكلفة</div><div class="k-value num">${money(s.stock_value)}</div><div class="k-sub">منها راكد <span class="num">${money(s.dead_value)}</span></div></a>
        <a class="kpi" href="#/customers"><div class="k-label">متأخرين في السداد</div><div class="k-value num">${c.overdue || 0}</div><div class="k-sub">مبلغ <span class="num">${money(c.overdue_amount)}</span></div></a>
        <a class="kpi" href="#/customers"><div class="k-label">متأخرين في الشراء</div><div class="k-value num">${c.late || 0}</div><div class="k-sub">متوقفين ${c.stopped || 0}</div></a>
        <a class="kpi" href="#/customers"><div class="k-label">موسمهم قرب</div><div class="k-value num">${c.season_soon || 0}</div><div class="k-sub">من ${c.seasonal || 0} عميل موسمي</div></a>
      </div>
      ${staleNote(st)}`;
  }


  // ---------- التقرير الأسبوعي ----------
  const WEEKDAY = (iso) => new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", timeZone: "UTC" }).format(new Date(iso + "T12:00:00Z"));
  const shortDate = (iso) => new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(iso + "T12:00:00Z"));
  function lastThursday(iso) {
    const d = new Date(iso + "T12:00:00Z");
    return addDays(iso, -((d.getUTCDay() - 4 + 7) % 7));
  }
  function change(cur, prev) {
    cur = Number(cur) || 0; prev = Number(prev) || 0;
    if (!prev && !cur) return "";
    if (!prev) return `<span class="chg up">جديد</span>`;
    const p = Math.round(((cur - prev) / prev) * 100);
    if (p === 0) return `<span class="chg">زي اللي فات</span>`;
    return `<span class="chg ${p > 0 ? "up" : "down"}">${p > 0 ? "▲" : "▼"} <span class="num">${Math.abs(p)}%</span></span>`;
  }

  const monthLong = (ym) => new Intl.DateTimeFormat("ar-EG-u-nu-latn", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(ym.slice(0, 7) + "-15T12:00:00Z"));
  const monthOnly = (ym) => new Intl.DateTimeFormat("ar-EG-u-nu-latn", { month: "long", timeZone: "UTC" }).format(new Date(ym.slice(0, 7) + "-15T12:00:00Z"));
  function addMonths(ym, n) {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 15));
    return d.toISOString().slice(0, 7);
  }
  function viewWeek(end) { return viewPeriod("week", end); }
  function viewMonth(ym) { return viewPeriod("month", ym); }

  // مقارنة صريحة: الفترة دي والفترة اللي قبلها والفرق
  function compareCard(t, pv, curLabel, prevLabel) {
    const row = (label, key) => {
      const c = Number(t[key]) || 0, p = Number(pv[key]) || 0, d = c - p;
      return `<tr><td><b>${label}</b></td><td class="n">${money(c)}</td><td class="n">${money(p)}</td>
        <td class="n ${d > 0 ? "plus" : d < 0 ? "minus" : ""}">${d > 0 ? "+" : d < 0 ? "−" : ""}${money(Math.abs(d))}<div>${change(c, p)}</div></td></tr>`;
    };
    return `<div class="card compare">
      <table class="tbl">
        <thead><tr><th></th><th class="n">${esc(curLabel)}</th><th class="n">${esc(prevLabel)}</th><th class="n">الفرق</th></tr></thead>
        <tbody>${row("المبيعات", "sales")}${row("التحصيلات", "collections")}</tbody>
      </table></div>`;
  }

  // ---------- رسم متحرك: حركة المبيعات والتحصيلات خلال الفترة مقارنة باللي قبلها ----------
  // وش تعبيري بيتفاعل مع الحركة: مبسوط لو أحسن، زعلان لو أقل، عادي لو زي اللي فات
  const motionPlayed = {};
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function cumulate(arr, k) { let s = 0; return arr.map((d) => (s += Number(d[k]) || 0)); }
  // ميل ناعم من غير ما المنحنى يطلع لفوق أو ينزل غلط (monotone cubic)
  function monoSlopes(ys) {
    const n = ys.length, m = new Array(n).fill(0), d = [];
    if (n < 2) return m;
    for (let i = 0; i < n - 1; i++) d[i] = ys[i + 1] - ys[i];
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return m;
  }
  function monoAt(ys, ms, f) {
    if (!ys.length) return 0;
    f = clamp(f, 0, ys.length - 1);
    const i = Math.min(Math.floor(f), ys.length - 2);
    if (i < 0) return ys[0];
    const t = f - i, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * ms[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * ms[i + 1];
  }
  // مستوى المزاج من نسبة التغيير
  function moodOf(pct, hasPrev, hasCur) {
    if (!hasPrev && !hasCur) return { lv: 0, m: 0 };
    if (!hasPrev) return { lv: 2, m: 1 };
    if (pct >= 25) return { lv: 2, m: 1 };
    if (pct >= 5) return { lv: 1, m: 0.6 };
    if (pct > -5) return { lv: 0, m: 0.32 };
    if (pct > -25) return { lv: -1, m: -0.55 };
    return { lv: -2, m: -1 };
  }
  // مؤشر الأداء (عداد) بدل الوشوش: درجات الأداء بألوان هادية
  const LV = {
    2: { t: "أداء ممتاز", c: "#2FB27A" }, 1: { t: "أداء جيد", c: "#7CC9A2" }, 0: { t: "أداء مستقر", c: "#AEBBCB" },
    "-1": { t: "تراجع طفيف", c: "#F2A43A" }, "-2": { t: "تراجع ملحوظ", c: "#EF5B5B" },
  };
  const ZONES = [[-50, -25, -2], [-25, -5, -1], [-5, 5, 0], [5, 25, 1], [25, 50, 2]];
  const lvOf = (pct) => (pct >= 25 ? 2 : pct >= 5 ? 1 : pct > -5 ? 0 : pct > -25 ? -1 : -2);
  const signPct = (p) => `${p > 0.5 ? "+" : p < -0.5 ? "−" : ""}${Math.abs(Math.round(p))}%`;
  const TREND = {
    up: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    flat: '<path d="M4 12h15"/><path d="M15 8l4 4-4 4"/>',
    down: '<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  };
  const trendIcon = (lv) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${TREND[lv > 0 ? "up" : lv < 0 ? "down" : "flat"]}</svg>`;
  // إيموجي صغير جنب الحكم (Fluent 3D من مايكروسوفت، رخصة MIT)
  const EMO = { 2: "m2", 1: "m1", 0: "m0", "-1": "n1", "-2": "n2" };
  // احتفال: أضواء ونجوم وقصاصات لما الأداء ممتاز، ولمعة خفيفة لما يكون جيد
  function celebrate(hero, emo, big) {
    const fx = hero.querySelector("[data-fx]");
    if (!fx) return;
    fx.innerHTML = "";
    hero.classList.remove("shine"); void hero.offsetWidth; hero.classList.add("shine");
    const hb = hero.getBoundingClientRect(), eb = emo.getBoundingClientRect();
    const ex = eb.left - hb.left + eb.width / 2, ey = eb.top - hb.top + eb.height / 2;
    const star = '<svg viewBox="0 0 24 24"><path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4.6 12 0z"/></svg>';
    const nStars = big ? 9 : 4;
    for (let i = 0; i < nStars; i++) {
      const sp = document.createElement("span");
      sp.className = "mo-spark";
      const a = (Math.PI * 2 * i) / nStars + Math.random() * 0.5, d = 22 + Math.random() * (big ? 26 : 14);
      sp.style.left = ex + Math.cos(a) * d + "px"; sp.style.top = ey + Math.sin(a) * d + "px";
      sp.style.setProperty("--s", (0.5 + Math.random() * 0.8).toFixed(2));
      sp.style.animationDelay = Math.round(Math.random() * 600) + "ms";
      sp.innerHTML = star; fx.appendChild(sp);
    }
    if (big) {
      const colors = ["#FFC93C", "#F57C00", "#2FB27A", "#6CB3F3", "#FFFFFF", "#FF8A65"];
      for (let i = 0; i < 34; i++) {
        const c = document.createElement("i");
        c.className = "mo-conf";
        c.style.left = Math.random() * hb.width + "px";
        c.style.background = colors[i % colors.length];
        c.style.setProperty("--dx", (Math.random() * 60 - 30).toFixed(0) + "px");
        c.style.setProperty("--r", (Math.random() * 720 - 360).toFixed(0) + "deg");
        c.style.setProperty("--h", hb.height + 20 + "px");
        c.style.animationDuration = (1.6 + Math.random() * 1.2).toFixed(2) + "s";
        c.style.animationDelay = Math.round(Math.random() * 500) + "ms";
        if (i % 3 === 0) c.style.borderRadius = "50%";
        fx.appendChild(c);
      }
    }
    setTimeout(() => { if (fx.isConnected) fx.innerHTML = ""; hero.classList.remove("shine"); }, 3600);
  }
  function gaugeSvg() {
    const cx = 120, cy = 112, r = 92;
    const pt = (p, rr) => { const a = Math.PI * (1 - (clamp(p, -50, 50) + 50) / 100); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
    const arc = (p1, p2, rr) => { const [x1, y1] = pt(p1, rr), [x2, y2] = pt(p2, rr); return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${rr} ${rr} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
    const zones = ZONES.map(([a, b, lv]) => `<path class="g-zone" data-z="${lv}" d="${arc(a + 0.9, b - 0.9, r)}" stroke="${LV[lv].c}"/>`).join("");
    let ticks = "";
    for (let p = -50; p <= 50; p += 5) {
      const major = p % 25 === 0, [x1, y1] = pt(p, r - 13), [x2, y2] = pt(p, r - (major ? 22 : 17));
      ticks += `<line class="g-tick${major ? " major" : ""}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
    }
    const lbl = (p, t) => { const [x, y] = pt(p, r - 34); return `<text class="g-lbl" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" direction="ltr">${t}</text>`; };
    return `<svg class="gauge" viewBox="0 0 240 124" aria-hidden="true">
      <path class="g-track" d="${arc(-50, 50, r)}"/>${zones}${ticks}
      ${lbl(-25, "−25")}${lbl(0, "0")}${lbl(25, "+25")}
      <text class="g-lbl" x="${(cx - r).toFixed(1)}" y="${cy + 15}" text-anchor="middle" direction="ltr">−50%</text>
      <text class="g-lbl" x="${(cx + r).toFixed(1)}" y="${cy + 15}" text-anchor="middle" direction="ltr">+50%</text>
      <g class="g-needle" data-needle style="transform-origin:${cx}px ${cy}px">
        <path d="M${cx - 4} ${cy} L${cx - 0.8} ${cy - r + 16} L${cx + 0.8} ${cy - r + 16} L${cx + 4} ${cy} Z"/>
      </g>
      <circle class="g-hub" cx="${cx}" cy="${cy}" r="9"/><circle class="g-hub-in" cx="${cx}" cy="${cy}" r="3.5"/>
    </svg>`;
  }
  function motionCard(id, periodWord, prevLabel, rangeLabel) {
    const row = (k, label) => `
      <div class="mo-row" data-k="${k}">
        <div class="mo-top">
          <div class="mo-figs">
            <div class="mo-lbl"><i></i>${label}</div>
            <div class="mo-val num" data-cur>0</div>
            <div class="mo-prev">${esc(prevLabel)} <b class="num" data-prev>0</b></div>
          </div>
          <div class="mo-chip" data-chip><span class="mo-ico" data-ico></span><span class="mo-chip-t"><b data-pct></b><small data-diff></small></span></div>
        </div>
        <div class="mo-plot" data-plot><svg></svg><span class="mo-ph" data-ph></span></div>
        <div class="mo-axis"><span data-a0></span><span data-a1></span></div>
      </div>`;
    return `<div class="card motion" id="${id}">
      <div class="mo-hero"><span class="mo-fx" data-fx aria-hidden="true"></span>
        <div class="mo-hero-t">
          <div class="mo-kicker">حركة ${esc(periodWord)} • ${esc(rangeLabel)}</div>
          <div class="mo-verdict" data-verdict><i></i><span>جاري المقارنة</span><img class="mo-emo" data-emo alt="" draggable="false"></div>
          <div class="mo-vs">مقارنة ب${esc(prevLabel)}</div>
          <div class="mo-sub" data-day>&nbsp;</div>
        </div>
        <div class="mo-gauge">${gaugeSvg()}<div class="mo-gread num" data-big>0%</div></div>
      </div>
      <div class="mo-body">
        ${row("sales", "المبيعات")}${row("collections", "التحصيلات")}
        <div class="mo-foot"><span class="mo-legend"><span><i class="lg cur"></i>${esc(periodWord)} ده</span><span><i class="lg prev"></i>${esc(prevLabel)}</span></span>
          <button class="mo-replay" data-replay aria-label="شغّل تاني"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 109-9"/><path d="M3 4v5h5"/></svg>شغّل تاني</button></div>
      </div>
    </div>`;
  }

  // cur/prev: [{d, sales, collections}] — totals: أرقام التقرير نفسها عشان النهاية تطابق جدول المقارنة
  function wireMotion(el, o) {
    if (!el) return;
    const DUR = 7500, STAGGER = 450, H = 132, PT = 16, PB = 10;
    const cur = o.cur || [], prev = o.prev || [];
    const n = Math.max(cur.length, prev.length, 2);
    const svgNS = "http://www.w3.org/2000/svg";
    const word = o.periodWord;
    const rows = [...el.querySelectorAll(".mo-row")].map((r) => {
      const k = r.dataset.k;
      const cc = cumulate(cur, k), pc = cumulate(prev, k);
      const ct = Number(o.totals[k]) || 0, pt = Number(o.prevTotals[k]) || 0;
      const pct = pt ? ((ct - pt) / pt) * 100 : 0;
      return { r, k, cc, pc, cm: monoSlopes(cc), pm: monoSlopes(pc), ct, pt, pct, mood: moodOf(pct, pt > 0, ct > 0), t: 0,
        plot: r.querySelector("[data-plot]"), ph: r.querySelector("[data-ph]"), chip: r.querySelector("[data-chip]"),
        ico: r.querySelector("[data-ico]"), vCur: r.querySelector("[data-cur]"), vPrev: r.querySelector("[data-prev]") };
    });
    rows.forEach((R) => {
      const a0 = R.r.querySelector("[data-a0]"), a1 = R.r.querySelector("[data-a1]");
      a0.textContent = cur[0] ? shortDate(cur[0].d) : "";
      a1.textContent = (cur.length > 1 || prev.length > 1) ? (cur[n - 1] ? shortDate(cur[n - 1].d) : "") : "";
    });
    const emoEl = el.querySelector("[data-emo]"), heroEl = el.querySelector(".mo-hero");
    const needle = el.querySelector("[data-needle]"), bigNum = el.querySelector("[data-big]"), zonesEl = [...el.querySelectorAll(".g-zone")];
    let gv = 0;                                   // مكان المؤشر دلوقتي (نسبة التغيير)
    const setGauge = (v, num, lvForce) => {
      gv = v;
      needle.style.transform = `rotate(${(clamp(v, -50, 50) / 50 * 90).toFixed(2)}deg)`;
      const lv = lvForce != null ? lvForce : lvOf(v);
      zonesEl.forEach((z) => z.classList.toggle("on", z.dataset.z === String(lv)));
      bigNum.textContent = signPct(num != null ? num : v);
      return lv;
    };
    const dayEl = el.querySelector("[data-day]"), verdictEl = el.querySelector("[data-verdict]");
    const totalPct = (() => {        // المزاج العام: المبيعات والتحصيلات بالنص
      const p = rows.filter((R) => R.pt > 0).map((R) => R.pct);
      return p.length ? p.reduce((a, b) => a + b, 0) / p.length : (rows.some((R) => R.ct > 0) ? 100 : 0);
    })();
    const overall = moodOf(totalPct, rows.some((R) => R.pt > 0), rows.some((R) => R.ct > 0));

    function build(R) {
      const W = Math.max(200, Math.round(R.plot.clientWidth || 300));
      const xAt = (f) => W - 8 - (f / (n - 1)) * (W - 16);              // الوقت من اليمين للشمال
      const max = Math.max(R.ct, R.pt, R.cc[R.cc.length - 1] || 0, R.pc[R.pc.length - 1] || 0, 1) * 1.08;
      const yAt = (v) => H - PB - (v / max) * (H - PT - PB);
      const pathOf = (ys, ms) => {
        if (!ys.length) return "";
        let d = `M${xAt(0).toFixed(1)} ${yAt(ys[0]).toFixed(1)}`;
        for (let i = 0; i < ys.length - 1; i++) {
          d += ` C${xAt(i + 1 / 3).toFixed(1)} ${yAt(ys[i] + ms[i] / 3).toFixed(1)} ${xAt(i + 2 / 3).toFixed(1)} ${yAt(ys[i + 1] - ms[i + 1] / 3).toFixed(1)} ${xAt(i + 1).toFixed(1)} ${yAt(ys[i + 1]).toFixed(1)}`;
        }
        return d;
      };
      const id = el.id + "-" + R.k;
      const cl = pathOf(R.cc, R.cm), pl = pathOf(R.pc, R.pm);
      const grid = [0.33, 0.66, 1].map((g) => `<line class="mo-grid" x1="0" x2="${W}" y1="${(H - PB - g * (H - PT - PB)).toFixed(1)}" y2="${(H - PB - g * (H - PT - PB)).toFixed(1)}"/>`).join("");
      const ticks = Array.from({ length: n }, (_, i) => `<circle class="mo-tick" cx="${xAt(i).toFixed(1)}" cy="${H - PB}" r="1.6"/>`).join("");
      const svg = R.plot.querySelector("svg");
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
      svg.innerHTML = `<defs>
          <linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--c);stop-opacity:.32"/><stop offset="1" style="stop-color:var(--c);stop-opacity:0"/></linearGradient>
          <clipPath id="${id}-c"><rect data-clip x="${W}" y="0" width="0" height="${H}"/></clipPath>
          <clipPath id="${id}-pc"><rect data-pclip x="${W}" y="0" width="0" height="${H}"/></clipPath></defs>
        ${grid}<line class="mo-baseline" x1="0" x2="${W}" y1="${H - PB}" y2="${H - PB}"/>${ticks}
        <path class="mo-prevline" clip-path="url(#${id}-pc)" d="${pl}"/>
        <g clip-path="url(#${id}-c)">
          ${cl ? `<path d="${cl} L${xAt(R.cc.length - 1).toFixed(1)} ${H - PB} L${xAt(0).toFixed(1)} ${H - PB} Z" fill="url(#${id}-g)"/>` : ""}
          <path class="mo-line-glow" d="${cl}"/><path class="mo-line" d="${cl}"/></g>
        <line class="mo-playhead" data-phl x1="0" x2="0" y1="${PT - 6}" y2="${H - PB}"/>
        ${R.pc.length ? `<circle class="mo-pdot" data-pdot r="4"/>` : ""}
        <circle class="mo-halo" data-halo r="11"/><circle class="mo-dot" data-dot r="6"/>`;
      R.W = W; R.xAt = xAt; R.yAt = yAt;
      R.clip = svg.querySelector("[data-clip]"); R.pclip = svg.querySelector("[data-pclip]");
      R.dot = svg.querySelector("[data-dot]"); R.halo = svg.querySelector("[data-halo]"); R.pdot = svg.querySelector("[data-pdot]"); R.phl = svg.querySelector("[data-phl]");
    }
    function draw(R, t) {
      R.t = t = clamp(t, 0, 1);
      const f = easeInOut(t) * (n - 1);
      const fc = Math.min(f, Math.max(R.cc.length - 1, 0)), fp = Math.min(f, Math.max(R.pc.length - 1, 0));
      const vc = R.cc.length ? monoAt(R.cc, R.cm, fc) : 0;
      const vp = R.pc.length ? monoAt(R.pc, R.pm, fp) : R.pt * easeInOut(t);
      const x = R.xAt(f), xc = R.xAt(fc);
      R.clip.setAttribute("x", (xc - 2).toFixed(1)); R.clip.setAttribute("width", (R.W - xc + 4).toFixed(1));
      R.pclip.setAttribute("x", (R.xAt(fp) - 2).toFixed(1)); R.pclip.setAttribute("width", (R.W - R.xAt(fp) + 4).toFixed(1));
      R.dot.setAttribute("cx", xc.toFixed(1)); R.dot.setAttribute("cy", R.yAt(vc).toFixed(1));
      R.halo.setAttribute("cx", xc.toFixed(1)); R.halo.setAttribute("cy", R.yAt(vc).toFixed(1));
      if (R.pdot) { R.pdot.setAttribute("cx", R.xAt(fp).toFixed(1)); R.pdot.setAttribute("cy", R.yAt(vp).toFixed(1)); }
      R.phl.setAttribute("x1", x.toFixed(1)); R.phl.setAttribute("x2", x.toFixed(1));
      const done = t >= 1;
      R.phl.style.opacity = done || t <= 0 ? 0 : 1;
      const i = Math.min(Math.round(f), n - 1), c = cur[i];
      R.ph.textContent = c ? shortDate(c.d) : "";
      const hw = (R.ph.offsetWidth || 60) / 2;          // العلامة ماتطلعش برة الرسم
      R.ph.style.left = clamp(x, hw, R.W - hw).toFixed(1) + "px";
      R.ph.style.opacity = done || t <= 0 ? 0 : 1;
      R.vCur.textContent = money(done ? R.ct : vc);
      R.vPrev.textContent = money(done ? R.pt : vp);
      R.plot.classList.toggle("live", !done && t > 0);
      return { f, vc, vp };
    }
    function chip(R, show) {
      const d = R.ct - R.pt, up = d > 0;
      R.chip.className = "mo-chip lv" + R.mood.lv + (show ? " show" : "");
      R.chip.querySelector("[data-pct]").innerHTML = !R.pt && !R.ct ? "مفيش حركة" : !R.pt ? "جديد" : Math.abs(R.pct) < 0.5 ? "زي اللي فات"
        : `${up ? "▲" : "▼"} <span class="num">${Math.abs(Math.round(R.pct))}%</span>`;
      R.chip.querySelector("[data-diff]").innerHTML = R.pt && d ? `${up ? "زيادة" : "نقص"} <span class="num">${money(Math.abs(d))}</span>` : "";
      R.ico.innerHTML = trendIcon(R.mood.lv);
    }
    const setVerdict = (txt, color) => {
      verdictEl.querySelector("span").textContent = txt;
      verdictEl.querySelector("i").style.background = color || "transparent";
    };
    function finale(animate) {
      const none = rows.every((R) => !R.ct && !R.pt);
      setVerdict(none ? "مفيش حركة" : LV[overall.lv].t, none ? "" : LV[overall.lv].c);
      verdictEl.classList.remove("in"); void verdictEl.offsetWidth; verdictEl.classList.add("in");
      if (!none) { emoEl.src = `${EMO[overall.lv]}.webp`; emoEl.classList.add("on"); emoEl.dataset.lv = overall.lv; }
      if (animate && !none && overall.lv >= 1) setTimeout(() => celebrate(heroEl, emoEl, overall.lv >= 2), 650);
      dayEl.innerHTML = rows.filter((R) => R.pt || R.ct).map((R) => `<div class="mo-m"><span>${R.k === "sales" ? "المبيعات" : "التحصيلات"}</span>
        <b class="num" style="color:${LV[R.mood.lv].c}">${!R.pt ? "جديد" : signPct(R.pct)}</b></div>`).join("") || esc(o.doneText || "");
      el.classList.add("done");
      bigNum.style.color = LV[overall.lv].c;
      const target = none ? 0 : totalPct;
      if (!animate) { setGauge(target, target, overall.lv); return; }
      // المؤشر بيستقر بحركة سوستة هادية
      const from = gv, s0 = performance.now();
      const spring = (now) => {
        if (!document.body.contains(el)) return;
        const t = (now - s0) / 1000;
        const v = target + (from - target) * Math.exp(-4.2 * t) * Math.cos(9 * t);
        const num = from + (target - from) * easeInOut(Math.min(1, t / 0.9));
        setGauge(v, num, overall.lv);
        if (t < 1.6) requestAnimationFrame(spring); else setGauge(target, target, overall.lv);
      };
      requestAnimationFrame(spring);
    }
    let raf = 0;
    function reset() {
      rows.forEach((R) => { draw(R, 0); chip(R, false); });
      setVerdict("جاري المقارنة", ""); verdictEl.classList.remove("in");
      emoEl.classList.remove("on"); heroEl.classList.remove("shine"); const fx = heroEl.querySelector("[data-fx]"); if (fx) fx.innerHTML = "";
      el.classList.remove("done"); bigNum.style.color = "";
      setGauge(0, 0);
      dayEl.innerHTML = "&nbsp;";
    }
    // elapsed: لو الصفحة اتحدثت والحركة شغالة، نكمل من نفس النقطة بدل ما نقفز للآخر
    function play(elapsed) {
      elapsed = typeof elapsed === "number" ? elapsed : 0;
      cancelAnimationFrame(raf);
      if (!elapsed) motionPlayed[o.key] = Date.now();
      reset();
      const t0 = performance.now() - elapsed;
      let fin = false;
      const step = (now) => {
        if (!document.body.contains(el)) return;
        let all = true, lead = null, sumP = 0, cntP = 0;
        rows.forEach((R, idx) => {
          const t = (now - t0 - idx * STAGGER) / DUR;
          const s = draw(R, t);
          if (idx === 0) lead = s;
          if (t >= 1) { if (!R.chip.classList.contains("show")) chip(R, true); } else all = false;
          if (R.pt > 0 && t > 0) { sumP += ((s.vc - s.vp) / Math.max(s.vp, R.pt * 0.15)) * 100; cntP++; }
        });
        // المؤشر بيتحرك مع الأيام: سابقين ولا متأخرين عن نفس النقطة في الفترة اللي فاتت
        if (cntP) setGauge(gv + (sumP / cntP - gv) * 0.05);
        if (lead) {
          const i = Math.min(Math.round(lead.f), n - 1), c = cur[i];
          dayEl.innerHTML = `<div class="mo-m"><span>${c ? esc(WEEKDAY(c.d) + " " + shortDate(c.d)) : ""}</span><b class="num">${i + 1}/${n}</b></div>`;
        }
        if (all) { if (!fin) { fin = true; finale(true); } return; }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    function finalState() { rows.forEach((R) => { draw(R, 1); chip(R, true); }); finale(false); }
    rows.forEach(build);
    el.querySelector("[data-replay]").onclick = () => play(0);
    el.querySelectorAll(".mo-plot").forEach((p) => (p.onclick = () => play(0)));
    el.querySelector(".mo-gauge").onclick = () => play(0);
    let rz = 0;
    const onResize = () => { if (!document.body.contains(el)) { removeEventListener("resize", onResize); return; }
      clearTimeout(rz); rz = setTimeout(() => rows.forEach((R) => { const t = R.t; build(R); draw(R, t); }), 120); };
    addEventListener("resize", onResize);
    const since = motionPlayed[o.key] ? Date.now() - motionPlayed[o.key] : null;
    const total = DUR + STAGGER * (rows.length - 1) + 200;
    if (since != null && since < total) { play(since); return; }          // اتحدثت وهي شغالة: كمّل
    if (since != null && since < 60000) { finalState(); return; }          // لسه متفرج عليها حالاً
    reset();
    if (!("IntersectionObserver" in window)) { setTimeout(() => play(0), 300); return; }
    const io = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting)) { io.disconnect(); setTimeout(() => play(0), 300); }
    }, { threshold: 0.2 });
    io.observe(el);
  }

  async function viewPeriod(kind, key) {
    if (!isBoss()) { location.hash = "#/"; return; }
    const today = cairoToday();
    const isWeek = kind === "week";
    const end = isWeek ? lastThursday(key || today) : null;
    const ym = isWeek ? null : (key || today).slice(0, 7);
    const label = isWeek ? `${shortDate(addDays(end, -6))} – ${shortDate(end)}` : monthLong(ym);
    const canNext = isWeek ? end < today : ym < today.slice(0, 7);
    const main = shell({ title: isWeek ? "التقرير الأسبوعي" : "التقرير الشهري", back: true, actions: shareBtn }, `
      <div class="date-nav">
        <button class="icon-btn" style="color:var(--accent)" id="prev" aria-label="اللي قبله">${I.back}</button>
        <div class="input center" style="display:grid;place-items:center;font-weight:700">${esc(label)}</div>
        <button class="icon-btn" style="color:var(--accent);transform:scaleX(-1)" id="next" aria-label="اللي بعده" ${canNext ? "" : "disabled"}>${I.back}</button>
      </div>
      <div id="wk">${loading}</div>`);
    document.getElementById("prev").onclick = () => (location.hash = isWeek ? "#/week/" + addDays(end, -7) : "#/month/" + addMonths(ym, -1));
    document.getElementById("next").onclick = () => { if (canNext) location.hash = isWeek ? "#/week/" + addDays(end, 7) : "#/month/" + addMonths(ym, 1); };
    let r;
    try { r = isWeek ? await call("weekly_report", { p_end: end }, { swr: true }) : await call("monthly_report", { p_month: ym + "-01" }, { swr: true }); }
    catch (e) { document.getElementById("wk").innerHTML = errBox(e); return; }
    const w = r.data || {}, t = w.totals || {}, pv = w.prev || {}, ag = w.aging || {}, cu = w.customers || {}, sk = w.stock || {}, sd = w.supplier_dues || {};
    const kpi = (label, key, cls, sub) => `<div class="kpi"><div class="k-label">${label}</div><div class="k-value num ${cls || ""}">${money(t[key])}</div>
      <div class="k-sub">${change(t[key], pv[key])} ${sub || ""}</div></div>`;
    const days = (w.daily || []).map((d) => ({ v: d.sales, d: d.d }));
    const inProgress = isWeek ? end >= today : !!w.partial;
    const curLabel = isWeek ? "الأسبوع ده" : monthOnly(ym);
    const prevLabel = isWeek ? "الأسبوع اللي فات" : monthOnly(w.prev_start || addMonths(ym, -1));
    const periodWord = isWeek ? "الأسبوع" : "الشهر";
    const box = document.getElementById("wk");
    box.innerHTML = `
      ${staleNote(r)}
      <div class="muted center small" style="margin:-4px 0 10px">${inProgress ? periodWord + " ده لحد دلوقتي • " : ""}مقارنة بـ ${esc(shortDate(w.prev_start))} – ${esc(shortDate(w.prev_end))}${inProgress && !isWeek ? " (نفس عدد الأيام)" : ""}</div>
      ${motionCard("mo-" + kind, periodWord, prevLabel, label)}
      ${compareCard(t, pv, curLabel, prevLabel)}
      <div class="kpis">
        <div class="kpi hero"><div class="k-label">مبيعات ${periodWord}</div><div class="k-value num" data-count="${Math.round(Number(t.sales) || 0)}">${money(t.sales)}</div>
          <div class="k-sub">${t.sales_count || 0} فاتورة • ${t.customers || 0} عميل • ${esc(prevLabel)} <span class="num">${money(pv.sales)}</span> ${change(t.sales, pv.sales)}</div></div>
        ${kpi("التحصيلات", "collections", "plus", `• ${t.collections_count || 0} سند`)}
        ${kpi("المشتريات", "purchases", "", `• ${t.purchases_count || 0} فاتورة`)}
        ${kpi("سداد للموردين", "supplier_payments", "minus")}
        ${kpi("مرتجعات البيع", "sales_returns", "")}
        ${kpi("المصروفات", "expenses", "")}
        <div class="kpi"><div class="k-label">آجل من المبيعات</div><div class="k-value num">${money(t.sales_credit)}</div><div class="k-sub">نقدي <span class="num">${money((t.sales || 0) - (t.sales_credit || 0))}</span></div></div>
      </div>
      <div class="card">${barChart(days, "المبيعات يوم بيوم", "ج", { cap: (p) => WEEKDAY(p.d) + " " + shortDate(p.d), label: (p) => isWeek ? WEEKDAY(p.d).replace("ال", "").slice(0, 3) : (Number(p.d.slice(8)) % 5 === 1 ? Number(p.d.slice(8)) : "") })}</div>

      ${(w.top_customers || []).length ? `<div class="section-title"><span>أكبر العملاء ${isWeek ? "الأسبوع ده" : "الشهر ده"}</span></div>
        <div class="list">${w.top_customers.map((c) => `<a class="list-item" ${c.key ? `href="#/party/${encodeURIComponent(c.key)}"` : ""}>
          ${rankAvatar(w.top_customers.indexOf(c))}<div class="grow"><div class="title ellipsis">${esc(c.name)}</div><div class="sub">${c.invoices} فاتورة</div></div>
          <div class="end"><div class="bal num">${money(c.sales)}</div></div></a>`).join("")}</div>` : ""}

      ${(w.top_items || []).length ? `<div class="section-title"><span>أكتر الأصناف مبيعاً</span></div>
        <div class="list">${w.top_items.map((i) => `<a class="list-item" href="#/item/${encodeURIComponent(i.code)}">
          <div class="grow"><div class="title ellipsis">${esc(i.name)}</div><div class="sub">اتباع <b class="num">${qty(i.qty)}</b> ${esc(i.unit || "")} • الرصيد دلوقتي <span class="num ${Number(i.stock) <= 0 ? "minus" : ""}">${qty(i.stock)}</span></div></div>
          <div class="end"><div class="bal num">${money(i.value)}</div></div></a>`).join("")}</div>` : ""}

      ${(w.top_suppliers || []).length ? `<div class="section-title"><span>أكبر الموردين (مشتريات)</span></div>
        <div class="list">${w.top_suppliers.map((s) => `<a class="list-item" ${s.key ? `href="#/party/${encodeURIComponent(s.key)}"` : ""}>
          <div class="grow"><div class="title ellipsis">${esc(s.name)}</div><div class="sub">${s.invoices} فاتورة</div></div>
          <div class="end"><div class="bal num">${money(s.purchases)}</div></div></a>`).join("")}</div>` : ""}

      ${(w.new_customers || []).length ? `<div class="section-title"><span>عملاء جداد</span><small>${w.new_customers.length}</small></div>
        <div class="list">${w.new_customers.map((c) => `<a class="list-item" href="#/party/${encodeURIComponent(c.key)}">
          <div class="grow"><div class="title ellipsis">${esc(c.name)}</div><div class="sub">أول فاتورة ${fmtDate(c.first)}</div></div>
          <div class="end"><div class="bal num">${money(c.sales)}</div></div></a>`).join("")}</div>` : ""}

      <div class="section-title"><span>أعمار الديون على العملاء</span><small>الإجمالي <span class="num">${money(ag.total)}</span></small></div>
      <div class="card">
        <div class="kvs">
          <div class="kv"><span>أقل من شهر</span><b class="num">${money(ag.d0_30)}</b></div>
          <div class="kv"><span>من شهر لشهرين</span><b class="num">${money(ag.d31_60)}</b></div>
          <div class="kv"><span>من شهرين لـ 3 شهور</span><b class="num">${money(ag.d61_90)}</b></div>
          <div class="kv"><span>أكتر من 3 شهور</span><b class="num minus">${money(ag.d90)}</b></div>
        </div>
        <div class="stat-boxes">
          <a class="stat-box alt" href="#/customers" onclick="sessionStorage.setItem('f-cust','overdue')"><div class="sb-l">متأخرين في السداد</div><div class="sb-v num">${cu.overdue || 0}</div><div class="sb-s">مبلغ <span class="num">${money(cu.overdue_amount)}</span></div></a>
          <a class="stat-box" href="#/customers" onclick="sessionStorage.setItem('f-cust','stopped')"><div class="sb-l">عملاء وقفوا شراء</div><div class="sb-v num">${cu.stopped || 0}</div><div class="sb-s">متأخرين في الشراء ${cu.late || 0}</div></a>
        </div>
      </div>
      ${(cu.top_overdue || []).length ? `<div class="section-title"><span>أكبر المتأخرين في السداد</span></div>
        <div class="list">${cu.top_overdue.map((c) => `<a class="list-item" href="#/party/${encodeURIComponent(c.key)}"><div class="grow"><div class="title ellipsis">${esc(c.name)}</div>
          <div class="sub">ما دفعش من <span class="num">${c.days}</span> يوم</div></div><div class="end"><div class="bal owe num">${money(c.amount)}</div></div></a>`).join("")}</div>` : ""}
      ${(cu.top_stopped || []).length ? `<div class="section-title"><span>أكبر العملاء اللي وقفوا</span></div>
        <div class="list">${cu.top_stopped.map((c) => `<a class="list-item" href="#/party/${encodeURIComponent(c.key)}"><div class="grow"><div class="title ellipsis">${esc(c.name)}</div>
          <div class="sub">آخر فاتورة من <span class="num">${c.days}</span> يوم</div></div><div class="end"><div class="bal num">${money(c.value_12)}</div><div class="bal-label">مشتريات سنة</div></div></a>`).join("")}</div>` : ""}

      <div class="section-title"><span>صحة المخزون</span></div>
      <div class="kpis">
        <a class="kpi" href="#/stock" onclick="sessionStorage.setItem('f-stock','attention')"><div class="k-label">محتاج طلب</div><div class="k-value num">${(sk.out || 0) + (sk.below_safety || 0) + (sk.reorder || 0)}</div><div class="k-sub">نفد ${sk.out || 0} • تحت الأمان ${sk.below_safety || 0} • وقت الطلب ${sk.reorder || 0}</div></a>
        <a class="kpi" href="#/stock" onclick="sessionStorage.setItem('f-stock','dead')"><div class="k-label">راكد</div><div class="k-value num">${sk.dead || 0}</div><div class="k-sub">بقيمة <span class="num">${money(sk.dead_value)}</span></div></a>
        <div class="kpi"><div class="k-label">قيمة المخزون</div><div class="k-value num">${money(sk.stock_value)}</div><div class="k-sub">زيادة عن الحد ${sk.over || 0} صنف</div></div>
        <div class="kpi"><div class="k-label">دوران المخزن</div><div class="k-value num">${turnTxt(sk.turnover_365)}</div><div class="k-sub">مرة في السنة</div></div>
      </div>
      ${sd.count ? `<a class="card row" href="#/alerts" style="color:inherit"><div class="grow"><b>مستحق للموردين بعد المهلة</b><div class="small muted">${sd.count} مورد</div></div><div class="bal num">${money(sd.amount)}</div></a>` : ""}
      <div class="muted small center" style="margin:12px 0">آخر تحديث من جهاز الحسابات ${esc(ago(w.last_sync))}</div>`;
    wireCharts(box, "ج");
    countUp(box);
    wireShare(() => sharePeriod(w, isWeek, label, prevLabel));
    const curDays = (w.daily || []).filter((d) => d.d <= today);
    wireMotion(document.getElementById("mo-" + kind), {
      key: kind + ":" + (isWeek ? end : ym), cur: curDays, prev: w.prev_daily || [],
      totals: t, prevTotals: pv, periodWord, prevWord: prevLabel,
      doneText: (inProgress ? periodWord + " ده لحد النهارده" : periodWord + " كله") + " • دوس على الرسم يتعاد",
    });
  }

  // ---------- تحليل المخزن ----------
  function stockRow(i) {
    const right = i.suggest_qty > 0
      ? `<div class="bal owe num">${qty(i.suggest_qty)}</div><div class="bal-label">اطلب</div>`
      : `<div class="bal num">${turnTxt(i.turnover_365)}</div><div class="bal-label">دوران</div>`;
    const parts = [`رصيد <span class="num">${qty(i.stock)}</span>`];
    if (i.active && i.reorder_point > 0) parts.push(`الطلب عند <span class="num">${qty(i.reorder_point)}</span>`);
    if (i.days_cover != null && i.stock > 0) parts.push(`يكفي <span class="num">${qty(i.days_cover)}</span> يوم`);
    if (i.days_out > 0) parts.push(`خلصان ${daysTxt(i.days_out)}`);
    return `<a class="list-item" href="#/item/${encodeURIComponent(i.code)}">
      <div class="grow">
        <div class="title ellipsis">${esc(i.name)}</div>
        <div class="sub">${tagStatus(i.status)} ${tagAbc(i.abc)} ${parts.join(" • ")}</div>
      </div>
      <div class="end">${right}</div></a>`;
  }

  // ---------- تقرير معدل دوران المخزون ----------
  async function viewTurnover() {
    if (!isBoss()) { location.hash = "#/"; return; }
    shell({ title: "معدل دوران المخزون", back: true }, `
      <div class="elite-intro"><div class="ei-ico">↻</div><div class="grow"><b>معدل الدوران</b>
        <div class="small">الصنف بيتباع ويتجدد في المخزن كام مرة في السنة = مبيعات آخر 12 شهر ÷ متوسط الرصيد. كل ما الرقم يعلى، الصنف بيلف أسرع وفلوسه مش واقفة.</div></div></div>
      <div id="tov">${loading}</div>`);
    let r;
    try { r = await call("items_list", { p_kind: "turnover", p_limit: 300 }, { swr: true }); }
    catch (e) { document.getElementById("tov").innerHTML = errBox(e); return; }
    const list = r.data || [];
    const el = document.getElementById("tov");
    if (!el) return;
    el.innerHTML = staleNote(r) + (list.length ? `<p class="small muted" style="margin:0 4px 8px">${list.length} صنف — الأصناف اللي كانت موجودة في المخزن أغلب السنة بس، عشان الرقم يبقى صح</p>
      <div class="list">${list.map((i, n) => `<a class="list-item" href="#/item/${encodeURIComponent(i.code)}">${rankAvatar(n)}
        <div class="grow"><div class="title ellipsis">${esc(i.name)}</div>
        <div class="sub">بيع شهري <span class="num">${qty(i.avg_month)}</span> • رصيد <span class="num ${i.stock <= 0 ? "minus" : ""}">${qty(i.stock)}</span>${i.days_cover != null && i.stock > 0 ? ` • يكفي <span class="num">${qty(i.days_cover)}</span> يوم` : ""}</div></div>
        <div class="end"><div class="bal val-pill num">${turnTxt(i.turnover_365)}</div><div class="bal-label">مرة في السنة</div></div></a>`).join("")}</div>`
      : empty("مفيش بيانات كفاية لحساب الدوران"));
  }

  function viewStock() {
    if (!isBoss()) { location.hash = "#/"; return; }
    const filters = [["attention", "محتاج تصرف"], ["out", "نفد"], ["below_safety", "تحت الأمان"], ["reorder", "وقت الطلب"],
      ["over", "زيادة"], ["dead", "راكد"], ["negative", "رصيد سالب"], ["fast", "سريع الحركة"], ["slow", "بطيء"], ["all", "الكل"]];
    let filter = sessionStorage.getItem("f-stock") || "attention";
    shell({ title: "تحليل المخزن", back: true }, `
      <div id="sum"></div>
      <div class="search">${I.search}<input class="input" id="q" type="search" placeholder="اسم الصنف أو الكود" autocomplete="off"></div>
      <div class="chips" id="chips">${filters.map(([k, l]) => `<button class="chip ${k === filter ? "on" : ""}" data-f="${k}">${l}</button>`).join("")}</div>
      <div id="res">${loading}</div>`);
    const q = document.getElementById("q");
    let seq = 0, t;
    const load = async () => {
      const my = ++seq;
      const res = document.getElementById("res");
      if (res) res.innerHTML = loading;
      try {
        const r = await call("stock_analysis", { p_status: filter, p_q: q.value.trim(), p_limit: 300 });
        if (my !== seq || !document.getElementById("res")) return;
        const d = r.data || {}, s = d.summary || {};
        document.getElementById("sum").innerHTML = `
          <div class="kpis">
            <div class="kpi"><div class="k-label">دوران المخزن</div><div class="k-value num">${turnTxt(s.turnover_365)}</div><div class="k-sub">مرة في السنة (آخر 12 شهر)</div></div>
            <div class="kpi"><div class="k-label">قيمة المخزون</div><div class="k-value num">${money(s.stock_value)}</div><div class="k-sub">راكد <span class="num">${money(s.dead_value)}</span></div></div>
          </div>`;
        document.querySelectorAll("#chips .chip").forEach((c) => {
          const k = c.dataset.f, label = filters.find((f) => f[0] === k)[1];
          const n = k === "all" ? s.active : s[k];
          c.textContent = n != null ? `${label} (${n})` : label;
        });
        const items = d.items || [];
        res.innerHTML = staleNote(r) + (items.length ? `<div class="list">${items.map(stockRow).join("")}</div>
          ${items.length >= 300 ? `<p class="small muted center">بيظهر أول 300 بس — استخدم البحث</p>` : ""}` : empty("مفيش أصناف هنا 👌"))
          + `<p class="small muted" style="margin:12px 4px">آخر حساب للتحليل ${esc(ago(d.computed_at))} • بيتحسب تلقائي كل 3 ساعات</p>`;
      } catch (e) { const res2 = document.getElementById("res"); if (my === seq && res2) res2.innerHTML = errBox(e); }
    };
    q.oninput = () => { clearTimeout(t); t = setTimeout(load, 350); };
    document.getElementById("chips").onclick = (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      filter = b.dataset.f; sessionStorage.setItem("f-stock", filter);
      document.querySelectorAll("#chips .chip").forEach((c) => c.classList.toggle("on", c === b));
      load();
    };
    load();
  }

  // ---------- تحليل العملاء ----------
  function custRow(c, filter) {
    let sub = [], right = "";
    if (c.pay_status === "overdue" && (filter === "overdue" || filter === "all")) {
      sub.push(`ما دفعش من <span class="num">${c.oldest_days}</span> يوم${c.last_pay ? ` (آخر دفعة ${fmtDate(c.last_pay)})` : ""}`);
      right = `<div class="bal owe num">${money(c.overdue_amount)}</div><div class="bal-label">عليه</div>`;
    }
    if (c.last_inv) sub.push(`آخر فاتورة من <span class="num">${c.days_since_inv}</span> يوم`);
    if (c.avg_gap && (filter === "late" || filter === "stopped")) sub.push(`عادته كل <span class="num">${Math.round(c.avg_gap)}</span> يوم`);
    if (c.season_in_days != null) sub.push(`موسمه بعد <span class="num">${c.season_in_days}</span> يوم`);
    if (!right) right = `<div class="bal num">${money(c.value_12)}</div><div class="bal-label">مشتريات سنة</div>`;
    const ptag = c.pattern ? `<span class="tag gray">${esc(PATTERN[c.pattern] || c.pattern)}</span>` : "";
    const btag = c.buy_status === "stopped" ? `<span class="tag red">متوقف</span>` : c.buy_status === "late" ? `<span class="tag">متأخر في الشراء</span>` : "";
    const av = c.pay_status === "overdue" ? `<div class="avatar k-late">${I.clock}</div>`
      : c.buy_status === "stopped" ? `<div class="avatar k-stop">${I.pause}</div>`
      : `<div class="avatar k-credit">${I.cust}${c.abc ? `<i class="abc ${esc(c.abc)}">${esc(c.abc)}</i>` : ""}</div>`;
    return `<a class="list-item" href="#/party/${encodeURIComponent(c.key)}">
      ${av}
      <div class="grow"><div class="title ellipsis">${esc(c.name)}</div>
        <div class="sub">${tagAbc(c.abc)} ${ptag} ${btag} ${sub.join(" • ")}</div></div>
      <div class="end">${right}</div></a>`;
  }

  function viewCustomers(f) {
    if (!isBoss()) { location.hash = "#/"; return; }
    if (f) sessionStorage.setItem("f-cust", f);
    const filters = [["overdue", "متأخر في السداد"], ["late", "متأخر في الشراء"], ["stopped", "متوقف"], ["seasonal", "موسمي"],
      ["A", "فئة A"], ["B", "فئة B"], ["C", "فئة C"], ["all", "الكل"]];
    let filter = sessionStorage.getItem("f-cust") || "overdue";
    shell({ title: "تحليل العملاء", back: true }, `
      <div id="sum"></div>
      <div class="search">${I.search}<input class="input" id="q" type="search" placeholder="اسم العميل أو الكود" autocomplete="off"></div>
      <div class="chips" id="chips">${filters.map(([k, l]) => `<button class="chip ${k === filter ? "on" : ""}" data-f="${k}">${l}</button>`).join("")}</div>
      <div id="res">${loading}</div>`);
    const q = document.getElementById("q");
    let seq = 0, t;
    const load = async () => {
      const my = ++seq;
      const res = document.getElementById("res");
      if (res) res.innerHTML = loading;
      try {
        const r = await call("customer_analysis", { p_filter: filter, p_q: q.value.trim(), p_limit: 300 });
        if (my !== seq || !document.getElementById("res")) return;
        const d = r.data || {}, s = d.summary || {};
        document.getElementById("sum").innerHTML = `
          <div class="kpis">
            <div class="kpi"><div class="k-label">إجمالي اللي على العملاء</div><div class="k-value num">${money(s.receivable)}</div><div class="k-sub">متأخر منه <span class="num">${money(s.overdue_amount)}</span></div></div>
            <div class="kpi"><div class="k-label">عملاء اشتروا السنة دي</div><div class="k-value num">${s.active_12 || 0}</div><div class="k-sub">منتظم ${s.regular || 0} • صفقات ${s.deal || 0} • موسمي ${s.seasonal || 0}</div></div>
          </div>`;
        document.querySelectorAll("#chips .chip").forEach((c) => {
          const k = c.dataset.f, label = filters.find((f) => f[0] === k)[1];
          const n = k === "all" ? null : s[k];
          c.textContent = n != null ? `${label} (${n})` : label;
        });
        const list = d.customers || [];
        res.innerHTML = staleNote(r) + (list.length ? `<div class="list">${list.map((c) => custRow(c, filter)).join("")}</div>` : empty("مفيش عملاء هنا 👌"))
          + `<p class="small muted" style="margin:12px 4px">آخر حساب للتحليل ${esc(ago(d.computed_at))}. مهلة السداد الافتراضية والاستثناءات بتتظبط من إعدادات التحليل أو من صفحة العميل.</p>`;
      } catch (e) { const res2 = document.getElementById("res"); if (my === seq && res2) res2.innerHTML = errBox(e); }
    };
    q.oninput = () => { clearTimeout(t); t = setTimeout(load, 350); };
    document.getElementById("chips").onclick = (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      filter = b.dataset.f; sessionStorage.setItem("f-cust", filter);
      document.querySelectorAll("#chips .chip").forEach((c) => c.classList.toggle("on", c === b));
      load();
    };
    load();
  }

  // ---------- التنبيهات ----------
  async function viewAlerts() {
    if (!isBoss()) { location.hash = "#/"; return; }
    const main = shell({ title: "التنبيهات", back: true }, loading);
    let r;
    try { r = await call("alerts_list", {}, { swr: true }); } catch (e) { main.innerHTML = errBox(e); return; }
    const a = r.data || {};
    const sec = (title, list, row, note) => {
      if (!list || !list.length) return "";
      const id = "s" + Math.random().toString(36).slice(2, 7);
      return `<div class="section-title"><span>${title}</span><small>${list.length}</small></div>
        ${note ? `<p class="small muted" style="margin:-4px 4px 8px">${note}</p>` : ""}
        <div class="list" id="${id}">${list.slice(0, 5).map(row).join("")}</div>
        ${list.length > 5 ? `<button class="btn ghost more" data-more="${id}" data-n="${list.length}">عرض الكل (${list.length})</button>` : ""}
        <template id="${id}-all">${list.slice(5).map(row).join("")}</template>`;
    };
    const partyLink = (x, line, amt, cls) => `<a class="list-item" href="#/party/${encodeURIComponent(x.key)}"><div class="grow"><div class="title ellipsis">${esc(x.name)}</div><div class="sub">${line}</div></div>${amt != null ? `<div class="end"><div class="bal ${cls || ""} num">${money(amt)}</div></div>` : ""}</a>`;
    const itemLink = (x, line, right) => `<a class="list-item" href="#/item/${encodeURIComponent(x.code)}"><div class="grow"><div class="title ellipsis">${esc(x.name)}</div><div class="sub">${line}</div></div>${right ? `<div class="end">${right}</div>` : ""}</a>`;
    const html = [
      sec("عملاء متأخرين في السداد", a.overdue_customers, (x) => partyLink(x, `ما دفعش من <span class="num">${x.days}</span> يوم • المهلة ${x.grace} يوم`, x.amount, "owe")),
      sec("مستحق للموردين", a.supplier_dues, (x) => partyLink(x, `أقدم فاتورة من <span class="num">${x.days}</span> يوم • المهلة ${x.grace} يوم`, x.amount, "credit")),
      sec("أصناف تحت مخزون الأمان", a.below_safety, (x) => itemLink(x, `${tagAbc(x.abc)} رصيد <span class="num">${qty(x.stock)}</span> • الأمان <span class="num">${qty(x.safety)}</span>`, x.suggest ? `<div class="bal owe num">${qty(x.suggest)}</div><div class="bal-label">اطلب</div>` : "")),
      sec("أصناف خلصت ومتجابتش", a.out_no_restock, (x) => itemLink(x, `${tagAbc(x.abc)} خلصان ${daysTxt(x.days)}${x.stock < 0 ? ` • رصيد سالب <span class="num">${qty(x.stock)}</span>` : ""}`, x.suggest ? `<div class="bal owe num">${qty(x.suggest)}</div><div class="bal-label">اطلب</div>` : "")),
      sec("عملاء موسمهم قرب", a.season_soon, (x) => partyLink(x, `الموسم بعد <span class="num">${x.days}</span> يوم • ${(x.months || []).map((m) => MONTHS[m - 1]).join("، ")}`)),
      sec("عملاء متأخرين في الشراء", a.late_buyers, (x) => partyLink(x, `${tagAbc(x.abc)} آخر فاتورة من <span class="num">${x.days}</span> يوم • عادته كل <span class="num">${Math.round(x.avg_gap || 0)}</span> يوم`)),
      sec("أصناف زيادة عن الحد الأقصى", a.overstock, (x) => itemLink(x, `رصيد <span class="num">${qty(x.stock)}</span> • الحد الأقصى <span class="num">${qty(x.max)}</span>${x.days_cover != null ? ` • يكفي <span class="num">${qty(x.days_cover)}</span> يوم` : ""}`)),
    ].join("");
    main.innerHTML = staleNote(r) + `<div id="recent"></div>` + (html || empty("مفيش تنبيهات دلوقتي 👌"));
    call("recent_alert_events", { p_limit: 30 }, { swr: true }).then((rr) => {
      const list = rr.data || [], el = document.getElementById("recent");
      if (!el || !list.length) return;
      el.innerHTML = `<div class="section-title"><span>آخر الإشعارات الفورية</span><small>${list.length}</small></div>
        <div class="list">${list.slice(0, 8).map((e) => `<a class="mv" href="${esc((e.url || "#/").replace(/^\.\//, ""))}">
          <div class="t">${esc(e.title)}</div><div class="d" style="text-align:left">${esc(ago(e.at))}</div>
          <div class="d" style="grid-column:1/-1">${esc(e.body)}</div></a>`).join("")}</div>`;
    }).catch(() => {});
    main.querySelectorAll("[data-more]").forEach((b) => (b.onclick = () => {
      const list = document.getElementById(b.dataset.more);
      list.insertAdjacentHTML("beforeend", document.getElementById(b.dataset.more + "-all").innerHTML);
      b.remove();
    }));
  }

  // ---------- تحليل الصنف (جوه كارت الصنف) ----------
  async function renderItemAnalysis(el, code) {
    let r;
    try { r = await call("item_analysis", { p_code: code }, { swr: true }); } catch (e) { el.innerHTML = ""; return; }
    const a = r.data;
    if (!a || !document.body.contains(el)) { el.innerHTML = ""; return; }
    const pts = (a.monthly || []).map((m) => ({ m: m.m, v: m.sold }));
    const quiet = !(Number(a.avg_month) > 0) && !(Number(a.sold_90) > 0);       // صنف مش بيتحرك
    const sinceSale = a.last_sale ? Math.round((Date.parse(cairoToday()) - Date.parse(String(a.last_sale).slice(0, 10))) / 864e5) : null;
    const row = (label, val, auto) => `<div class="kv"><span>${label}</span><b class="num">${val}</b>${auto != null ? `<small class="muted">(التلقائي <span class="num">${auto}</span>)</small>` : ""}</div>`;
    const locked = a.locked;
    el.innerHTML = `
      <div class="section-title"><span>تحليل الصنف</span><small>${tagStatus(a.status)}</small></div>
      <div class="card stack">
        <div class="row" style="flex-wrap:wrap;gap:6px">
          <span class="tag gray">${esc(MOVEMENT[a.movement] || "")}</span> ${tagAbc(a.abc)}
          ${locked ? `<span class="tag">🔒 قيم يدوية</span>` : ""} ${a.excluded ? `<span class="tag gray">مستبعد من التنبيهات</span>` : ""}
        </div>
        ${a.suggest_qty > 0 ? `<div class="card soft" style="margin:0"><b>محتاج تطلب حوالي <span class="num">${qty(a.suggest_qty)}</span> ${esc(a.unit || "")}</b><div class="small">عشان توصل للحد الأقصى (<span class="num">${qty(a.max_stock)}</span>)</div></div>` : ""}
        ${quiet ? `<div class="quiet-note">${I.pause}<div><b>صنف مش بيتحرك</b><div class="small">${a.last_sale ? `آخر بيع ${fmtDate(a.last_sale)} (من <span class="num">${sinceSale}</span> يوم)` : "ما اتباعش خالص في آخر سنة"}${Number(a.stock) > 0 ? ` • عليه رصيد <span class="num">${qty(a.stock)}</span> ${esc(a.unit || "")}` : ""}</div></div></div>` : ""}
        <div class="kpis" style="margin:0" ${quiet ? "hidden" : ""}>
          <div class="kpi"><div class="k-label">متوسط البيع في الشهر</div><div class="k-value num">${qty(a.avg_month)}</div><div class="k-sub">آخر 3 شهور: <span class="num">${qty(a.sold_90)}</span></div></div>
          <div class="kpi"><div class="k-label">الرصيد يكفي</div><div class="k-value num">${a.days_cover != null ? qty(a.days_cover) : "—"}</div><div class="k-sub">يوم بمعدل البيع الحالي</div></div>
          <div class="kpi"><div class="k-label">معدل الدوران (12 شهر)</div><div class="k-value num">${turnTxt(a.turnover_365)}</div><div class="k-sub">مرة في السنة</div></div>
          <div class="kpi"><div class="k-label">معدل الدوران (3 شهور)</div><div class="k-value num">${turnTxt(a.turnover_90)}</div><div class="k-sub">بمعدل سنوي</div></div>
        </div>
        <div class="kvs">
          ${quiet && !locked && !(a.safety_stock > 0) ? "" : row("مخزون الأمان", qty(a.safety_stock), locked && a.safety_stock !== a.auto_safety_stock ? qty(a.auto_safety_stock) : null)}
          ${quiet && !locked && !(a.reorder_point > 0) ? "" : row("نقطة إعادة الطلب", qty(a.reorder_point), locked && a.reorder_point !== a.auto_reorder_point ? qty(a.auto_reorder_point) : null)}
          ${quiet && !locked && !(a.max_stock > 0) ? "" : row("الحد الأقصى", qty(a.max_stock), locked && a.max_stock !== a.auto_max_stock ? qty(a.auto_max_stock) : null)}
          ${row("مدة التوريد", qty(a.lead_days) + " يوم")}
          ${row("أيام الرصيد صفر (آخر سنة)", qty(a.zero_days_365) + " يوم")}
          ${a.last_purchase ? row("آخر شراء", fmtDate(a.last_purchase)) : ""}
        </div>
        ${pts.some((x) => Number(x.v) > 0) ? barChart(pts, "المبيعات آخر 12 شهر", a.unit || "") : ""}
        ${a.override_note ? `<div class="small muted">ملاحظة: ${esc(a.override_note)}</div>` : ""}
        ${isBoss() ? `<button class="btn ghost" id="ovr">تعديل يدوي وقفل</button><div id="ovrf"></div>` : ""}
        <div class="small muted">آخر حساب ${esc(ago(a.computed_at))}</div>
      </div>`;
    wireCharts(el, a.unit || "");
    const b = el.querySelector("#ovr");
    if (b) b.onclick = () => { b.hidden = true; itemOverrideForm(el.querySelector("#ovrf"), a, () => renderItemAnalysis(el, code)); };
  }

  function itemOverrideForm(box, a, done) {
    const v = (x) => (x != null ? x : "");
    box.innerHTML = `
      <div class="card soft" style="margin:0">
        <p class="small" style="margin-top:0">اكتب الرقم اللي إنت عايزه وسيب الباقي فاضي يفضل تلقائي. القيم اللي تكتبها بتتقفل ومش بتتغير مع إعادة الحساب.</p>
        <label class="field"><span>مخزون الأمان (التلقائي ${qty(a.auto_safety_stock)})</span><input class="input" inputmode="decimal" id="o_ss" value="${esc(v(a.o_ss))}"></label>
        <label class="field"><span>نقطة إعادة الطلب (التلقائي ${qty(a.auto_reorder_point)})</span><input class="input" inputmode="decimal" id="o_rop" value="${esc(v(a.o_rop))}"></label>
        <label class="field"><span>الحد الأقصى (التلقائي ${qty(a.auto_max_stock)})</span><input class="input" inputmode="decimal" id="o_max" value="${esc(v(a.o_max))}"></label>
        <label class="field"><span>مدة التوريد بالأيام (الافتراضي ${qty(a.lead_days)})</span><input class="input" inputmode="decimal" id="o_lead" value="${esc(v(a.o_lead))}"></label>
        <label class="field"><span>ملاحظة</span><input class="input" id="o_note" value="${esc(a.override_note || "")}"></label>
        <div class="row between" style="min-height:48px"><b>استبعد الصنف من التنبيهات</b><label class="switch"><input type="checkbox" id="o_ex" ${a.excluded ? "checked" : ""}><span></span></label></div>
        <div class="stack">
          <button class="btn" id="o_save">حفظ وقفل</button>
          ${a.locked || a.excluded ? `<button class="btn danger" id="o_reset">رجوع للحساب التلقائي</button>` : ""}
        </div>
      </div>`;
    box.querySelector("#o_save").onclick = async () => {
      const rec = {
        item_code: a.code, safety_stock: numOrNull(box.querySelector("#o_ss").value), reorder_point: numOrNull(box.querySelector("#o_rop").value),
        max_stock: numOrNull(box.querySelector("#o_max").value), lead_time_days: numOrNull(box.querySelector("#o_lead").value),
        note: box.querySelector("#o_note").value.trim() || null, excluded: box.querySelector("#o_ex").checked,
        updated_at: new Date().toISOString(), updated_by: state.me.id,
      };
      rec.locked = rec.safety_stock != null || rec.reorder_point != null || rec.max_stock != null || rec.lead_time_days != null;
      const { error } = await sb.from("item_overrides").upsert(rec, { onConflict: "item_code" });
      if (error) toast(error.message); else { toast("اتحفظ ✅"); done(); }
    };
    const rs = box.querySelector("#o_reset");
    if (rs) rs.onclick = async () => {
      const { error } = await sb.from("item_overrides").delete().eq("item_code", a.code);
      if (error) toast(error.message); else { toast("رجع للحساب التلقائي"); done(); }
    };
  }

  // ---------- تحليل العميل/المورد (جوه كشف الحساب) ----------
  async function renderPartyAnalysis(el, key) {
    let r;
    try { r = await call("party_analysis", { p_key: key }, { swr: true }); } catch (e) { el.innerHTML = ""; return; }
    if (!document.body.contains(el)) return;
    const c = r.data && r.data.customer, s = r.data && r.data.supplier;
    let html = "";
    if (c && (c.last_inv || c.balance)) {
      const pts = (c.monthly || []).map((m) => ({ m: m.m, v: m.v }));
      const payLine = c.pay_status === "overdue"
        ? `<div class="card soft" style="margin:0;background:var(--danger-soft);border-color:transparent;color:var(--danger)"><b>متأخر في السداد — عليه <span class="num">${money(c.overdue_amount)}</span></b><div class="small">ما دفعش أي دفعة من <span class="num">${c.oldest_days}</span> يوم${c.last_pay ? ` (آخر دفعة ${fmtDate(c.last_pay)})` : ""} • المهلة ${c.grace_days} يوم</div></div>`
        : c.balance > 0 ? `<div class="small" style="color:var(--success);font-weight:700">ملتزم في السداد${c.last_pay ? ` — آخر دفعة ${fmtDate(c.last_pay)}` : ""} (المهلة ${c.grace_days} يوم)</div>` : "";
      const GSRC = { learned: "محسوبة من عادته في الدفع", manual: "متحددة يدوي", system: "من برنامج الحسابات", default: "المهلة الافتراضية" };
      const habitLine = `<div class="habit">${I.clock}<div>${c.pay_med_gap ? `عادته يدفع كل <b class="num">${Math.round(c.pay_med_gap)}</b> يوم تقريباً <span class="muted">(من ${c.pay_n} دفعة آخر سنة ونص)</span><br>` : ""}
        مهلة السداد بتاعته <b class="num">${c.grace_days}</b> يوم <span class="muted">— ${GSRC[c.grace_source] || ""}</span></div></div>`;
      const buyLine = c.buy_status === "stopped" ? `<span class="tag red">متوقف عن الشراء</span>` : c.buy_status === "late" ? `<span class="tag">متأخر في الشراء</span>` : "";
      const hs = healthScore(c);
      html += `
        <div class="section-title"><span>تحليل العميل</span><small>${tagAbc(c.abc)}</small></div>
        <div class="card stack">
          ${healthHtml(hs)}
          <div class="row" style="flex-wrap:wrap;gap:6px">
            ${c.pattern ? `<span class="tag gray">${esc(PATTERN[c.pattern] || c.pattern)}</span>` : ""} ${buyLine}
            ${c.locked ? `<span class="tag">🔒 قيم يدوية</span>` : ""} ${c.excluded ? `<span class="tag gray">مستبعد من التنبيهات</span>` : ""}
          </div>
          ${payLine}
          ${habitLine}
          <div class="kpis" style="margin:0">
            <div class="kpi"><div class="k-label">مشترياته آخر 12 شهر</div><div class="k-value num">${money(c.value_12)}</div><div class="k-sub">${c.inv_12 || 0} فاتورة</div></div>
            <div class="kpi"><div class="k-label">متوسط الفاتورة</div><div class="k-value num">${money(c.avg_invoice)}</div><div class="k-sub">${c.avg_gap ? `بيشتري كل <span class="num">${Math.round(c.avg_gap)}</span> يوم` : "&nbsp;"}</div></div>
          </div>
          <div class="kvs">
            ${c.last_inv ? `<div class="kv"><span>آخر فاتورة</span><b>${fmtDate(c.last_inv)} <small class="muted">(من ${c.days_since_inv} يوم)</small></b></div>` : ""}
            ${c.expected_by ? `<div class="kv"><span>المفروض يشتري قبل</span><b>${fmtDate(c.expected_by)}</b></div>` : ""}
            ${c.season_months && c.season_months.length ? `<div class="kv"><span>موسمه</span><b>${c.season_months.map((m) => MONTHS[m - 1]).join("، ")}</b></div>` : ""}
            ${c.next_season ? `<div class="kv"><span>الموسم الجاي</span><b>${fmtDate(c.next_season)}</b></div>` : ""}
            ${c.first_inv ? `<div class="kv"><span>أول فاتورة</span><b>${fmtDate(c.first_inv)}</b></div>` : ""}
          </div>
          ${barChart(pts, "مشترياته آخر 12 شهر", "ج")}
          ${c.override_note ? `<div class="small muted">ملاحظة: ${esc(c.override_note)}</div>` : ""}
          ${isBoss() ? `<button class="btn ghost" id="covr">تعديل يدوي وقفل</button><div id="covrf"></div>` : ""}
        </div>`;
    }
    if (s && s.due_amount >= 1) {
      html += `
        <div class="section-title"><span>مستحق للمورد</span></div>
        <div class="card soft"><b>مستحق عليك بعد المهلة: <span class="num">${money(s.due_amount)}</span></b>
          <div class="small">أقدم فاتورة متدفعتش من <span class="num">${s.oldest_days}</span> يوم • المهلة ${s.grace_days} يوم</div></div>`;
    }
    el.innerHTML = html;
    wireCharts(el, "ج");
    const b = el.querySelector("#covr");
    if (b) b.onclick = () => { b.hidden = true; partyOverrideForm(el.querySelector("#covrf"), c, s, () => renderPartyAnalysis(el, key)); };
  }

  // صحة العميل من 100: الالتزام في السداد + انتظام الشراء + حجم التعامل
  function healthScore(c) {
    let sc = 100; const why = [];
    if (c.pay_status === "overdue") {
      const late = Math.max(0, (Number(c.oldest_days) || 0) - (Number(c.grace_days) || 0));
      const d = Math.round(20 + Math.min(25, late / 3)); sc -= d; why.push(["-", `متأخر في السداد (${c.oldest_days} يوم من غير دفع)`]);
    } else if (Number(c.balance) > 0) why.push(["+", "ملتزم في السداد"]);
    else why.push(["+", "مفيش عليه فلوس"]);
    if (c.buy_status === "stopped") { sc -= 30; why.push(["-", "وقف شراء"]); }
    else if (c.buy_status === "late") { sc -= 15; why.push(["-", "متأخر عن عادته في الشراء"]); }
    else if (Number(c.inv_12) > 0) why.push(["+", c.avg_gap ? `بيشتري بانتظام (كل ${Math.round(c.avg_gap)} يوم)` : "بيشتري"]);
    if (!(Number(c.inv_12) > 0)) { sc -= 20; why.push(["-", "ما اشتراش في آخر سنة"]); }
    if (c.abc === "A") why.push(["+", "من أكبر العملاء (فئة A)"]);
    else if (c.abc === "B") sc -= 5;
    else if (c.abc === "C") { sc -= 10; why.push(["-", "تعامله صغير (فئة C)"]); }
    sc = Math.max(0, Math.min(100, Math.round(sc)));
    const lv = sc >= 80 ? ["ممتاز", "#2FB27A"] : sc >= 60 ? ["جيد", "#7CC9A2"] : sc >= 40 ? ["متوسط", "#F2A43A"] : ["ضعيف", "#EF5B5B"];
    return { sc, label: lv[0], color: lv[1], why };
  }
  function healthHtml(h) {
    const R = 26, C = 2 * Math.PI * R, off = C * (1 - h.sc / 100);
    return `<div class="health">
      <svg viewBox="0 0 64 64" class="h-ring"><circle cx="32" cy="32" r="${R}" class="h-tr"/><circle cx="32" cy="32" r="${R}" class="h-v" style="stroke:${h.color};stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${off.toFixed(1)}"/>
        <text x="32" y="37" text-anchor="middle" direction="ltr">${h.sc}</text></svg>
      <div class="grow"><div class="h-t">صحة العميل: <b style="color:${h.color}">${h.label}</b></div>
        <ul class="h-why">${h.why.slice(0, 4).map(([k, t]) => `<li class="${k === "+" ? "p" : "m"}">${esc(t)}</li>`).join("")}</ul></div>
    </div>`;
  }

  function partyOverrideForm(box, c, s, done) {
    const opt = (obj, cur) => `<option value="">تلقائي</option>` + Object.entries(obj).filter(([k]) => !["new", "none"].includes(k))
      .map(([k, l]) => `<option value="${k}" ${cur === k ? "selected" : ""}>${l}</option>`).join("");
    box.innerHTML = `
      <div class="card soft" style="margin:0">
        <p class="small" style="margin-top:0">سيب أي خانة فاضية تفضل تلقائي.</p>
        <label class="field"><span>مهلة السداد بالأيام (الحالية ${c.grace_days})</span><input class="input" inputmode="numeric" id="p_grace" value="${c.o_grace != null ? c.o_grace : ""}"><small class="muted">سيبها فاضية والنظام يحسبها من عادة العميل في الدفع</small></label>
        <label class="field"><span>نبهني لو ما اشتراش بعد كام يوم${c.buy_alert_days ? ` (الحالي ${c.buy_alert_days})` : ""}</span><input class="input" inputmode="numeric" id="p_buy" value="${c.o_buy != null ? c.o_buy : ""}"></label>
        <label class="field"><span>نمط الشراء (التلقائي: ${esc(PATTERN[c.auto_pattern] || "—")})</span><select class="input" id="p_pat">${opt(PATTERN, c.o_pattern)}</select></label>
        <label class="field"><span>التصنيف (التلقائي: ${esc(c.auto_abc || "—")})</span><select class="input" id="p_abc"><option value="">تلقائي</option>${["A", "B", "C"].map((x) => `<option ${c.o_rating === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
        ${s ? `<label class="field"><span>مهلة سدادنا للمورد بالأيام (الحالية ${s.grace_days})</span><input class="input" inputmode="numeric" id="p_sgrace"></label>` : ""}
        <label class="field"><span>ملاحظة</span><input class="input" id="p_note" value="${esc(c.override_note || "")}"></label>
        <div class="row between" style="min-height:48px"><b>استبعد من التحليل والتنبيهات</b><label class="switch"><input type="checkbox" id="p_ex" ${c.excluded ? "checked" : ""}><span></span></label></div>
        <p class="small muted" style="margin:0 0 8px">الاستبعاد مناسب للحسابات الداخلية زي "نقدي" أو حسابات أصحاب الشركة.</p>
        <div class="stack">
          <button class="btn" id="p_save">حفظ وقفل</button>
          ${c.locked || c.excluded ? `<button class="btn danger" id="p_reset">رجوع للحساب التلقائي</button>` : ""}
        </div>
      </div>`;
    box.querySelector("#p_save").onclick = async () => {
      const rec = {
        party_type: "customer", party_code: c.code,
        pay_grace_days: numOrNull(box.querySelector("#p_grace").value), buy_alert_days: numOrNull(box.querySelector("#p_buy").value),
        pattern: box.querySelector("#p_pat").value || null, rating: box.querySelector("#p_abc").value || null,
        note: box.querySelector("#p_note").value.trim() || null, excluded: box.querySelector("#p_ex").checked,
        updated_at: new Date().toISOString(), updated_by: state.me.id,
      };
      rec.locked = rec.pay_grace_days != null || rec.buy_alert_days != null || !!rec.pattern || !!rec.rating;
      let { error } = await sb.from("party_overrides").upsert(rec, { onConflict: "party_type,party_code" });
      const sg = box.querySelector("#p_sgrace");
      if (!error && s && sg) {
        const g = numOrNull(sg.value);
        ({ error } = await sb.from("party_overrides").upsert({ party_type: "supplier", party_code: s.code, pay_grace_days: g, locked: g != null,
          excluded: rec.excluded, updated_at: rec.updated_at, updated_by: state.me.id }, { onConflict: "party_type,party_code" }));
      }
      if (error) toast(error.message); else { toast("اتحفظ ✅"); done(); }
    };
    const rs = box.querySelector("#p_reset");
    if (rs) rs.onclick = async () => {
      let { error } = await sb.from("party_overrides").delete().eq("party_type", "customer").eq("party_code", c.code);
      if (!error && s) ({ error } = await sb.from("party_overrides").delete().eq("party_type", "supplier").eq("party_code", s.code));
      if (error) toast(error.message); else { toast("رجع للحساب التلقائي"); done(); }
    };
  }

  // ---------- إعدادات التحليل (للمدير) ----------
  const SETTINGS = [
    ["default_pay_grace_days", "مهلة السداد الافتراضية (يوم)", "كل عميل ليه مهلة محسوبة من عادته في الدفع (لو دفع 3 مرات على الأقل). الرقم ده للعملاء الجداد أو اللي مالهمش دفعات كفاية، وأقل مهلة لأي عميل"],
    ["lead_time_days", "مدة التوريد (يوم)", "من وقت ما تطلب البضاعة لحد ما توصل المخزن"],
    ["order_cycle_days", "الطلبية تكفي كام يوم", "بتحدد الحد الأقصى للمخزون"],
    ["service_z", "معامل الأمان", "1.65 يغطي 95% من تقلبات البيع — كل ما يزيد يزيد مخزون الأمان"],
    ["restock_alert_days", "نبهني لو صنف خلص ومتجابش بعد (يوم)", ""],
    ["dead_stock_days", "الصنف يعتبر راكد لو ما اتباعش من (يوم)", ""],
    ["seasonal_lead_days", "نبهني قبل موسم العميل الموسمي بـ (يوم)", ""],
  ];
  async function viewSettings() {
    if (!isAdmin()) { location.hash = "#/"; return; }
    const main = shell({ title: "إعدادات التحليل", back: true }, loading);
    const { data, error } = await sb.from("app_settings").select("key, value");
    if (error) { main.innerHTML = errBox(isNetErr(error) ? "مفيش إنترنت" : error.message); return; }
    const cur = Object.fromEntries(data.map((x) => [x.key, x.value]));
    main.innerHTML = `
      <form class="card" id="setf">
        ${SETTINGS.map(([k, l, n]) => `<label class="field"><span>${l}</span><input class="input" inputmode="decimal" name="${k}" value="${esc(cur[k] != null ? cur[k] : "")}">${n ? `<small class="muted">${n}</small>` : ""}</label>`).join("")}
        <button class="btn" type="submit">حفظ</button>
      </form>
      <div class="section-title"><span>الإشعارات الفورية</span></div>
      <div class="card stack">
        <div class="row between" style="min-height:48px"><div class="grow"><b>الأصناف</b><div class="small muted">لما صنف يوصل نقطة الطلب، ولما ينزل تحت مخزون الأمان، ولما يخلص</div></div>
          <label class="switch"><input type="checkbox" id="al_items" ${cur.alerts_items !== false ? "checked" : ""}><span></span></label></div>
        <div class="row between" style="min-height:48px"><div class="grow"><b>العملاء</b><div class="small muted">لما عميل يعدي مهلة السداد</div></div>
          <label class="switch"><input type="checkbox" id="al_overdue" ${cur.alerts_overdue !== false ? "checked" : ""}><span></span></label></div>
        <div class="small muted">الإشعارات اللي بتطلع من 12 بالليل لـ 8 الصبح بتوصل الساعة 8 الصبح.</div>
      </div>
      <div class="card stack">
        <b>إعادة حساب التحليل دلوقتي</b>
        <div class="small muted">التحليل بيتحسب لوحده كل 3 ساعات. استخدم الزرار ده لو غيرت إعدادات وعايز تشوف أثرها على الأرقام اللي بتتحسب (زي نمط العملاء والدوران) فوراً.</div>
        <button class="btn soft" id="recalc">${I.refresh} احسب دلوقتي</button>
      </div>`;
    [["al_items", "alerts_items"], ["al_overdue", "alerts_overdue"]].forEach(([id, key]) => {
      const cb = document.getElementById(id);
      if (cb) cb.onchange = async () => {
        const { error: e3 } = await sb.from("app_settings").update({ value: cb.checked, updated_at: new Date().toISOString(), updated_by: state.me.id }).eq("key", key);
        if (e3) { toast(e3.message); cb.checked = !cb.checked; } else toast(cb.checked ? "اتفعّلت ✅" : "اتقفلت");
      };
    });
    document.getElementById("setf").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      for (const [k] of SETTINGS) {
        const n = numOrNull(fd.get(k));
        if (n == null || n < 0) { toast("اكتب أرقام صحيحة"); return; }
        if (String(n) === String(cur[k])) continue;
        const { error: e2 } = await sb.from("app_settings").update({ value: n, updated_at: new Date().toISOString(), updated_by: state.me.id }).eq("key", k);
        if (e2) { toast(e2.message); return; }
      }
      toast("اتحفظت الإعدادات ✅");
    };
    document.getElementById("recalc").onclick = async (e) => {
      const b = e.currentTarget; b.disabled = true; b.innerHTML = `${I.refresh} جاري الحساب...`;
      try { await call("refresh_analysis_now", {}, { cache: false }); toast("اتحسب التحليل من جديد ✅"); }
      catch (err) { toast(err.message); }
      b.disabled = false; b.innerHTML = `${I.refresh} احسب دلوقتي`;
    };
  }

  // ================= التنقل =================
  const routes = [
    [/^#\/?$/, viewHome],
    [/^#\/parties$/, viewParties],
    [/^#\/party\/(.+)$/, viewParty],
    [/^#\/items$/, viewItems],
    [/^#\/item\/(.+)$/, viewItem],
    [/^#\/invoice\/(sale|sale_return|purchase|purchase_return)\/(.+)$/, viewInvoice],
    [/^#\/report(?:\/(\d{4}-\d{2}-\d{2}))?$/, viewReport],
    [/^#\/users$/, viewUsers],
    [/^#\/user\/([0-9a-f-]+)$/, viewUser],
    [/^#\/me$/, viewMe],
    [/^#\/reports$/, viewReports],
    [/^#\/week(?:\/(\d{4}-\d{2}-\d{2}))?$/, viewWeek],
    [/^#\/month(?:\/(\d{4}-\d{2}))?$/, viewMonth],
    [/^#\/stock$/, viewStock],
    [/^#\/turnover$/, viewTurnover],
    [/^#\/customers(?:\/([a-zA-Z]+))?$/, viewCustomers],
    [/^#\/alerts$/, viewAlerts],
    [/^#\/settings$/, viewSettings],
  ];
  function route(keepScroll) {
    if (!state.me) return;
    const h = location.hash || "#/";
    for (const [re, fn] of routes) {
      const m = h.match(re);
      if (m) {
        if (keepScroll !== true) window.scrollTo(0, 0);
        state.quiet = keepScroll === true;
        fn(...m.slice(1).map((x) => (x == null ? x : decodeURIComponent(x))));
        return;
      }
    }
    location.replace("#/");
  }
  // عداد عمق التنقل عشان زر الرجوع في الشاشة ما يخرجش من التطبيق
  let depth = (history.state && history.state.d) || 0;
  window.addEventListener("hashchange", () => {
    if (history.state && typeof history.state.d === "number") depth = history.state.d;
    else { depth += 1; history.replaceState({ d: depth }, ""); }
    route();
  });

  // ================= التشغيل =================
  async function boot() {
    let session = null;
    try { session = (await sb.auth.getSession()).data.session; } catch (e) { /* */ }
    if (!session) {
      // بدون إنترنت والجلسة محتاجة تتجدد: نكمل بآخر بيانات محفوظة
      const cachedMe = cacheGet("app_me:{}");
      if (!navigator.onLine && cachedMe && cachedMe.v && localStorage.getItem("drsalama-auth")) {
        state.me = cachedMe.v; setOffline(true); route(); return;
      }
      state.me = null; renderAuth(); return;
    }
    try {
      const r = await call("app_me");
      state.me = r.data;
    } catch (e) {
      state.me = null;
    }
    if (!state.me) {
      $app.innerHTML = `<div class="auth-wrap"><div class="card stack center">${errBox("مش قادر أوصل للسيرفر")}<button class="btn" id="retry">حاول تاني</button><button class="btn ghost" id="lo">تسجيل الخروج</button></div></div>`;
      document.getElementById("retry").onclick = boot;
      document.getElementById("lo").onclick = logout;
      return;
    }
    if (!state.me.active || !["admin", "manager", "sales"].includes(state.me.role)) { renderPending(); return; }
    if (/access_token|error_description/.test(location.hash)) history.replaceState(null, "", location.pathname + "#/");
    route();
  }

  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); state.installPrompt = e; renderInstallCard(); });
  window.addEventListener("appinstalled", () => { state.installPrompt = null; renderInstallCard(); toast("اتثبت التطبيق ✅"); });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data && e.data.type === "open" && e.data.url) location.hash = e.data.url.replace(/^.*#/, "#");
    });
  }

  sb.auth.onAuthStateChange((ev) => {
    if (ev === "SIGNED_OUT") { state.me = null; renderAuth(); }
  });

  boot();
})();

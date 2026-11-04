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
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/></svg>',
  };

  function toast(msg, ms = 2800) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), ms);
  }

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
  async function call(fn, args = {}, opts = {}) {
    const key = fn + ":" + JSON.stringify(args);
    try {
      const { data, error } = await sb.rpc(fn, args);
      if (error) {
        if (isNetErr(error)) throw error;
        const msg = error.code === "42501" ? "غير مسموح لك تشوف البيانات دي" : (error.message || "حصل خطأ");
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
      <main id="main" class="${nav ? "" : "no-nav"}">${body}</main>
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
    if (/^#\/(report|stock|customers|alerts|settings)/.test(h)) return "report";
    if (h.startsWith("#/me") || h.startsWith("#/user")) return "me";
    if (h.startsWith("#/invoice")) return "";
    return "home";
  }
  function goBack() {
    if (history.state && history.state.d > 0) history.back();
    else location.hash = "#/";
  }
  const loading = '<div class="loader"><div class="spin"></div></div>';
  const errBox = (e) => `<div class="err">${esc(e.message || e)}</div>`;
  const empty = (msg) => `<div class="empty">${I.search}<div>${esc(msg)}</div></div>`;

  // ================= الدخول =================
  function renderAuth(mode = "login", msg = "") {
    $app.innerHTML = `
      <div class="auth-wrap">
        <div class="brand">
          <img src="icons/icon-192.png" alt="">
          <h1>مخزن د/محمد سلامه</h1>
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
        <div class="brand"><img src="icons/icon-192.png" alt=""><h1>مخزن د/محمد سلامه</h1></div>
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

  // ================= الرئيسية =================
  async function viewHome() {
    const main = shell({ title: "مخزن د/محمد سلامه" }, `
      <div class="row between" style="margin:4px 4px 12px">
        <div><div class="muted small">أهلاً</div><div style="font-weight:800;font-size:18px">${esc(state.me.name || "")}</div></div>
        <span class="tag">${esc(ROLE[state.me.role] || "")}</span>
      </div>
      <form class="search" id="qform" role="search">
        ${I.search}
        <input class="input" id="q" type="search" placeholder="ابحث عن عميل أو مورد أو صنف" autocomplete="off">
      </form>
      <div id="qres"></div>
      <div id="sync"></div>
      <div id="install"></div>
      <div id="push"></div>
      <div id="alerts"></div>
      <div id="today"></div>`);
    const qi = document.getElementById("q");
    const homeBlocks = ["sync", "install", "push", "alerts", "today"].map((x) => document.getElementById(x));
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
        ${ps.length ? `<div class="section-title"><span>العملاء والموردين</span><a class="small" href="#/parties" data-keep="q-parties">الكل</a></div><div class="list">${ps.map(partyRow).join("")}</div>` : ""}
        ${is.length ? `<div class="section-title"><span>الأصناف</span><a class="small" href="#/items" data-keep="q-items">الكل</a></div><div class="list">${is.map(itemRow).join("")}</div>` : ""}`;
    };
    qi.oninput = () => { clearTimeout(qt); qt = setTimeout(qsearch, 300); };
    document.getElementById("qres").onclick = (e) => {
      const a = e.target.closest("[data-keep]");
      if (a) sessionStorage.setItem(a.dataset.keep, qi.value.trim());
    };
    document.getElementById("qform").onsubmit = (e) => { e.preventDefault(); clearTimeout(qt); qsearch(); qi.blur(); };

    renderInstallCard();
    if (isBoss()) renderPushCard(document.getElementById("push"));

    call("app_sync_status").then((r) => {
      const s = r.data || {};
      const mins = s.last_sync ? (Date.now() - new Date(s.last_sync).getTime()) / 60000 : 1e9;
      const cls = mins <= 15 ? "ok" : mins <= 120 ? "warn" : "bad";
      const el = document.getElementById("sync");
      if (el) el.innerHTML = `
        <div class="card row">
          <span class="status-dot ${cls}"></span>
          <div class="grow">
            <div style="font-weight:700">آخر تحديث من جهاز الحسابات: ${esc(ago(s.last_sync))}</div>
            ${cls === "bad" ? `<div class="small muted">ممكن جهاز الحسابات يكون مقفول أو النت فاصل عنده</div>` : ""}
          </div>
        </div>`;
    }).catch(() => {});

    if (isBoss()) {
      call("alerts_list").then((r) => {
        const a = r.data || {}, el = document.getElementById("alerts");
        if (!el) return;
        const parts = [
          [a.overdue_customers, "عميل متأخر في السداد"], [a.below_safety, "صنف تحت الأمان"], [a.out_no_restock, "صنف خلص ومتجابش"],
          [a.supplier_dues, "مورد مستحق له"], [a.season_soon, "عميل موسمه قرب"], [a.late_buyers, "عميل متأخر في الشراء"],
        ].filter(([l]) => l && l.length);
        if (!parts.length) { el.innerHTML = ""; return; }
        el.innerHTML = `<a class="card row" href="#/alerts" style="color:inherit">
          <div class="avatar" style="background:var(--danger-soft);color:var(--danger)">${hubIcon.bell}</div>
          <div class="grow"><b>التنبيهات</b><div class="small muted">${parts.map(([l, t]) => `<span class="num">${l.length}</span> ${t}`).join(" • ")}</div></div>${I.chev}</a>`;
      }).catch(() => {});
      const today = cairoToday();
      const el = document.getElementById("today");
      el.innerHTML = `
        <div class="section-title"><span>حركة النهارده — ${esc(dayName(today))}</span>
          <a class="small" href="#/report/${addDays(today, -1)}">الأيام اللي فاتت</a></div>
        <div id="todayBody">${loading}</div>`;
      call("daily_report", { p_date: today }).then((r) => {
        const box = document.getElementById("todayBody");
        if (box) box.innerHTML = reportBody(r, today, false);
      }).catch((e) => { const box = document.getElementById("todayBody"); if (box) box.innerHTML = errBox(e); });
    }
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
      <div class="avatar">${esc(initial(p.name))}</div>
      <div class="grow">
        <div class="title ellipsis">${esc(p.name)}</div>
        <div class="sub">${kind} • كود <span class="num">${esc(code)}</span>${p.last_date ? ` • آخر حركة ${fmtDate(p.last_date)}` : ""}</div>
      </div>
      <div class="end">${balHtml(p.balance)}</div>
    </a>`;
  }

  function viewParties() {
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
    const main = shell({ title: "كشف حساب", back: true }, loading);
    let r;
    try { r = await call("party_detail", { p_key: key }); }
    catch (e) { main.innerHTML = errBox(e); return; }
    const p = r.data;
    document.querySelector(".topbar h1").textContent = p.name;
    const kind = p.is_customer && p.is_supplier ? "عميل ومورد" : p.is_supplier ? "مورد" : "عميل";
    const bi = balInfo(p.balance);
    const st = p.statement || [];
    const linked = p.is_customer && p.is_supplier;
    main.innerHTML = `
      ${staleNote(r)}
      <div class="hero-card">
        <div class="lbl">${bi.cls === "zero" ? "الحساب" : bi.label}</div>
        <div class="big num">${bi.cls === "zero" ? "خالص" : bi.text}</div>
        <div class="meta">
          <span class="tag">${kind}</span>
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

  // ================= الفاتورة =================
  async function viewInvoice(type, no) {
    const main = shell({ title: `${INV[type] || "فاتورة"} ${no}`, back: true }, loading);
    let r;
    try { r = await call("invoice_detail", { p_type: type, p_no: no }); }
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

  function viewItems() {
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
    const main = shell({ title: "كارت صنف", back: true }, loading);
    let days = Number(sessionStorage.getItem("item-days") || 365);
    let r;
    try { r = await call("item_card", { p_code: code, p_days: days }); }
    catch (e) { main.innerHTML = errBox(e); return; }
    const v = r.data;
    document.querySelector(".topbar h1").textContent = v.name;
    const stores = Object.entries(v.stock_by_store || {});
    const lp = v.last_purchase;
    const periods = [[90, "3 شهور"], [365, "سنة"], [3650, "من الأول"]];
    main.innerHTML = `
      ${staleNote(r)}
      <div class="hero-card">
        <div class="lbl">الرصيد الحالي</div>
        <div class="big num">${qty(v.stock)} <span style="font-size:16px">${esc(v.unit || "")}</span></div>
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
    const main = shell({ title: "التقرير اليومي", back: true }, `
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
    try { r = await call("daily_report", { p_date: date }); }
    catch (e) { document.getElementById("rep").innerHTML = errBox(e); return; }
    document.getElementById("rep").innerHTML = reportBody(r, date, true);
  }

  function reportBody(r, date, withDay) {
    const d = r.data || {};
    const t = d.totals || {};
    const nothing = !t.sales_count && !t.purchases_count && !t.collections_count && !t.supplier_payments_count &&
                    !(d.sales_returns || []).length && !(d.purchase_returns || []).length && !(d.expenses || []).length;
    const lastSync = d.last_sync ? `<div class="muted small center" style="margin:8px 0 16px">آخر تحديث من جهاز الحسابات ${esc(ago(d.last_sync))}</div>` : "";
    return `
      ${staleNote(r)}
      ${withDay ? `<div class="muted center" style="margin:-4px 0 10px;font-weight:700">${esc(dayName(date))}</div>` : ""}
      <div class="kpis">
        <div class="kpi hero">
          <div class="k-label">المبيعات</div>
          <div class="k-value num">${money(t.sales)}</div>
          <div class="k-sub">${t.sales_count || 0} فاتورة • آجل <span class="num">${money(t.sales_credit)}</span> • نقدي <span class="num">${money(t.sales_cash)}</span></div>
        </div>
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
      ${isBoss() ? `<div class="section-title"><span>الإشعارات</span></div><div id="push"></div>` : ""}
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
    if (isBoss()) renderPushCard(document.getElementById("push"), true);
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
            <div class="grow"><b>إشعار التقرير اليومي</b><div class="small muted">كل يوم الساعة 12 بالليل بتوقيت مصر</div></div>
            <label class="switch"><input type="checkbox" id="ptoggle" ${on ? "checked" : ""}><span></span></label>
          </div>
          ${Notification.permission === "denied" ? `<div class="small" style="color:var(--danger)">الإشعارات مقفولة للموقع ده. افتح إعدادات Chrome ← إعدادات المواقع ← الإشعارات، واسمح بيها.</div>` : ""}
          ${on ? `<button class="btn soft" id="ptest">ابعت إشعار تجربة دلوقتي</button>` : ""}
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
  function barChart(points, title, unit) {
    if (!points || !points.length) return "";
    const max = Math.max(...points.map((p) => Number(p.v) || 0), 0);
    const id = "ch" + Math.random().toString(36).slice(2, 8);
    const last = points[points.length - 1];
    return `<div class="chart" id="${id}">
      <div class="chart-head"><span class="chart-title">${esc(title)}</span><span class="chart-val" data-cap>${esc(monthName(last.m))}: <b class="num">${qty(last.v)}</b> ${esc(unit || "")}</span></div>
      <div class="bars" role="list">${points.map((p, i) => {
        const h = max > 0 ? Math.max(2, Math.round((Number(p.v) || 0) / max * 100)) : 2;
        return `<button class="bar ${i === points.length - 1 ? "on" : ""} ${(Number(p.v) || 0) <= 0 ? "zero" : ""}" role="listitem" data-m="${esc(p.m)}" data-v="${esc(p.v)}" aria-label="${esc(monthName(p.m))}: ${qty(p.v)}"><span style="height:${h}%"></span></button>`;
      }).join("")}</div>
      <div class="bars-x">${points.map((p) => `<span>${Number(String(p.m).split("-")[1])}</span>`).join("")}</div>
    </div>`;
  }
  function wireCharts(root, unit) {
    root.querySelectorAll(".chart").forEach((ch) => {
      const cap = ch.querySelector("[data-cap]");
      const pick = (b) => {
        ch.querySelectorAll(".bar").forEach((x) => x.classList.toggle("on", x === b));
        cap.innerHTML = `${esc(monthName(b.dataset.m))}: <b class="num">${qty(b.dataset.v)}</b> ${esc(unit || "")}`;
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
        ${hubRow("#/report/" + addDays(cairoToday(), -1), "تقارير الأيام اللي فاتت", "حركة أي يوم: مبيعات وتحصيلات ومشتريات", I.report)}
        ${hubRow("#/alerts", "التنبيهات", "اللي محتاج تصرف دلوقتي", hubIcon.bell)}
        ${hubRow("#/stock", "تحليل المخزن", "معدل الدوران، نقطة الطلب، الراكد والزيادة", I.box)}
        ${hubRow("#/customers", "تحليل العملاء", "الانتظام، التصنيف، المتأخرين في السداد والشراء", I.people)}
        ${isAdmin() ? hubRow("#/settings", "إعدادات التحليل", "مدة التوريد، مهلة السداد، وإعادة الحساب", hubIcon.gear) : ""}
      </div>
      <div id="hubk">${loading}</div>`);
    const loadTop = async () => {
      const box = document.getElementById("toplist"), tot = document.getElementById("toptot");
      if (!box) return;
      box.innerHTML = loading; tot.textContent = "";
      try {
        const r = await call("top_balances", { p_kind: kind, p_limit: 20 });
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
      call("stock_analysis", { p_status: "attention", p_q: "", p_limit: 1 }).catch((e) => ({ err: e })),
      call("customer_analysis", { p_filter: "overdue", p_q: "", p_limit: 1 }).catch((e) => ({ err: e })),
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
      sub.push(`متأخر <span class="num">${c.oldest_days}</span> يوم (المهلة ${c.grace_days})`);
      right = `<div class="bal owe num">${money(c.overdue_amount)}</div><div class="bal-label">متأخر</div>`;
    }
    if (c.last_inv) sub.push(`آخر فاتورة من <span class="num">${c.days_since_inv}</span> يوم`);
    if (c.avg_gap && (filter === "late" || filter === "stopped")) sub.push(`عادته كل <span class="num">${Math.round(c.avg_gap)}</span> يوم`);
    if (c.season_in_days != null) sub.push(`موسمه بعد <span class="num">${c.season_in_days}</span> يوم`);
    if (!right) right = `<div class="bal num">${money(c.value_12)}</div><div class="bal-label">مشتريات سنة</div>`;
    const ptag = c.pattern ? `<span class="tag gray">${esc(PATTERN[c.pattern] || c.pattern)}</span>` : "";
    const btag = c.buy_status === "stopped" ? `<span class="tag red">متوقف</span>` : c.buy_status === "late" ? `<span class="tag">متأخر في الشراء</span>` : "";
    return `<a class="list-item" href="#/party/${encodeURIComponent(c.key)}">
      <div class="avatar">${esc(initial(c.name))}</div>
      <div class="grow"><div class="title ellipsis">${esc(c.name)}</div>
        <div class="sub">${tagAbc(c.abc)} ${ptag} ${btag} ${sub.join(" • ")}</div></div>
      <div class="end">${right}</div></a>`;
  }

  function viewCustomers() {
    if (!isBoss()) { location.hash = "#/"; return; }
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
    try { r = await call("alerts_list"); } catch (e) { main.innerHTML = errBox(e); return; }
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
      sec("عملاء متأخرين في السداد", a.overdue_customers, (x) => partyLink(x, `أقدم فاتورة من <span class="num">${x.days}</span> يوم • المهلة ${x.grace} يوم • الرصيد <span class="num">${money(x.balance)}</span>`, x.amount, "owe")),
      sec("مستحق للموردين", a.supplier_dues, (x) => partyLink(x, `أقدم فاتورة من <span class="num">${x.days}</span> يوم • المهلة ${x.grace} يوم`, x.amount, "credit")),
      sec("أصناف تحت مخزون الأمان", a.below_safety, (x) => itemLink(x, `${tagAbc(x.abc)} رصيد <span class="num">${qty(x.stock)}</span> • الأمان <span class="num">${qty(x.safety)}</span>`, x.suggest ? `<div class="bal owe num">${qty(x.suggest)}</div><div class="bal-label">اطلب</div>` : "")),
      sec("أصناف خلصت ومتجابتش", a.out_no_restock, (x) => itemLink(x, `${tagAbc(x.abc)} خلصان ${daysTxt(x.days)}${x.stock < 0 ? ` • رصيد سالب <span class="num">${qty(x.stock)}</span>` : ""}`, x.suggest ? `<div class="bal owe num">${qty(x.suggest)}</div><div class="bal-label">اطلب</div>` : "")),
      sec("عملاء موسمهم قرب", a.season_soon, (x) => partyLink(x, `الموسم بعد <span class="num">${x.days}</span> يوم • ${(x.months || []).map((m) => MONTHS[m - 1]).join("، ")}`)),
      sec("عملاء متأخرين في الشراء", a.late_buyers, (x) => partyLink(x, `${tagAbc(x.abc)} آخر فاتورة من <span class="num">${x.days}</span> يوم • عادته كل <span class="num">${Math.round(x.avg_gap || 0)}</span> يوم`)),
      sec("أصناف زيادة عن الحد الأقصى", a.overstock, (x) => itemLink(x, `رصيد <span class="num">${qty(x.stock)}</span> • الحد الأقصى <span class="num">${qty(x.max)}</span>${x.days_cover != null ? ` • يكفي <span class="num">${qty(x.days_cover)}</span> يوم` : ""}`)),
    ].join("");
    main.innerHTML = staleNote(r) + (html || empty("مفيش تنبيهات دلوقتي 👌"));
    main.querySelectorAll("[data-more]").forEach((b) => (b.onclick = () => {
      const list = document.getElementById(b.dataset.more);
      list.insertAdjacentHTML("beforeend", document.getElementById(b.dataset.more + "-all").innerHTML);
      b.remove();
    }));
  }

  // ---------- تحليل الصنف (جوه كارت الصنف) ----------
  async function renderItemAnalysis(el, code) {
    let r;
    try { r = await call("item_analysis", { p_code: code }); } catch (e) { el.innerHTML = ""; return; }
    const a = r.data;
    if (!a || !document.body.contains(el)) { el.innerHTML = ""; return; }
    const pts = (a.monthly || []).map((m) => ({ m: m.m, v: m.sold }));
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
        <div class="kpis" style="margin:0">
          <div class="kpi"><div class="k-label">متوسط البيع في الشهر</div><div class="k-value num">${qty(a.avg_month)}</div><div class="k-sub">آخر 3 شهور: <span class="num">${qty(a.sold_90)}</span></div></div>
          <div class="kpi"><div class="k-label">الرصيد يكفي</div><div class="k-value num">${a.days_cover != null ? qty(a.days_cover) : "—"}</div><div class="k-sub">يوم بمعدل البيع الحالي</div></div>
          <div class="kpi"><div class="k-label">معدل الدوران (12 شهر)</div><div class="k-value num">${turnTxt(a.turnover_365)}</div><div class="k-sub">مرة في السنة</div></div>
          <div class="kpi"><div class="k-label">معدل الدوران (3 شهور)</div><div class="k-value num">${turnTxt(a.turnover_90)}</div><div class="k-sub">بمعدل سنوي</div></div>
        </div>
        <div class="kvs">
          ${row("مخزون الأمان", qty(a.safety_stock), locked && a.safety_stock !== a.auto_safety_stock ? qty(a.auto_safety_stock) : null)}
          ${row("نقطة إعادة الطلب", qty(a.reorder_point), locked && a.reorder_point !== a.auto_reorder_point ? qty(a.auto_reorder_point) : null)}
          ${row("الحد الأقصى", qty(a.max_stock), locked && a.max_stock !== a.auto_max_stock ? qty(a.auto_max_stock) : null)}
          ${row("مدة التوريد", qty(a.lead_days) + " يوم")}
          ${row("أيام الرصيد صفر (آخر سنة)", qty(a.zero_days_365) + " يوم")}
          ${a.last_purchase ? row("آخر شراء", fmtDate(a.last_purchase)) : ""}
        </div>
        ${barChart(pts, "المبيعات آخر 12 شهر", a.unit || "")}
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
    try { r = await call("party_analysis", { p_key: key }); } catch (e) { el.innerHTML = ""; return; }
    if (!document.body.contains(el)) return;
    const c = r.data && r.data.customer, s = r.data && r.data.supplier;
    let html = "";
    if (c && (c.last_inv || c.balance)) {
      const pts = (c.monthly || []).map((m) => ({ m: m.m, v: m.v }));
      const payLine = c.pay_status === "overdue"
        ? `<div class="card soft" style="margin:0;background:var(--danger-soft);border-color:transparent;color:var(--danger)"><b>متأخر في السداد: <span class="num">${money(c.overdue_amount)}</span></b><div class="small">أقدم فاتورة متدفعتش من <span class="num">${c.oldest_days}</span> يوم • المهلة ${c.grace_days} يوم</div></div>`
        : c.balance > 0 ? `<div class="small" style="color:var(--success);font-weight:700">ملتزم في السداد (المهلة ${c.grace_days} يوم)</div>` : "";
      const buyLine = c.buy_status === "stopped" ? `<span class="tag red">متوقف عن الشراء</span>` : c.buy_status === "late" ? `<span class="tag">متأخر في الشراء</span>` : "";
      html += `
        <div class="section-title"><span>تحليل العميل</span><small>${tagAbc(c.abc)}</small></div>
        <div class="card stack">
          <div class="row" style="flex-wrap:wrap;gap:6px">
            ${c.pattern ? `<span class="tag gray">${esc(PATTERN[c.pattern] || c.pattern)}</span>` : ""} ${buyLine}
            ${c.locked ? `<span class="tag">🔒 قيم يدوية</span>` : ""} ${c.excluded ? `<span class="tag gray">مستبعد من التنبيهات</span>` : ""}
          </div>
          ${payLine}
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

  function partyOverrideForm(box, c, s, done) {
    const opt = (obj, cur) => `<option value="">تلقائي</option>` + Object.entries(obj).filter(([k]) => !["new", "none"].includes(k))
      .map(([k, l]) => `<option value="${k}" ${cur === k ? "selected" : ""}>${l}</option>`).join("");
    box.innerHTML = `
      <div class="card soft" style="margin:0">
        <p class="small" style="margin-top:0">سيب أي خانة فاضية تفضل تلقائي.</p>
        <label class="field"><span>مهلة السداد بالأيام (الحالية ${c.grace_days})</span><input class="input" inputmode="numeric" id="p_grace" value="${c.o_grace != null ? c.o_grace : ""}"></label>
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
    ["default_pay_grace_days", "مهلة السداد الافتراضية (يوم)", "العميل يعتبر متأخر لو فاتورته عدت المدة دي ومتدفعتش"],
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
      <div class="card stack">
        <b>إعادة حساب التحليل دلوقتي</b>
        <div class="small muted">التحليل بيتحسب لوحده كل 3 ساعات. استخدم الزرار ده لو غيرت إعدادات وعايز تشوف أثرها على الأرقام اللي بتتحسب (زي نمط العملاء والدوران) فوراً.</div>
        <button class="btn soft" id="recalc">${I.refresh} احسب دلوقتي</button>
      </div>`;
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
    [/^#\/stock$/, viewStock],
    [/^#\/customers$/, viewCustomers],
    [/^#\/alerts$/, viewAlerts],
    [/^#\/settings$/, viewSettings],
  ];
  function route() {
    if (!state.me) return;
    const h = location.hash || "#/";
    for (const [re, fn] of routes) {
      const m = h.match(re);
      if (m) {
        window.scrollTo(0, 0);
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

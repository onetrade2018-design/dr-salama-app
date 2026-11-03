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
        ${isBoss() ? navLink("#/report", "التقرير", I.report, tab === "report") : ""}
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
    if (h.startsWith("#/report")) return "report";
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
      <div id="today"></div>
      <div id="top"></div>`);
    const qi = document.getElementById("q");
    const homeBlocks = ["sync", "install", "push", "today", "top"].map((x) => document.getElementById(x));
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
      const today = cairoToday();
      call("daily_report", { p_date: today }).then((r) => {
        const t = (r.data && r.data.totals) || {};
        const el = document.getElementById("today");
        if (!el) return;
        el.innerHTML = `
          <div class="section-title"><span>النهارده — ${esc(dayName(today))}</span><a class="small" href="#/report/${today}">التفاصيل</a></div>
          <a href="#/report/${today}" class="kpis" style="display:grid">
            <div class="kpi hero"><div class="k-label">المبيعات</div><div class="k-value num">${money(t.sales)}</div><div class="k-sub">${t.sales_count || 0} فاتورة</div></div>
            <div class="kpi"><div class="k-label">التحصيلات</div><div class="k-value num">${money(t.collections)}</div><div class="k-sub">${t.collections_count || 0} سند</div></div>
            <div class="kpi"><div class="k-label">المشتريات</div><div class="k-value num">${money(t.purchases)}</div><div class="k-sub">${t.purchases_count || 0} فاتورة</div></div>
          </a>
          ${staleNote(r)}`;
      }).catch((e) => { const el = document.getElementById("today"); if (el) el.innerHTML = errBox(e); });
    }

    call("search_parties", { p_q: "", p_limit: 8 }).then((r) => {
      const el = document.getElementById("top");
      if (!el || !r.data || !r.data.length) return;
      el.innerHTML = `<div class="section-title"><span>أكبر الأرصدة</span><a class="small" href="#/parties">الكل</a></div>
        <div class="list">${r.data.map(partyRow).join("")}</div>`;
    }).catch(() => {});
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
      <div class="section-title"><span>كشف الحساب</span><small>${st.length} حركة • الأحدث فوق</small></div>
      <div class="list" id="stmt"></div>
      <div class="more" id="more"></div>`;
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
          ${showCost ? `<tfoot><tr><td>الإجمالي</td><td class="n">${qty((v.lines || []).reduce((a, l) => a + (Number(l.qty) || 0), 0))}</td><td></td><td class="n">${money(v.total)}</td></tr></tfoot>` : ""}
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
    const main = shell({ title: "التقرير اليومي", back: false }, `
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
    const d = r.data || {};
    const t = d.totals || {};
    const box = document.getElementById("rep");
    const nothing = !t.sales_count && !t.purchases_count && !t.collections_count && !t.supplier_payments_count &&
                    !(d.sales_returns || []).length && !(d.purchase_returns || []).length && !(d.expenses || []).length;
    const lastSync = d.last_sync ? `<div class="muted small center" style="margin:8px 0 16px">آخر تحديث من جهاز الحسابات ${esc(ago(d.last_sync))} • المخازن: ${esc((d.stores || []).join(" + "))}</div>` : "";

    box.innerHTML = `
      ${staleNote(r)}
      <div class="muted center" style="margin:-4px 0 10px;font-weight:700">${esc(dayName(date))}</div>
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
      </div>
      ${nothing ? empty("مفيش حركات مسجلة في اليوم ده") : ""}
      ${invSection("فواتير البيع", d.sales, "sale", true)}
      ${paySection("التحصيلات من العملاء", d.collections, "plus")}
      ${invSection("فواتير الشراء", d.purchases, "purchase", false)}
      ${paySection("سداد للموردين", d.supplier_payments, "minus")}
      ${invSection("مرتجعات البيع", d.sales_returns, "sale_return", false)}
      ${invSection("مرتجعات الشراء", d.purchase_returns, "purchase_return", false)}
      ${expSection(d.expenses)}
      ${lastSync}`;
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
            </table>
            <a class="btn small ghost" style="margin-top:10px" href="#/invoice/${type}/${encodeURIComponent(inv.no)}">فتح الفاتورة</a>
          </div>
        </details>`).join("")}`;
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
        <div class="list"><a class="list-item" href="#/users"><div class="avatar">${I.people}</div><div class="grow"><div class="title">المستخدمين والصلاحيات</div><div class="sub">موافقة الحسابات الجديدة وتحديد عملاء كل مندوب</div></div>${I.chev}</a></div>` : ""}
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

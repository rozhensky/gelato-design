/* ============================================================
   Gelato — Admin (brief inbox)
   Supabase Auth (magic-link, whitelisted in `admins`) -> list of
   briefs -> brief card (audio + transcripts + links) -> "Передати
   дані" builds a ZIP for Claude Code (brief.md + audio/ + json).
   ============================================================ */
(function () {
  "use strict";

  var QTITLES = [
    "Проблема та її гострота", "Для кого це", "Як вирішують зараз",
    "Суть і головна цінність", "Перший «вау»-сценарій", "Функції першої версії",
    "Референси та конкуренти", "Бренд, тон і стиль", "Монетизація", "Успіх і наступний крок",
  ];

  var app = document.getElementById("app");
  var CFG = window.GELATO_SUPABASE || {};
  var ready = CFG.url && CFG.anonKey && window.supabase;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function toastMsg(m) { var t = document.getElementById("toast"); t.textContent = m; t.classList.add("show"); setTimeout(function () { t.classList.remove("show"); }, 2200); }
  function confirmDialog(title, text, okLabel, onOk) {
    var ov = document.createElement("div");
    ov.className = "overlay";
    ov.innerHTML = '<div class="dialog"><div class="dlg-title">' + esc(title) + '</div><p class="dlg-text">' + esc(text) + '</p>' +
      '<div class="dlg-actions"><button class="btn btn-ghost" id="dlgCancel">Скасувати</button><button class="btn danger-solid" id="dlgOk">' + esc(okLabel) + '</button></div></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); }
    document.getElementById("dlgCancel").onclick = close;
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    document.getElementById("dlgOk").onclick = function () { close(); onOk(); };
  }
  function fmtDate(s) { try { var d = new Date(s); return d.toLocaleDateString("uk-UA") + " " + d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }); } catch (e) { return s || ""; } }
  function initials(name, acc) { var n = (name || "").trim(); if (n) return n.split(/\s+/).map(function (x) { return x[0]; }).slice(0, 2).join("").toUpperCase(); return (acc || "?").replace("tg_", "").slice(0, 2); }
  function topBar(email) {
    return '<div class="top"><div class="brand"><span class="dot"></span> Gelato · Брифи</div>' +
      (email ? '<div class="who"><span>' + esc(email) + '</span><button class="btn btn-ghost btn-sm" id="logout">Вийти</button></div>' : '') + '</div>';
  }

  if (!ready) {
    app.innerHTML = topBar() + '<div class="card"><div class="eyebrow">Налаштування</div><h1>Бекенд не підключено</h1>' +
      '<p class="muted" style="margin-top:10px">Заповніть <code>url</code> і <code>anonKey</code> у файлі <code>app/supabase.js</code> (Supabase → Settings → API), і адмінка запрацює.</p></div>';
    return;
  }

  var sb = window.supabase.createClient(CFG.url, CFG.anonKey);
  var me = null;          // admin email
  var view = { name: "boot" };

  function bindLogout() { var b = document.getElementById("logout"); if (b) b.onclick = function () { sb.auth.signOut().then(function () { location.reload(); }); }; }

  async function boot() {
    var res = await sb.auth.getSession();
    var session = res.data.session;
    if (!session) { me = null; return renderLogin(); }
    // verify admin allowlist
    var a = await sb.from("admins").select("email").eq("email", session.user.email).maybeSingle();
    if (!a.data) { me = null; return renderNoAccess(session.user.email); }
    me = session.user.email;
    if (view.name === "brief") return renderBrief(view.id);
    return renderList();
  }

  // re-evaluate on auth changes (magic-link return, sign-out)
  sb.auth.onAuthStateChange(function (_evt, session) {
    if (!session && view.name !== "login") boot();
    if (session && (view.name === "login" || view.name === "boot")) boot();
  });

  function renderLogin() {
    view = { name: "login" };
    app.innerHTML = topBar() +
      '<div class="card login"><div class="eyebrow">Вхід для команди</div><h1>Адмінка брифів</h1>' +
      '<p class="muted" style="margin-top:10px">Введіть свій робочий email — надішлемо посилання для входу. Доступ лише для адрес зі списку команди.</p>' +
      '<div class="row"><input type="email" id="email" placeholder="you@example.com" autocomplete="email"><button class="btn btn-primary" id="send">Надіслати</button></div>' +
      '<p class="muted" id="hint" style="margin-top:12px;font-size:12.5px"></p></div>';
    var send = document.getElementById("send"), email = document.getElementById("email");
    var go = async function () {
      var v = (email.value || "").trim();
      if (!/.+@.+\..+/.test(v)) { toastMsg("Перевірте email"); return; }
      send.disabled = true; document.getElementById("hint").textContent = "Надсилаємо…";
      var r = await sb.auth.signInWithOtp({ email: v, options: { emailRedirectTo: location.href.split("#")[0] } });
      send.disabled = false;
      document.getElementById("hint").textContent = r.error ? ("Помилка: " + r.error.message) : "Готово — перевірте пошту й перейдіть за посиланням.";
    };
    send.onclick = go;
    email.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
  }

  function renderNoAccess(email) {
    view = { name: "noaccess" };
    app.innerHTML = topBar(email) +
      '<div class="card"><div class="eyebrow">Немає доступу</div><h1>Цей акаунт не в списку команди</h1>' +
      '<p class="muted" style="margin-top:10px">Додайте <code>' + esc(email) + '</code> у таблицю <code>admins</code> в Supabase, щоб бачити брифи.</p></div>';
    bindLogout();
  }

  async function renderList() {
    view = { name: "list" };
    app.innerHTML = topBar(me) + '<div class="card"><div class="eyebrow">Вхідні</div><h1>Брифи</h1><div class="list" id="list"><p class="muted" style="margin-top:14px">Завантаження…</p></div></div>';
    bindLogout();
    var r = await sb.from("briefs")
      .select("*, answers(count), voices(count), links(count)")
      .order("updated_at", { ascending: false });
    if (r.error) { document.getElementById("list").innerHTML = '<p class="muted">Помилка: ' + esc(r.error.message) + "</p>"; return; }
    var rows = r.data || [];
    if (!rows.length) { document.getElementById("list").innerHTML = '<p class="muted" style="margin-top:14px">Поки що порожньо.</p>'; return; }
    function rowHtml(b) {
      var nVoices = (b.voices && b.voices[0]) ? b.voices[0].count : 0;
      var nLinks = (b.links && b.links[0]) ? b.links[0].count : 0;
      var name = b.contact_name || b.tg_name || b.account_id;
      var sub = (nVoices + " голос. · " + nLinks + " посил. · " + fmtDate(b.updated_at));
      var pill = b.status === "submitted" ? '<span class="pill sub">Надіслано</span>' : '<span class="pill prog">В процесі</span>';
      return '<button class="brief-row" data-id="' + b.id + '">' +
        '<span class="av">' + esc(initials(name, b.account_id)) + "</span>" +
        '<span class="nm"><span class="t">' + esc(name) + (b.tg_username ? ' <span class="muted">@' + esc(b.tg_username) + "</span>" : "") + "</span>" +
        '<span class="s">' + esc(sub) + "</span></span>" + pill + "</button>";
    }
    var submitted = rows.filter(function (b) { return b.status === "submitted"; });
    var inprog = rows.filter(function (b) { return b.status !== "submitted"; });
    var html = "";
    if (submitted.length) html += '<div class="group-label">Надіслані · ' + submitted.length + "</div>" + submitted.map(rowHtml).join("");
    if (inprog.length) html += '<div class="group-label' + (submitted.length ? " mt" : "") + '">В процесі · ' + inprog.length + "</div>" + inprog.map(rowHtml).join("");
    document.getElementById("list").innerHTML = html;
    Array.prototype.forEach.call(document.querySelectorAll(".brief-row"), function (el) {
      el.onclick = function () { renderBrief(el.getAttribute("data-id")); };
    });
  }

  var current = null; // { brief, byQ }

  async function renderBrief(id) {
    view = { name: "brief", id: id };
    app.innerHTML = topBar(me) + '<div class="card"><p class="muted">Завантаження брифу…</p></div>';
    bindLogout();

    var bq = await Promise.all([
      sb.from("briefs").select("*").eq("id", id).single(),
      sb.from("answers").select("*").eq("brief_id", id),
      sb.from("voices").select("*").eq("brief_id", id).order("created_at"),
      sb.from("links").select("*").eq("brief_id", id).order("created_at"),
    ]);
    var brief = bq[0].data, answers = bq[1].data || [], voices = bq[2].data || [], links = bq[3].data || [];
    if (!brief) { app.innerHTML = topBar(me) + '<div class="card"><p class="muted">Бриф не знайдено.</p></div>'; return; }

    var qByAns = {}; answers.forEach(function (a) { qByAns[a.id] = a.q_num; });
    var vByQ = {}, lByQ = {};
    voices.forEach(function (v) { var q = qByAns[v.answer_id]; (vByQ[q] = vByQ[q] || []).push(v); });
    links.forEach(function (l) { var q = qByAns[l.answer_id]; (lByQ[q] = lByQ[q] || []).push(l); });

    // signed URLs for playback
    await Promise.all(voices.map(async function (v) {
      var s = await sb.storage.from("voices").createSignedUrl(v.storage_path, 3600);
      v._url = s.data ? s.data.signedUrl : "";
    }));

    current = { brief: brief, voices: voices, links: links, vByQ: vByQ, lByQ: lByQ };

    var dash = '<span class="muted">—</span>';
    var cinfo = [
      ["Імʼя", brief.contact_name ? esc(brief.contact_name) : dash],
      ["Email", brief.email ? '<a href="mailto:' + esc(brief.email) + '">' + esc(brief.email) + "</a>" : dash],
      ["Телефон", brief.phone ? '<a href="tel:' + esc(brief.phone) + '">' + esc(brief.phone) + "</a>" : dash],
      ["Соцмережі", brief.socials ? esc(brief.socials) : dash],
      ["Telegram", brief.tg_username ? "@" + esc(brief.tg_username) : dash],
    ];
    var contactHtml = '<div class="contacts">' + cinfo.map(function (c) { return '<div class="crow"><span class="ck">' + c[0] + '</span><span class="cv">' + c[1] + "</span></div>"; }).join("") + "</div>";

    var blocks = QTITLES.map(function (title, idx) {
      var n = idx + 1;
      var vs = vByQ[n] || [], ls = lByQ[n] || [];
      var inner = "";
      vs.forEach(function (v, i) {
        inner += '<div class="voice"><div class="vh"><span class="muted" style="font-size:12.5px;min-width:74px">Голосова ' + (i + 1) + '</span>' +
          (v._url ? '<audio controls preload="none" src="' + esc(v._url) + '"></audio>' : '<span class="muted">аудіо недоступне</span>') + "</div>" +
          (v.transcript
            ? '<div class="tx">' + esc(v.transcript) + "</div>"
            : '<div class="pending"><iconify-icon icon="solar:clock-circle-linear"></iconify-icon> транскрипт ще готується…</div>') +
          "</div>";
      });
      ls.forEach(function (l) {
        inner += '<div class="linkrow"><iconify-icon icon="' + (l.kind === "video" ? "solar:videocamera-record-linear" : "solar:link-linear") + '"></iconify-icon><a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.url) + "</a></div>";
      });
      if (!vs.length && !ls.length) inner = '<div class="qempty">— не заповнено</div>';
      return '<div class="qblock"><div class="qhead"><span class="qn">' + (n < 10 ? "0" + n : n) + '</span><span class="qt">' + esc(title) + "</span></div>" + inner + "</div>";
    }).join("");

    app.innerHTML = topBar(me) +
      '<div class="bar"><button class="btn btn-ghost btn-sm" id="back"><iconify-icon icon="solar:arrow-left-linear"></iconify-icon> Усі брифи</button>' +
      '<button class="btn btn-primary btn-sm" id="export"><iconify-icon icon="solar:download-minimalistic-linear"></iconify-icon> Передати дані</button>' + '<button class="btn btn-ghost btn-sm danger" id="del"><iconify-icon icon="solar:trash-bin-trash-linear"></iconify-icon> Видалити</button></div>' +
      '<div class="card"><div class="eyebrow">Бриф</div><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:6px 0 4px"><h1>' + esc(brief.tg_name || brief.account_id) + "</h1>" +
      (brief.status === "submitted" ? '<span class="pill sub">Надіслано</span>' : '<span class="pill prog">В процесі</span>') + "</div>" +
      '<p class="muted" style="font-size:13px">' + (brief.tg_username ? "@" + esc(brief.tg_username) + " · " : "") + esc(brief.account_id) + " · оновлено " + fmtDate(brief.updated_at) + "</p>" +
      contactHtml +
      '<div style="margin-top:14px">' + blocks + "</div></div>";

    document.getElementById("back").onclick = function () { renderList(); };
    document.getElementById("export").onclick = function () { exportBrief(); };
    document.getElementById("del").onclick = function () {
      confirmDialog("Видалити бриф?", "Ви справді хочете видалити цей бриф? Усі відповіді й аудіо зникнуть назавжди.", "Видалити", async function () {
        var paths = (current && current.voices ? current.voices : []).map(function (v) { return v.storage_path; }).filter(Boolean);
        if (paths.length) { try { await sb.storage.from("voices").remove(paths); } catch (e) {} }
        var r = await sb.from("briefs").delete().eq("id", brief.id).select();
        if (r.error) { toastMsg("Помилка: " + r.error.message); return; }
        if (!r.data || !r.data.length) { toastMsg("Не вдалося видалити — застосуйте RLS-політику на delete у Supabase"); return; }
        toastMsg("Бриф видалено");
        renderList();
      });
    };
    bindLogout();
  }

  async function exportBrief() {
    if (!current) return;
    var btn = document.getElementById("export");
    btn.disabled = true; var orig = btn.innerHTML;
    btn.innerHTML = '<iconify-icon icon="solar:refresh-linear" class="spin"></iconify-icon> Збираю…';
    try {
      var brief = current.brief, zip = new JSZip();
      var safe = (brief.tg_name || brief.account_id || "brief").replace(/[^\wа-яіїєґ\-]+/gi, "_");
      var root = "brief-" + safe;

      var md = "# Бриф: " + (brief.contact_name || brief.tg_name || brief.account_id) + "\n\n" +
        "- Акаунт: " + brief.account_id + (brief.tg_username ? " (@" + brief.tg_username + ")" : "") + "\n" +
        (brief.contact_name ? "- Імʼя: " + brief.contact_name + "\n" : "") +
        (brief.email ? "- Email: " + brief.email + "\n" : "") +
        (brief.phone ? "- Телефон: " + brief.phone + "\n" : "") +
        (brief.socials ? "- Соцмережі: " + brief.socials + "\n" : "") +
        "- Статус: " + brief.status + "\n- Оновлено: " + brief.updated_at + "\n\n---\n\n";
      var json = { account: brief.account_id, contact_name: brief.contact_name, email: brief.email, phone: brief.phone, socials: brief.socials, tg_name: brief.tg_name, tg_username: brief.tg_username, status: brief.status, questions: [] };

      for (var n = 1; n <= QTITLES.length; n++) {
        md += "## " + n + ". " + QTITLES[n - 1] + "\n\n";
        var vs = current.vByQ[n] || [], ls = current.lByQ[n] || [];
        var qjson = { n: n, title: QTITLES[n - 1], transcripts: [], audio: [], links: [] };
        if (!vs.length && !ls.length) md += "_— не заповнено_\n\n";
        for (var i = 0; i < vs.length; i++) {
          var v = vs[i];
          var ext = (v.storage_path.split(".").pop() || "webm").toLowerCase();
          var fname = "audio/q" + n + "-" + (i + 1) + "." + ext;
          if (v.transcript) { md += "**Голосова " + (i + 1) + ":** " + v.transcript + "\n\n"; }
          else { md += "**Голосова " + (i + 1) + ":** _(транскрипт ще не готовий — див. " + fname + ")_\n\n"; }
          qjson.transcripts.push(v.transcript || null);
          qjson.audio.push(fname);
          // fetch audio bytes into the zip
          try { if (v._url) { var resp = await fetch(v._url); zip.file(root + "/" + fname, await resp.arrayBuffer()); } } catch (e) { /* skip file */ }
        }
        if (ls.length) {
          md += "**Посилання:**\n";
          ls.forEach(function (l) { md += "- " + (l.kind === "video" ? "[відео] " : "") + l.url + "\n"; qjson.links.push({ url: l.url, kind: l.kind }); });
          md += "\n";
        }
        json.questions.push(qjson);
      }

      var readme = "# Бриф продукту для планування\n\n" +
        "Цей пакет згенеровано з інтерактивного брифу клієнта Gelato.\n\n" +
        "**Що зробити (Claude Code):**\n" +
        "1. Прочитай `brief.md` — це відповіді клієнта (транскрипти голосових) на 10 питань + посилання.\n" +
        "2. За потреби звірся з оригінальними аудіо в папці `audio/` та структурованим `answers.json`.\n" +
        "3. Зроби продуктове планування: проблема й аудиторія, головна цінність, ключові сценарії, обсяг першого прототипу (MVP), екрани/флоу, розбивка на спринти, відкриті питання до стратегічної сесії.\n";

      zip.file(root + "/brief.md", md);
      zip.file(root + "/answers.json", JSON.stringify(json, null, 2));
      zip.file(root + "/README.md", readme);

      var blob = await zip.generateAsync({ type: "blob" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = root + ".zip";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      toastMsg("Пакет зібрано");
    } catch (e) {
      toastMsg("Помилка експорту");
    } finally {
      btn.disabled = false; btn.innerHTML = orig;
    }
  }

  boot();
})();

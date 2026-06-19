/* ============================================================
   Gelato — Interactive Brief (Telegram Mini App)

   Onboarding wizard that captures a product brief BEFORE the
   strategy session. Per question the user can: record one or
   several voice notes (record / play / delete / re-record), and
   attach links & video URLs. Everything autosaves at the account
   level and can be resumed, edited or deleted later.

   v1 persistence: IndexedDB (local, handles audio blobs).
   The user identity comes from Telegram WebApp when available.
   Swapping the persistence layer for a real backend (Supabase)
   later only touches the `Store` object + submitBrief().
   ============================================================ */
(function () {
    'use strict';

    /* ---------- Telegram WebApp ---------- */
    var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
    function tgCall(fn) { try { return fn(); } catch (e) { return undefined; } }
    if (tg) {
        tgCall(function () { tg.ready(); });
        tgCall(function () { tg.expand(); });
        tgCall(function () { tg.setHeaderColor('#EFECE5'); });
        tgCall(function () { tg.setBackgroundColor('#EFECE5'); });
        tgCall(function () { if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); });
        tgCall(function () { if (tg.enableClosingConfirmation) tg.enableClosingConfirmation(); });
        tgCall(function () { if (tg.MainButton) tg.MainButton.hide(); });
        // keep the layout sized to Telegram's stable viewport
        var applyVH = function () {
            var h = tg.viewportStableHeight || tg.viewportHeight;
            if (h) document.documentElement.style.setProperty('--vh', h + 'px');
        };
        tgCall(function () { if (tg.onEvent) tg.onEvent('viewportChanged', applyVH); });
        applyVH();
    }
    var tgUser = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : null;
    var ACCOUNT_ID = tgUser ? ('tg_' + tgUser.id) : 'local';

    /* ---------- Questions ---------- */
    var QUESTIONS = [
        { n: 1,  title: 'Проблема та її гострота',
          help: 'Яку проблему вирішує ваш продукт? Для кого вона найболючіша і як люди страждають від неї зараз?',
          formats: ['voice'] },
        { n: 2,  title: 'Для кого це',
          help: 'Опишіть конкретну людину: хто вона, у якому контексті й у який момент їй це потрібно.',
          formats: ['voice'] },
        { n: 3,  title: 'Як вирішують зараз',
          help: 'Як ваша аудиторія справляється сьогодні (зокрема «ніяк» чи «вручну»)? Чим ви будете кращими? Додайте посилання на конкурентів.',
          formats: ['voice', 'links'] },
        { n: 4,  title: 'Суть і головна цінність',
          help: 'У 2–3 реченнях: що це за продукт і яку одну головну цінність він дає.',
          formats: ['voice'] },
        { n: 5,  title: 'Перший «вау»-сценарій',
          help: 'Проведіть нас кроками: користувач уперше відкриває продукт — що він робить і в який момент відчуває цінність?',
          formats: ['voice'] },
        { n: 6,  title: 'Функції першої версії',
          help: 'Без яких 3–5 функцій прототип не має сенсу? І що точно НЕ робимо зараз.',
          formats: ['voice'] },
        { n: 7,  title: 'Референси та конкуренти',
          help: 'Покажіть продукти й інтерфейси, які вам подобаються (і чим саме). Посилання, відео-огляди, Loom.',
          formats: ['links', 'video', 'voice'] },
        { n: 8,  title: 'Бренд, тон і стиль',
          help: 'Який настрій і характер у продукту? Приклади візуалу чи брендів, що резонують.',
          formats: ['voice', 'links'],
          hint: { url: 'https://www.aura.build/design-systems', label: 'Відкрити Aura',
                  text: 'На Aura зібрані різні дизайн-системи продуктів. Знайдіть ту, що подобається найбільше, відкрийте її, скопіюйте посилання — і вставте нижче. Це допоможе нам зрозуміти ваші смаки.' } },
        { n: 9,  title: 'Монетизація',
          help: 'Як продукт заробляє (підписка, разово, комісія…) і хто за це платить?',
          formats: ['voice'] },
        { n: 10, title: 'Успіх і наступний крок',
          help: 'Як ви зрозумієте, що прототип «вистрілив»? Кому покажете першим — інвесторам, аудиторії, клієнтам?',
          formats: ['voice', 'video'] }
    ];
    var FORMAT_META = {
        voice: { label: 'Голос', icon: 'solar:microphone-3-linear' },
        links: { label: 'Посилання', icon: 'solar:link-linear' },
        video: { label: 'Відео', icon: 'solar:videocamera-record-linear' }
    };

    /* ---------- tiny utils ---------- */
    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
    function fmtTime(sec) {
        sec = Math.max(0, Math.round(sec));
        var m = Math.floor(sec / 60), s = sec % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
    }
    function plural(n, one, few, many) {
        var d = n % 10, h = n % 100;
        if (d === 1 && h !== 11) return one;
        if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
        return many;
    }
    function prettyUrl(u) {
        try { var x = new URL(u); return x.hostname.replace(/^www\./, '') + (x.pathname.length > 1 ? x.pathname : ''); }
        catch (e) { return u; }
    }
    function normalizeUrl(u) {
        u = (u || '').trim();
        if (!u) return '';
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        try { new URL(u); return u; } catch (e) { return ''; }
    }
    function haptic(type) {
        if (!tg || !tg.HapticFeedback) return;
        tgCall(function () {
            if (type === 'impact') tg.HapticFeedback.impactOccurred('medium');
            else if (type === 'ok') tg.HapticFeedback.notificationOccurred('success');
            else tg.HapticFeedback.selectionChanged();
        });
    }
    var toastTimer;
    function toast(msg) {
        var t = $('#toast'); if (!t) return;
        t.textContent = msg; t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1900);
    }

    /* ============================================================
       Store — IndexedDB persistence (one record per question).
       ============================================================ */
    var Store = (function () {
        var DB_NAME = 'gelato_brief';
        var STORE = 'answers';
        var dbp = null;
        function open() {
            if (dbp) return dbp;
            dbp = new Promise(function (res, rej) {
                var r = indexedDB.open(DB_NAME, 1);
                r.onupgradeneeded = function (e) {
                    var db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
                };
                r.onsuccess = function () { res(r.result); };
                r.onerror = function () { rej(r.error); };
            });
            return dbp;
        }
        function tx(mode) { return open().then(function (db) { return db.transaction(STORE, mode).objectStore(STORE); }); }
        return {
            getAll: function () {
                return tx('readonly').then(function (os) {
                    return new Promise(function (res, rej) {
                        var out = {}; var c = os.openCursor();
                        c.onsuccess = function (e) {
                            var cur = e.target.result;
                            if (cur) { out[cur.value.id] = cur.value; cur.continue(); }
                            else res(out);
                        };
                        c.onerror = function () { rej(c.error); };
                    });
                });
            },
            put: function (rec) {
                rec.ts = Date.now();
                return tx('readwrite').then(function (os) {
                    return new Promise(function (res, rej) {
                        var r = os.put(rec); r.onsuccess = function () { res(rec); }; r.onerror = function () { rej(r.error); };
                    });
                });
            }
        };
    })();

    /* ============================================================
       Sync — best-effort push of answers to the Supabase backend.
       Enabled only inside Telegram (needs initData) with config set;
       otherwise the app stays local-only (IndexedDB) as before.
       ============================================================ */
    var Sync = (function () {
        var CFG = window.GELATO_SUPABASE || {};
        var client = (CFG.url && CFG.anonKey && window.supabase) ? window.supabase.createClient(CFG.url, CFG.anonKey) : null;
        var enabled = !!(client && tg && tg.initData);
        function call(action, payload) {
            return client.functions.invoke('save', { body: Object.assign({ initData: tg.initData, action: action }, payload || {}) })
                .then(function (res) { if (res.error) throw res.error; return res.data; });
        }
        function extOf(mime) {
            mime = mime || '';
            if (mime.indexOf('mp4') > -1) return 'mp4';
            if (mime.indexOf('ogg') > -1) return 'ogg';
            if (mime.indexOf('mpeg') > -1 || mime.indexOf('mp3') > -1) return 'mp3';
            if (mime.indexOf('wav') > -1) return 'wav';
            return 'webm';
        }
        return {
            enabled: enabled,
            uploadVoice: function (n, title, clip) {
                return call('requestUpload', { qNum: n, title: title, ext: extOf(clip.mime), mime: clip.mime })
                    .then(function (up) {
                        return client.storage.from('voices').uploadToSignedUrl(up.path, up.token, clip.blob)
                            .then(function (r) { if (r.error) throw r.error; return up.path; });
                    })
                    .then(function (path) { return call('recordVoice', { qNum: n, title: title, path: path, mime: clip.mime, duration: clip.dur }); })
                    .then(function (rec) { return rec.id; });
            },
            deleteVoice: function (rid) { return call('deleteVoice', { id: rid }); },
            saveLink: function (n, title, url, kind) { return call('saveLink', { qNum: n, title: title, url: url, kind: kind }).then(function (r) { return r.id; }); },
            deleteLink: function (rid) { return call('deleteLink', { id: rid }); },
            submit: function () { return call('submit', {}); }
        };
    })();

    function qMeta(qid) { var n = parseInt(qid.slice(1), 10); return { n: n, title: (QUESTIONS[n - 1] || {}).title || '' }; }
    function syncVoice(qid, clip) {
        if (!Sync.enabled) return;
        var m = qMeta(qid);
        Sync.uploadVoice(m.n, m.title, clip).then(function (rid) { clip.remoteId = rid; persist(qid); }).catch(function () {});
    }

    /* ---------- in-memory mirror for synchronous rendering ---------- */
    var ANS = {};
    function ansFor(qid) {
        if (!ANS[qid]) ANS[qid] = { id: qid, voices: [], links: [] };
        return ANS[qid];
    }
    function persist(qid) { Store.put(ansFor(qid)).catch(function () { toast('Не вдалося зберегти локально'); }); }
    function isAnswered(qid) { var a = ANS[qid]; return !!(a && (a.voices.length || a.links.length)); }
    function answeredCount() {
        return QUESTIONS.reduce(function (n, q) { return n + (isAnswered('q' + q.n) ? 1 : 0); }, 0);
    }

    /* ============================================================
       State + navigation.  pos: -1 intro | 0..9 questions | 10 review | 11 done
       ============================================================ */
    var state = { pos: -1 };
    var app = $('#app');
    var bar = $('#bar');
    function setBar(html) { bar.innerHTML = html ? '<div class="bar-inner">' + html + '</div>' : ''; }

    function setBackButton() {
        if (!tg || !tg.BackButton) return;
        if (state.pos > -1 && state.pos < 11) tgCall(function () { tg.BackButton.show(); });
        else tgCall(function () { tg.BackButton.hide(); });
    }
    if (tg && tg.BackButton) tgCall(function () { tg.BackButton.onClick(function () { goBack(); }); });

    function goBack() {
        stopRecording(true);
        if (state.pos === 0) state.pos = -1;
        else if (state.pos >= 1 && state.pos <= 10) state.pos -= 1;
        render();
    }
    function goTo(pos) { stopRecording(true); state.pos = pos; window.scrollTo(0, 0); render(); }

    /* ============================================================
       Audio recording controller
       ============================================================ */
    var rec = { mr: null, chunks: [], stream: null, qid: null, t0: 0, int: null, active: false, _discard: false };

    function pickMime() {
        if (!window.MediaRecorder) return null;
        var cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', ''];
        for (var i = 0; i < cands.length; i++) {
            try { if (cands[i] === '' || MediaRecorder.isTypeSupported(cands[i])) return cands[i]; } catch (e) {}
        }
        return '';
    }

    function startRecording(qid) {
        if (rec.active) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
            toast('Запис не підтримується — завантажте аудіофайл'); return;
        }
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
            var mime = pickMime();
            try { rec.mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); }
            catch (e) { rec.mr = new MediaRecorder(stream); }
            rec.stream = stream; rec.chunks = []; rec.qid = qid; rec.active = true; rec.t0 = Date.now();
            rec.mr.ondataavailable = function (e) { if (e.data && e.data.size) rec.chunks.push(e.data); };
            rec.mr.onstop = function () { finalizeRecording(); };
            rec.mr.start();
            haptic('impact');
            updateRecUI();
            rec.int = setInterval(updateRecUI, 250);
        }).catch(function () {
            toast('Немає доступу до мікрофона');
        });
    }

    function stopRecording(discard) {
        if (!rec.active) return;
        rec._discard = !!discard;
        clearInterval(rec.int); rec.int = null;
        try { rec.mr.stop(); } catch (e) { finalizeRecording(); }
    }

    function finalizeRecording() {
        var discard = rec._discard; rec._discard = false;
        if (rec.stream) { rec.stream.getTracks().forEach(function (t) { t.stop(); }); }
        var qid = rec.qid, chunks = rec.chunks, dur = (Date.now() - rec.t0) / 1000;
        rec.active = false; rec.mr = null; rec.stream = null; rec.chunks = []; rec.qid = null;
        if (discard || !chunks.length) { updateRecUI(); return; }
        var type = (chunks[0] && chunks[0].type) || 'audio/webm';
        var blob = new Blob(chunks, { type: type });
        if (blob.size < 600) { toast('Запис надто короткий'); updateRecUI(); return; }
        var a = ansFor(qid);
        var clip = { id: uid(), blob: blob, mime: type, dur: dur, ts: Date.now() };
        a.voices.push(clip);
        persist(qid);
        syncVoice(qid, clip);
        haptic('ok');
        if (state.pos >= 0 && state.pos <= 9 && 'q' + QUESTIONS[state.pos].n === qid) render();
    }

    function updateRecUI() {
        var btn = $('#recBtn'), hint = $('#recHint'), wrap = $('#recWrap');
        if (!btn) return;
        if (rec.active) {
            btn.classList.add('is-rec');
            btn.innerHTML = '<iconify-icon icon="solar:stop-bold"></iconify-icon>';
            if (wrap) wrap.classList.add('live');
            if (hint) { hint.classList.add('live'); hint.textContent = '● Запис… ' + fmtTime((Date.now() - rec.t0) / 1000); }
        } else {
            btn.classList.remove('is-rec');
            btn.innerHTML = '<iconify-icon icon="solar:microphone-3-bold"></iconify-icon>';
            if (wrap) wrap.classList.remove('live');
            if (hint) { hint.classList.remove('live'); hint.textContent = 'Натисніть, щоб записати голосову'; }
        }
    }

    /* ---------- playback (single shared <audio>) ---------- */
    var player = $('#player');
    var playingId = null, playingUrl = null;
    function togglePlay(qid, clipId) {
        var a = ANS[qid]; if (!a) return;
        var clip = a.voices.filter(function (v) { return v.id === clipId; })[0]; if (!clip) return;
        if (playingId === clipId && !player.paused) { player.pause(); return; }
        if (playingUrl) { URL.revokeObjectURL(playingUrl); playingUrl = null; }
        playingUrl = URL.createObjectURL(clip.blob);
        player.src = playingUrl; playingId = clipId;
        player.play().catch(function () { toast('Не вдалося відтворити'); });
    }
    player.addEventListener('play', updatePlayIcons);
    player.addEventListener('pause', updatePlayIcons);
    player.addEventListener('ended', function () { playingId = null; updatePlayIcons(); });
    function updatePlayIcons() {
        document.querySelectorAll('[data-play]').forEach(function (b) {
            var on = (b.getAttribute('data-clip') === playingId) && !player.paused;
            var ic = b.querySelector('iconify-icon');
            if (ic) ic.setAttribute('icon', on ? 'solar:pause-bold' : 'solar:play-bold');
        });
    }

    /* ---------- mutations ---------- */
    function deleteVoice(qid, clipId) {
        var a = ANS[qid]; if (!a) return;
        var clip = a.voices.filter(function (v) { return v.id === clipId; })[0];
        if (playingId === clipId) { player.pause(); playingId = null; }
        a.voices = a.voices.filter(function (v) { return v.id !== clipId; });
        persist(qid);
        if (clip && clip.remoteId && Sync.enabled) Sync.deleteVoice(clip.remoteId).catch(function () {});
        render();
    }
    function deleteLink(qid, linkId) {
        var a = ANS[qid]; if (!a) return;
        var link = a.links.filter(function (l) { return l.id === linkId; })[0];
        a.links = a.links.filter(function (l) { return l.id !== linkId; });
        persist(qid);
        if (link && link.remoteId && Sync.enabled) Sync.deleteLink(link.remoteId).catch(function () {});
        render();
    }
    function addLink(qid, raw, kind) {
        var url = normalizeUrl(raw);
        if (!url) { toast('Перевірте посилання'); return false; }
        var link = { id: uid(), url: url, kind: kind || 'link', ts: Date.now() };
        ansFor(qid).links.push(link);
        persist(qid);
        if (Sync.enabled) { var m = qMeta(qid); Sync.saveLink(m.n, m.title, link.url, link.kind).then(function (id) { link.remoteId = id; persist(qid); }).catch(function () {}); }
        haptic(); render();
        return true;
    }

    /* ============================================================
       Rendering
       ============================================================ */
    function topChrome(label) {
        var total = QUESTIONS.length, done = answeredCount();
        var pct = state.pos >= 0 && state.pos <= 9
            ? Math.round((state.pos / total) * 100)
            : Math.round((done / total) * 100);
        return '' +
            '<div class="top">' +
                '<div class="brand"><span class="dot"></span> Gelato</div>' +
                '<div class="step-count">' + label + '</div>' +
            '</div>' +
            '<div class="pbar"><i style="width:' + pct + '%"></i></div>';
    }

    function render() {
        setBackButton();
        if (state.pos === -1) return renderIntro();
        if (state.pos >= 0 && state.pos <= 9) return renderQuestion(state.pos);
        if (state.pos === 10) return renderReview();
        return renderDone();
    }

    function feat(icon, t, d) {
        return '<div class="feat"><div class="fi"><iconify-icon icon="' + icon + '"></iconify-icon></div>' +
               '<div class="ft"><b>' + t + '</b>' + d + '</div></div>';
    }

    function renderIntro() {
        var done = answeredCount();
        var resuming = done > 0;
        var hi = tgUser && tgUser.first_name ? (', ' + esc(tgUser.first_name)) : '';
        app.innerHTML =
            topChrome('Бриф') +
            '<div class="card">' +
                '<div class="eyebrow">Інтерактивний бриф · ~10–15 хв</div>' +
                '<h1 class="title">Розкажіть про ідею' + hi + '</h1>' +
                '<p class="help">10 коротких питань, щоб ми зрозуміли ваш продукт ще до стратегічної сесії. Відповідайте, як зручно — голосом, посиланнями чи відео.</p>' +
                '<div class="intro-feats">' +
                    feat('solar:microphone-3-linear', 'Голосом', 'На кожне питання — одна чи кілька голосових. Можна прослухати й перезаписати.') +
                    feat('solar:link-linear', 'Посилання та відео', 'Кидайте конкурентів, референси, огляди чи Loom — усе в одному місці.') +
                    feat('solar:diskette-linear', 'Зберігається саме', 'Можна вийти й повернутись будь-коли — відповіді лишаться на вашому акаунті.') +
                '</div>' +
            '</div>';
        setBar(resuming
            ? '<button class="btn btn-ghost" id="reviewBtn">Огляд</button><button class="btn btn-primary" id="startBtn"><iconify-icon icon="solar:play-circle-bold"></iconify-icon> Продовжити · ' + done + '/10</button>'
            : '<button class="btn btn-primary" id="startBtn">Почати <iconify-icon icon="solar:arrow-right-linear"></iconify-icon></button>');
        $('#startBtn').onclick = function () {
            var first = 0;
            for (var i = 0; i < QUESTIONS.length; i++) { if (!isAnswered('q' + QUESTIONS[i].n)) { first = i; break; } }
            goTo(resuming ? first : 0);
        };
        if ($('#reviewBtn')) $('#reviewBtn').onclick = function () { goTo(10); };
    }

    function renderQuestion(idx) {
        var q = QUESTIONS[idx], qid = 'q' + q.n, a = ansFor(qid);
        var wantsLinks = q.formats.indexOf('links') > -1 || q.formats.indexOf('video') > -1;
        var wantsVideo = q.formats.indexOf('video') > -1;

        var chips = q.formats.map(function (f) {
            var m = FORMAT_META[f];
            return '<span class="chip"><iconify-icon icon="' + m.icon + '"></iconify-icon>' + m.label + '</span>';
        }).join('');

        var voicesHtml = a.voices.length
            ? '<div class="list">' + a.voices.map(function (v, i) {
                return '<div class="row">' +
                    '<button class="icon-btn" data-play data-clip="' + v.id + '"><iconify-icon icon="solar:play-bold"></iconify-icon></button>' +
                    '<div class="meta"><span class="ln1">Запис #' + (i + 1) + '</span>' +
                    '<div class="ln2">' + fmtTime(v.dur || 0) + '</div></div>' +
                    '<button class="del" data-delvoice="' + v.id + '"><iconify-icon icon="solar:trash-bin-trash-linear"></iconify-icon></button>' +
                '</div>';
            }).join('') + '</div>'
            : '';

        var linksHtml = a.links.length
            ? '<div class="list">' + a.links.map(function (l) {
                var ic = l.kind === 'video' ? 'solar:videocamera-record-linear' : 'solar:link-linear';
                return '<div class="row">' +
                    '<span class="icon-btn"><iconify-icon icon="' + ic + '"></iconify-icon></span>' +
                    '<div class="meta"><a class="ln1" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(prettyUrl(l.url)) + '</a></div>' +
                    '<button class="del" data-dellink="' + l.id + '"><iconify-icon icon="solar:trash-bin-trash-linear"></iconify-icon></button>' +
                '</div>';
            }).join('') + '</div>'
            : '';

        var linkBlock = wantsLinks ? (
            '<div class="block">' +
                '<div class="block-label"><iconify-icon icon="' + (wantsVideo ? 'solar:videocamera-record-linear' : 'solar:link-linear') + '"></iconify-icon>' +
                    (wantsVideo ? 'Посилання та відео ' : 'Посилання ') + '<span class="muted">— за бажанням</span></div>' +
                linksHtml +
                '<div class="adder">' +
                    '<input id="linkInput" type="url" inputmode="url" placeholder="' + (wantsVideo ? 'Вставте посилання або відео…' : 'Вставте посилання…') + '">' +
                    '<button id="linkAdd">Додати</button>' +
                '</div>' +
            '</div>'
        ) : '';

        var hintHtml = q.hint ? (
            '<a class="hint" href="' + esc(q.hint.url) + '" target="_blank" rel="noopener">' +
                '<span class="hint-ic"><iconify-icon icon="solar:palette-2-linear"></iconify-icon></span>' +
                '<span class="hint-body"><span class="hint-text">' + esc(q.hint.text) + '</span>' +
                '<span class="hint-link">' + esc(q.hint.label) + ' <iconify-icon icon="solar:arrow-right-up-linear"></iconify-icon></span></span>' +
            '</a>'
        ) : '';

        var last = idx === QUESTIONS.length - 1;
        app.innerHTML =
            topChrome('Питання ' + q.n + ' з ' + QUESTIONS.length) +
            '<div class="card">' +
                '<div class="eyebrow"><span class="qnum">' + (q.n < 10 ? '0' + q.n : q.n) + '</span> · Питання</div>' +
                '<h2 class="qtitle">' + esc(q.title) + '</h2>' +
                '<p class="help">' + esc(q.help) + '</p>' +
                '<div class="chips">' + chips + '</div>' +

                '<div class="block">' +
                    '<div class="block-label"><iconify-icon icon="solar:microphone-3-linear"></iconify-icon>Голосова відповідь</div>' +
                    '<div class="rec-wrap" id="recWrap">' +
                        '<button class="rec" id="recBtn"><iconify-icon icon="solar:microphone-3-bold"></iconify-icon></button>' +
                        '<div class="eq"><i></i><i></i><i></i><i></i><i></i></div>' +
                        '<div class="rec-hint" id="recHint">Натисніть, щоб записати голосову</div>' +
                    '</div>' +
                    voicesHtml +
                '</div>' +

                hintHtml +
                linkBlock +
            '</div>';

        setBar(
            '<button class="btn btn-ghost narrow" id="prevBtn"><iconify-icon icon="solar:arrow-left-linear"></iconify-icon></button>' +
            '<button class="btn btn-ghost narrow" id="goReview"><iconify-icon icon="solar:checklist-minimalistic-linear"></iconify-icon> Огляд</button>' +
            '<button class="btn btn-primary" id="nextBtn">' + (last ? 'До огляду' : 'Далі') + ' <iconify-icon icon="solar:arrow-right-linear"></iconify-icon></button>'
        );

        updateRecUI();
        $('#recBtn').onclick = function () { if (rec.active) stopRecording(false); else startRecording(qid); };
        document.querySelectorAll('[data-play]').forEach(function (b) {
            b.onclick = function () { togglePlay(qid, b.getAttribute('data-clip')); };
        });
        document.querySelectorAll('[data-delvoice]').forEach(function (b) {
            b.onclick = function () { deleteVoice(qid, b.getAttribute('data-delvoice')); };
        });
        document.querySelectorAll('[data-dellink]').forEach(function (b) {
            b.onclick = function () { deleteLink(qid, b.getAttribute('data-dellink')); };
        });
        if (wantsLinks) {
            var inp = $('#linkInput');
            var doAdd = function () {
                var kind = /youtu\.?be|loom\.com|vimeo|\.mp4|\.mov/i.test(inp.value) ? 'video' : 'link';
                addLink(qid, inp.value, wantsVideo ? kind : 'link');
            };
            $('#linkAdd').onclick = doAdd;
            inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
        }
        $('#prevBtn').onclick = function () { goTo(idx === 0 ? -1 : idx - 1); };
        $('#goReview').onclick = function () { goTo(10); };
        $('#nextBtn').onclick = function () { goTo(idx + 1 > 9 ? 10 : idx + 1); };
    }

    function renderReview() {
        var done = answeredCount();
        var items = QUESTIONS.map(function (q, i) {
            var qid = 'q' + q.n, a = ansFor(qid), ok = isAnswered(qid);
            var bits = [];
            if (a.voices.length) bits.push(a.voices.length + ' ' + plural(a.voices.length, 'запис', 'записи', 'записів'));
            if (a.links.length) bits.push(a.links.length + ' ' + plural(a.links.length, 'посилання', 'посилання', 'посилань'));
            var sub = bits.length ? bits.join(' · ') : 'Ще не заповнено';
            return '<button class="rev-item" data-go="' + i + '">' +
                '<span class="rev-badge ' + (ok ? 'done' : 'todo') + '">' + (ok ? '<iconify-icon icon="mdi:check-bold" width="16"></iconify-icon>' : q.n) + '</span>' +
                '<span class="rev-main"><span class="rt">' + esc(q.title) + '</span><span class="rs">' + sub + '</span></span>' +
                '<span class="go"><iconify-icon icon="solar:pen-2-linear"></iconify-icon></span>' +
            '</button>';
        }).join('');

        app.innerHTML =
            topChrome('Огляд · ' + done + '/' + QUESTIONS.length) +
            '<div class="card">' +
                '<div class="eyebrow">Майже готово</div>' +
                '<h2 class="qtitle">Перегляньте бриф</h2>' +
                '<p class="help">Заповнено ' + done + ' із ' + QUESTIONS.length + '. Можна доповнити будь-яке питання або надіслати як є — деталі все одно уточнимо на сесії.</p>' +
                '<div class="rev-list">' + items + '</div>' +
            '</div>';

        setBar(
            '<button class="btn btn-ghost narrow" id="backIntro"><iconify-icon icon="solar:home-2-linear"></iconify-icon></button>' +
            '<button class="btn btn-primary" id="submitBtn">Надіслати бриф <iconify-icon icon="solar:plain-2-bold"></iconify-icon></button>'
        );
        document.querySelectorAll('[data-go]').forEach(function (it) {
            it.onclick = function () { goTo(parseInt(it.getAttribute('data-go'), 10)); };
        });
        $('#backIntro').onclick = function () { goTo(-1); };
        $('#submitBtn').onclick = function () { submitBrief(); };
    }

    function renderDone() {
        app.innerHTML =
            '<div class="card"><div class="done-wrap">' +
                '<div class="done-ic"><iconify-icon icon="solar:check-read-linear"></iconify-icon></div>' +
                '<h2 class="qtitle" style="margin-top:0">Бриф надіслано</h2>' +
                '<p class="help" style="margin-left:auto;margin-right:auto;max-width:34ch">Дякуємо! Ми вивчимо матеріали й підготуємось до стратегічної сесії. Відповіді лишаються у вас — можна повернутись і доповнити.</p>' +
            '</div></div>';
        setBar('<button class="btn btn-ghost" id="reopen">Відкрити бриф знову</button>');
        $('#reopen').onclick = function () { goTo(10); };
    }

    /* ============================================================
       Submit — v1 marks complete locally. TODO: POST to backend
       (validate Telegram initData, upload audio to storage, notify
       team). The collected payload is assembled here for that swap.
       ============================================================ */
    function submitBrief() {
        var payload = {
            account: ACCOUNT_ID,
            tgUser: tgUser ? { id: tgUser.id, username: tgUser.username, name: tgUser.first_name } : null,
            initData: tg ? tg.initData : null,
            answers: QUESTIONS.map(function (q) {
                var a = ansFor('q' + q.n);
                return {
                    n: q.n, title: q.title,
                    voices: a.voices.length,
                    links: a.links.map(function (l) { return { url: l.url, kind: l.kind }; })
                };
            })
        };
        try { localStorage.setItem('gelato_brief_submitted_' + ACCOUNT_ID, JSON.stringify({ ts: Date.now(), summary: payload.answers })); } catch (e) {}
        haptic('ok');
        if (Sync.enabled) Sync.submit().catch(function () {});
        // Backend hook (phase 2):
        // fetch(API + '/brief', { method: 'POST', body: buildFormData(payload) })
        toast('Бриф збережено');
        goTo(11);
    }

    /* ============================================================
       Boot
       ============================================================ */
    Store.getAll().then(function (all) {
        ANS = all || {};
        QUESTIONS.forEach(function (q) { ansFor('q' + q.n); });
        render();
    }).catch(function () {
        QUESTIONS.forEach(function (q) { ansFor('q' + q.n); });
        toast('Локальне сховище недоступне — відповіді не збережуться');
        render();
    });
})();

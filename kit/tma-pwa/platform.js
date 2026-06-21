/* ============================================================
   platform.js — єдиний адаптер «Telegram Mini App ↔ PWA».
   Одна кодова база працює і всередині Telegram, і як
   встановлюваний веб-застосунок (PWA). Замість прямих викликів
   window.Telegram.WebApp.* код викликає Platform.*, а адаптер
   сам маршрутизує у Telegram SDK або у веб-фолбек.

   Підключати ПЕРШИМ, до основного скрипта застосунку:
     <script src="platform.js"></script>
     <script src="app.js"></script>

   Залежностей немає (vanilla). Сумісно з поточним app.js.
   ============================================================ */
(function (w) {
    'use strict';

    var tg = (w.Telegram && w.Telegram.WebApp) ? w.Telegram.WebApp : null;
    var inTelegram = !!(tg && (tg.initData || (tg.initDataUnsafe && tg.initDataUnsafe.user)));

    function safe(fn) { try { return fn(); } catch (e) { return undefined; } }

    var WEB_USER_KEY = 'app_web_user';
    function webUser() { try { return JSON.parse(w.localStorage.getItem(WEB_USER_KEY) || 'null'); } catch (e) { return null; } }

    var Platform = {
        mode: inTelegram ? 'telegram' : 'web',
        isTelegram: inTelegram,

        ready: function () { if (tg) safe(function () { tg.ready(); }); },
        expand: function () { if (tg) safe(function () { tg.expand(); }); },

        // Уніфікований користувач: {id, name, username, lang} або null
        user: function () {
            if (inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.user) {
                var u = tg.initDataUnsafe.user;
                return {
                    id: 'tg_' + u.id,
                    name: [u.first_name, u.last_name].filter(Boolean).join(' '),
                    username: u.username || '',
                    lang: u.language_code || ''
                };
            }
            return webUser(); // веб: задається через setWebUser після логіну/email
        },
        setWebUser: function (u) { try { w.localStorage.setItem(WEB_USER_KEY, JSON.stringify(u || null)); } catch (e) {} },

        // Підписаний payload для перевірки на бекенді (лише Telegram)
        initData: function () { return inTelegram ? (tg.initData || '') : ''; },

        lang: function () {
            if (inTelegram && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) {
                return tg.initDataUnsafe.user.language_code;
            }
            return (w.navigator.language || 'en');
        },

        haptic: function (type) {
            if (inTelegram && tg.HapticFeedback) {
                safe(function () {
                    if (type === 'impact') tg.HapticFeedback.impactOccurred('medium');
                    else if (type === 'ok') tg.HapticFeedback.notificationOccurred('success');
                    else tg.HapticFeedback.selectionChanged();
                });
            } else if (w.navigator.vibrate) {
                safe(function () { w.navigator.vibrate(type === 'impact' ? 15 : 8); });
            }
        },

        theme: function (opts) {
            opts = opts || {};
            if (inTelegram) {
                if (opts.header) safe(function () { tg.setHeaderColor(opts.header); });
                if (opts.bg) safe(function () { tg.setBackgroundColor(opts.bg); });
                if (tg.disableVerticalSwipes) safe(function () { tg.disableVerticalSwipes(); });
            } else if (opts.themeColor) {
                var m = w.document.querySelector('meta[name="theme-color"]');
                if (m) m.setAttribute('content', opts.themeColor);
            }
        },

        // Кнопка «назад»: Telegram BackButton або клас на <html> для веб-UI
        back: {
            show: function () { if (tg && tg.BackButton) safe(function () { tg.BackButton.show(); }); else w.document.documentElement.classList.add('web-back-on'); },
            hide: function () { if (tg && tg.BackButton) safe(function () { tg.BackButton.hide(); }); else w.document.documentElement.classList.remove('web-back-on'); },
            onClick: function (fn) { if (tg && tg.BackButton) safe(function () { tg.BackButton.onClick(fn); }); else w.__onWebBack = fn; }
        },

        openLink: function (url) { if (tg && tg.openLink) safe(function () { tg.openLink(url); }); else w.open(url, '_blank', 'noopener'); },

        // PWA: реєстрація service worker + перехоплення install-промпта (тільки веб)
        initPWA: function (opts) {
            if (inTelegram) return; // всередині Telegram PWA-частина не потрібна
            opts = opts || {};
            if (opts.sw && 'serviceWorker' in w.navigator) {
                w.addEventListener('load', function () { safe(function () { w.navigator.serviceWorker.register(opts.sw); }); });
            }
            var deferred = null;
            w.addEventListener('beforeinstallprompt', function (e) {
                e.preventDefault(); deferred = e;
                if (opts.onInstallable) safe(function () { opts.onInstallable(); });
            });
            Platform.promptInstall = function () { if (deferred) { deferred.prompt(); deferred = null; } };
        }
    };

    w.Platform = Platform;
})(window);

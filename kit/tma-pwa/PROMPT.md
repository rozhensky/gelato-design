# Промпт: перетворити Telegram Mini App у дводушний застосунок (Telegram ↔ PWA)

Встав цей промпт у Claude Code, відкритий у корені проєкту. Він робить так, щоб ОДНА кодова база працювала і всередині Telegram, і як встановлюваний PWA. Внизу — і зворотний напрямок (відкотити до Telegram-only).

> **Контекст для тебе, Claude Code:** цільовий застосунок — це Telegram Mini App (vanilla JS або React), що зараз викликає `window.Telegram.WebApp.*` напряму. Поруч у `kit/tma-pwa/` лежать готові шаблони: `platform.js`, `sw.js`, `manifest.json`. Використай їх.

---

## Завдання (вперед: TMA → дводушний TMA + PWA)

Ціль: застосунок працює без змін усередині Telegram і додатково встановлюється як PWA з відкритого вебу, з єдиною кодовою базою. Telegram лишається джерелом ідентичності, коли він є; інакше — веб-фолбек.

Зроби рівно це:

1. **Адаптер.** Скопіюй `kit/tma-pwa/platform.js` у теку застосунку (напр. `app/platform.js`). Підключи його ПЕРШИМ, до основного скрипта, в `index.html`:
   ```html
   <script src="platform.js?v=1"></script>
   <script src="app.js?v=N"></script>
   ```

2. **Заміни прямі виклики Telegram на `Platform.*`** у коді застосунку (не чіпай поведінку всередині Telegram — вона має лишитися ідентичною):
   - `Telegram.WebApp.ready()/expand()` → `Platform.ready()/Platform.expand()`
   - `tg.setHeaderColor / setBackgroundColor / disableVerticalSwipes` → `Platform.theme({ header:'#EFECE5', bg:'#EFECE5', themeColor:'#EFECE5' })`
   - `tg.initDataUnsafe.user` (ім'я/мова/ідентифікатор) → `Platform.user()` та `Platform.lang()`
   - `tg.initData` (для бекенду) → `Platform.initData()`
   - `tg.HapticFeedback.*` → `Platform.haptic('impact'|'ok'|'select')`
   - `tg.BackButton.show/hide/onClick` → `Platform.back.show/hide/onClick`
   - відкриття посилань → `Platform.openLink(url)`
   Залиш існуючу логіку `var tg = ... ? ... : null` як фолбек, якщо вона десь потрібна, але новий код має йти через `Platform`.

3. **Ідентичність для не-Telegram (веб).** Там, де код покладається на користувача Telegram, додай веб-шлях: якщо `Platform.isTelegram === false` і `Platform.user()` порожній — показати простий екран входу (email або ім'я), зберегти через `Platform.setWebUser({...})`. Бекенд: коли є `Platform.initData()` — перевіряти підпис Telegram як зараз; коли його немає — приймати веб-ідентичність (email) окремою гілкою. **Не послаблюй перевірку Telegram-підпису.**

4. **PWA-ассети.** Скопіюй у теку застосунку `manifest.json` і `sw.js` з `kit/tma-pwa/`. У `index.html` у `<head>` додай:
   ```html
   <link rel="manifest" href="manifest.json">
   <meta name="theme-color" content="#EFECE5">
   ```
   (apple-touch-icon уже має бути.) Виправ у `manifest.json` шляхи до іконок і назву під цей застосунок. Додай іконки `icon-192.png` і `icon-512.png` (512×512 з безпечним полем для maskable), бо SVG сам по собі не покриває iOS/Android-інсталяцію.

5. **Увімкни PWA лише поза Telegram.** У точці старту застосунку виклич:
   ```js
   Platform.initPWA({ sw: 'sw.js', onInstallable: function () { /* показати кнопку «Встановити» → Platform.promptInstall() */ } });
   ```
   Усередині Telegram цей виклик нічого не робить (service worker не реєструється).

6. **Версіонування.** Service worker кешує оболонку; підіймай `CACHE` у `sw.js` і `?v=` на ассетах при кожній зміні, щоб не віддавати старе.

### Критерії приймання
- Усередині Telegram: поведінка ідентична до попередньої (ідентичність, кнопка «назад», хаптика, тема працюють).
- У звичайному браузері: застосунок відкривається, пропонує «Встановити», ставиться на головний екран, запускається повноекранно, базово працює офлайн.
- Жодних помилок у консолі в обох контекстах. Перевірка Telegram-підпису на бекенді не ослаблена.
- `node --check` для всіх змінених `.js`.

---

## Завдання (назад: дводушний → Telegram-only)

Якщо треба відкотити до чистого Telegram Mini App:

1. Прибери з `index.html`: `<link rel="manifest">`, `<meta name="theme-color">` (за бажанням) і підключення `platform.js`, якщо переходиш назад на прямі виклики.
2. Прибери виклик `Platform.initPWA(...)` і будь-який веб-екран входу.
3. Видали `manifest.json` і `sw.js`. У браузера, де SW уже зареєстровано, додай одноразове знесення:
   ```js
   if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
   ```
4. Або простіше — лиши `platform.js`: усередині Telegram він і так поводиться як звичайний TMA, а PWA-частина без `initPWA` просто не вмикається. Тоді «назад» = не викликати `initPWA` і не підключати manifest.

### Критерій приймання (назад)
- Жодних згадок про PWA/service worker; усередині Telegram усе працює; старий SW знесено.

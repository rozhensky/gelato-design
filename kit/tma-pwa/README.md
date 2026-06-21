# kit/tma-pwa — Telegram Mini App ↔ PWA (дводушний режим)

Переюзабельний набір студії: зробити так, щоб ОДНА кодова база працювала і всередині
Telegram, і як встановлюваний PWA. Філософія — «той самий код, інша оболонка»:
Telegram дає ідентичність і нативний UI, коли він є; інакше — веб-фолбек.

## Файли
- `platform.js` — адаптер. Замість `window.Telegram.WebApp.*` код викликає `Platform.*`,
  а адаптер маршрутизує у Telegram SDK або у веб-фолбек. Підключати першим.
- `manifest.json` — «паспорт» PWA (назва, іконки, кольори, `display: standalone`).
- `sw.js` — service worker: stale-while-revalidate для свого origin, обхід для Supabase/API.
- `PROMPT.md` — промпт для Claude Code: вперед (TMA → TMA+PWA) і назад (→ TMA-only).

## Як застосувати
1. Відкрий Claude Code в корені проєкту.
2. Встав вміст `PROMPT.md`.
3. Перевір за критеріями приймання в обох контекстах (Telegram і браузер).

## Що зробити вручну (поза кодом)
- Додати іконки `assets/img/icon-192.png` і `icon-512.png` (512×512, безпечне поле для maskable) —
  SVG не покриває інсталяцію на iOS/Android.
- Для веб-режиму — продумати ідентичність не-Telegram користувача (email/логін).

## API адаптера (коротко)
`Platform.mode` · `isTelegram` · `ready()` · `expand()` · `user()` · `setWebUser()` ·
`initData()` · `lang()` · `haptic(type)` · `theme({header,bg,themeColor})` ·
`back.show/hide/onClick` · `openLink(url)` · `initPWA({sw,onInstallable})` · `promptInstall()`

Споріднене: див. бачення движка студії в розмові про гібридну модель (стек, архетипи).

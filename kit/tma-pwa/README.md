# kit/tma-pwa — Telegram Mini App ↔ PWA (дводушний режим)

Переюзабельний набір студії: зробити так, щоб ОДНА кодова база працювала і всередині
Telegram, і як встановлюваний PWA. Філософія — «той самий код, інша оболонка»:
Telegram дає ідентичність і нативний UI, коли він є; інакше — веб-фолбек.

## Потрібен лише промпт
Достатньо `PROMPT.md` — самодостатній текст, який вставляєш у Claude Code, і агент
сам згенерує всі файли. Решта файлів нижче — це готова еталонна реалізація «про запас»;
носити їх НЕ обов'язково.

## Файли
- `PROMPT.md` — **головне.** Промпт для Claude Code: вперед (TMA → TMA+PWA) і назад (→ TMA-only).
- `platform.js` — *(опційно, еталон)* адаптер: замість `window.Telegram.WebApp.*` код кличе `Platform.*`.
- `manifest.json` — *(опційно, еталон)* «паспорт» PWA.
- `sw.js` — *(опційно, еталон)* service worker.

## Як застосувати
1. Відкрий Claude Code в корені проєкту з Telegram Mini App.
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

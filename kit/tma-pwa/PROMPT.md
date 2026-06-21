# Промпт: Telegram Mini App → працює ще й як PWA (і назад)

Самодостатній промпт. Відкрий Claude Code (або Cursor / агента Replit) у корені проєкту з Telegram Mini App і встав текст нижче. Агент сам створить усі потрібні файли — нічого додатково носити не треба.

---

```
Зроби так, щоб цей Telegram Mini App працював ОДНІЄЮ кодовою базою і всередині
Telegram, і як встановлюваний PWA з відкритого вебу. Усередині Telegram поведінка
має лишитися ідентичною. Зроби рівно це:

1) Створи файл platform.js — адаптер, що виставляє window.Platform з єдиним API:
   mode ('telegram'|'web'), isTelegram, ready(), expand(), user(), setWebUser(u),
   initData(), lang(), haptic('impact'|'ok'|'select'),
   theme({header,bg,themeColor}), back.show()/hide()/onClick(fn), openLink(url),
   initPWA({sw,onInstallable}), promptInstall().
   Усередині Telegram адаптер маршрутизує у window.Telegram.WebApp.* (ready/expand,
   initDataUnsafe.user, initData, HapticFeedback, BackButton, setHeaderColor/
   setBackgroundColor, openLink). Поза Telegram — веб-фолбеки: user() читає
   localStorage; haptic → navigator.vibrate; theme → meta[name=theme-color];
   back → клас на <html>; openLink → window.open. Підключи platform.js ПЕРШИМ,
   до основного скрипта, в index.html.

2) Заміни в коді всі прямі виклики window.Telegram.WebApp.* на Platform.*.
   Не змінюй поведінку всередині Telegram.

3) Створи manifest.json (name, short_name, display:"standalone", start_url:"./",
   scope:"./", background_color і theme_color під бренд, іконки 192×192 і 512×512 png
   + svg). Додай у <head>: <link rel="manifest" href="manifest.json"> і
   <meta name="theme-color" content="...">. Якщо png-іконок ще нема — створи заглушки
   й познач у відповіді, що їх треба замінити (512×512 з безпечним полем для maskable).

4) Створи sw.js — service worker: stale-while-revalidate для свого origin
   (миттєвий старт + базовий офлайн), а зовнішні запити (Supabase/API, /functions/)
   завжди в мережу, без кешу. Реєструй його ТІЛЬКИ поза Telegram —
   через Platform.initPWA({ sw: 'sw.js' }) у точці старту застосунку.

5) Ідентичність поза Telegram: якщо Platform.isTelegram === false і Platform.user()
   порожній — покажи простий екран входу (email або ім'я) і збережи через
   Platform.setWebUser(...). На бекенді: коли є Platform.initData() — перевіряй
   Telegram-підпис як раніше; коли нема — окрема email-гілка. НЕ послаблюй перевірку
   Telegram-підпису.

6) Підіймай ?v= на ассетах і версію CACHE у sw.js при змінах. Прожени node --check
   на всіх змінених .js. Критерії приймання: усередині Telegram усе як було;
   у браузері застосунок пропонує «Встановити», ставиться на головний екран,
   стартує повноекранно й базово працює офлайн; у консолі чисто в обох контекстах.
```

---

## Назад (PWA → тільки Telegram)

Встав це, якщо треба відкотити:

```
Прибери PWA-режим, лиши чистий Telegram Mini App: не викликай Platform.initPWA(),
прибери <link rel="manifest"> і <meta name="theme-color">, видали manifest.json і
sw.js, прибери веб-екран входу. Додай разове знесення старого service worker:
if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations()
  .then(function(rs){ rs.forEach(function(r){ r.unregister(); }); });
platform.js можна лишити — без initPWA він просто поводиться як звичайний TMA.
```

> У теці поруч (`platform.js`, `sw.js`, `manifest.json`) лежить готова еталонна реалізація — агент може взяти її як зразок або згенерувати свою. Носити ці файли НЕ обов'язково: достатньо промпту вище.

# Gelato — MVP Launch Studio (landing)

Лендинг студії швидкого запуску MVP: «клікабельний MVP за 7 днів від €500».
Статичний сайт, готовий до публікації на домен.

## Структура

```
letthemcook/
├── index.html            # головна сторінка (єдина)
├── assets/
│   ├── css/styles.css     # власні стилі (paper-card, voice-demo, анімації)
│   ├── js/main.js         # GSAP reveal, FAQ-акордеон, voice→product демо
│   └── img/               # зображення (og-image тощо)
├── DESIGN.md             # дизайн-система проєкту (кольори, типографіка, компоненти)
├── .gitignore
└── README.md
```

## Стек

- **HTML** — один файл, семантична розмітка з SEO (meta, Open Graph, Twitter, JSON-LD).
- **Tailwind CSS** — через CDN (`cdn.tailwindcss.com`). Утилітарні класи живуть прямо в розмітці.
- **GSAP + ScrollTrigger** — через CDN. Reveal-анімації тексту та ambient-рух фону.
- **Iconify** — іконки (`solar:*` набір).
- **Inter** — шрифт (Google Fonts).

Зовнішніх залежностей для збірки немає — це чистий статичний сайт.

## Локальний запуск

Будь-який статичний сервер, наприклад:

```bash
python3 -m http.server 8000
# відкрити http://localhost:8000
```

(Просто відкрити `index.html` файлом теж працює, але CDN-скрипти потребують інтернету.)

## Публікація

Сайт статичний — підійде будь-який static-хостинг (Netlify, Vercel, Cloudflare Pages, GitHub Pages).
Розгортається завантаженням кореня репозиторію; точка входу — `index.html`.

## TODO перед продакшеном

- [ ] Замінити `https://t.me/your_bot` на реальне посилання на Telegram.
- [ ] Замінити `https://gelato.example/` (canonical, OG, JSON-LD) на бойовий домен.
- [ ] Додати `assets/img/og-image.jpg` (1200×630) і виправити шлях у meta.
- [ ] Заповнити блок засновника (`[ Твоє ім'я ]`, фото).
- [ ] Підставити реальні відгуки у блок Testimonials.
- [ ] (Опціонально) Перейти з Tailwind CDN на збірку Tailwind CLI для продакшену.

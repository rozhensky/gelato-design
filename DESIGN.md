# Gelato — Дизайн-система

База: **PaperFlow Design Layout** (тепла «паперова» естетика, помаранчевий акцент, bento-сітка).
Цей документ — джерело правди для дизайну. Тримай нові секції в межах цих токенів.

## Кольори

| Роль            | HEX        | Використання |
|-----------------|------------|--------------|
| primary         | `#E65C00`  | головна дія, акценти, посилання-CTA |
| primary-hover   | `#CC5200`  | hover для кнопок |
| primary-grad    | `#E65C00 → #FF8C40` | градієнт лого, акцентних карток, CTA |
| accent          | `#FFB380`  | світлий помаранчевий, блоби |
| background      | `#EFECE5`  | фон сторінки (з radial-glow `#F8F5EF`) |
| surface / paper | `#FDFBF7 → #F7F4EB` | `.paper-card` — основна поверхня карток |
| surface-warm    | `#F5EFE6 → #FCE8D5` | теплі картки (hero-демо) |
| dark-section    | `#2A2520 → #3D352C` | темні «контрастні» секції |
| text-primary    | `#111827` / `stone-900` | заголовки |
| text-secondary  | `stone-500/600` | основний текст |
| border          | `stone-200/70` | тонкі рамки (ring) |
| success         | `#34D399` | «Free» / підтвердження |

## Типографіка

- Шрифт: **Inter** (400/500/600). Mono-метадані за потреби — JetBrains Mono.
- Display / H1: `clamp ~42px→64px`, `font-medium`, `tracking-tight`, `leading-[1.04]`.
- H2 секцій: `text-3xl md:text-5xl font-medium tracking-tight leading-[1.08]`.
- Body: `text-sm md:text-base text-stone-500 leading-relaxed`.
- Eyebrow (надзаголовок): `.eyebrow` (`letter-spacing: .12em`), `text-[11px] uppercase`, помаранчевий.

## Простір і форми

- Радіуси: картки `rounded-2xl` (16px), зовнішня рамка `rounded-[2.5rem]`, кнопки/чипи `rounded-full`.
- Відступи секцій: `p-8 md:p-12`, проміжки `gap-4 lg:gap-5`, секції розділені `mt-4 lg:mt-5`.
- Сітка: 12-колонкова bento (`grid-cols-12`), max-width `1280px`.

## Компоненти

- **`.paper-card`** — фірмова поверхня: вертикальний градієнт + внутрішній світлий блік + м'яка тінь. Завжди з `ring-1 ring-stone-200/50`.
- **CTA-кнопка (primary):** `bg-[#E65C00] text-white rounded-full` + помаранчева тінь, hover → `#CC5200`.
- **Кнопка (secondary):** `bg-white text-stone-800 rounded-full ring-1 ring-stone-200`, hover-текст помаранчевий.
- **Чип/бейдж:** `rounded-full px-3 py-1.5`, варіанти: нейтральний (`stone-100`), акцентний (`#FFF5E6` + помаранч ring), success.
- **Іконки:** Iconify, набір `solar:*`, `--iconify-stroke-width: 1.5`.

## Рух (motion)

- **Reveal:** маскований по-словесний підйом тексту (`.gsap-reveal`) через ScrollTrigger, `power3.out`, stagger.
- **Ambient:** повільне обертання/масштаб градієнтних блобів (`.gsap-blob`, `.gsap-blob-reverse`), float-карток (`.gsap-float`).
- **Voice→Product демо:** інтерактив у hero (`#voiceDemo`) — запис → обробка → жива міні-аппка з клікабельними тасками/табами.
- Все вимикається при `prefers-reduced-motion: reduce`.

## Guardrails

- Не «розплющувати» дизайн у генеричну SaaS-сітку — тримати bento-ритм і паперову поверхню.
- Не міняти колірний режим (світла тепла база) без причини.
- Кнопки/картки/бейджі — єдина мова радіусів і рамок (див. вище).
- Помаранчевий — для дії та акценту, не для великих площин тексту.

# Бекенд брифу — налаштування (Supabase)

Усе нижче робиться **один раз**. Код уже в репо; треба лише створити проєкт і вставити ключі.

## 1. Проєкт і ключі
1. Створи проєкт на [supabase.com](https://supabase.com).
2. **Settings → API**: скопіюй `Project URL` і `anon public` ключ → встав у [`app/supabase.js`](../app/supabase.js). (Ці значення публічні, їх можна комітити.)
3. Звідти ж візьми `service_role` ключ — він **секретний**, у файли не клади.

## 2. База
4. **SQL Editor** → встав і виконай [`supabase/schema.sql`](schema.sql).
5. Додай свою пошту в адміни:
   ```sql
   insert into admins (email) values ('you@example.com');
   ```

## 3. Сховище аудіо
6. **Storage → New bucket** → назва `voices`, **Private**. (Політику доступу вже створив `schema.sql`.)

## 4. Edge Functions
Постав [Supabase CLI](https://supabase.com/docs/guides/cli) і з кореня репо:
```bash
supabase login
supabase link --project-ref <your-ref>

# секрети (новий бот-токен після ротації + ключ OpenAI + секрет вебхука)
supabase secrets set TELEGRAM_BOT_TOKEN=xxxxx
supabase secrets set OPENAI_API_KEY=sk-xxxxx
supabase secrets set WEBHOOK_SECRET=$(openssl rand -hex 16)   # запам'ятай значення

supabase functions deploy save
supabase functions deploy transcribe --no-verify-jwt
```
`SUPABASE_URL` і `SUPABASE_SERVICE_ROLE_KEY` Supabase підставляє у функції автоматично.

## 5. Авто-транскрипція (вебхук на нові голосові)
7. **Database → Webhooks → Create**:
   - Table: `public.voices`, Event: **Insert**
   - Type: **HTTP Request**, Method `POST`
   - URL: `https://<your-ref>.functions.supabase.co/transcribe`
   - HTTP Header: `x-webhook-secret: <те саме значення WEBHOOK_SECRET>`

## 6. Авторизація адмінки
8. **Authentication → Providers → Email**: увімкни, лиши **Magic Link**.
9. **Authentication → URL Configuration**: додай у *Redirect URLs* адресу адмінки — `https://gelato.design/admin/` (і `http://localhost:8000/admin/` для локального тесту).

## Готово
- Міні-ап `gelato.design/app/` тепер пише голосові/посилання у твій Supabase (на рівні Telegram-акаунту).
- Адмінка `gelato.design/admin/` — вхід за magic-link, список брифів, картка з аудіо+транскриптами, кнопка **«Передати дані»** → ZIP для Claude Code.

> Поки `app/supabase.js` порожній — міні-ап працює локально (IndexedDB), нічого не ламається.

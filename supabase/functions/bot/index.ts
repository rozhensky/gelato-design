// ============================================================
// Edge Function: bot
// Telegram webhook. On /start (or any message) greets the user
// and shows a button that opens the brief Mini App.
//
// Deploy:  supabase functions deploy bot --no-verify-jwt
// Secrets: TELEGRAM_BOT_TOKEN  (+ optional TELEGRAM_WEBHOOK_SECRET)
// Connect: call setWebhook once (see supabase/README.md, Крок 9).
// ============================================================
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const APP_URL = "https://gelato.design/app/";

// Tri-lingual welcome — picked from the user's Telegram language_code.
const WELCOME: Record<string, { text: string; btn: string }> = {
  uk: {
    text:
      "Вітаю! 👋 Радий допомогти вам втілити вашу ідею.\n\n" +
      "Відкрийте, будь ласка, інтерактивний бриф за кнопкою нижче й дайте відповіді на всі питання — " +
      "якомога детальніше, з максимумом подробиць. Так ми найкраще зрозуміємо ваш продукт.\n\n" +
      "Коли бриф буде готовий, ми переглянемо деталі та звʼяжемося з вами щодо стратегічної сесії.",
    btn: "📝 Відкрити бриф",
  },
  ru: {
    text:
      "Здравствуйте! 👋 Рад помочь вам воплотить вашу идею.\n\n" +
      "Откройте, пожалуйста, интерактивный бриф по кнопке ниже и ответьте на все вопросы — " +
      "как можно подробнее, с максимумом деталей. Так мы лучше всего поймём ваш продукт.\n\n" +
      "Когда бриф будет готов, мы изучим детали и свяжемся с вами по поводу стратегической сессии.",
    btn: "📝 Открыть бриф",
  },
  en: {
    text:
      "Hi there! 👋 Happy to help you bring your idea to life.\n\n" +
      "Please open the interactive brief with the button below and answer all the questions — " +
      "in as much detail as possible. That's how we'll understand your product best.\n\n" +
      "Once the brief is ready, we'll review the details and reach out about a strategy session.",
    btn: "📝 Open the brief",
  },
};

function pickWelcome(code: string | undefined) {
  const c = (code || "").toLowerCase();
  if (c.startsWith("ru")) return WELCOME.ru;
  if (c.startsWith("en")) return WELCOME.en;
  return WELCOME.uk;
}

async function tg(method: string, payload: unknown) {
  return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

Deno.serve(async (req) => {
  // Always answer 200 so Telegram doesn't retry-storm on our errors.
  try {
    if (WEBHOOK_SECRET) {
      const got = req.headers.get("x-telegram-bot-api-secret-token") || "";
      if (got !== WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
    }
    const update = await req.json();
    const msg = update.message;
    const text = (msg && typeof msg.text === "string") ? msg.text.trim() : "";
    // reply ONLY to /start — avoids greeting on every message
    if (msg && msg.chat && msg.chat.id && text.startsWith("/start")) {
      console.log("bot /start lang_code:", (msg.from && msg.from.language_code) || "-");
      const w = pickWelcome(msg.from && msg.from.language_code);
      const p = tg("sendMessage", {
        chat_id: msg.chat.id,
        text: w.text,
        reply_markup: {
          inline_keyboard: [[{ text: w.btn, web_app: { url: APP_URL } }]],
        },
      });
      // answer Telegram instantly so it never retries (which would duplicate the reply)
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(p);
      else await p;
    }
    return new Response("ok");
  } catch (_e) {
    return new Response("ok");
  }
});

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

const WELCOME =
  "Вітаю! 👋 Радий допомогти вам втілити вашу ідею.\n\n" +
  "Відкрийте, будь ласка, інтерактивний бриф за кнопкою нижче й дайте відповіді на всі питання — " +
  "якомога детальніше, з максимумом подробиць. Так ми найкраще зрозуміємо ваш продукт.\n\n" +
  "Коли бриф буде готовий, ми переглянемо деталі та звʼяжемося з вами щодо стратегічної сесії.";

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
    const msg = update.message || update.edited_message;
    if (msg && msg.chat && msg.chat.id) {
      await tg("sendMessage", {
        chat_id: msg.chat.id,
        text: WELCOME,
        reply_markup: {
          inline_keyboard: [[{ text: "📝 Відкрити бриф", web_app: { url: APP_URL } }]],
        },
      });
    }
    return new Response("ok");
  } catch (_e) {
    return new Response("ok");
  }
});

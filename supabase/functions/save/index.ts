// ============================================================
// Edge Function: save
// Mini-app -> backend. Validates Telegram initData (HMAC with the
// bot token), then upserts brief/answers/links and records voices.
// Audio itself is uploaded by the client straight to Storage via a
// short-lived signed upload URL this function hands out.
//
// Deploy:  supabase functions deploy save
// Secrets: TELEGRAM_BOT_TOKEN   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const BUCKET = "voices";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function hmac(keyBytes: Uint8Array, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}
const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

// Telegram Mini App initData validation
// secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)
// hash       = HMAC_SHA256(key=secret_key, msg=data_check_string)
async function verifyInitData(initData: string) {
  if (!initData || !BOT_TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dcs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = await hmac(new TextEncoder().encode("WebAppData"), BOT_TOKEN);
  const calc = toHex(await hmac(secret, dcs));
  if (calc !== hash) return null;
  // freshness: reject if older than 24h
  const authDate = Number(params.get("auth_date") || 0);
  if (authDate && Date.now() / 1000 - authDate > 86400) return null;
  const user = params.get("user");
  return { user: user ? JSON.parse(user) : null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const auth = await verifyInitData(body.initData);
    if (!auth || !auth.user) return json({ error: "unauthorized" }, 401);

    const u = auth.user;
    const accountId = "tg_" + u.id;
    const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // ensure brief exists / refresh tg info
    const { data: brief, error: be } = await db
      .from("briefs")
      .upsert(
        {
          account_id: accountId,
          tg_user_id: u.id,
          tg_username: u.username ?? null,
          tg_name: [u.first_name, u.last_name].filter(Boolean).join(" ") || null,
        },
        { onConflict: "account_id" },
      )
      .select()
      .single();
    if (be || !brief) return json({ error: "brief upsert failed" }, 500);

    const ensureAnswer = async (qNum: number, title: string) => {
      const { data } = await db
        .from("answers")
        .upsert({ brief_id: brief.id, q_num: qNum, title }, { onConflict: "brief_id,q_num" })
        .select()
        .single();
      return data;
    };

    switch (body.action) {
      case "upsertBrief":
        return json({ briefId: brief.id });

      case "saveLink": {
        const a = await ensureAnswer(body.qNum, body.title);
        const { data } = await db
          .from("links")
          .insert({ brief_id: brief.id, answer_id: a!.id, url: body.url, kind: body.kind ?? "link" })
          .select()
          .single();
        return json({ id: data!.id });
      }

      case "deleteLink":
        await db.from("links").delete().eq("id", body.id).eq("brief_id", brief.id);
        return json({ ok: true });

      case "requestUpload": {
        const a = await ensureAnswer(body.qNum, body.title);
        const ext = String(body.ext || "webm").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "webm";
        const path = `${brief.id}/q${body.qNum}/${crypto.randomUUID()}.${ext}`;
        const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
        if (error || !data) return json({ error: error?.message || "sign failed" }, 500);
        return json({ path: data.path, token: data.token, answerId: a!.id });
      }

      case "recordVoice": {
        const a = await ensureAnswer(body.qNum, body.title);
        const { data } = await db
          .from("voices")
          .insert({ brief_id: brief.id, answer_id: a!.id, storage_path: body.path, mime: body.mime ?? null, duration: body.duration ?? null })
          .select()
          .single();
        return json({ id: data!.id });
      }

      case "deleteVoice": {
        const { data: v } = await db.from("voices").select("storage_path").eq("id", body.id).eq("brief_id", brief.id).single();
        if (v?.storage_path) await db.storage.from(BUCKET).remove([v.storage_path]);
        await db.from("voices").delete().eq("id", body.id).eq("brief_id", brief.id);
        return json({ ok: true });
      }

      case "saveContact": {
        const c = body.contact || {};
        await db.from("briefs").update({
          contact_name: c.name ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          socials: c.socials ?? null,
        }).eq("id", brief.id);
        return json({ ok: true });
      }

      case "submit": {
        const isUpdate = !!body.update;
        await db.from("briefs").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", brief.id);
        const ADMIN = Deno.env.get("ADMIN_CHAT_ID");
        if (ADMIN && BOT_TOKEN) {
          const who = brief.contact_name || brief.tg_name || accountId;
          const handle = brief.tg_username ? " (@" + brief.tg_username + ")" : "";
          const text = (isUpdate ? "\u{1F501} Бриф оновлено: " : "\u{2705} Новий бриф: ") + who + handle + "\n\nДеталі: https://gelato.design/admin/";
          try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: ADMIN, text }),
            });
          } catch (_e) { /* ignore notify failure */ }
        }
        return json({ ok: true });
      }

      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

// ============================================================
// Edge Function: transcribe
// Triggered by a Database Webhook on INSERT into `voices`.
// Downloads the audio from Storage and runs OpenAI Whisper (uk),
// then writes the transcript back to the voice row.
//
// Deploy:  supabase functions deploy transcribe --no-verify-jwt
// Secrets: OPENAI_API_KEY, WEBHOOK_SECRET
// Webhook: Database -> Webhooks -> INSERT on public.voices ->
//          POST https://<ref>.functions.supabase.co/transcribe
//          header  x-webhook-secret: <WEBHOOK_SECRET>
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const BUCKET = "voices";

Deno.serve(async (req) => {
  try {
    if (WEBHOOK_SECRET) {
      const got = req.headers.get("x-webhook-secret") || req.headers.get("authorization") || "";
      if (got !== WEBHOOK_SECRET && got !== `Bearer ${WEBHOOK_SECRET}`) {
        return new Response("forbidden", { status: 403 });
      }
    }
    const payload = await req.json();
    const rec = payload.record || payload; // webhook sends { type, record, ... }
    const id = rec.id;
    const path = rec.storage_path;
    if (!id || !path) return new Response("no record", { status: 400 });

    const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const { data: file, error } = await db.storage.from(BUCKET).download(path);
    if (error || !file) return new Response("download failed: " + (error?.message || ""), { status: 500 });

    const form = new FormData();
    form.append("file", file, path.split("/").pop() || "audio.webm");
    form.append("model", "whisper-1");
    form.append("language", "uk");
    form.append("response_format", "json");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });
    if (!r.ok) return new Response("whisper error: " + (await r.text()), { status: 502 });

    const { text } = await r.json();
    await db.from("voices").update({ transcript: text ?? "", transcribed_at: new Date().toISOString() }).eq("id", id);

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response("error: " + String(e), { status: 500 });
  }
});

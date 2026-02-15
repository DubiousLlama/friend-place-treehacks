import { sendResultsRemindersForGame } from "../_shared/results-reminder.ts";

interface WebhookPayload {
  type?: string;
  table?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: WebhookPayload = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { type, table, record, old_record } = payload;
  if (table !== "games" || type !== "UPDATE" || !record || typeof record !== "object") {
    return new Response(JSON.stringify({ ok: true, skipped: "not games UPDATE" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const phase = record.phase as string | undefined;
  const oldPhase = (old_record as Record<string, unknown> | undefined)?.phase as string | undefined;

  if (phase !== "results") {
    return new Response(JSON.stringify({ ok: true, skipped: "phase not results" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (oldPhase === "results") {
    return new Response(JSON.stringify({ ok: true, skipped: "already results" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const gameId = record.id as string | undefined;
  if (!gameId) {
    return new Response(JSON.stringify({ error: "missing game id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await sendResultsRemindersForGame({
      id: gameId,
      axis_x_label_low: String(record.axis_x_label_low ?? ""),
      axis_x_label_high: String(record.axis_x_label_high ?? ""),
      axis_y_label_low: String(record.axis_y_label_low ?? ""),
      axis_y_label_high: String(record.axis_y_label_high ?? ""),
    });
  } catch (e) {
    console.error("[notify-game-ended]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

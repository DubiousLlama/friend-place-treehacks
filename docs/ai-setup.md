# AI setup — Anthropic API and axis generation

This document describes how the Friend Place AI features work (daily axis, suggest axes) and how to set up the Anthropic API key. See also the [game plan](.cursor/plans/friend_place_game_plan_fd997aac.plan.md) for overall architecture.

---

## 1. Overview

- **Daily axis:** The landing page can prefill axis labels with a single “daily” suggestion (one pair per day, shared by everyone). Stored in `daily_axes`; generated via `GET /api/ai/daily-axis`.
- **Suggest axes:** When creating a game, users can request AI-suggested axis pairs (and regenerate one axis at a time). Implemented via `POST /api/ai/suggest-axes`.
- **Provider:** All text generation goes through `lib/ai/provider.ts`, which uses the [Anthropic Messages API](https://docs.anthropic.com/en/api/messages) (Claude). Configuration is in `lib/ai/config.ts`; prompts are in `lib/ai/prompts.ts`.

---

## 2. Anthropic API key setup

### 2.1 Where the app reads the key

- **Environment variable:** `ANTHROPIC_API_KEY`
- **Loaded from:** `.env.local` in the project root (Next.js loads this for server-side code; do not commit it).
- **Used in:** `lib/ai/config.ts` → `lib/ai/provider.ts`. The key is never sent to the client.

### 2.2 Getting the key from Anthropic

1. **Sign in** at [console.anthropic.com](https://console.anthropic.com) with the account that has (or will have) API credits.
2. **Check the workspace.** In the header, note the current **workspace** (e.g. “Default”). Credits and API usage are **per workspace**. The API key you create must belong to the same workspace that has credits.
3. **Create or copy an API key:** In the console, go to **API keys** (or **Settings → API Keys**). Click **Create key**, give it a name (e.g. “Friend Place”), then **copy the key** (it starts with `sk-ant-`). You only see the full key once.
4. **Put it in `.env.local`** in the project root:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxx...
   ```
   No quotes, no spaces around `=`.
5. **Restart the dev server** after changing `.env.local` so Next.js reloads env (e.g. stop and run `npm run dev` or `pnpm dev` again).

### 2.3 If you see “credit balance too low”

- The request is reaching Anthropic (you get a 400 with their message and a `request_id`), so the key and env are correct.
- Anthropic is rejecting the call because **that workspace** has no usable API credits.
- Go to **Plans & Billing** in the Anthropic console (same workspace as the key). Add a **payment method** or **purchase credits**. The dashboard may show “credits” or a trial, but the **API** often requires completing billing before it accepts requests.
- If you have multiple workspaces, ensure the key is from the **same** workspace that has the plan/credits.

### 2.4 Verifying the key (optional)

From a terminal (replace `YOUR_KEY` with the value from `.env.local`):

```bash
curl "https://api.anthropic.com/v1/messages" -H "x-api-key: YOUR_KEY" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" -d "{\"model\":\"claude-3-5-sonnet-20241022\",\"max_tokens\":64,\"messages\":[{\"role\":\"user\",\"content\":\"Say hi\"}]}"
```

- JSON with `content` → key and workspace are valid.
- Same “credit balance too low” → add payment/credits for that workspace.
- 401 → key invalid or wrong format.

---

## 3. Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes (for AI) | API key from Anthropic console. Server-side only. |
| `AI_ENABLED` | No | Set to `false` to disable all AI (default: enabled if key is set). |
| `AI_DAILY_AXIS` | No | Set to `false` to disable daily axis generation (default: on). |
| `AI_SUGGEST_AXES` | No | Set to `false` to disable suggest/regenerate axes (default: on). |
| `ANTHROPIC_MODEL` | No | Model id (default: `claude-sonnet-4-20250514`). |

Optional: `BRIGHTDATA_API_KEY` and related vars in `lib/ai/config.ts` for enhanced prompt context (trending, etc.); not required for basic axis generation.

---

## 4. Prompts and where they live

- **System prompt (shared):** `lib/ai/prompts.ts` → **`AXIS_SYSTEM_PROMPT`**. This is the system message sent to Claude for both daily axis and suggest-axes. It defines the rules (two axes, one category per axis, one word per label, order: horizontal then vertical).
- **User prompts:**
  - **Daily axis:** `buildDailyAxisPrompt(recentDailyAxes?)` in `lib/ai/prompts.ts`. Includes seasonal context from `lib/ai/context.ts` and optional “avoid repeating” recent axes.
  - **Suggest / regenerate one axis:** `buildRegenerateOneAxisPrompt(axis, options)` in `lib/ai/prompts.ts`. Includes the other axis, daily axes, previous pair, and past game axes so the model avoids repeating.

Edits to behavior or tone should be made in `lib/ai/prompts.ts` (and optionally `lib/ai/context.ts` for date/seasonal hints).

---

## 5. Credits-low handling (402)

When Anthropic returns an error that indicates low or exhausted credits (e.g. “Your credit balance is too low…”), the provider throws a custom error with `code: "ANTHROPIC_CREDITS_LOW"`. The API routes catch this and return **HTTP 402** with a clear message so the UI can show “AI credits are low; add credits in your Anthropic account (Plans & Billing) or try again later” instead of a generic 500.

- **Provider:** `lib/ai/provider.ts` — detects credit-related error message, throws with `code: "ANTHROPIC_CREDITS_LOW"`.
- **Routes:** `app/api/ai/daily-axis/route.ts` and `app/api/ai/suggest-axes/route.ts` — catch that error and return 402 with a user-friendly message.

---

## 6. File layout

| Path | Purpose |
|------|---------|
| `lib/ai/config.ts` | Feature flags and env (e.g. `AI_ENABLED`, `ANTHROPIC_API_KEY`). `isAIAvailable()` for route guards. |
| `lib/ai/provider.ts` | Anthropic client, `generateText(systemPrompt, userPrompt)`, credits-low detection and 402-style error. |
| `lib/ai/context.ts` | Seasonal/date context for prompts (e.g. holidays). |
| `lib/ai/prompts.ts` | `AXIS_SYSTEM_PROMPT`, `buildDailyAxisPrompt`, `buildRegenerateOneAxisPrompt`, `AxisSuggestion` type. |
| `app/api/ai/daily-axis/route.ts` | GET: generate or return cached daily axis; uses `daily_axes` table. |
| `app/api/ai/suggest-axes/route.ts` | POST: suggest full axes or regenerate one axis; returns 402 on credits-low. |

Database: `daily_axes` table (see migrations) stores one row per calendar day for the shared daily suggestion.

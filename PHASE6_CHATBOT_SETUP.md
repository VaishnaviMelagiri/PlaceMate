# Phase 6 — Chatbot: setup & deploy

The `chat` Edge Function calls Mistral server-side. The browser only talks to
your function; the Mistral key never reaches the frontend.

## 1. Pick a provider (any OpenAI-compatible LLM)

The function is provider-agnostic — set `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`.
Use a provider/key **dedicated to PlaceMate** so it never shares another project's
quota. Free options:

| Provider | `LLM_BASE_URL` | `LLM_MODEL` | Key from |
|---|---|---|---|
| **Groq** (recommended, generous free) | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | console.groq.com |
| Mistral (default) | `https://api.mistral.ai/v1` | `mistral-small-latest` | console.mistral.ai |
| OpenRouter | `https://openrouter.ai/api/v1` | `meta-llama/llama-3.3-70b-instruct:free` | openrouter.ai |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.0-flash` | aistudio.google.com |

## 2. Set the secrets

Example with **Groq** (swap for your chosen provider's row above):

```bash
supabase secrets set \
  LLM_BASE_URL="https://api.groq.com/openai/v1" \
  LLM_MODEL="llama-3.3-70b-versatile" \
  LLM_API_KEY="<your groq key>"
```

If you set nothing, it defaults to Mistral and also accepts a legacy
`MISTRAL_API_KEY`. `SUPABASE_URL` / `SUPABASE_ANON_KEY` are injected automatically.

## 3. Deploy

```bash
supabase functions deploy chat
```

## 4. Use it

Open the app → the floating **💬** button (bottom-right) → ask a question. The
assistant can see your tracked applications and any relevant crowdsourced
company notes, and its answers render as markdown. History persists per user in
`chat_messages` (RLS-scoped).

## Security & cost notes (how this function is built)

- **Identity from the JWT, never the body.** The function calls
  `supabase.auth.getUser()` on the caller's token and reads data through a
  JWT-bound client, so RLS guarantees a user can only ever see their own
  applications/chat. A `user_id` in the request body is ignored.
- **Key stays server-side.** `MISTRAL_API_KEY` lives only in the Edge env.
- **Directory is untrusted input.** Crowdsourced `company_directory` text is
  wrapped in a `<reference_data>` fence with an explicit "data, not instructions"
  note, and the system role is fixed — a basic guard against prompt injection
  from a malicious company tip.
- **Lean prompt for the free tier.** Only non-rejected applications (max 15),
  up to 5 relevant directory rows (info capped at 500 chars each), and the last
  10 chat messages are sent — keeps you under Mistral's free rate/token limits.
- **Fails gracefully.** On 429 / timeout / upstream error the function returns a
  friendly message the panel shows as a normal bubble — never a crash or blank
  bubble. The user turn is saved even when the assistant call fails.

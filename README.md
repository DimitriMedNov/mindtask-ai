# MindTask AI

Task manager with an AI assistant, voice input and gamification.

**Live demo:** https://mindtask-ai.vercel.app/

## What it does

**Tasks** — create, edit and organize tasks, see them in a list or in a calendar view,
and track progress with per-user stats.

**AI assistant** — suggests tasks and breaks down larger ones, through a Supabase Edge
Function that calls the model server-side so the API key never reaches the browser. The
provider is swappable: Ollama, OpenAI, Anthropic, or any OpenAI-compatible endpoint.

**Voice** — dictate a task; the audio is transcribed by a `voice-to-text` Edge Function
and turned into a task.

**Focus** — a Pomodoro timer whose sessions are stored, so the stats reflect real focused
time rather than self-reported time.

**Gamification** — points and streaks from `user_stats`, to keep the habit going.

**Admin** — role management screen backed by `assign-role` and `get-users` functions.

## Data model

`tasks`, `pomodoro_sessions`, `user_stats` and `user_roles`, all under Row Level Security
so each person only reaches their own rows. Two more tables back the AI layer:
`ai_rate_limits` (the per-user quota) and `ai_usage` (one row per model call). Users can
read their own rows in both but never write to them.

## Edge Functions

| Function | What it does |
|---|---|
| `ai-task-suggestions` | Generates task suggestions from the user's context |
| `voice-to-text` | Transcribes dictated audio |
| `assign-role` | Grants or revokes a role, admin only |
| `get-users` | Lists users for the admin screen |

Keeping these server-side is the point: the model key and the role logic stay out of the
client bundle.

### Limits and failure handling

The two AI functions share the same guard rails, all in `supabase/functions/_shared/`:

| What | Behaviour | Status |
|---|---|---|
| AI not configured | Function answers right away, no quota spent | `503` |
| Per-user quota | 20 calls per user per hour, per function, counted in `ai_rate_limits` by `consume_ai_quota()` | `429` + `Retry-After` |
| Timeout | 30 s per call, retries and waits included (`AbortController`) | `504` "El modelo tardó demasiado en responder" |
| Retries | Up to 2 retries with progressive backoff (1 s, 2 s, or the provider's `Retry-After`), only when the provider answers `429` or `5xx`. A `400` is never retried | — |
| Provider error | Anything else from the provider | `502` with the provider's message |

The frontend shows the message the function returned and tells the three cases apart:
AI not configured, quota reached, and model failure.

## Bring your own model

Nothing in the app is tied to one AI vendor. `supabase/functions/_shared/ai.ts` reads the
provider from the environment and speaks two wire formats — OpenAI-compatible and
Anthropic — so the same code runs against any of these:

| `AI_PROVIDER` | What you need | Notes |
|---|---|---|
| `ollama` | Ollama running locally | No API key, no data leaves the machine |
| `openai` | `AI_API_KEY` | Also covers voice transcription (`whisper-1`) |
| `anthropic` | `AI_API_KEY` | Text only — Anthropic does not transcribe audio |
| `custom` | `AI_BASE_URL` + model | Any OpenAI-compatible server (vLLM, LM Studio, a gateway) |

If no provider is configured, the AI endpoints answer `503` with a clear message and the
rest of the app — tasks, calendar, Pomodoro, stats, roles — keeps working. Nothing
crashes because a key is missing.

## Measured performance

Every model call is logged to `ai_usage`: provider, model, input and output tokens (when
the provider reports them) and milliseconds. To benchmark the configured provider:

```bash
npm run medir-ia                  # 20 sample requests, same prompt as ai-task-suggestions
AI_PRICE_INPUT_PER_MTOK=0.15 AI_PRICE_OUTPUT_PER_MTOK=0.60 npm run medir-ia   # adds cost
```

The script calls the provider directly with the function's own code
(`_shared/ai.ts` + `_shared/suggestions.ts`), after one warm-up request that is not
counted. It does not include the Edge Function round trip or the database calls. The
figures below are the script's output, unedited:

| Model | Provider | Machine | Requests | Median | p95 | Input tokens (avg) | Output tokens (avg) | Cost per suggestion |
|---|---|---|---|---|---|---|---|---|
| `llama3.2` (3.2B, Q4_K_M) | ollama | Apple M5 Pro, 24 GB RAM, macOS | 20/20 | 0.91 s | 1.23 s | 163 | 102 | — (local, no price) |

Measured on 2026-09-18. Run it again with your own provider and add a row.

## Voice dictation

`voice-to-text` needs a provider that exposes the OpenAI `/audio/transcriptions`
endpoint. Text generation and transcription can come from different servers.

| Provider | Transcribes? | How |
|---|---|---|
| `openai` | Yes | `AI_STT_MODEL="whisper-1"` (the default) |
| `lovable` | Yes | `whisper-1` through the Lovable gateway (the default) |
| `custom` | If the server does | Set `AI_STT_MODEL` to the server's model name |
| `ollama` | No | Ollama has no transcription endpoint. Point `AI_STT_BASE_URL` at a Whisper server (below) |
| `anthropic` | No | Same as Ollama: add a separate Whisper server |

The optional `AI_STT_BASE_URL` and `AI_STT_API_KEY` send only the transcription to another
OpenAI-compatible server; text keeps going to `AI_PROVIDER`. When the configured setup
cannot transcribe, the record button is disabled and the card says why, before anyone
records anything.

### Local Whisper with whisper.cpp

Keeps Ollama for text and runs Whisper on your machine too. Not yet tested end to end on
this project; check each step.

```bash
brew install whisper-cpp ffmpeg         # ffmpeg converts the browser's webm/mp4 to wav
which whisper-server                    # if missing, build from source (see below)

mkdir -p ~/whisper-models
curl -L -o ~/whisper-models/ggml-base.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin   # multilingual, ~150 MB

whisper-server \
  -m ~/whisper-models/ggml-base.bin \
  -l es \
  --host 0.0.0.0 --port 8080 \
  --inference-path /v1/audio/transcriptions \
  --convert
```

- `-l es`: whisper.cpp assumes English unless told otherwise. Use `-l auto` to detect.
- `--inference-path`: exposes the OpenAI path the function calls.
- `--convert`: requires ffmpeg.
- `--host 0.0.0.0`: the functions run in Docker, so the server has to accept connections
  from `host.docker.internal`, not only from localhost. It has no authentication, so
  don't leave it exposed on a shared network.

Then add to `supabase/functions/.env` and restart `supabase functions serve`:

```bash
AI_STT_BASE_URL="http://host.docker.internal:8080/v1"
AI_STT_MODEL="whisper-1"                # whisper.cpp ignores the name, but it must not be empty
```

Check it before opening the app:

```bash
curl -F file=@some-audio.wav -F model=whisper-1 http://localhost:8080/v1/audio/transcriptions
# → {"text": "..."}
```

If Homebrew doesn't ship `whisper-server`, build it:
`git clone https://github.com/ggml-org/whisper.cpp && cd whisper.cpp && cmake -B build && cmake --build build -j --config Release`,
then use `./build/bin/whisper-server`.

## Run it fully local, with your own data

The whole stack runs on your machine: Postgres, auth, storage, the Edge Functions and the
model. Useful if you care about privacy, if you want to work offline, or if you just don't
want to pay anyone to try it.

```bash
npm install
supabase start                 # Postgres + auth + functions (needs Docker)
ollama pull llama3.2           # or any model you prefer
cp supabase/functions/.env.example supabase/functions/.env
supabase functions serve --env-file supabase/functions/.env
npm run dev
```

`supabase start` applies the migrations and loads `supabase/seed.sql`, which creates a
demo account with ten tasks, nine Pomodoro sessions and a streak already going:

```
demo@mindtask.local / demo123456
```

Everything — the database, the auth server and the model — stays on localhost. No account
to create, no key to buy, no request leaving the machine.

> Note: Supabase Edge Functions deployed to the cloud cannot reach a model running on
> `localhost`. Local models work when you run the functions locally (as above) or expose
> your server through a tunnel and point `AI_BASE_URL` at it.

## Stack

React · TypeScript · Vite · Tailwind CSS · shadcn/ui · Supabase (PostgreSQL, Auth,
Edge Functions) · React Query

## Run it locally

```bash
npm install
cp .env.example .env    # fill in your own Supabase project values
npm run dev
```

## Roadmap

- Shared task lists between users
- Push reminders
- Tests for the role functions (`assign-role`, `get-users`)

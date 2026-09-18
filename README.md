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
so each person only reaches their own rows.

## Edge Functions

| Function | What it does |
|---|---|
| `ai-task-suggestions` | Generates task suggestions from the user's context |
| `voice-to-text` | Transcribes dictated audio |
| `assign-role` | Grants or revokes a role, admin only |
| `get-users` | Lists users for the admin screen |

Keeping these server-side is the point: the model key and the role logic stay out of the
client bundle.

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
- Tests for the role functions

# MindTask

A personal task manager that runs on your own machine: your database, your model,
your data. No landing page, no sign-up funnel — it opens straight into the app.

The whole stack is local by default. Postgres, auth, the edge functions, the
language model and the speech-to-text all run on localhost, so the app keeps
working on a plane, and nothing you write or say leaves the computer unless you
point it at a cloud provider yourself.

![Tablero en tema claro](docs/capturas/tablero-claro.png)
![Tablero en tema oscuro, con un bloque de enfoque corriendo](docs/capturas/tablero-oscuro.png)

---

## What it does

**One screen answers one question: what do I do now.** The day opens with its
date and its count, and the sections stack below it — what slipped past, today,
soon, no date, and the finished ones folded at the end. Nothing hides behind a
filter, so an empty day still shows the week ahead.

**Focus belongs to a task, not to a timer.** Pick a task and a bar slides up from
the bottom with its name and 25 minutes running, the way the music player works
on iOS. The row it belongs to shows the same clock. Close the bar and it's gone —
there is no timer widget sitting there when nothing is running.

**Writing a task is writing a sentence.** Type *"llamar al dentista el viernes"*
and the app reads the date, the priority and the category out of it, and shows
what it understood as chips before saving. The same interpreter runs behind
dictation, so both paths behave identically. Speak and the text appears as you
talk, corrected as the sentence goes on.

**The calendar and the list live together.** The month sits beside the list with a
dot per task; picking a day filters the list to that day.

**Suggestions come from a model you chose.** Ask for three and they arrive from
whatever provider is configured — or the feature politely says it isn't
configured, and the rest of the app carries on.

---

## Run it

You need [Docker](https://docs.docker.com/get-docker/) (Colima works),
the [Supabase CLI](https://supabase.com/docs/guides/cli), Node 18+, and
[Ollama](https://ollama.com) if you want the AI features.

```bash
npm install
supabase start                 # Postgres, auth and storage on localhost
ollama pull llama3.2           # or any model you prefer
cp supabase/functions/.env.example supabase/functions/.env
supabase functions serve --env-file supabase/functions/.env
npm run dev
```

`supabase start` applies the migrations and loads `supabase/seed.sql`, which
creates a demo account with ten tasks, nine Pomodoro sessions and a streak
already going:

```
demo@mindtask.local / demo123456
```

> npm is the package manager here. The repo used to carry a stale `bun.lockb`
> from its Lovable scaffold alongside `package-lock.json`; two lockfiles for one
> project is how installs start drifting between machines.

### Voice dictation, also local

Ollama generates text but does not transcribe audio, so dictation needs its own
engine. whisper.cpp covers it without leaving the machine:

```bash
brew install whisper-cpp
mkdir -p ~/.whisper-models && curl -L -o ~/.whisper-models/ggml-base.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
whisper-server -m ~/.whisper-models/ggml-base.bin --port 8178 -l es
```

Then set `AI_STT_BASE_URL=http://host.docker.internal:8178` and
`AI_STT_FORMAT=whisper-cpp`. `ggml-base` (141 MB) is enough to try it;
`ggml-small` (~466 MB) transcribes noticeably better in Spanish.

---

## Bring your own model

Nothing in the app is tied to one AI vendor. `supabase/functions/_shared/ai.ts`
reads the provider from the environment and speaks two wire formats —
OpenAI-compatible and Anthropic — so the same code runs against any of these:

| `AI_PROVIDER` | What you need | Notes |
|---|---|---|
| `ollama` | Ollama running locally | No API key, nothing leaves the machine |
| `openai` | `AI_API_KEY` | Also covers voice transcription (`whisper-1`) |
| `anthropic` | `AI_API_KEY` | Text only — Anthropic does not transcribe audio |
| `custom` | `AI_BASE_URL` + model | Any OpenAI-compatible server (vLLM, LM Studio, a gateway) |

Transcription can point somewhere else than text generation — `AI_STT_BASE_URL`,
`AI_STT_API_KEY` and `AI_STT_FORMAT` — which is how a local Whisper pairs with a
hosted chat model, or the other way round.

If no provider is configured the AI endpoints answer `503` with a clear message
and the rest of the app keeps working. Nothing crashes because a key is missing.

---

## How it holds up

The AI layer is the part most likely to fail in the real world, so it is the part
with the most guardrails:

- **A 30-second ceiling per call**, retries and waits included, after which the
  caller gets a `504` instead of a spinner that never ends.
- **Two retries with growing waits**, and only when the provider answers `429` or
  `5xx`. A `400` is never retried, because it will fail again.
- **Twenty calls per user per hour**, counted per function through a Postgres
  function with a per-user lock, so twenty-five simultaneous calls let exactly
  twenty through. Partial transcriptions — the ones that make the text appear
  while you speak — don't spend quota; a fifteen-second sentence would eat six
  uses otherwise.
- **Every call is recorded** in `ai_usage` with provider, model, tokens,
  milliseconds, status and attempts. `npm run medir-ia` turns that into medians
  and p95.

Measured on this machine:

| Model | Machine | Successful | Median | p95 | Input tokens | Output tokens | Cost |
|---|---|---|---|---|---|---|---|
| llama3.2 (Ollama) | Apple M5 Pro, 24 GB | 20/20 | 0.91 s | 1.23 s | 163 | 102 | — (local) |

---

## Data model

Four tables, all under Row Level Security so each person only reaches their own
rows: `tasks`, `pomodoro_sessions`, `user_stats` and `user_roles`. Roles live in
their own table instead of a column on the profile, so someone can hold more than
one and permissions are checked without reading the profile.

### Edge Functions

| Function | What it does |
|---|---|
| `ai-task-suggestions` | Suggests three tasks from the ones you already have |
| `voice-to-text` | Transcribes dictated audio; answers `GET` with whether dictation is available at all |
| `assign-role` | Grants or revokes a role, admin only |
| `get-users` | Lists users for the admin screen |

Keeping these server-side is the point: the model key and the role logic stay out
of the client bundle.

---

## Tests

```bash
npm test        # 57 unit tests: provider selection, wire formats, retries, timeouts, parsing, dictation
npm run test:db # 10 tests against the local database, for the RLS policies
npm run test:all
```

The RLS tests create two fresh users without admin rights and check that neither
can read the other's tasks — the demo account is an admin and sees everything by
design, which would make the test pass for the wrong reason.

GitHub Actions runs all of them on every push.

---

## Design

The interface follows Apple's Human Interface Guidelines: grouped lists with
hairline separators instead of a card per row, a single accent for anything
actionable, and red quarantined for overdue work — if warm colour shows up,
something is late.

Both themes are designed, not inverted, and every pair that carries text was
measured: system blue reaches 5.34:1 against white in light mode and 6.63:1
against the card in dark mode; the overdue red reaches 6.28:1 on its own pill.
The app follows the system theme until you pick one.

`docs/auditoria-visual.md` holds the audit the redesign came from — eight
findings, each with what was wrong, why it mattered citing the guideline, and how
it was fixed.

---

## What's missing

- The stack still needs Docker. A local-first app that requires three services to
  start isn't local enough; moving the database into a file is the next step.
- No desktop packaging yet. It runs in a browser tab, which contradicts the rest
  of the idea.
- No evaluation set for transcription accuracy, so the quality claims about
  Whisper models are anecdotal.
- No recurring tasks and no search — both start to matter past a hundred tasks.

---

## Credits

The first scaffold came out of Lovable; everything since — the swappable AI layer,
the local stack, dictation, the redesign, the tests — was built on top of it.

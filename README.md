# MindTask AI

Task manager with an AI assistant, voice input and gamification.

**Live demo:** https://mindtask-ai.vercel.app/

## What it does

**Tasks** — create, edit and organize tasks, see them in a list or in a calendar view,
and track progress with per-user stats.

**AI assistant** — suggests tasks and breaks down larger ones, through a Supabase Edge
Function that calls the model server-side so the API key never reaches the browser.

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

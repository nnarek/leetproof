# LeetProof — Theorem Proving Platform

Sharpen your formal verification skills by proving theorems and verifying code in [Lean 4](https://lean-lang.org/). Think LeetCode, but for mathematical proofs.

## Features

- 📝 **Problem library** — Browse problems by difficulty (easy/medium/hard) and category
- ✏️ **Built-in editor** — Powered by [lean4web](https://github.com/leanprover-community/lean4web) with real-time Lean 4 feedback
- 🔐 **Google & GitHub Sign-In** — via Supabase Auth
- 🗄️ **Database adapters** — Supabase or Firebase through a shared interface
- 🚀 **Serverless deployment** — Static export for GitHub Pages when enabled
- 📄 **Markdown problems** — Author problems as markdown files, seed to DB

## Quick Start

### 1. Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com/) project
- Optional: a [Firebase](https://firebase.google.com/) project if you want to use Firestore for problem data
- A lean4web instance (or use `https://live.lean-lang.org`)

### 2. Setup

```bash
# Clone and install
git clone <your-repo-url> leetproof
cd leetproof
npm install

# Configure environment
cp .env.local.example .env.local
# Or, for Firebase-backed problem data:
# cp .env.firebase.example .env.firebase

# Edit the copied file with your backend URLs, keys, and lean4web URL
```

### 3. Database Setup

The seed script (step 5) automatically creates tables if they don't exist.
For auto-migration, log in to the Supabase CLI and link your project:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

Alternatively, run the migration manually in the Supabase SQL Editor:

```bash
# Copy contents of supabase/migrations/001_initial_schema.sql
# into Supabase Dashboard → SQL Editor → Run
```

If you use Firebase, create a `problems` collection in Firestore with documents that match the `Problem` shape in [`src/lib/types.ts`](./src/lib/types.ts). The included `npm run seed` script seeds Supabase, so Firebase data must be imported separately.

### 4. Enable Google Auth

In Supabase Dashboard:
1. Go to **Authentication → Sign In / Providers → Google**
2. Enable Google provider
3. Add your Google OAuth client ID and secret
4. Set redirect URL to `https://<your-project-ref>.supabase.co/auth/v1/callback` in the Google Cloud Console

### 4b. Enable GitHub Auth

1. Go to [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers) and click **New OAuth App**
2. Set **Homepage URL** to your app URL (e.g., `http://localhost:3000`)
3. Set **Authorization callback URL** to `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Register the app and copy the **Client ID** and **Client Secret**
5. In Supabase Dashboard, go to **Authentication → Sign In / Providers → GitHub**
6. Enable GitHub provider and paste the Client ID and Client Secret

### 5. Seed Problems

```bash
npm run seed
```

This seeds Supabase. Firebase users should load Firestore data using their own import process.

### 6. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. Deploy as a static GitHub Pages site

Set these environment variables before building:

- `NEXT_PUBLIC_LEETPROOF_SERVERLESS=true`
- `NEXT_PUBLIC_BASE_PATH=/leetproof` for project pages on GitHub Pages, or leave it blank for a user/organization site
- `NEXT_PUBLIC_LEAN4WEB_URL` pointing at your separate lean4web server

Build the static export:

```bash
npm run build:static
```

The output is written to `out/` and can be deployed with the included GitHub Actions workflow in [`.github/workflows/deploy-gh-pages.yml`](./.github/workflows/deploy-gh-pages.yml), or manually with `npx gh-pages -d out`.

### 8. Optional: Publish to Vercel (SSR mode)

```bash
npm run build
```

1. Create a new project on [Vercel](https://vercel.com/)
2. Connect your GitHub repository
3. Go to Settings → Environment Variables and import `.env.local` variables as Sensitive vars
4. Deploy!

## Firebase

Use Firebase if you want Firestore as the backing store for problem data.

1. Install the Firebase SDK:

```bash
npm install firebase
```

2. Copy `.env.firebase.example` to `.env.firebase` and fill in the Firebase values.
3. Set `NEXT_PUBLIC_DB_PROVIDER=firebase`.
4. Keep the Supabase auth variables if you still want the current Google sign-in flow.
5. Create a `problems` collection in Firestore with documents that match [`src/lib/types.ts`](./src/lib/types.ts).

The Firebase adapter in this repo covers problem data only. If you want to replace Supabase Auth too, you will need to swap out the auth flow separately.


## Adding Problems

1. Create a markdown file in `problems/` (e.g., `011-my-problem.md`)
2. Add YAML frontmatter:

```yaml
---
slug: "my-problem"
title: "My Problem Title"
difficulty: "medium"
tags: ["logic", "tactics"]
sort_order: 11
starter_code: |
  theorem my_theorem : ... := by
    sorry
---
```

3. Write the problem description in markdown below the frontmatter
4. Run `npm run seed` to upload to Supabase

## Tech Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS v4
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Editor:** lean4web (iframe embed)
- **Deployment:** Vercel (or any Node.js host)

## Documentation

- [`AGENTS.md`](./AGENTS.md) — Full architecture & context for AI agents
- [`CLAUDE.md`](./CLAUDE.md) — Claude/Copilot-specific coding guidelines
- [`PROMPTS.md`](./PROMPTS.md) — History of AI prompts used in development

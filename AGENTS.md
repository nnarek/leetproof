<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# LeetProof — AI Agent Context Document

> This file provides context for AI agents (Copilot, Claude, Cursor, etc.) working on this codebase.

## Project Summary

**LeetProof** is a collaborative platform for the **Lean 4** programming language. Users prove theorems and verify code, share solutions and hints with the community.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS v4 |
| Backend/DB | Supabase (PostgreSQL, Auth, RLS) — **serverless, no custom server** |
| Auth | Supabase Auth with Google OAuth |
| Code Editor | **lean4monaco** directly embedded (connects to live.lean-lang.org) |
| Markdown | react-markdown + remark-gfm for problem descriptions |

## Key Architecture Decisions

1. **No running backend server** — All data comes from Supabase (serverless Postgres + Auth). The code editor connects directly to the remote Lean server at `wss://live.lean-lang.org`.
2. **lean4monaco embedded directly** — The editor uses the `lean4monaco` npm package which provides Monaco editor + Lean 4 LSP integration. No iframe. Code is persisted in browser `localStorage` (key: `leetproof:editor-code`). See `src/components/Lean4EditorInner.tsx`.
3. **lean4web source files in `src/lib/lean4web/`** — Adapted lean4web components and utilities are in a separate directory for easy syncing with upstream [lean4web](https://github.com/leanprover-community/lean4web) changes.
4. **Problems stored in Supabase** — But authored as markdown files in `/problems/` with YAML frontmatter. A seed script (`scripts/seed-problems.ts`) loads them into the DB.
5. **Row Level Security (RLS)** — Problems are public-read. Submissions are per-user. Profiles auto-created on signup.
6. **Static-ish rendering** — Problems pages use `revalidate = 60` (ISR). Landing page is static.

## Directory Structure

```
leetproof/
├── .env.local.example        # Template for environment variables
├── problems/                  # Markdown problem files (source of truth)
│   ├── 001-hello-lean.md
│   ├── 002-and-introduction.md
│   └── ...
├── scripts/
│   └── seed-problems.ts       # Loads problems/ into Supabase
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # DB schema (tables, RLS, triggers)
├── src/
│   ├── app/
│   │   ├── page.tsx               # Landing page
│   │   ├── layout.tsx             # Root layout (Navbar + Footer)
│   │   ├── globals.css            # Global styles
│   │   ├── auth/callback/route.ts # OAuth callback handler
│   │   └── problems/
│   │       ├── page.tsx           # Problems list (table)
│   │       └── [slug]/page.tsx    # Problem detail (description + editor)
│   ├── components/
│   │   ├── Navbar.tsx             # Navigation with Google sign-in
│   │   ├── Footer.tsx             # Site footer
│   │   ├── DifficultyBadge.tsx    # Easy/Medium/Hard badge
│   │   ├── Lean4Editor.tsx        # lean4monaco editor wrapper (dynamic import, ssr: false)
│   │   ├── Lean4EditorInner.tsx   # Editor implementation with split pane
│   │   └── MarkdownRenderer.tsx   # Renders markdown content
│   ├── hooks/
│   │   └── useAuth.ts            # Auth hook (signIn, signOut, user state)
│   ├── lib/
│   │   ├── types.ts               # TypeScript types (Problem, Submission, etc.)
│   │   ├── lean4web/              # Adapted lean4web frontend (keep synced with upstream)
│   │   │   ├── editor/code-atoms.ts       # Code state → localStorage
│   │   │   ├── settings/                  # Settings UI, types, atoms
│   │   │   ├── store/                     # URL args, location, window state atoms
│   │   │   ├── utils/                     # URL encoding, shallow equal, save-to-file
│   │   │   ├── navigation/Popup.tsx       # Modal wrapper
│   │   │   └── css/lean4web.css           # Scoped lean4web styles
│   │   └── supabase/
│           ├── client.ts          # Browser Supabase client
│           ├── server.ts          # Server Supabase client
│           └── middleware.ts      # Session refresh middleware
├── AGENTS.md                      # This file
├── CLAUDE.md                      # Claude-specific instructions
└── PROMPTS.md                     # History of prompts given to AI agents
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL     — Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase anonymous/public key
SUPABASE_SERVICE_ROLE_KEY     — Supabase service role key (admin, for scripts only)
DATABASE_URL                  — Postgres connection string (for seed script auto-migration)
                                Get from: Supabase Dashboard → Settings → Database → Connection string (URI)
```

## Database Schema

### `profiles` — Auto-created on Google signup
- `id` (uuid, FK to auth.users)
- `email`, `full_name`, `avatar_url`

### `problems` — Theorem proving challenges
- `id` (uuid), `slug` (unique), `title`, `difficulty` (easy/medium/hard)
- `description` (markdown), `starter_code` (Lean 4 code)
- `tags` (text[]), `sort_order` (int)

### `submissions` — User proof attempts
- `id`, `user_id` (FK profiles), `problem_id` (FK problems)
- `code`, `status` (pending/accepted/wrong)

## Common Tasks

### Add a new problem
1. Create a markdown file in `problems/` following the naming convention `NNN-slug-name.md`
2. Include YAML frontmatter: `slug`, `title`, `difficulty`, `tags`, `sort_order`, `starter_code`
3. Run `npm run seed` to upload to Supabase

### Run locally
```bash
npm install    # Automatically copies lean4web assets via postinstall hook
npm run dev
```

### Seed problems into DB
```bash
npm run seed
```
The seed script automatically creates the database tables (from `supabase/migrations/001_initial_schema.sql`) if they don't exist.

For auto-migration, it tries these methods in order:
1. **Supabase Management API** (recommended) — requires `npx supabase login` + `npx supabase link`
2. **Direct Postgres** via `DATABASE_URL` in `.env.local`
3. **Manual** — prints a link to the Supabase SQL Editor

## Lean4 Editor Integration

The editor uses **lean4monaco** (from npm) which provides Monaco editor + Lean 4 LSP client.

**Code persistence:**
- Code is stored in browser `localStorage` with key `leetproof:editor-code`
- Code persists across page refreshes without URL manipulation
- User can open current code in live.lean-lang.org via "Open↗" button

**Theme sync:**
- Editor theme automatically syncs with the app's `data-theme` attribute
- Supports: Visual Studio Light/Dark, High Contrast, Cobalt
- Theme can also be manually set via Settings popup

**WebSocket connection:**
- Hardcoded to `wss://live.lean-lang.org/websocket/MathlibDemo`
- No custom Lean server needed (uses the public live.lean-lang.org instance)

**Static assets:**
- Run `npm run copy:lean-assets` to copy infoview files and fonts from `node_modules/` to `public/`
- This happens automatically via `npm postinstall` script
- See `scripts/copy-lean4web-assets.mjs`

**Main components:**
- `src/components/Lean4Editor.tsx` — Dynamic import wrapper (`ssr: false`)
- `src/components/Lean4EditorInner.tsx` — Implementation with split pane (editor + infoview)
- `src/lib/lean4web/` — Adapted lean4web frontend code (keep synced with upstream)

## Hints System

The hints system provides structured, progressive guidance for solving problems. Users can create "hint packs" — collections of hints stored as YAML — that other users can use to get incremental help.

### Architecture

- **Storage**: Hint packs are stored in the `hint_packs` table as raw YAML text.
- **Likes**: Users can upvote hint packs via `hint_pack_likes` table.
- **UI**: The "Hints" tab in `ProblemTabs` shows hint packs sorted by likes, with the top-liked pack auto-expanded.
- **Editor integration**: Code completions are applied via `executeEdits()` (undo-safe via Ctrl+Z).
- **Events**: Communication between HintsTab and editor uses CustomEvents:
  - `leetproof:request-code` — HintsTab requests current editor code
  - `leetproof:code-updated` — Editor broadcasts code changes
  - `leetproof:apply-hint-code` — HintsTab sends new code to editor

### YAML Format (step-based)

The project now uses a step-based hint YAML format. Each hint contains an ordered list of `steps`; each step has a `description` and optional `code_completions`. A `force_find` regex (per-hint) is still used for force-replace operations.

```yaml
name: "My Hint Pack Name"
hints:
  - name: "Helper Lemma Name"
    force_find: "regex matching ANY state of the code section (for force-replace)"
    steps:
      - name: "Step 1: idea"
        description: "Short one-line description of what this step is about"
      - name: "Step 2: lemma signature"
        description: "Add the helper lemma signature"
        code_completions:
          - name: "Signature"
            find: "regex matching the current code state"
            replace: "replacement code (next incremental step)"
          - name: "Fill signature"
            find: "regex matching the state after step 1"
            replace: "replacement code (more complete)"
  - name: "Main Theorem Name"
    force_find: "..."
    steps:
      - name: "Main idea"
        description: "High-level approach"
      - name: "Proof"
        description: "Detailed inductive proof"
        code_completions:
          - name: "Start proof"
            find: "..."
            replace: "..."
```

Notes:
- `steps` is the primary structure: each step renders a collapsible description and its buttons.
- `code_completions` entries may include an optional `name` (used as the button label), plus `find` and `replace`.
- For backward compatibility the parser still accepts the legacy format that used `descriptions` + a flat `code_completions` list; the loader converts legacy `descriptions` into `steps` and attaches legacy `code_completions` to the last step.

### How Hints Work

1. Each hint pack contains multiple **hints** (displayed as "Hint 1", "Hint 2", ..., "Final").
2. Each hint is an ordered list of `steps`:
  - **Step `name`**: Short label shown in the step header.
  - **`description`**: Markdown rendered when the step is expanded.
  - **`code_completions`** (optional): An ordered list of completion entries `{ name?, find, replace }` that are applied sequentially.
  - **`force_find`** (per-hint): A regex that matches the whole theorem/lemma region for force-replace operations.

3. UI behaviour:
  - Steps are independent, collapsible units; each step has its own chevron and header.
  - When expanded, the step shows its `description` followed by the step's buttons (if any). Buttons are aligned with the chevron and have a small gap from the description for readability.
  - The UI intentionally omits separate "Brief/Detail/Code Completions" labels — the step header, description and buttons are the primary affordances.

4. Applying completions:
  - If a completion's `find` regex matches the current editor text the completion is considered **ready** (accent/blue) and can be applied.
  - Clicking a **ready** completion will first attempt to apply any earlier ready completions within the same hint (chaining), then apply the clicked completion.
  - If the completion is **not ready**, the button shows as **force** (orange). Clicking it performs a force-apply: the `force_find` regex is used to replace the matched region with step-0's `replace`, then steps are applied sequentially up to the clicked completion.
  - `force_find` should target the full code block (e.g. `"theorem foo[\\s\\S]*?(?=\\n\\n|\\n--|\\n#|$)"`).

5. Undo support: All code modifications use Monaco's `executeEdits` together with undo stops; users can Ctrl+Z to revert a single hint application.

6. Backwards compatibility: The parser accepts both the new step-based format and the legacy `descriptions` + flat `code_completions` format; legacy packs are converted at load time into the step structure.

### Writing Good Hint Packs

**Structure advice:**
- First hint should be about a helper lemma not dependent on others in the problem.
- Later hints can build on earlier ones.
- For problems with no helper lemmas, use a single hint with multiple code completion steps.

**Regex tips:**
- Use `\\s*` or `\\s+` for flexible whitespace matching.
- Use `[\\s\\S]*?` for multi-line lazy matching.
- `force_find` should match from the theorem/lemma name to the next definition boundary: `"theorem foo[\\s\\S]*?(?=\\n\\n|\\n--|\\n#|$)"`
- Escape special regex characters in theorem names: `\\(`, `\\)`, `\\.`, `\\+`
- Use `(?=...)` lookahead for boundaries without consuming them.
- Test regexes against both the initial starter code AND each intermediate state.

**Code completion steps:**
- Each step should be a meaningful incremental improvement (e.g., add structure → fill base case → fill inductive case).
- The `replace` text should be the COMPLETE code for that section at that step (not a diff).
- Make sure step N's `find` matches exactly what step N-1's `replace` produces.

### Example hint pack files

See `problems/hints/008-list-reverse-reverse.yaml` for a reference implementation.

### Database Tables

- `hint_packs`: id, user_id, problem_id, yaml_content, created_at, updated_at
- `hint_pack_likes`: hint_pack_id, user_id, created_at (composite PK)

### Key Files

- `src/components/HintsTab.tsx` — Hints tab UI with pack listing, expand/collapse, and code completion buttons
- `src/lib/hints.ts` — YAML parser and code completion logic (findCurrentStep, canApplyStep, applyStep, forceApplyStep)
- `src/lib/types.ts` — HintPack, ParsedHintPack, ParsedHint, HintCodeCompletion types
- `supabase/migrations/008_hint_packs.sql` — Database schema
- `problems/hints/` — Example YAML hint pack files

## Future Work Ideas

- Submission tracking and verification
- Leaderboard / user rankings
- Problem categories / filtering
- Timed challenges
- Solution sharing
- Admin panel for problem management
- Custom lean4web deployment with Mathlib project

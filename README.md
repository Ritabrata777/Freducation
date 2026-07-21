# Freducation

A community-powered academic library for regional, curriculum-specific learning materials.

Freducation lets contributors upload, share, and discover study resources across formats — PDFs, links, images, notes, MCQs, and videos — while a moderation and recommendation system keeps quality high and personalization relevant.

## Tech Stack

- **Frontend / Framework:** TanStack Start v1 (React 19, Vite 7, TypeScript)
- **Styling:** Tailwind CSS v4 with custom Material-3 inspired tokens and liquid-glass effects
- **Backend / Database:** Supabase with Row Level Security (RLS)
- **Auth:** Supabase Auth with Google OAuth
- **Storage:** Supabase Storage with signed URLs
- **AI:** Gemini API for metadata auto-fill and recommendation features
- **Icons:** Material Symbols Outlined
- **Fonts:** Geist, Inter

## Key Features

### Public
- **Landing page** — public overview with features, stats, and regional highlights
- **Login / Signup** — Google OAuth and email/password authentication

### Authenticated
- **Home feed** — personalized recommendations, resume progress, latest uploads
- **Library** — browse, filter, and search live materials with rich metadata cards
- **Material detail** — preview PDFs, videos, images, audio, and text inline; download with progress; Q&A and voting threads
- **Ingest** — upload files or paste links; AI auto-fill extracts title, subject, region, language, tags; auto-flagging validates quality
- **My List** — track study progress (Reading, Completed, Saved), completion analytics by subject, region, and language
- **Requests board** — ask for missing materials and vote on requests
- **Contributor profiles** — public profiles with tier badges (Novice → Scholar → Reliable → Trusted)
- **Settings** — profile, monogram avatar, background motion preference, account deletion

### Admin
- **Admin dashboard** — live stats, total/anonymous views, CSV export
- **User ledger** — manage users and roles
- **Moderation queue** — review auto-flagged materials, approve or reject appeals
- **Moderation log** — transparent record of who hid/deleted what and why
- **Auto-flag settings** — configure banned keywords, minimum image resolution, link-check timeout
- **False-positive tracking** — measure recurring flag reasons to guide threshold tuning

## Project Structure

```text
src/
  components/          # Shared UI components (AppSidebar, TopNav, Icon, Skeleton, etc.)
  hooks/               # React hooks (auth, progress, recommendations, motion prefs, etc.)
  integrations/        # Supabase clients / middleware
  lib/                 # Server functions, business logic, utilities
  routes/              # TanStack Start file-based routes
    _authenticated/    # Auth-guarded routes
    api/               # Public API / webhook endpoints
    auth.login.tsx     # Login page
    auth.signup.tsx    # Signup page
    index.tsx          # Public landing page
  styles.css           # Tailwind v4 tokens, glass variables, typography
supabase/
  migrations/          # Database migrations (RLS, policies, tables, functions)
```

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Public landing page |
| `/auth/login` | Login |
| `/auth/signup` | Create account |
| `/home` | Authenticated home feed |
| `/library` | Browse materials |
| `/ingest` | Upload new material |
| `/material/$id` | Material detail + preview + Q&A |
| `/my-list` | Personal progress and analytics |
| `/requests` | Community request board |
| `/u/$userId` | Contributor profile |
| `/settings` | User configuration |
| `/admin/users` | Admin user directory |
| `/admin/policies` | Moderation, appeals, auto-flag settings |

## Getting Started

1. Install dependencies

```bash
bun install
```

2. Configure environment variables

```bash
# .env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
GEMINI_API_KEY=
```

3. Run the development server

```bash
npm run dev
```

## Code Conventions

- Routes live in `src/routes/` following TanStack Start file-based conventions
- Server functions use `createServerFn` from `@tanstack/react-start`
- Protected server functions use authentication middleware
- Admin-only functions verify the caller's role server-side before executing privileged operations
- Styling uses the project token system; avoid hardcoded colors
- Icons are Material Symbols via the `Icon` component

## License

MIT

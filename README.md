# Achiles

A fitness app that turns five body measurements into an actionable baseline —
BMI, BMR, a body-composition verdict, calorie and macro targets — then lets an
athlete pick a training identity (Spartan, Greek God, Superhero, Athlete,
Manga) that **re-skins the entire app** around that plan's own layout, palette
and motion, and shows its nutrition and workout content on the dashboard. An
LLM coach is available on top for a plan generated from your own numbers, with
a `.docx` export.

Go + Postgres + Redis on the back, React + TypeScript on the front. A Python
service for retrieval-augmented coaching is planned but not yet built — see
[Roadmap](#roadmap).

```
achiles/
├── client/                    # React 19 + TypeScript + Vite + Tailwind v4
├── server/go_be_skeleton/     # Go 1.26 HTTP API + pgx/Postgres + Redis
└── LLM/                       # Planned Python RAG coach — empty scaffold today
```

---

## Table of contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Database schema](#database-schema)
- [API reference](#api-reference)
- [Frontend architecture](#frontend-architecture)
- [Design system — five identities, not one theme](#design-system--five-identities-not-one-theme)
- [Known rough edges](#known-rough-edges)
- [Scripts](#scripts)
- [Roadmap](#roadmap)

---

## What it does

| Screen | Route | Backend calls |
|---|---|---|
| **Welcome / guest login** | `/welcome` | `POST /addUser` → `GET /getBMI`, or Google sign-in |
| **Choose your plan** | `/select-plan` | `GET /getPlans` → `POST /selectPlan` |
| **Dashboard** | `/` | `GET /getUserById`, `GET /getDashboard` |
| **Nutrition customisation** | `/nutrition` | recalculates locally from stored BMR |
| **Workout customisation** | `/workout` | local planner, no persistence yet |
| **AI panel — "Guide me"** | `/coach` | `POST /askGroq`, `POST /docgeneration` |

### The flow

1. **Onboarding.** No real password-based auth. A guest enters name, age,
   gender, weight and height. The client `POST`s to `/addUser`, gets back a
   generated `id`, then calls `/getBMI` to compute and persist BMI, BMR,
   verdict and water intake. That id is the "session", persisted to
   `localStorage`. Signing in with Google links a Google account to that same
   athlete id instead of replacing it (see [Auth](#google-oauth)).
2. **Choose your plan.** A one-time step after onboarding: five training
   identities are fetched from `/getPlans` and shown in a spinning-drum
   picker, each already wearing its own theme as you preview it. Confirming
   one calls `POST /selectPlan`, which persists `training_plan_id` on the
   athlete's row — this is the one choice server-side state, not just local
   storage, remembers.
3. **Resume.** "I have an ID" (or a returning Google sign-in) fetches an
   existing profile by id and restores both the profile *and* the plan it
   already has selected, so a returning athlete lands straight on their
   dashboard instead of being asked to choose again.
4. **Dashboard.** Renders the KPI row, a hero maintenance-calorie figure, four
   visualisations, and a "Your Plan" card: the selected plan's cover art and
   description, its nutrition guidance, and its workout days with exercise
   counts — all pulled from `/getDashboard`.
5. **Coach.** `/askGroq` builds the prompt server-side from the stored metrics
   and calls Groq; the client renders the reply as markdown and can export it
   to `.docx` via `/docgeneration`.

### What is measured vs. derived

The server stores BMI, BMR, verdict, water intake and the raw body
measurements — no time-series data, so the app does not fabricate history.
Every chart is either a direct reading or a labelled derivation from published
formulas:

| Figure | Source |
|---|---|
| BMI, BMR, verdict, water intake | computed and stored server-side |
| Maintenance calories | BMR × standard TDEE activity factors (1.2 – 1.9) |
| Cut / maintain / build targets | −20% / 0% / +15% of maintenance |
| Macro grams | calorie share ÷ 4 kcal/g (protein, carbs) or 9 kcal/g (fat) |
| Healthy weight range | the 18.5–25 BMI window converted to kg for your height |
| BMI bands | WHO thresholds |
| Plan nutrition/workout content | authored per plan via `/addNutritionTemplate` etc., not derived |

Derived numbers are labelled "Estimated" in the UI. The derivation logic lives
in [`client/src/lib/fitness.ts`](client/src/lib/fitness.ts), and the Nutrition
page carries a "How these numbers are built" panel.

---

## Tech stack

**Backend**

| Concern | Choice |
|---|---|
| Language | Go 1.26 |
| Router | `net/http` `ServeMux` (stdlib, method-aware patterns) |
| Database | Postgres via `pgx/v5` connection pool |
| Cache | Redis via `go-redis/v9` |
| Object storage | S3 (`aws-sdk-go-v2`) — plan cover art and backdrops |
| Auth | Google OAuth 2.0, hand-rolled (no library) — signed, HMAC'd session cookie |
| Rate limiting | Hand-rolled token-bucket (`internal/RateLimiterService`) |
| Doc export | `goldmark` (Markdown → AST) into `godocx` (.docx) |
| Config | env vars + `.env` through `godotenv`, typed structs |
| Logging | `log/slog`, JSON handler |
| Middleware | CORS, request logging, panic recovery |
| LLM | Groq `llama-3.3-70b-versatile` |

**Frontend**

| Concern | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first `@theme`), five per-plan token sets |
| Routing | React Router 7 |
| Server state | TanStack Query 5 |
| Client state | Zustand 5 (`persist` → `localStorage`) |
| Forms | React Hook Form + Zod 4 |
| Charts | Recharts 3 |
| Animation | `motion` — route-enter transitions, one identity per plan |
| HTTP client | axios |
| Icons | Lucide |
| Markdown | `react-markdown` + `remark-gfm` |
| Fonts | Inter, Cinzel, Cormorant Garamond, Orbitron, Barlow Condensed, Bebas Neue, Chakra Petch (self-hosted via Fontsource, one family per plan identity) |

---

## Getting started

### Prerequisites

- Go 1.26+
- Node 20+ (developed on 22)
- A running Postgres instance
- A running Redis instance
- AWS credentials with S3 access (or equivalent), for plan cover art/backdrops
- A [Groq API key](https://console.groq.com/) for the AI panel
- (Optional) a Google OAuth 2.0 "Web application" client, for Google sign-in

### 1. Database

Most tables are created automatically on boot (see
[Database schema](#database-schema) for exactly which). `userinfo` and
`user_specs` are the two exceptions — create them by hand from the DDL below
before starting the server.

### 2. Server

```bash
cd server/go_be_skeleton
cp .env.example .env
```

`.env.example` covers HTTP, Postgres, CORS and Google OAuth — it currently
**omits** a few variables the app needs, so add these by hand:

```dotenv
# Groq — read by internal/config, required for /askGroq
GROQ_KEY=gsk_your_key_here

# AWS S3 — read directly by the AWS SDK's default credential chain, not by
# internal/config, so these just need to be present in the process environment
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

The S3 bucket name itself (`project-achiles`) is a constant in
[`internal/db/s3/conf.go`](server/go_be_skeleton/internal/db/s3/conf.go), not
an env var — point your credentials at a bucket with that name, or edit the
constant.

Then run it:

```bash
go run ./cmd/api
```

On boot the server also seeds the plan catalog's cover/backdrop images into
S3 (skipping objects already present) and ensures the auth and training-plan
tables exist. The API listens on `:8080`:

```bash
curl http://localhost:8080/readyz
```

`/healthz` reports liveness; `/readyz` also pings the database.

### 3. Client

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173.

The Vite dev server proxies `/api/*` → `http://localhost:8080` (stripping the
`/api` prefix), so the browser stays same-origin and CORS never applies in
development. To point at a different backend, set `VITE_API_BASE_URL`.

---

## Database schema

Two tables are created out-of-band (see [Getting started](#getting-started));
everything else is created idempotently on boot by `auth.EnsureSchema` and
`trainingplan.EnsureSchema` in [`cmd/api/main.go`](server/go_be_skeleton/cmd/api/main.go),
so a fresh database needs no manual migration for them.

```sql
-- Created by hand — see Getting started.
-- user_specs.user_id must be unique: GetBMI_BMR relies on a failed INSERT
-- falling through to its UPDATE branch.
CREATE TABLE userinfo (
    id        SERIAL PRIMARY KEY,
    name      TEXT             NOT NULL,
    age       INTEGER          NOT NULL,
    weight    DOUBLE PRECISION NOT NULL,   -- kg
    gender    TEXT             NOT NULL,   -- 'Male' | 'Female'
    height_cm DOUBLE PRECISION NOT NULL
    -- training_plan_id is added to this table automatically on boot, once
    -- training_plans exists — see below.
);

CREATE TABLE user_specs (
    user_id      INTEGER PRIMARY KEY REFERENCES userinfo(id) ON DELETE CASCADE,
    bmi_value    DOUBLE PRECISION NOT NULL,
    bmr_value    DOUBLE PRECISION NOT NULL,
    verdict      TEXT             NOT NULL,
    water_intake DOUBLE PRECISION NOT NULL   -- litres per day
);

-- Self-provisioned on boot (auth.EnsureSchema) — one row per external
-- identity, linked to a userinfo row once onboarding finishes.
CREATE TABLE auth_identity (
    id         BIGSERIAL PRIMARY KEY,
    provider   TEXT NOT NULL,
    subject    TEXT NOT NULL,
    email      TEXT NOT NULL DEFAULT '',
    name       TEXT NOT NULL DEFAULT '',
    picture    TEXT NOT NULL DEFAULT '',
    user_id    INTEGER,             -- no FK: userinfo isn't guaranteed to exist yet at boot
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, subject)
);

-- Self-provisioned on boot (trainingplan.EnsureSchema) — the plan catalog.
CREATE TABLE training_plans (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    slug          TEXT NOT NULL UNIQUE,   -- 'spartan' | 'greek-god' | 'superhero' | 'athlete' | 'manga'
    description   TEXT NOT NULL DEFAULT '',
    image_key     TEXT NOT NULL DEFAULT '',   -- S3 key, cover art (picker cards)
    watermark_key TEXT NOT NULL DEFAULT ''    -- S3 key, full-bleed backdrop
);

-- Also self-provisioned: userinfo gains this column once training_plans exists.
ALTER TABLE userinfo ADD COLUMN training_plan_id INTEGER REFERENCES training_plans(id);

-- Basic per-plan content — authored via POST, not generated.
CREATE TABLE nutrition_templates (
    id               BIGSERIAL PRIMARY KEY,
    training_plan_id INTEGER NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
    calorie_guidance TEXT NOT NULL DEFAULT '',
    protein_pct      DOUBLE PRECISION NOT NULL DEFAULT 0,
    carbs_pct        DOUBLE PRECISION NOT NULL DEFAULT 0,
    fats_pct         DOUBLE PRECISION NOT NULL DEFAULT 0,
    meal_frequency   INTEGER NOT NULL DEFAULT 0,
    notes            TEXT NOT NULL DEFAULT '',
    UNIQUE (training_plan_id)   -- one nutrition template per plan
);

CREATE TABLE workout_templates (
    id               BIGSERIAL PRIMARY KEY,
    training_plan_id INTEGER NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
    split_name       TEXT NOT NULL,     -- e.g. "Push Day"
    day_order        INTEGER NOT NULL DEFAULT 1,
    notes            TEXT NOT NULL DEFAULT ''
);

CREATE TABLE workout_exercises (
    id                   BIGSERIAL PRIMARY KEY,
    workout_template_id BIGINT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    name                 TEXT NOT NULL,
    sets                 INTEGER NOT NULL DEFAULT 0,
    reps                 TEXT NOT NULL DEFAULT '',   -- "8-12", not always an integer
    rest_seconds         INTEGER NOT NULL DEFAULT 0,
    exercise_order       INTEGER NOT NULL DEFAULT 1
);
```

### Formulas

From [`internal/User/Logic.go`](server/go_be_skeleton/internal/User/Logic.go):

- **BMI** — `weight / height_cm² × 10000`
- **BMR** — Revised Harris–Benedict (see [Known rough edges](#known-rough-edges) — the gender branch is dead code)
- **Water intake** — `weight × 35 ml`, converted to litres
- **Verdict** — `Underweight` (<19) · `Healthy` (21–24) · `Overweight` (26–29) ·
  `Obese` (≥30) · `Normal` (fall-through for 19, 20, 25 exactly)

---

## API reference

Base URL `http://localhost:8080`. No request-level authentication except
where noted — the athlete `id` in the query string or body is the only
credential most routes check.

### Health

`GET /healthz` · `GET /readyz` — liveness and readiness (`readyz` pings Postgres).

### Profile & specs

**`POST /addUser`**
```jsonc
// request
{ "name": "Alex Mercer", "age": 29, "weight": 88, "gender": "Male", "height_cm": 181 }
// 200 — echoes the record with its generated id
{ "id": 6, "name": "Alex Mercer", "age": 29, "weight": 88, "gender": "Male", "height_cm": 181 }
```

**`GET /getBMI?id={id}`** — computes BMI, BMR, verdict and water intake, then
upserts `user_specs`. Must be called once after `/addUser` — `/getUserById`
404s until this has run. ⚠️ Requires a JSON body despite being a `GET` — see
[Known rough edges](#known-rough-edges).

**`GET /getUserById?id={id}`**
```jsonc
// 200
{
  "userDetails": {
    "id": 6, "name": "Alex Mercer", "age": 29, "gender": "Male",
    "weight": 88, "height_cm": 181,
    "specs": { "BMI": 26, "BMR": 1696, "Verdict": "Overweight", "WaterIntake": 3 },
    // present only once a plan has been selected
    "training_plan": { "id": 1, "name": "Spartan Plan", "slug": "spartan", "description": "...",
                        "image_url": "https://...", "watermark_url": "https://..." }
  }
}
```
Returns `404 specs not found` if `/getBMI` has never run for this id.

### Training plans

**`GET /getPlans`** — the catalog. Each row's `image_url`/`watermark_url` are
resolved S3 URLs, absent when the underlying key is empty.

**`POST /addPlans`** — upserts plans by slug from `[{name, slug, description}]`;
each slug's art is looked up server-side in a fixed asset table, not accepted
from the request.

**`POST /selectPlan`** `{ "user_id": 6, "training_plan_id": 1 }` — sets
`userinfo.training_plan_id`. 404s if the user doesn't exist.

**`GET /getDashboard?id={user_id}`** — the plan a user selected, plus its
nutrition template and workout templates/exercises. 404s if the user hasn't
selected a plan yet, or doesn't exist.
```jsonc
// 200
{ "dashboard": {
    "plan": { "id": 1, "name": "Spartan Plan", "slug": "spartan", "description": "...",
              "image_url": "...", "watermark_url": "..." },
    // absent (not null) until authored
    "nutrition": { "calorie_guidance": "...", "protein_pct": 35, "carbs_pct": 40, "fats_pct": 25, "meal_frequency": 4 },
    "workouts": [ { "split_name": "Conditioning + Lower Body", "day_order": 1,
                    "exercises": [ { "name": "Kettlebell Swing", "sets": 4, "reps": "15-20", "rest_seconds": 45 } ] } ]
} }
```

**`POST /addNutritionTemplate`** `{training_plan_id, calorie_guidance, protein_pct, carbs_pct, fats_pct, meal_frequency, notes}`
— one per plan (`UNIQUE(training_plan_id)`).

**`POST /addWorkoutTemplate`** `{training_plan_id, split_name, day_order, notes}`
— one training day.

**`POST /addWorkoutExercise`** `{workout_template_id, name, sets, reps, rest_seconds, exercise_order}`
— one movement within a day.

These four authoring endpoints have no admin UI yet — content is written via
direct API calls. See [Roadmap](#roadmap).

### Google OAuth

**`GET /login[?return=/path]`** — redirects to Google's consent screen.
**`GET /api/auth/oauth/google/callback`** — Google's redirect target; exchanges
the code, upserts the identity, sets a signed session cookie, and bounces the
browser back to the client.
**`GET /auth/me`** — `{authenticated: false}` or the signed-in identity plus
`user_id` (`null` until linked to an athlete row).
**`POST /auth/link`** `{"user_id": 6}` — attaches the signed-in Google account
to an athlete row.
**`POST /auth/logout`** — clears the session cookie only; does not revoke the
Google grant.

### AI coach & export

**`POST /askGroq?id={id}`** — no body; the server reads the athlete's stored
metrics via a join and builds the prompt itself.
```jsonc
// 200
{ "message": "Responded succesfully", "Ai_Response": "{\"choices\":[{\"message\":{\"content\":\"...\"}}]}" }
```
`Ai_Response` is the upstream Groq body forwarded as an **unparsed JSON
string**; the client parses it in
[`client/src/api/ai.ts`](client/src/api/ai.ts). ⚠️ See
[Known rough edges](#known-rough-edges) for how this endpoint's Redis caching
actually behaves — it is not what "caching" usually means here.

**`POST /docgeneration`** — hands plan markdown to the server, gets a `.docx`
back. ⚠️ The body is currently ignored by the handler; see
[Known rough edges](#known-rough-edges).

### Rate limiting (demo only)

**`POST /rateTest`** — exercises a single global token bucket (capacity 7,
refill 1/s) configured in `internal/config`. Not wired to any real route yet —
it demonstrates the limiter, it doesn't protect anything.

---

## Frontend architecture

```
client/src/
├── api/                    # axios instance + one typed module per concern
│   ├── client.ts           # base instance, error-message normaliser
│   ├── users.ts            # addUser, computeSpecs, getUserById
│   ├── trainingPlan.ts     # selectPlan, getDashboard, addNutritionTemplate, addWorkoutTemplate, addWorkoutExercise
│   ├── plans.ts            # getPlans (the catalog)
│   ├── auth.ts             # Google session, link, logout
│   ├── ai.ts                # askGroq — unwraps the double-encoded response
│   └── docs.ts             # docgeneration — plan text in, .docx blob out
├── components/
│   ├── charts/             # BmiScale, CalorieByActivityChart, MacroSplitBar, WeightRangeMeter
│   ├── layout/
│   │   ├── shells/         # StoaShell, PeristyleShell, CommandDeckShell, BroadcastShell, PanelGridShell
│   │   ├── AppShell.tsx    # gates on userId, then on planSlug; mounts the plan's shell
│   │   └── ...             # PageHeader, Logo, navigation
│   ├── plans/               # PlanPicker, PlanDrum, PlanCylinderCard, PlanWatermark — the plan picker
│   └── ui/                  # Button, Card, Field, StatTile, StatusBadge, OptionGroup, Feedback
├── hooks/
│   ├── useUser.ts           # profile queries + onboarding/resume mutations
│   ├── useTrainingPlan.ts   # useDashboard, useSelectPlan, template-authoring mutations
│   ├── usePlans.ts          # the plan catalog query
│   └── useAuth.ts           # Google session query, link/logout mutations
├── lib/
│   ├── fitness.ts           # TDEE, macro, BMI-band and weight-range derivations
│   ├── workout.ts           # local split templates and volume estimates
│   └── format.ts
├── pages/                   # Welcome, SelectPlan, Dashboard, Nutrition, Workout, Coach
├── store/session.ts         # Zustand: userId, profile cache, planSlug — persisted to localStorage
├── theme/                   # registry.ts (slug → shell/motion/scheme), planMotif.ts (per-plan copy/icons), plan-themes.css, plan-shells.css
└── types/index.ts           # mirrors the Go structs
```

**Route guarding.** `AppShell` has two gates: no `userId` → `/welcome`; a
`userId` but no local `planSlug` → `/select-plan`. `planSlug` is restored from
the server's `training_plan` on every resume (`useResumeSession`), so a
returning athlete only sees the picker if they genuinely haven't chosen yet —
not merely because `localStorage` was cleared or they signed in elsewhere.

**Server vs. client state.** TanStack Query owns anything fetched. Zustand
holds the session identity and the *local* copy of `planSlug` used for
instant theming — `training_plan_id` on the server is the source of truth,
`planSlug` is a synced cache of it. Nutrition and Workout page preferences are
deliberately component-local; there's no endpoint to persist them to yet.

**Error handling.** Go handlers write plain-text bodies via `http.Error`, so
`apiErrorMessage()` in `api/client.ts` unwraps a bare string rather than a
JSON envelope, and special-cases `ERR_NETWORK` into "is the server running?".

**Safety.** The coach's markdown renders through `react-markdown` with raw
HTML disabled, so model output cannot inject markup. Its styles are scoped to
`.prose-plan` rather than applied globally.

---

## Design system — five identities, not one theme

There is no single visual design for Achiles — there are five, one per
training plan, and picking a plan on `/select-plan` swaps the whole app: not
just colour, but layout, typography, iconography, copy voice and route-enter
motion.

| Slug | Shell | Scheme | Motion | Character |
|---|---|---|---|---|
| `spartan` | Stoa | dark | ember | Discipline over motivation — bronze, stone, orders |
| `greek-god` | Peristyle | **light** | ascend | Proportion as the goal — marble, gold, symmetry |
| `superhero` | Command Deck | dark | scan | Precision over spectacle — a HUD for the work nobody sees |
| `athlete` | Broadcast | dark | streak | Every session is a fixture — numbers under the lights |
| `manga` | Panel Grid | dark | glitch | Training as an awakening — screentone, panels, seals |

The mapping lives in one place,
[`client/src/theme/registry.ts`](client/src/theme/registry.ts): slug → shell
component (lazy-loaded, so an athlete only downloads their own layout) → CSS
`data-plan` attribute → token block in
[`plan-themes.css`](client/src/theme/plan-themes.css). Colour and structure
are kept independent, so adding a sixth plan is one CSS block, one shell file,
and one registry row — nothing under `pages/` or `components/ui/` changes.
`planMotif.ts` supplies the copy voice (a Spartan dashboard says "Draw the
orders"; a Greek God dashboard says "Consult the canon") over the *same*
underlying numbers — the flavour never reaches the data.

`greek-god` is the one light-scheme identity; the rest are dark. An unthemed
screen (no plan chosen, or a stored slug the client no longer recognises)
falls back to `athlete`, deliberately the closest to a neutral neon-on-black
default.

### Chart colour

Independent of plan theming, chart series were validated rather than
eyeballed — checked for lightness band, chroma floor, colour-vision-deficiency
separation, normal-vision separation and surface contrast:

- **Categorical** (macro split): `#7A9E19` · `#3B82D9` · `#D4459B` — worst
  all-pairs CVD ΔE 11.0, normal-vision ΔE 25.4. Fixed order, never cycled.
- **Ordinal ramp** (calories by activity): a single-hue lime ramp with
  monotone lightness, so colour reinforces bar length instead of fighting it.
- **Status** (`good` / `warning` / `serious` / `critical`): used **one at a
  time**, always paired with an icon and a text label, never colour alone.

BMI bands render as neutral labelled regions with only the reader's own
position coloured — four status colours side by side are not reliably
distinguishable.

---

## Known rough edges

Documented rather than silently patched. Items marked **shimmed** have a
client-side workaround in place.

### 1. `GET /getBMI` and `POST /docgeneration` both fight browser body rules · *shimmed*

`GetBMI_BMR` decodes `r.Body` on a `GET` and 400s on an empty body; browsers
cannot send a body on `GET` at all. `ServeDocxHandler` similarly insists on
`GET`. The Vite dev proxy runs in Node, which has no such restriction: it
injects `{}` for `/getBMI` and replays `/docgeneration`'s POST as a GET
carrying the same body — see
[`client/vite.config.ts`](client/vite.config.ts). **Both shims are
development-only**; a production build served by anything other than the Vite
dev server fails on onboarding and on doc export. The real fix is server-side:
make both routes `POST`.

### 2. `/docgeneration` ignores the body it's shimmed so hard to deliver

Even with the shim delivering the client's plan text, `ServeDocxHandler`
([`DocTest.go`](server/go_be_skeleton/internal/DocGeneration/DocTest.go))
never reads it. It pulls whatever is in Redis under the single fixed key
`"cachedResponse"` instead — which is only ever written by `/askGroq`, and
only when the athlete's verdict isn't `"Healthy"` (see #3). The exported
`.docx` reflects **the last non-Healthy `/askGroq` call from any athlete**,
not the plan on screen and not necessarily this athlete's plan at all.

### 3. `/askGroq`'s caching is keyed on the wrong things

```go
if specs.Verdict != "Healthy" {
    resp, _ := client.Do(req)      // calls Groq, error discarded — see #4
    ...
    connect.AddCache(rdb, string(body), ctx)   // key: "cachedResponse", global
} else {
    resp, _ := connect.GetCache(rdb, ctx)      // never calls Groq at all
}
```
Two separate problems. First, the Redis key is a single global string, not
scoped per athlete — concurrent users overwrite and read each other's cached
plan. Second, whether Groq is called at all is gated on the athlete's
**health verdict**, which has nothing to do with cache freshness — a
`"Healthy"` athlete never gets a fresh plan from Groq, they always get
whichever unhealthy athlete's plan was cached last.

### 4. `CallGroq` will panic if Groq is slow or errors

```go
resp, _ := client.Do(req)   // error discarded
defer resp.Body.Close()     // nil-pointer dereference if the call failed
```
The context deadline is 5s while the HTTP client allows 10s, so a slow
completion trips the shorter one, `resp` is `nil`, and the handler panics.
Recovery middleware contains it, but the request is lost.

### 5. `CalculateBmr` ignores gender

```go
if u.Gender == "Male" {
    bmrVal.Bmr_value = 13.397*(u.Weight) + ...   // assigned...
}
bmrVal.Bmr_value = 9.247*(u.Weight) + ...        // ...then unconditionally overwritten
```
Every user gets the female formula regardless of the stored gender.

### 6. Integer truncation loses precision

`CalculateBmi`, `CalculateBmr` and `calculateWaterIntake` all return Go `int`.
A BMI of 26.86 is stored as `26`; an 88 kg user's 3.08 L target as `3`. The
client doesn't force a decimal, so the UI doesn't advertise precision the data
lacks — but the precision is genuinely gone at the source.

### 7. Verdict boundary gaps

`Get_User_verdict` now has an `Obese` band (an earlier gap where every BMI
≥30 read as `"Normal"` has been fixed), but the boundaries are still
exclusive comparisons with no explicit band for them: integer BMI values of
exactly **19, 20, or 25** fall through to `"Normal"` rather than landing in
`Underweight`/`Healthy`/`Overweight`. The client maps that fall-through to a
neutral tone rather than guessing, and the BMI scale chart plots the true WHO
thresholds independently of the verdict string.

### 8. Config and infrastructure gaps

- `.env.example` documents HTTP/Postgres/CORS/Google OAuth but omits
  `GROQ_KEY` and the AWS credentials the S3 SDK needs — see
  [Getting started](#getting-started).
- The S3 bucket name (`project-achiles`) is a Go constant, not configurable
  by environment.
- `trainingplan.EnsureSchema` runs `ALTER TABLE userinfo ADD COLUMN ...` on
  boot, which assumes `userinfo` already exists (it's created out-of-band —
  same tradeoff `auth.EnsureSchema` documents for the same table). Fine once
  `userinfo`/`user_specs` exist; a genuinely first-ever boot needs them
  created first.
- The rate limiter is real but only demonstrated on `/rateTest` — no
  production route currently sits behind it.

### 9. Minor client cleanups

- The Weight and Water Intake dashboard tiles still gate their **unit label**
  on `storedWeight` (the local session cache) rather than on the server
  value, even though `/getUserById` does return `weight` now — the figures
  are correct, the conditional predates that and is stricter than it needs
  to be.
- `npm audit` reports a React Router RSC-mode advisory. The project is on the
  latest 7.x and does not use RSC; the only "fix" available is a downgrade to
  a release with more open advisories, so it is intentionally not applied.

---

## Scripts

### Client

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server on `:5173` with the `/api` proxy and both shims |
| `npm run build` | `tsc -b` then a production bundle to `dist/` |
| `npm run preview` | Serve the built bundle (**no dev shims** — see rough edge #1) |
| `npm run lint` | oxlint |

### Server

| Command | Purpose |
|---|---|
| `go run ./cmd/api` | Start the API on `:8080` |
| `go build ./cmd/...` | Compile the actual binary |
| `go vet ./...` | Static checks |

> `go build ./...` (no `cmd/` scoping) currently also tries to compile a dead,
> unused file at the module root
> ([`psqlQuerySkeleton.go`](server/go_be_skeleton/psqlQuerySkeleton.go)) that
> doesn't parse — two unrelated file bodies got concatenated into one. It
> isn't imported by `cmd/api` and doesn't affect the running server; scope
> builds to `./cmd/...` until it's deleted.

### Configuration

Server env vars are documented in
[`server/go_be_skeleton/.env.example`](server/go_be_skeleton/.env.example)
(incomplete — see rough edge #8) and parsed in `internal/config/config.go`.
Client config is a single optional `VITE_API_BASE_URL`.

---

## Roadmap

### Short term

- Fix the rough edges above, starting with #2/#3 (doc export and AI caching
  are both currently broken in ways that cross athletes)
- Persist Nutrition/Workout page preferences (needs new endpoints, same shape
  as the training-plan work)
- A minimal admin surface for authoring nutrition/workout templates — today
  that's direct API calls, since there's no in-app content-authoring screen
- SQL migrations instead of the current mix of on-boot `EnsureSchema` calls
  and hand-created tables

### Planned: an LLM coach grounded in real plan content

`LLM/` exists as an empty Python scaffold today (pytest + ruff configured, no
source yet) for a retrieval-augmented coach, intended to eventually replace
`/askGroq`'s bare prompt-stuffing:

- **Retrieval corpus** — the training-plan styles authored via
  `nutrition_templates`/`workout_templates` (the same tables this app already
  writes to), not a separate content store. Likely `pgvector` on the existing
  Postgres rather than a standalone vector DB, given the corpus size.
- **Two kinds of context, not one** — the plan corpus is retrieved
  (semantic match on what an athlete is asking for); the athlete's own
  BMI/BMR/verdict/plan is fetched by id and injected directly, the same way
  `/askGroq` already does it today.
- **Service boundary** — the Python service owns the full pipeline
  (retrieve → assemble prompt → call the LLM) rather than Go orchestrating it
  step by step; Go keeps owning auth, CRUD, and the plan/nutrition/workout
  tables, and would proxy `user_id + query` to the Python service.

### Longer term

- Weight-log history, which would unlock genuine trend charts instead of
  single-point-in-time figures
- Real auth to fully replace the id-as-session model (Google sign-in already
  covers part of this)
- Rate limiting applied to real traffic, not just `/rateTest`

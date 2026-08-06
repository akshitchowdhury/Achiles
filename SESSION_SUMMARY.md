# Session summary

Branch: `feat/s3_workoutplantable`

## 1. Go — training plans API

- **`AddPlans`** ([TrainPlanService.go](server/go_be_skeleton/internal/TrainingPlan/TrainPlanService.go)) — bulk upsert in one statement via
  `INSERT ... SELECT * FROM unnest($1::text[], ...) ON CONFLICT (slug) DO UPDATE ... RETURNING`.
  Single statement = atomic on its own, so no explicit transaction.
- Rejected the original draft: hardcoded `VALUES` + 5 args (pgx rejects), and `QueryRow` on a multi-row insert.
- `EnsureSchema` added (the `UNIQUE (slug)` is required by `ON CONFLICT`), wired in `main.go`.
- Model became one `TrainingPlan` struct with `ImageKey` (column) + derived `ImageURL`; `PlanAssets` is the
  canonical slug → S3 key → local path table, feeding both `s3.SetUp` and `AddPlans`.
- `POST /addPlans`, `GET /getPlans` in `router.go`.
- Reviewed user's `GetAllPlansHandler`: scan arity 6 vs 5 columns (500s every call), missing
  `ResolveImageURL`, wrong 202 status, copy-paste log strings.

## 2. Go — `psqlQuerySkeleton.go`

Rewritten as a CRUD reference: AddOne/AddAll/GetAll/GetOne/UpsertOne/UpsertAll/EditOne/EditMany/
DeleteOne/DeleteAll + notes (tx, `CopyFrom`, `pgx.Batch`, `CollectRows`, `ANY`, pagination, COALESCE).
Given its own `go.mod` (it sits outside the main module).

## 3. Client — per-plan theming

Mechanism: every colour/radius/font is already a Tailwind v4 `@theme` custom property, so
`:root[data-plan="<slug>"]` re-points the **values**. Zero component colour edits.

- **`theme/plan-themes.css` is GENERATED** (`scratchpad/gen-themes.py`) — 5 themes × 49 tokens.
  Generator has a **contrast gate**: every fg vs plane/surface/raised must clear 4.5:1 or it refuses to write.
- Palette corrections: greek-god is the **light** theme (its spec had Ivory-on-white at 1.02:1 → navy ink);
  greek-god accent is Royal Purple not gold, spartan accent is Antique Gold not crimson (both forced by
  symmetric contrast).
- Dark planes were all near-identical near-blacks → separated by hue so hover preview actually reads.
- `chartTheme.ts` deleted → `useChartTheme()` reads computed properties (`var()` doesn't resolve in SVG
  presentation attributes).
- Pre-paint bootstrap in `index.html` prevents a flash of the wrong theme.

## 4. Client — plan picker

`/select-plan`, entered after the guest signup form. Faceted-cylinder cards (14 facets, 56° sweep, photo on
the barrel, text on a flat plane), hover previews the theme app-wide via the same `data-plan` attribute the
commit writes, gated by enter-gate / exit-hold / rate-cap / sweep-breaker.
`PlanWatermark` renders the plan image full-bleed behind the picker and the app.

## 5. Client — 5 layouts

`spartan` Stoa (icon rail + architrave) · `greek-god` Peristyle (centred entablature, pillars) ·
`superhero` Command Deck (floating dock + HUD) · `athlete` Broadcast (scoreboard bar) ·
`manga` Panel Grid (right rail). Lazy-loaded, ~2kB each. `Sidebar.tsx` → `PlanNav` + `PlanUser`.
Deleted: `Sidebar.tsx`, `HomePage.tsx`, `chartTheme.ts`.

## 6. Bugs found and fixed

- Cards rendered at **zero height** — `<button>` sizes to fit-content, all children absolute → `width: 100%` fix.
- `@layer components` lost to Tailwind's `@layer utilities`; 3 plans' card edges were dead CSS → unlayered.
- `revert()` targeted the persisted plan, not the selection → theme fell off after picking a card.
- `.cyl-rail > .cyl-item` never matched (wrapper div in between).
- `layoutFor` not total → blank app on an unknown persisted slug.
- Spartan mobile nav marked active state by colour alone.
- Peristyle first nav item unreachable on phones (`justify-center` in `overflow-x-auto`).
- `/select-plan` was a dead end with no sign-out.

## 7. Open items

- **Plan is stored in `localStorage` only** — `users` has no `plan_slug` column. Needs the column +
  a `PATCH /users/{id}/plan` endpoint to survive a device change.
- **Images too small**: sources are 399–736px wide; watermark upscales up to 4.8×.
  Want **2000×2840 WebP q78**, subject centred horizontally, head in upper third.
  Spartan's 0.53 aspect is the worst offender (cards are 31:44).
- `s3.SetUp` never sets `ContentType` → every object is `application/octet-stream`.
- Never verified in a browser by me — headless Chrome refuses `http://` here. Only the card-sizing
  fix was visually confirmed. User confirmed the picker renders.
- `psqlQuerySkeleton.go` SQL is unexecuted (no DB run).

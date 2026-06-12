# Purity Command Tower — Architecture

> A read-only operations dashboard for Babylon × Purity: inventory, match-rate (can we
> build it?), procurement (what to order, when), cash, finance, product development, and
> compliance — all on top of an **existing** GCP data pipeline.
>
> Last verified against the codebase: **2026-06-08.**

---

## 1. The one-paragraph version

A colleague already built and populated a full data pipeline in GCP project
`purity-control-tower-demo`: **raw, high-volume data lives in BigQuery** (sales, on-hand,
orders — hundreds of thousands of rows) and **derived data lives in Firestore** (per-SKU
summaries, match-rate readiness, forecasts, channel rollups, exceptions). This app
**consumes** that pipeline. It is three TypeScript packages in one repo: a **pure engine**
(domain math, no I/O), a **thin read-only API** (Express over BigQuery + Firestore), and a
**React web app** (Vite). The web app never touches GCP directly — it only calls the API.
Where no real cost/vendor master exists yet (cash, finance, intercompany), the engine
supplies **clearly-labeled "modeled" defaults** instead of inventing data silently.

---

## 2. The layer cake (read this first)

```
┌──────────────────────────────────────────────────────────────────────┐
│  SOURCE SYSTEMS  (owned by colleague's pipeline — we don't write here) │
│  Odoo · Shopify · 3PL/Deposco                                          │
└───────────────────────────────┬──────────────────────────────────────┘
                                 │  (ingestion + precompute — UPSTREAM, not in this repo)
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│  GCP DATA  (project: purity-control-tower-demo)                        │
│                                                                        │
│   BigQuery  ── RAW, millions of rows ──────────────┐                   │
│     control_tower_raw.finished_goods_sales (406k)  │  high-volume      │
│     .finished_goods_on_hand (195k)                 │  facts, queried   │
│     .raw_materials_on_hand · .products (324)       │  on demand        │
│     .finished_goods_orders_placed · .raw_material_orders_placed        │
│     control_tower_summary.* (sku_summaries, monthly actuals …)         │
│                                                                        │
│   Firestore ── DERIVED, small docs ────────────────┐                   │
│     control_tower_summary/current   (Overview KPIs) │  precomputed     │
│     sku_summaries · material_readiness_summaries    │  metrics &       │
│     production_plan_summaries · sales_forecasts_6m   │  summaries —     │
│     channel_summaries · exception_summaries · …     │  cheap reads     │
│     + seeded: ingredients, formulas, reviews, artwork, …               │
└───────────────────────────────┬──────────────────────────────────────┘
                                 │  service-account (read-only)
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│  packages/api   @pct/api   — Express, port 8080                        │
│    • One HTTP route per view's data need (§5)                          │
│    • clients.ts: firestore + bigquery SDK wrappers + 60s TTL cache     │
│    • imports @pct/engine for any real math / modeled $                 │
│    • read-only: no writes to GCP, ever                                 │
└───────────────────────────────┬──────────────────────────────────────┘
                                 │  HTTP /api/*   (Vite proxies in dev)
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│  packages/web   @pct/web   — React 18 + Vite, port 5173                │
│    • App.tsx = sidebar nav + one view component per tab                │
│    • useFetch('/api/…') → render. No GCP credentials in the browser.   │
└──────────────────────────────────────────────────────────────────────┘

        packages/engine   @pct/engine   — pure, I/O-free, shared
          imported by api (and the contract web data conforms to)
```

**The mental model to take away:** this is a classic **three-tier read model**.
Source → warehouse (raw) → derived store (fast reads) → API → UI. Each layer only
knows about the one below it. The browser knows the API; the API knows GCP; GCP is fed
by an upstream pipeline we don't own yet. Pushing volume down (BigQuery) and pulling
pre-chewed summaries up (Firestore) is the core performance trick — **the UI never waits
on a million-row scan.**

---

## 3. Raw vs. derived — the rule that drives everything

This split is a hard architectural rule, not a preference:

| | BigQuery (`control_tower_raw`) | Firestore (derived) |
|---|---|---|
| **Holds** | Facts: every sale, every on-hand snapshot, every order line | Conclusions: per-SKU velocity, days-of-cover, match-rate, KPIs |
| **Grain** | One row per event/line (hundreds of thousands) | One doc per SKU / channel / exception (hundreds) |
| **Accessed** | `bqQuery(...)` — parameterized SQL, on demand | `fetchCollection`/`fetchDoc` — whole collection or one doc |
| **Cost shape** | Scanned bytes; you pay per query | Cheap point/collection reads |
| **Who writes it** | Upstream pipeline (+ our seed scripts for new feeds) | Upstream pipeline (+ our seed scripts) |

**Generalization for your data-model learning:** *raw is what happened; derived is what it
means.* Keep them in separate stores chosen for their access pattern — a columnar
warehouse for "scan and aggregate," a document store for "give me this one thing fast."
Never make the UI recompute meaning from raw on every page load; precompute it once and
read it many times. The cost of that choice is **staleness** (derived can lag raw) and
**duplication** (the same fact lives twice) — both acceptable here because the data
refreshes on a schedule, not per-second.

---

## 4. The three packages in detail

### `packages/engine` — `@pct/engine` (pure domain model)

Zero I/O. No network, no database, no `Date.now()` baked into outputs. Just types and
functions. This makes it **trivially testable** (Vitest parity suite) and reusable by both
the API and any future precompute job.

- `types.ts` — the domain contract: inventory (`SkuRecord`/`SkuDerived`), BOM + match-rate
  (`Component`/`ProductBOM`/`Build`), procurement (`Schedule`/`ScheduleItem`), finance
  shapes, plus the broader masters (`RealBom`, `Formulas`, `Ingredients`, `VendorMaster`…).
- `reference.ts` — **labeled SEED DEFAULTS**: durations (compound/fill/freight…), cover
  bands, vendor terms/origin, component cost, HTS codes, Section 301. Real master data
  *overrides* these; they are not authoritative.
- `inventory.ts` — `coverBand`, `deriveSkus`, `computeFlags`, `overstockCapital`.
- `build.ts` — `computeBuild` (match-rate: of the units you *want* to build, how many can
  you actually make given component shortfalls?) + `strandedCapital`.
- `schedule.ts` — `computeSchedule` (synced vs. naive procurement timing).
- `procurement.ts` — shared helpers reused by the API: `DAY_MS`, `parseISODate`,
  `isoFromMs`, `isIngredientSku`, `originFromVendor` (vendor → `{mode, imported, badge}`).
- `finance.ts` — `cashWeeks`/`cashMonths` (payables buckets + running balance),
  `skuEconomics` (modeled COGS), `leaseVsBuy`, `intercompanyStats` (transfer pricing +
  AR aging). Constants like `FIN_ING_COST`, `FIN_PKG_COST`, transfer markup 1.45.
- `index.ts` — barrel export. Tests in `test/` (build, inventory, schedule, finance).

**Why a pure engine matters:** it's the *single definition* of "what match-rate means" or
"how cash buckets are computed." Anywhere that number appears — API response, future
scheduled job — it comes from the same code, so it can't drift. The reference tables being
**overridable defaults** is the key design move: the engine is the typed shape real data
maps onto, and where real data is missing the defaults fill in, **always labeled "modeled."**

### `packages/api` — `@pct/api` (read-only HTTP)

Express, boots on **port 8080**. Structure:

- `index.ts` — boots `createApp()` and listens.
- `app.ts` — **`createApp()` registers every route** (this is the route map; see §5).
- `auth.ts` — optional gating: if `API_KEY` is set, `/api/*` (except `/health`) requires
  `Authorization: Bearer` or `x-api-key`. Unset = open (dev default).
- `env.ts` — loads `credentials/.env`, resolves the service-account path to absolute,
  exposes `PROJECT_ID`, `PORT`, `CORS_ORIGIN`, `API_KEY`.
- `clients.ts` — the only place that talks to GCP: `firestore` + `bigquery` SDK clients,
  `fetchCollection` / `fetchCollectionWhere` / `fetchDoc` / `bqQuery`, all wrapped in a
  **60-second in-memory TTL cache** so a page load doesn't hammer GCP.
- Feature handlers: `orders.ts`, `velocity.ts`, `channels.ts`, `productDev.ts`,
  `finance.ts`, `extras.ts`, `poTimeline.ts`.

**Design stance:** the API is *thin*. Most routes are "fetch a Firestore collection and
return it." The interesting ones **join across stores** (e.g. `/api/skus/:sku` fans out to
3 Firestore docs + 4 BigQuery queries in parallel) or **apply the engine** (finance/cash).
It never writes to GCP.

### `packages/web` — `@pct/web` (React UI)

React 18 + Vite, dev server on **port 5173**, proxies `/api` → `:8080`.

- `App.tsx` — the shell: a `NAV` array (one entry per tab) drives the sidebar and which
  view renders. Two React contexts let *any* view trigger global UI:
  `useOpenSku(sku)` opens the SKU drawer; `useOpenChannel(id)` navigates to channel detail.
- `lib/api.ts` — `useFetch<T>(path)` hook (loading/error/data) + loose typed shapes. Types
  are deliberately loose (`extends Dict`) because **Firestore has no schema** — we follow
  the real data and guard every field.
- `views/*` — one component per tab (Overview, Inventory, Readiness, Production plan,
  Product development, What to order, vendors, Cash, Finance, Intercompany, Reviews,
  Artwork, Regulatory, Channels, Forecast, Exceptions).
- `components/*` — reusable: `SkuDrawer` (per-SKU deep dive), `Gantt` + `PoGantt`
  (lifecycle / per-component PO timeline), `ui.tsx` (cards, stat tiles, etc.).

---

## 5. The route map (API surface)

Every route is `GET` and read-only. Registered in [app.ts](packages/api/src/app.ts).

| Route | Backed by | Powers (view) |
|---|---|---|
| `/api/health` | — | liveness |
| `/api/summary` | Firestore `…/current` + BQ velocity | Overview KPIs |
| `/api/skus` | Firestore `sku_summaries` + velocity overlay | Inventory list |
| `/api/skus/:sku` | 3 Firestore docs + 4 BQ queries (joined) | SKU drawer |
| `/api/readiness` | `material_readiness_summaries` | Material readiness |
| `/api/production-plan` | `production_plan_summaries` | Production plan |
| `/api/exceptions` `/api/data-quality` `/api/actions` | matching collections | Exceptions |
| `/api/forecast` | `sales_forecasts_6m` | Forecast |
| `/api/sales-orders` `/api/orders` | BQ orders + engine plan | What to order |
| `/api/po-timeline` | FG orders ⨝ raw-material POs | Per-component PO Gantt |
| `/api/channels` `/api/channels/:channel` | `channel_summaries` + monthly | Channels |
| `/api/pd/formulas` `/api/pd/formulas/:id` `/api/pd/ingredients` | PD collections | Product development |
| `/api/vendors` | BQ RM POs + `ingredients` | Component / Ingredient vendors |
| `/api/finance/cash` | BQ open POs → engine `cashWeeks/Months` | Cash planner *(modeled $)* |
| `/api/finance/summary` | `sku_summaries` + engine `skuEconomics` | Finance *(modeled)* |
| `/api/finance/intercompany` | engine `intercompanyStats` | Intercompany *(modeled)* |
| `/api/reviews` `/api/artwork` | seeded collections | Reviews / Artwork |
| `/api/regulatory` | derived from PD collections | Regulatory dossier |

---

## 6. Two request flows, traced end-to-end

**Simple (Overview):** browser `useFetch('/api/summary')` → Vite proxy → API `/api/summary`
→ `fetchDoc('control_tower_summary','current')` + `bqVelocityMap()` (cached) → merge →
JSON → React renders KPI tiles. *One Firestore doc + one cached BQ aggregate. Fast.*

**Joined (SKU drawer):** click a SKU → `useOpenSku(sku)` → `SkuDrawer` fetches
`/api/skus/:sku` → API fires **7 reads in parallel** (`Promise.all`): summary, readiness,
plan, exceptions, actions from Firestore; lots, sales, FG orders from BigQuery; then applies
the **velocity overlay** (corrects the known-inflated Firestore velocity using BigQuery
windowed velocities) and, if there are no open orders, **synthesizes a projected build**
via the engine. *This is where raw + derived + engine all meet in one response.*

---

## 7. "Modeled vs. real" — the honesty discipline

Some tabs (Cash, Finance, Intercompany) need unit costs and vendor terms that **don't exist
yet** as a real master. Rather than fabricate numbers silently, the engine supplies labeled
SEED DEFAULTS, every such response carries `modeled: true`, and the UI shows a "modeled"
badge. **Dates and quantities in those views are real** (from actual open POs); only the
**dollars are modeled** until a cost master lands.

Generalization: *a derived field can lie.* The Firestore `daily_velocity_estimate` was
all-time-units ÷ 30 (not a true trailing-30d rate), so the API overlays BigQuery windowed
velocities instead. Treat precomputed fields as claims to verify, not gospel — and label
anything you model so a reader never mistakes an assumption for a measurement.

---

## 8. Hard rules (carried throughout the build)

1. **Credentials are git- AND gcloud-ignored.** `credentials/` (service-account JSON +
   `.env`) never gets committed or deployed.
2. **Raw high-volume → BigQuery; derived → Firestore.** Non-negotiable split (§3).
3. **Work with the existing BigQuery schema — don't redesign it.** New data is appended /
   added as new tables mirroring existing conventions; existing tables aren't restructured.
4. **The app is read-only.** It consumes the pipeline. (Seed scripts in `scripts/discover`
   add genuinely-new derived collections like `ingredients`/`reviews`; they don't rewrite
   the colleague's tables.)
5. **Follow the real data shapes**, not the handoff prototype's mocked model. The handoff
   is UX inspiration only. NoSQL has no schema → guard every array/object field
   (`(x ?? []).map`).

---

## 9. How to run it

```bash
npm install                 # workspaces: engine, api, web, scripts/discover
npm run dev                 # concurrently: API on :8080 + web on :5173 (open this)
# or individually:
npm run dev:api             # tsx watch — Express on :8080
npm run dev:web             # Vite on :5173, proxying /api → :8080

npm run typecheck           # tsc --noEmit across engine + api + web
npm test                    # Vitest: engine parity suite + API supertest suite
npm run build               # web (Vite) + api (tsc)
npm run discover            # regenerate docs/EXISTING_SCHEMA.md (read-only introspection)
```

Config lives in `credentials/.env` (gitignored): `FIREBASE_PROJECT_ID`,
`GOOGLE_APPLICATION_CREDENTIALS` (path to the service-account JSON, resolved relative to
repo root), optional `PORT` / `CORS_ORIGIN` / `API_KEY`.

---

## 10. What's deferred (not built yet)

- **Owning the pipeline.** Ingestion (Odoo/Shopify/3PL → BigQuery) and precompute
  (BigQuery → engine → Firestore) currently run *upstream*. "Consume now, absorb later."
- **Real cost/vendor master.** Until one exists, finance dollars stay **modeled** (§7).
- **`computeBuild`/`computeSchedule` on real BOM.** The engine procurement model isn't yet
  fed real BOM/cost data; `packages/api/src/orders.ts buildPlan` overlaps `computeSchedule`
  and could be deduped onto the engine.
- **Tweaks / on-demand recompute.** The engine is pure and ready for a live "what-if"
  endpoint (slider-driven durations), but it isn't wired yet.

---

## 11. Where to look when…

| You want to… | Go to |
|---|---|
| Add a new tab | `packages/web/src/App.tsx` (NAV) + a new `views/*.tsx` + an API route |
| Add an API route | `packages/api/src/app.ts` (`createApp`) + a handler file |
| Change domain math | `packages/engine/src/*` + its test in `packages/engine/test/` |
| Change how GCP is queried | `packages/api/src/clients.ts` |
| See the real data shapes | `docs/EXISTING_SCHEMA.md`, `docs/SAMPLE_DOCS.md` *(gitignored)* |
| Seed a new derived collection | `scripts/discover/seed-*.mjs` |
```

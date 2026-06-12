# Purity Command Tower

Operations dashboard for the **Babylon × Purity** skincare line — unified inventory, material readiness (match-rate), production planning, channels, demand forecast, and exceptions.

It is a **read layer + UI on top of an existing data pipeline**. A separate pipeline already ingests Odoo / Shopify / Amazon / Deposco / Berkeley data into **BigQuery** (`control_tower_raw`, `control_tower_summary`) and computes derived summaries into **Firestore** (project `purity-control-tower-demo`). This app consumes that data; it does not (yet) own the pipeline. See `docs/EXISTING_SCHEMA.md` (regenerate with `npm run discover`).

## Layout (npm workspaces monorepo)

| package | role |
|---|---|
| `packages/api` | Thin **read-only** Express server. Reads Firestore (Admin SDK) + BigQuery via the service account; serves `/api/*` for the frontend. |
| `packages/web` | React + TypeScript + Vite frontend. Seven views; reads the API. |
| `scripts/discover` | Read-only BigQuery + Firestore introspection (`docs/EXISTING_SCHEMA.md`, `docs/SAMPLE_DOCS.md`). |

## Data → view mapping

| View | Firestore / BigQuery source |
|---|---|
| Overview | `control_tower_summary/current` |
| Material readiness (match-rate) | `material_readiness_summaries` |
| Production plan | `production_plan_summaries` |
| Inventory | `sku_summaries` (+ `finished_goods_on_hand`, `finished_goods_sales` for the SKU drawer) |
| Channels | `channel_summaries` + `sales_monthly_actuals` |
| Forecast | `sales_forecasts_6m` |
| Exceptions & data quality | `exception_summaries` + `data_quality_checks` |

## Setup

1. Put the service-account JSON and `.env` in `credentials/` (gitignored + gcloudignored). See `.env.example`.
   - `GOOGLE_APPLICATION_CREDENTIALS` should be a path **relative to the repo root**, e.g. `./credentials/<key>.json`.
2. Install: `npm install`
3. Run both api + web: `npm run dev` (api on `:8080`, web on `:5173`, web proxies `/api` → api).
   - Or individually: `npm run dev:api` / `npm run dev:web`.
4. Inspect the live schema any time: `npm run discover`.

## Build / typecheck

```
npm run typecheck
npm run build      # web (static) + api (dist/)
```

## Security

`credentials/`, `.env*`, and `*.json` keys are git- and gcloud-ignored. Never commit or deploy secrets. `docs/EXISTING_SCHEMA.md` / `docs/SAMPLE_DOCS.md` are gitignored because they contain sampled rows.

## Status / roadmap

- ✅ Read-only API + 7 views over the existing data, verified against live data.
- ⏳ Deferred: deploy (Cloud Run for `api`, Firebase Hosting for `web`); "absorb the pipeline" (own ingestion + summarization in this repo); handoff-spec extras (synced/naive procurement Gantt, landed-cost/customs) if/when needed.

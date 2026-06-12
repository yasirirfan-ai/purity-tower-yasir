// Read-only: dump FULL sample docs for the Firestore collections the app will
// consume, plus a few BigQuery aggregates (channels, sales date range), so we
// can design the views against real shapes. Output -> docs/SAMPLE_DOCS.md (gitignored).
import { BigQuery } from '@google-cloud/bigquery';
import { Firestore } from '@google-cloud/firestore';
import dotenv from 'dotenv';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: resolve(REPO_ROOT, 'credentials/.env') });
const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (cred && !isAbsolute(cred)) process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(REPO_ROOT, cred);
const projectId = process.env.FIREBASE_PROJECT_ID;

const out = [];
const log = (s = '') => out.push(s);

const COLLECTIONS = [
  'control_tower_summary',
  'sku_summaries',
  'material_readiness_summaries',
  'production_plan_summaries',
  'sales_forecasts_6m',
  'channel_summaries',
  'exception_summaries',
  'action_recommendations',
  'data_quality_checks',
  'sales_monthly_actuals',
];

const fs = new Firestore({ projectId });
const bq = new BigQuery({ projectId });

log('# Sample Docs — full payloads for app design (read-only)');
log('');

for (const name of COLLECTIONS) {
  log(`## \`${name}\``);
  log('');
  try {
    const snap = await fs.collection(name).limit(2).get();
    if (snap.empty) { log('_(empty)_\n'); continue; }
    for (const doc of snap.docs) {
      log(`### doc id: \`${doc.id}\``);
      log('```json');
      log(JSON.stringify(doc.data(), null, 2));
      log('```');
      log('');
    }
  } catch (err) {
    log(`> error: ${err.message}\n`);
  }
}

log('---');
log('## BigQuery aggregates');
log('');

const queries = {
  'sales channels + date range': `
    SELECT channel, COUNT(*) rows, MIN(sale_date) min_date, MAX(sale_date) max_date,
           SUM(net_quantity_sold) net_units, ROUND(SUM(net_sales)) net_sales
    FROM \`control_tower_raw.finished_goods_sales\`
    GROUP BY channel ORDER BY rows DESC`,
  'on_hand channels': `
    SELECT channel, source_system, COUNT(*) rows, ROUND(SUM(quantity_on_hand)) qty
    FROM \`control_tower_raw.finished_goods_on_hand\`
    GROUP BY channel, source_system ORDER BY rows DESC`,
  'products item_type breakdown': `
    SELECT item_type, COUNT(*) n FROM \`control_tower_raw.products\` GROUP BY item_type ORDER BY n DESC`,
};

for (const [label, sql] of Object.entries(queries)) {
  log(`### ${label}`);
  log('');
  try {
    const [rows] = await bq.query({ query: sql });
    if (rows.length) {
      const cols = Object.keys(rows[0]);
      log('| ' + cols.join(' | ') + ' |');
      log('|' + cols.map(() => '---').join('|') + '|');
      for (const r of rows) log('| ' + cols.map((c) => String(r[c] ?? '')).join(' | ') + ' |');
      log('');
    }
  } catch (err) {
    log(`> error: ${err.message}\n`);
  }
}

const outPath = resolve(REPO_ROOT, 'docs/SAMPLE_DOCS.md');
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, out.join('\n'), 'utf8');
console.log(`✅ written ${outPath}`);

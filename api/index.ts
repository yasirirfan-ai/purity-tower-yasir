/**
 * Vercel serverless entry point.
 *
 * Environment variables required in the Vercel dashboard:
 *   FIREBASE_PROJECT_ID      – GCP / Firebase project id
 *   GCP_CREDENTIALS_JSON     – full contents of the service-account JSON key
 *                              (copy-paste the entire JSON as one line)
 *   BIGQUERY_DATASET         – BigQuery dataset name  (e.g. purity_inventory)
 *   CORS_ORIGIN              – comma-separated allowed origins (optional)
 *   API_KEY                  – bearer token to protect the API  (optional)
 */

import { writeFileSync } from 'fs';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Credentials bootstrap ──────────────────────────────────────────────────
// Vercel can't ship a JSON file, so the service-account key is stored as an
// env var and written to /tmp once per cold-start.
if (process.env.GCP_CREDENTIALS_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const tmpPath = '/tmp/gcp-credentials.json';
  writeFileSync(tmpPath, process.env.GCP_CREDENTIALS_JSON);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
}

// ── Express app ────────────────────────────────────────────────────────────
// Dynamic import so the credential env vars above are set first.
const { createApp } = await import('../packages/api/src/app.js');
const app = createApp();

// ── Vercel handler ─────────────────────────────────────────────────────────
export default function handler(req: VercelRequest, res: VercelResponse) {
  // Express is a valid connect-style middleware — Vercel calls it the same way.
  return new Promise<void>((resolve, reject) => {
    // @ts-expect-error  VercelRequest is compatible with IncomingMessage
    app(req, res, (err?: unknown) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

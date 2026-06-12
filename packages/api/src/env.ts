import dotenv from 'dotenv';
import { resolve, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

// repo root = packages/api/src -> ../../..
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

dotenv.config({ path: resolve(REPO_ROOT, 'credentials/.env') });

// Railway/cloud deploy: set GOOGLE_APPLICATION_CREDENTIALS_JSON to the raw JSON content
// of your service-account key; this writes it to a temp file so the GCP SDKs find it.
const credJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
if (credJson && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const tmpPath = resolve(tmpdir(), 'gcp-sa.json');
  writeFileSync(tmpPath, credJson, 'utf8');
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
}

// Resolve a possibly-relative service-account path to absolute so the GCP SDKs find it.
const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (cred && !isAbsolute(cred)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(REPO_ROOT, cred);
}

export const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? '';
export const PORT = Number(process.env.PORT ?? 8080);
/** Comma-separated allowed origins; unset = cors default (allow all in dev). */
export const CORS_ORIGIN = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);
/** When set, /api/* (except health) requires Authorization: Bearer or x-api-key. */
export const API_KEY = process.env.API_KEY || undefined;

if (!PROJECT_ID) {
  // eslint-disable-next-line no-console
  console.error('FIREBASE_PROJECT_ID missing from credentials/.env');
  process.exit(1);
}

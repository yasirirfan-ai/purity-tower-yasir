import { Firestore } from '@google-cloud/firestore';
import { BigQuery } from '@google-cloud/bigquery';
import { PROJECT_ID } from './env.js';

export const firestore = new Firestore({ projectId: PROJECT_ID });
export const bigquery = new BigQuery({ projectId: PROJECT_ID });

// ── Tiny in-memory TTL cache to avoid hammering Firestore/BigQuery on every page load.
const cache = new Map<string, { at: number; value: unknown }>();
const DEFAULT_TTL_MS = 60_000;

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < ttlMs) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: now, value });
  return value;
}

export { DEFAULT_TTL_MS };

/** Fetch every doc in a collection as plain objects (with id). Read-only. */
export async function fetchCollection(
  name: string,
  ttlMs = DEFAULT_TTL_MS,
): Promise<Array<Record<string, unknown> & { id: string }>> {
  return cached(`col:${name}`, ttlMs, async () => {
    const snap = await firestore.collection(name).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
  });
}

/** Fetch docs in a collection where `field == value`. Read-only. */
export async function fetchCollectionWhere(
  name: string,
  field: string,
  value: string,
  ttlMs = DEFAULT_TTL_MS,
): Promise<Array<Record<string, unknown> & { id: string }>> {
  return cached(`col:${name}:${field}:${value}`, ttlMs, async () => {
    const snap = await firestore.collection(name).where(field, '==', value).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
  });
}

/** Fetch a single doc by id, or null. */
export async function fetchDoc(
  collection: string,
  id: string,
  ttlMs = DEFAULT_TTL_MS,
): Promise<(Record<string, unknown> & { id: string }) | null> {
  return cached(`doc:${collection}/${id}`, ttlMs, async () => {
    const snap = await firestore.collection(collection).doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() as Record<string, unknown>) };
  });
}

/** Run a parameterized BigQuery query (read-only). */
export async function bqQuery<T = Record<string, unknown>>(
  query: string,
  params: Record<string, unknown> = {},
  ttlMs = DEFAULT_TTL_MS,
): Promise<T[]> {
  const key = `bq:${query}:${JSON.stringify(params)}`;
  return cached(key, ttlMs, async () => {
    const [rows] = await bigquery.query({ query, params, location: 'US' });
    return rows as T[];
  });
}

export const RAW = 'control_tower_raw';

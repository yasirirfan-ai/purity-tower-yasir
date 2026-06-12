import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { fetchCollection, fetchCollectionWhere, fetchDoc, bqQuery, bqVelocityMap } = vi.hoisted(() => ({
  fetchCollection: vi.fn(),
  fetchCollectionWhere: vi.fn(),
  fetchDoc: vi.fn(),
  bqQuery: vi.fn(),
  bqVelocityMap: vi.fn(),
}));

vi.mock('../src/env.js', () => ({
  PROJECT_ID: 'test-project',
  PORT: 8080,
  CORS_ORIGIN: undefined,
  API_KEY: undefined,
}));

vi.mock('../src/clients.js', () => ({
  fetchCollection,
  fetchCollectionWhere,
  fetchDoc,
  bqQuery,
  cached: async (_k: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
  RAW: 'control_tower_raw',
  DEFAULT_TTL_MS: 60_000,
  firestore: {},
  bigquery: {},
}));

vi.mock('../src/velocity.js', () => ({
  bqVelocityMap,
  applyVelocity: <T extends Record<string, unknown>>(rec: T) => rec,
}));

import { createApp } from '../src/app.js';

describe('createApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bqVelocityMap.mockResolvedValue(new Map());
  });

  it('GET /api/health returns ok', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.ts).toBeTruthy();
  });

  it('GET /api/readiness returns collection data', async () => {
    fetchCollection.mockResolvedValue([{ id: 'SKU1', readiness_band: 'ready' }]);
    const res = await request(createApp()).get('/api/readiness');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(fetchCollection).toHaveBeenCalledWith('material_readiness_summaries');
  });

  it('ok() wrapper returns 500 on handler error', async () => {
    fetchCollection.mockRejectedValue(new Error('firestore down'));
    const res = await request(createApp()).get('/api/readiness');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('firestore down');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

describe('apiKeyAuth', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const mockRes = () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    return res;
  };

  it('passes through when API_KEY is unset', async () => {
    vi.doMock('../src/env.js', () => ({ API_KEY: undefined }));
    const { apiKeyAuth } = await import('../src/auth.js');
    const next = vi.fn() as NextFunction;
    apiKeyAuth({ path: '/api/readiness', headers: {} } as Request, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects missing key when API_KEY is set', async () => {
    vi.doMock('../src/env.js', () => ({ API_KEY: 'secret-key' }));
    const { apiKeyAuth } = await import('../src/auth.js');
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    apiKeyAuth({ path: '/api/readiness', headers: {} } as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows /api/health without key', async () => {
    vi.doMock('../src/env.js', () => ({ API_KEY: 'secret-key' }));
    const { apiKeyAuth } = await import('../src/auth.js');
    const next = vi.fn() as NextFunction;
    apiKeyAuth({ path: '/api/health', headers: {} } as Request, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('accepts Bearer token', async () => {
    vi.doMock('../src/env.js', () => ({ API_KEY: 'secret-key' }));
    const { apiKeyAuth } = await import('../src/auth.js');
    const next = vi.fn() as NextFunction;
    apiKeyAuth(
      { path: '/api/readiness', headers: { authorization: 'Bearer secret-key' } } as Request,
      mockRes(),
      next,
    );
    expect(next).toHaveBeenCalled();
  });
});

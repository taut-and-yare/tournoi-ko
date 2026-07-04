import { describe, it, expect, beforeEach } from 'vitest';
import { isAdmin, requireAdmin } from './auth';

beforeEach(() => {
  process.env.ADMIN_SECRET = 'secret';
});

function req(secret?: string): Request {
  const headers = new Headers();
  if (secret) headers.set('x-admin-secret', secret);
  return new Request('http://x', { headers });
}

describe('auth', () => {
  it('accepts the correct secret', () => {
    expect(isAdmin(req('secret'))).toBe(true);
    expect(() => requireAdmin(req('secret'))).not.toThrow();
  });
  it('rejects a missing or wrong secret', () => {
    expect(isAdmin(req())).toBe(false);
    expect(isAdmin(req('nope'))).toBe(false);
    expect(() => requireAdmin(req('nope'))).toThrow();
  });
});

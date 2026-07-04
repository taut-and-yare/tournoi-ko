import { describe, it, expect, beforeEach } from 'vitest';
import { GET as listGET, POST as createPOST } from './+server';
import { GET as itemGET, PATCH as itemPATCH, DELETE as itemDELETE } from './[id]/+server';
import { __resetMemForTests } from '$lib/server/storage';

beforeEach(() => {
  process.env.ADMIN_SECRET = 'secret';
  __resetMemForTests();
});

function post(body: unknown, admin = true): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (admin) headers.set('x-admin-secret', 'secret');
  return new Request('http://x/api/tournaments', { method: 'POST', headers, body: JSON.stringify(body) });
}

const valid = { name: 'T', startDate: '2026-07-10', endDate: '2026-07-12', organiser: 'A', participantCount: 4 };

async function create() {
  const res = await createPOST({ request: post(valid) } as never);
  return res.json();
}

describe('tournaments API', () => {
  it('rejects unauthenticated create', async () => {
    await expect(createPOST({ request: post(valid, false) } as never)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a non-power-of-two participant count', async () => {
    await expect(
      createPOST({ request: post({ ...valid, participantCount: 6 }) } as never)
    ).rejects.toMatchObject({ status: 400 });
  });

  it('creates, then hides registration tournaments from non-admins', async () => {
    await create();
    const asAdmin = await (await listGET({ request: new Request('http://x', { headers: { 'x-admin-secret': 'secret' } }) } as never)).json();
    const asPublic = await (await listGET({ request: new Request('http://x') } as never)).json();
    expect(asAdmin).toHaveLength(1);
    expect(asPublic).toHaveLength(0);
  });

  it('reads, patches, and deletes an item', async () => {
    const t = await create();
    const got = await (await itemGET({ params: { id: t.id }, request: new Request('http://x') } as never)).json();
    expect(got.id).toBe(t.id);

    const patchReq = new Request('http://x', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-admin-secret': 'secret' },
      body: JSON.stringify({ name: 'Renamed' })
    });
    const patched = await (await itemPATCH({ params: { id: t.id }, request: patchReq } as never)).json();
    expect(patched.name).toBe('Renamed');

    const delReq = new Request('http://x', { method: 'DELETE', headers: { 'x-admin-secret': 'secret' } });
    const del = await (await itemDELETE({ params: { id: t.id }, request: delReq } as never)).json();
    expect(del.ok).toBe(true);
    await expect(itemGET({ params: { id: t.id }, request: new Request('http://x') } as never)).rejects.toMatchObject({ status: 404 });
  });
});

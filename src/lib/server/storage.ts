import { kv } from '@vercel/kv';
import type { Tournament, TournamentSummary } from '../types';

const useKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const INDEX_KEY = 'tournaments:index';
const mem = new Map<string, unknown>();

async function rawGet<T>(key: string): Promise<T | null> {
  if (useKV) return (await kv.get<T>(key)) ?? null;
  return mem.has(key) ? (mem.get(key) as T) : null;
}
async function rawSet(key: string, value: unknown): Promise<void> {
  if (useKV) await kv.set(key, value);
  else mem.set(key, value);
}
async function rawDel(key: string): Promise<void> {
  if (useKV) await kv.del(key);
  else mem.delete(key);
}

const docKey = (id: string) => `tournament:${id}`;

function summarize(t: Tournament): TournamentSummary {
  return {
    id: t.id,
    name: t.name,
    status: t.status,
    participantCount: t.participantCount,
    registered: t.players.length
  };
}

export async function getTournament(id: string): Promise<Tournament | null> {
  return rawGet<Tournament>(docKey(id));
}

export async function listTournaments(): Promise<TournamentSummary[]> {
  return (await rawGet<TournamentSummary[]>(INDEX_KEY)) ?? [];
}

export async function saveTournament(t: Tournament): Promise<void> {
  await rawSet(docKey(t.id), t);
  const index = await listTournaments();
  const next = index.filter((s) => s.id !== t.id);
  next.push(summarize(t));
  await rawSet(INDEX_KEY, next);
}

export async function deleteTournament(id: string): Promise<void> {
  await rawDel(docKey(id));
  const index = await listTournaments();
  await rawSet(INDEX_KEY, index.filter((s) => s.id !== id));
}

export function __resetMemForTests(): void {
  mem.clear();
}

import { put } from '@vercel/blob';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

function extFor(file: File): string {
  const fromName = file.name?.includes('.') ? file.name.split('.').pop() : '';
  if (fromName) return fromName.toLowerCase();
  const type = file.type || 'image/jpeg';
  return type.split('/')[1] ?? 'jpg';
}

export async function savePlayerPhoto(tournamentId: string, playerId: string, file: File): Promise<string> {
  const ext = extFor(file);
  if (useBlob) {
    const blob = await put(`tournaments/${tournamentId}/players/${playerId}.${ext}`, file, {
      access: 'public',
      addRandomSuffix: false
    });
    return blob.url;
  }
  // Local dev fallback: write into static/uploads so the file is served at /uploads/...
  const dir = path.resolve('static/uploads');
  await mkdir(dir, { recursive: true });
  const filename = `${tournamentId}-${playerId}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), bytes);
  return `/uploads/${filename}`;
}

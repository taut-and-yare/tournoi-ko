import { error } from '@sveltejs/kit';

export function isAdmin(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return request.headers.get('x-admin-secret') === secret;
}

export function requireAdmin(request: Request): void {
  if (!isAdmin(request)) throw error(401, 'Non autorisé.');
}

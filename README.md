# Tournoi KO

Site de visualisation de tournois d'échecs à élimination directe (PoC). SvelteKit + Vercel KV + Vercel Blob.

## Développement local

```bash
npm install
ADMIN_SECRET=test npm run dev
```

Without KV/Blob env vars the app uses in-memory storage (reset on restart) and writes photos to `static/uploads/`. Set `ADMIN_SECRET` to unlock organiser mode in the UI.

## Tests

```bash
npm test          # run once
npm run test:watch
npm run check     # type-check
```

## Deploy to Vercel

1. Import the repo into Vercel.
2. Add the **Upstash Redis** integration (Marketplace) — it provisions `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Add the **Vercel Blob** store — it provisions `BLOB_READ_WRITE_TOKEN`.
4. Set env var `ADMIN_SECRET` to a private passphrase.
5. Deploy. Organiser mode is unlocked in the browser with that passphrase; spectators only see tournaments whose registration is complete.

## Notes

- `participantCount` must be a power of two (2/4/8/16).
- Match format: 2×10min → (if tied) 2×3m+2s → (if tied) 1 armageddon; an armageddon draw counts as a Black win.

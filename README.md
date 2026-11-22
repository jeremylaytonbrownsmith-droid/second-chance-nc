# Second Chance Pet Adoptions — Auction & Giving System

A gala auction and giving system: one record of truth per donor per
event, syncing clean gift records into eTapestry, replacing a
spreadsheet-and-hand-keying workflow.

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — how it's built: directory
  map, data model, the adapter pattern, auth, testing, deploying, and the
  gotchas worth not re-discovering. Start here to get oriented.
- **[CLAUDE.md](./CLAUDE.md)** — the hard, non-negotiable rules (money,
  tax, deletes) and build conventions.

## Getting started

```bash
cp .env.example .env   # fill in at least DATABASE_URL
npm install
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Everything runs
fully demo-functional with nothing beyond `DATABASE_URL` set — every
external integration (eTapestry, email, SMS, payments) defaults to a
fake adapter that records what it would have done instead of requiring
real credentials. See `.env.example` for what each one needs to turn on
for real.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `prisma migrate deploy` + production build |
| `npm test` | Unit/integration tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) — needs a running dev server and a reachable database |
| `npm run lint` | ESLint |

CI (`.github/workflows/ci.yml`) runs all of the above against a real
Postgres service container on every push.

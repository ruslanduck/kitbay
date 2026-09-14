# Kitbay

Rental and scheduling for a photo/film studio: what gear exists, which physical
unit is on which job, who is on set and when, and the paperwork that follows —
estimate, pull sheet, activity trail.

## Run it

```bash
npm install
npm run dev
```

Opens on `http://localhost:5173/kitbay/`.

`.env.development.local` pins the dev server to **local mode**: seeded data in
`localStorage`, no account, no network. That is deliberate — several flows do
real inventory writes, and pointing dev at the live database means ordinary
clicking around edits the studio's own register.

## Two data sources, one app

`VITE_DATA_SOURCE` switches `src/data/repository.js`:

| value      | where the data lives                   | used by                    |
| ---------- | -------------------------------------- | -------------------------- |
| `local`    | seeds in `src/data/*` → `localStorage`  | `npm run dev`              |
| `supabase` | Postgres + Auth (schema in `supabase/`) | the deployed build         |

The store (`src/store.js`) hydrates from whichever one is configured, so every
screen is written once.

## Checks

```bash
npm run test:lib    # assertions over the pure modules in src/lib, under plain Node
npm run lint        # oxlint, with no-undef on
npm run audit:tdz   # a hook initializer reading a const declared below it
npm run audit:jsx   # a JSX prop whose value identifier its own file never declares
```

All four run in CI ahead of the build, and again in the Vercel build command —
a failing assertion does not deploy.

## Deploy

Push to `main`. Two hosts are wired and both are correct from the same repo:

- **Vercel** — `vercel.json` carries the build; `base` becomes `/`.
- **GitHub Pages** — `.github/workflows/deploy.yml`; `base` becomes the repo
  name, read from `GITHUB_REPOSITORY` so a rename cannot break it.

Confirm a deploy through the CDN rather than the GitHub API, and check CONTENT:
fetch the served `index-*.js` and grep it for a string unique to the new code.

## Database

Migrations live in `supabase/migrations/`. Apply with

```bash
set -a; . ./.env.local; set +a; echo y | npx supabase db push
```

Nothing is ever deleted: every table with its own identity archives
(`archived_at`), and the app is not granted DELETE.

## Accounts

Sign-in only — there is no self-registration. Provision one with

```bash
NEW_USER_PASSWORD=… npm run user:add -- --email name@studio.com --name "Full Name"
```

The password is read from the environment, never hardcoded and never printed.

## Secrets

`.env.local` (gitignored) holds the service-role key and the database password.
`.env.production` carries only the public URL and the anon key — the security
boundary is Row Level Security, not that file.

**This repository is public**, so the studio's own inventory export is not in
it: `scripts/import-inventory.mjs` takes the file by `--file` and is dry-run by
default.

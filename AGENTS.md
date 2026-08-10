<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project

**Simulasi OSN AI 2026** — Next.js App Router app for EKKA/OSN AI study, practice, timed mocks, AI assistants, and admin analytics.

- Repo: `jrrqd/simulasi-osn-ai`
- Stack: Next.js 16, React 19, Drizzle, Better Auth, AI SDK + MiniMax (OpenAI-compatible)
- Production: VPS (`/var/www/osnai`, build at `/opt/osnai-build`). Prefer local `npm run build` / `npm run lint` unless the user asks to deploy.

## Cursor Cloud specific instructions

### Boot / verify
1. Dependencies install via `.cursor/environment.json` (`npm ci || npm install`).
2. Prefer PGlite for cloud: set `USE_PGLITE=true` (see `.env.example`). Do not require VPS Postgres unless secrets are configured. The app self-migrates the PGlite schema on first `getDb()` (`src/db/index.ts`) — no `db:push`/`db:migrate` needed. PGlite is **in-memory by default**, so the seeded admin and any registered users are wiped on every dev-server restart unless you set `PGLITE_DATA_DIR` (e.g. `PGLITE_DATA_DIR=.data/pglite`) to persist.
   - `.env.local` is required and gitignored; copy `.env.example` and fill `BETTER_AUTH_SECRET` + `CREDENTIALS_ENCRYPTION_KEY` (`openssl rand -hex 32`). No external services (DB/Redis) are needed to boot.
3. Dev server: `npm run dev -- --hostname 0.0.0.0 --port 3000` (also started as a terminal in environment.json).
4. Before claiming a fix: `npx tsc --noEmit` and/or `npm run lint`. For UI changes, exercise the flow in the browser when possible.

### Secrets (Cursor Dashboard → Cloud Agents)
Add as needed (never commit real values):
- `BETTER_AUTH_SECRET`, `CREDENTIALS_ENCRYPTION_KEY`
- `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` (use the cloud preview URL if different)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_EMAILS`
- `MINIMAX_API_KEY` (and optional `MINIMAX_BASE_URL`, `MINIMAX_MODEL_ID`) for AI generation/chat
- Optional: `DATABASE_URL` + `USE_PGLITE=false` if using real Postgres

### Important AI generation notes
- MiniMax-M3 does **not** support JSON schema structured outputs reliably.
- Problem generation uses plain chat JSON + local repair in `src/lib/ai/parse-json-object.ts` and `src/lib/ai/generate-problem.ts`.
- Do not reintroduce `Output.object` for MiniMax problem generation without verifying parse success.
- Mock AI generation path: `src/app/api/ai/generate-mock/route.ts`.

### Deploy (only when user asks)
- SSH key: on a local machine it's typically `~/Downloads/lighthouse.pem`. In Cursor Cloud that path does not exist — instead provide the private key via the `LIGHTHOUSE_SSH_KEY` secret and materialize it: `printf '%s\n' "$LIGHTHOUSE_SSH_KEY" > ~/.ssh/lighthouse.pem && chmod 600 ~/.ssh/lighthouse.pem`, then `ssh -i ~/.ssh/lighthouse.pem ubuntu@43.134.182.44`.
- Host `ubuntu@43.134.182.44`. The VPS runs the app as systemd unit `osnai.service` (Next.js on port 3000).
- Sync into `/opt/osnai-build`, `npm run build`, rsync standalone to `/var/www/osnai`, `systemctl restart osnai`
- Env on VPS: `/etc/osnai/env`
- **Landing changelog:** before every deploy that ships new code, add a entry at the top of `src/lib/whats-new.ts` (WIB timestamp + short story). `./scripts/deploy.sh` runs `npm run deploy:check` and blocks if `whats-new.ts` was not updated since the local `deploy/production` tag. Redeploys with no code changes pass. Emergency override: `SKIP_WHATS_NEW_CHECK=1 ./scripts/deploy.sh`.

## Recent work / handoff (continue from here)

Shipped or in progress on the working tree (verify git status):
- Onboarding + user profile fields
- Performance dashboard readiness + session trend; floating Performance assistant
- Assistant pet FAB (Jacky/Ichi) on Study + Performance; settings picker
- Copy button on AI assistant answers (`AssistantMessageBubble`)
- MiniMax JSON parse hardening for **Generate simulasi AI** (plain JSON + repair + retries)
- Admin student report readiness/mastery visuals
- Numeric scoring accepts `1/2`, `½`, `0,5` as 0.5

If the user continues on the road, prefer small PR-sized commits and keep cloud agents on feature branches off `main`.

# Pharmasync

## Local setup

The browser app uses the Express API as its only source of authoritative data. Copy `.env.example` to `.env`, set `DATABASE_URL` to a PostgreSQL database, then initialize it:

```bash
pnpm install
pnpm db:migrate
```

Run the migration before starting the API on a new or upgraded database. API startup does not apply schema changes or repair legacy columns; use the explicit migration command for those operations.

Run the API and Vite in separate terminals with `pnpm api` and `pnpm dev`. Vite proxies `/api` requests to port `8787` by default. `pnpm typecheck`, `pnpm test`, and `pnpm build` are the project verification commands.

To run browser tests, install Playwright's Chromium and Linux runtime dependencies with `pnpm exec playwright install --with-deps chromium` on the host. The dependency install requires package-manager privileges; then run `pnpm test:e2e`.

The migration creates the tables, records its schema version, and skips demo seed rows that conflict with an existing ID, username, or barcode; it does not overwrite existing records. Demo accounts are `admin` / `admin123`, `pharmacist` / `pharma123`, and `cashier` / `cashier123`; replace them before any non-demo deployment.

`CLIENT_ORIGIN` must match the browser app's origin exactly: scheme, hostname, and port if present, with no path. For local Vite development, the example uses `http://localhost:4175`. In production, set it to the actual HTTPS app URL, for example `https://your-project.vercel.app`; do not use the API URL unless the browser app itself is served from that URL. If the app is served from multiple known origins, list them comma-separated. The API intentionally rejects production write requests such as login with `403 ORIGIN_REJECTED` when the request's `Origin` is not on this list. Add the exact deployed preview origin when testing a production API from a preview URL; wildcard origins are not supported. Serve production over HTTPS so the session cookie is secure.

An unauthenticated `GET /api/session` returns `401 UNAUTHORIZED` by design; it indicates there is no active login cookie yet. After a successful login, the API sets an HTTP-only session cookie and that request should return `200`.

Cashless POS methods support a dummy demo provider and hosted PayMongo checkout. Keep `PAYMENT_PROVIDER=dummy` for local demo behavior and set `DUMMY_PAYMENT_OUTCOME` to `success`, `pending`, `failure`, `cancelled`, or `timeout` to exercise controlled outcomes. For real checkout, set `PAYMENT_PROVIDER=paymongo`, `PAYMONGO_BASE_URL=https://api.paymongo.com/v1`, and `PAYMONGO_SECRET_KEY`. In the PayMongo dashboard, register `https://<your-app-origin>/api/webhooks/paymongo`, subscribe to `checkout_session.payment.paid`, and set `PAYMONGO_WEBHOOK_SECRET` to that endpoint's signing secret. The endpoint verifies the raw request signature and confirms payment details with PayMongo before updating inventory; status checks remain available as a fallback. In production, simulated cashless checkout is disabled unless `ALLOW_SIMULATED_PAYMENTS=true` is explicitly set. No card or wallet credentials are collected by the demo flow. Production backup/restore, purchase receiving, and several admin workflows are not configured by this demo implementation and must not be treated as production-ready.

Selecting `Card` in the POS opens a simulated tap/insert terminal. Confirming it records a paid `SIMULATED_CARD` sale and updates inventory, but does not read card data or contact a processor. In production, enable this demo behavior explicitly with `ALLOW_SIMULATED_PAYMENTS=true`; GCash, Maya, and QRPh continue to use the configured payment provider.

For local PayMongo testing, set `PAYMENT_PROVIDER=paymongo`, `PAYMONGO_SECRET_KEY` to the matching PayMongo test secret key, and `CLIENT_ORIGIN=http://localhost:4175` in `.env`; `PAYMONGO_BASE_URL` defaults to `https://api.paymongo.com/v1`. Set `PAYMONGO_WEBHOOK_SECRET` only when testing webhooks. Keep `DATABASE_URL` pointed at the intended PostgreSQL database and use test keys for test checkouts.

For Vercel, add these under **Project Settings > Environment Variables** for each environment where you run the app, then redeploy:

- `DATABASE_URL`: the PostgreSQL connection URI, with SSL required and Vercel permitted by the database network/access rules.
- `CLIENT_ORIGIN`: the exact browser-app origin, for example `https://your-project.vercel.app` (no path or trailing slash).
- `PAYMENT_PROVIDER`: `paymongo`.
- `PAYMONGO_SECRET_KEY`: the PayMongo test or live secret key matching the desired payment mode.
- `PAYMONGO_WEBHOOK_SECRET`: the signing secret for the registered `/api/webhooks/paymongo` endpoint.
- `PAYMONGO_BASE_URL`: optional; defaults to `https://api.paymongo.com/v1`.
- `DB_POOL_MAX`: optional; keep at `1` for the Vercel serverless API unless the database provider recommends another pool size.

Vercel supplies `NODE_ENV` and manages `PORT`; do not add either manually. `ALLOW_SIMULATED_PAYMENTS` should remain unset or `false` for real production payments. Configure the webhook URL and secret from the same PayMongo mode (test or live) as the secret key. Never put secret keys in `VITE_*` variables because they would be exposed to the browser.

Admin backups use the system `pg_dump` executable, write private custom-format files below `BACKUP_DIRECTORY`, and record status/metadata in PostgreSQL. Install the PostgreSQL client tools on the API host. To test a restore, create a disposable database and use `pg_restore --no-owner --no-privileges --dbname="$RESTORE_DATABASE_URL" "$BACKUP_FILE"`; never restore over the live database. Restore verification remains an operator/deployment step.

For Clever Cloud, use `POSTGRESQL_ADDON_URI` and keep the application and PostgreSQL addon in the same region where possible. Use `pnpm start` for the API; it reads Clever Cloud's `PORT` variable automatically.
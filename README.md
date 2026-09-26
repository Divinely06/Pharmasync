# Pharmasync

## Local setup

The browser app uses the Express API as its only source of authoritative data. Copy `.env.example` to `.env`, set `DATABASE_URL` to a PostgreSQL database, then initialize it:

```bash
pnpm install
pnpm db:migrate
```

Run the API and Vite in separate terminals with `pnpm api` and `pnpm dev`. Vite proxies `/api` requests to port `8787` by default. `pnpm typecheck`, `pnpm test`, and `pnpm build` are the project verification commands.

The migration creates the tables, records its schema version, and skips demo seed rows that conflict with an existing ID, username, or barcode; it does not overwrite existing records. Demo accounts are `admin` / `admin123`, `pharmacist` / `pharma123`, and `cashier` / `cashier123`; replace them before any non-demo deployment. In production, set `CLIENT_ORIGIN` to the exact browser origin and serve over HTTPS so the session cookie is secure.

Cashless POS methods are simulations, not real payment collection. Set `DUMMY_PAYMENT_OUTCOME` to `success`, `pending`, `failure`, `cancelled`, or `timeout` to exercise the controlled demo outcomes. No card or wallet credentials are collected. The real-provider adapter, payment webhooks, production backup/restore, purchase receiving, and several admin workflows are not configured by this demo implementation and must not be treated as production-ready.

Admin backups use the system `pg_dump` executable, write private custom-format files below `BACKUP_DIRECTORY`, and record status/metadata in PostgreSQL. Install the PostgreSQL client tools on the API host. To test a restore, create a disposable database and use `pg_restore --no-owner --no-privileges --dbname="$RESTORE_DATABASE_URL" "$BACKUP_FILE"`; never restore over the live database. Restore verification remains an operator/deployment step.

For Clever Cloud, use `POSTGRESQL_ADDON_URI` and keep the application and PostgreSQL addon in the same region where possible. Use `pnpm start` for the API; it reads Clever Cloud's `PORT` variable automatically.
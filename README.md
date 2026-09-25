# Pharmasync

## PostgreSQL setup

The application now includes a PostgreSQL API in `152-reference/server`.

### Clever Cloud

1. In Clever Cloud, create or open the PostgreSQL addon and attach it to the application running this project.
2. Deploy the repository with `152-reference` as the application root, or configure the build/start commands from that directory.
3. Clever Cloud exposes the database as `POSTGRESQL_ADDON_URI`; this API reads that variable automatically. You do not need to paste the password into the source code.
4. Run the migration once from a shell that has the addon variable available:

```bash
cd 152-reference
POSTGRESQL_ADDON_URI='your Clever Cloud PostgreSQL URI' pnpm db:migrate
```

For a Clever Cloud application, use `pnpm start` as the run command. The API automatically uses Clever Cloud's `PORT` variable. Keep the database addon and application in the same Clever Cloud region when possible.

1. Copy `152-reference/.env.example` to `152-reference/.env`.
2. Set `DATABASE_URL` to the connection string from Clever Cloud. Keep `sslmode=require` for Clever Cloud PostgreSQL.
3. Initialize the empty database:

```bash
cd 152-reference
pnpm db:migrate
```

This creates the pharmacy tables and inserts the demo accounts and reference medicines. Start the API with `pnpm api`; it listens on port `8787` by default. Check the connection with `curl http://localhost:8787/api/health`.

Demo accounts are `admin` / `admin123`, `pharmacist` / `pharma123`, and `cashier` / `cashier123`. Change these credentials before using the system outside a demo environment.
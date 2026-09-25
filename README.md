# Pharmasync

## PostgreSQL setup

The application now includes a PostgreSQL API in `152-reference/server`.

1. Copy `152-reference/.env.example` to `152-reference/.env`.
2. Set `DATABASE_URL` to the connection string from Clever Cloud. Keep `sslmode=require` for Clever Cloud PostgreSQL.
3. Initialize the empty database:

```bash
cd 152-reference
pnpm db:migrate
```

This creates the pharmacy tables and inserts the demo accounts and reference medicines. Start the API with `pnpm api`; it listens on port `8787` by default. Check the connection with `curl http://localhost:8787/api/health`.

Demo accounts are `admin` / `admin123`, `pharmacist` / `pharma123`, and `cashier` / `cashier123`. Change these credentials before using the system outside a demo environment.
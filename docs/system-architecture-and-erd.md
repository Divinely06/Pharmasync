# System Architecture and ERD

## System Architecture

```mermaid
%%{init: {"flowchart": {"curve": "linear"}}}%%
flowchart TB
    User[Pharmacy staff] --> Browser[Browser<br/>React 19 frontend]
    Browser -->|JSON requests to /api/*| Vite[Vite dev server<br/>serves frontend and proxies API]
    Vite -->|proxy to port 8787| API[Node.js runtime<br/>Express API]
    API --> Middleware[Authentication, roles,<br/>validation, rate limits]
    Middleware --> Routes[REST-style JSON routes]
    Routes --> Modules[Application logic<br/>inventory, payments, backups]
    Modules --> Pool[PostgreSQL connection pool<br/>node-postgres / pg]
    Pool -->|SQL| DB[(PostgreSQL database)]
    Migration[pnpm db:migrate<br/>schema.sql and seed.sql] --> DB
    Modules --> Provider{Configured payment provider}
    Provider --> PayMongo[PayMongo API<br/>optional]
    API --> Webhook[PayMongo webhook endpoint<br/>POST /api/webhooks/paymongo]
    PayMongo -->|webhook POST| Webhook
    Modules --> Backup[Backup files<br/>pg_dump or logical JSON]
```

In local development, Vite serves the React frontend and proxies `/api` requests to the Express API. The API returns JSON and uses PostgreSQL through `pg`. `pnpm db:migrate` applies the schema and demo seed data. Payment processing is selected by environment configuration; backups use database backup utilities and files on the API host.

## Entity Relationship Diagram

The diagram shows the database-enforced foreign keys declared in `db/schema.sql`. It is a single top-down diagram with straight connectors. Invisible layout links keep the tables in a vertical sequence; they are not database relationships. Entity fields are representative identifiers and relationship columns, not every column.

```mermaid
%%{init: {"flowchart": {"curve": "linear"}}}%%
flowchart TB
    USERS["USERS<br/>PK id<br/>username, email, role"]
    SESSIONS["SESSIONS<br/>PK token_hash<br/>FK user_id<br/>expires_at"]
    SUPPLIERS["SUPPLIERS<br/>PK id<br/>supplier_name"]
    MEDICINES["MEDICINES<br/>PK id<br/>UK barcode<br/>optional FK supplier_id<br/>generic_name, quantity, unit_price"]
    MEDICINE_BATCHES["MEDICINE_BATCHES<br/>PK id<br/>FK medicine_id<br/>batch_number, quantity, expiration_date"]
    SALES["SALES<br/>PK id<br/>FK cashier_id<br/>idempotency_key, total_amount, status"]
    SALE_ITEMS["SALE_ITEMS<br/>PK id<br/>FK sale_id, medicine_id<br/>quantity, unit_price"]
    SALE_ITEM_BATCHES["SALE_ITEM_BATCHES<br/>composite PK/FK sale_item_id + batch_id<br/>quantity"]
    PURCHASES["PURCHASES<br/>PK id<br/>FK supplier_id<br/>reference_number, status, total_amount"]
    PURCHASE_ITEMS["PURCHASE_ITEMS<br/>PK id<br/>FK purchase_id, medicine_id<br/>quantity, batch_number"]
    PAYMENT_RECORDS["PAYMENT_RECORDS<br/>PK id<br/>FK sale_id<br/>provider_reference, status, amount"]
    PAYMENT_EVENTS["PAYMENT_EVENTS<br/>PK id<br/>FK payment_id, performed_by<br/>status, metadata"]
    INVENTORY_TRANSACTIONS["INVENTORY_TRANSACTIONS<br/>PK id<br/>FK medicine_id, performed_by<br/>transaction_type, quantity"]
    AUDIT_LOGS["AUDIT_LOGS<br/>PK id<br/>optional FK user_id<br/>action, entity_type, entity_id"]
    BACKUP_HISTORY["BACKUP_HISTORY<br/>PK id<br/>optional FK requested_by<br/>status, file_name"]
    SCHEMA_MIGRATIONS["SCHEMA_MIGRATIONS<br/>PK version<br/>applied_at"]

    USERS -->|one to many| SESSIONS
    SUPPLIERS -->|one to many; medicine supplier is optional| MEDICINES
    MEDICINES -->|one to many| MEDICINE_BATCHES
    USERS -->|one to many| SALES
    SALES -->|one to many| SALE_ITEMS
    MEDICINES -->|one to many| SALE_ITEMS
    SALE_ITEMS -->|one to many| SALE_ITEM_BATCHES
    MEDICINE_BATCHES -->|one to many| SALE_ITEM_BATCHES
    SUPPLIERS -->|one to many| PURCHASES
    PURCHASES -->|one to many| PURCHASE_ITEMS
    MEDICINES -->|one to many| PURCHASE_ITEMS
    SALES -->|one to many| PAYMENT_RECORDS
    PAYMENT_RECORDS -->|one to many| PAYMENT_EVENTS
    USERS -->|optional actor; one to many events| PAYMENT_EVENTS
    MEDICINES -->|one to many| INVENTORY_TRANSACTIONS
    USERS -->|one to many| INVENTORY_TRANSACTIONS
    USERS -->|optional actor; one to many logs| AUDIT_LOGS
    USERS -->|optional requester; one to many backups| BACKUP_HISTORY

    USERS ~~~ SUPPLIERS
    SUPPLIERS ~~~ MEDICINES
    MEDICINES ~~~ PURCHASES
    PURCHASES ~~~ SALES
    SALES ~~~ SESSIONS
    SESSIONS ~~~ MEDICINE_BATCHES
    MEDICINE_BATCHES ~~~ PURCHASE_ITEMS
    PURCHASE_ITEMS ~~~ SALE_ITEMS
    SALE_ITEMS ~~~ PAYMENT_RECORDS
    PAYMENT_RECORDS ~~~ INVENTORY_TRANSACTIONS
    INVENTORY_TRANSACTIONS ~~~ SALE_ITEM_BATCHES
    SALE_ITEM_BATCHES ~~~ PAYMENT_EVENTS
    PAYMENT_EVENTS ~~~ AUDIT_LOGS
    AUDIT_LOGS ~~~ BACKUP_HISTORY
    BACKUP_HISTORY ~~~ SCHEMA_MIGRATIONS
```
```

## Relationship Notes

- A medicine may have no supplier; `medicines.supplier_id` is nullable.
- A sale item can be fulfilled from multiple medicine batches. `sale_item_batches` is the junction table and uses `(sale_item_id, batch_id)` as its composite primary key.
- `inventory_transactions.reference_id` is a text reference without a declared foreign key, so its target depends on the transaction type.
- `purchases.created_by` is stored as text but has no declared foreign-key constraint in the current schema.
- `schema_migrations` records schema versions and has no relationship to the business entities.

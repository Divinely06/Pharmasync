# Pharmasync Implementation Backlog

This document tracks the work required to turn the current prototype into a functioning PostgreSQL-backed pharmacy management system. It is intentionally organized by dependency order: establish one source of truth first, then add workflows, then harden and verify them.

## Current Baseline

- Frontend: React, Vite, Tailwind CSS, with a typed API client and no browser storage for authoritative data.
- Backend: Express API in `server/index.ts` with durable cookie sessions, role checks, medicine/supplier/user writes, and transactional sales.
- Database: PostgreSQL schema and separate demo seed in `db/schema.sql` and `db/seed.sql`.
- Cashless checkout is an explicitly labelled, environment-controlled dummy simulation. It is not a real payment integration.
- This is a verified demo foundation, not the Definition of Done. Purchase/receiving and stock workflows, complete user administration, report/audit APIs, production payment lifecycle/webhooks, real backup/restore, and broad automated integration/browser coverage remain open.

## Priority 0: Establish One Source Of Truth

- [x] Remove `localStorage` as the primary application database.
- [ ] Add a typed frontend API client for authentication, state queries, CRUD, POS, inventory, reports, audit, and backup.
- [ ] Add loading, empty, unauthorized, database-error, and retry states.
- [x] Keep only display preferences in browser storage; never store passwords, access tokens, or authoritative records there. (No application data is currently persisted in browser storage.)
- [ ] Add a single authenticated session provider and role/permission helper.
- [x] Decide whether the browser uses secure HTTP-only cookies or short-lived bearer tokens with a refresh mechanism. Prefer HTTP-only, secure, same-site cookies for a browser deployment. (Uses durable server-side sessions and HTTP-only, same-site cookies; secure cookies are enabled in production.)

## Database And Migrations

- [x] Add `purchases` and `purchase_items` tables with foreign keys, status, totals, and indexes.
- [x] Add payment records or a payment-attempt table for cashless checkout. Do not overload `sales` with provider-specific fields.
- [x] Add payment status values such as `PENDING`, `AUTHORIZED`, `PAID`, `FAILED`, `CANCELLED`, `EXPIRED`, and `REFUNDED`.
- [x] Add a provider transaction/reference ID with a uniqueness constraint.
- [x] Add a backup history table containing requested time, completion time, status, file metadata, requester, and error-safe message.
- [x] Add indexes for barcode, medicine search, expiration, quantity/reorder level, supplier, sale date, and audit filters.
- [x] Add migration versioning and separate seed data from schema creation.
- [ ] Add database constraints for payment methods, totals, positive quantities, valid dates, and valid status transitions.
- [ ] Model batch-level stock before implementing receiving or expiry workflows if one medicine can have multiple batches.

## Authentication, Authorization, And Security

- [x] Connect the frontend login form to `POST /api/login`.
- [x] Add logout and server-side session invalidation.
- [x] Replace the in-memory session map with a durable session strategy or signed short-lived tokens with rotation.
- [x] Record successful and failed login attempts, account status failures, logout, and authorization failures.
- [x] Add centralized `requireAuth` and `requireRole` middleware.
- [x] Enforce authorization on every resource, not only on sales.
- [x] Restrict `/api/state` so each role receives only the data it is allowed to see.
- [ ] Add request validation using typed schemas for every write endpoint.
- [x] Add rate limiting, security headers, strict CORS, and safe production error handling.
- [x] Never return password hashes, secrets, provider keys, or database errors.
- [x] Use server-derived user identity for audit records and payment operations.
- [ ] Add tests proving cashier, pharmacist, and admin boundaries.

## Backend API And Domain Services

- [ ] Split `server/index.ts` into routes, middleware, validation, database helpers, domain services, and configuration.
- [ ] Add medicine list/search/detail/create/update/archive endpoints.
- [ ] Add supplier list/search/detail/create/update/deactivate endpoints.
- [ ] Add user list/create/update/deactivate/reset-password endpoints for admins.
- [ ] Add purchase order and receiving endpoints using database transactions.
- [ ] Add inventory adjustment, damaged, expired, return, and stock-movement endpoints.
- [ ] Add server-side report queries for dashboard, sales, inventory value, low stock, and expiration alerts.
- [ ] Add paginated and filterable audit-log endpoints for admins.
- [ ] Add receipt detail endpoint and a server-generated printable receipt view or print-safe client view.
- [x] Return stable error codes and user-safe messages instead of raw exception text.
- [x] Make sales idempotent so a repeated request cannot create duplicate transactions.
- [x] Reject expired or inactive medicines at checkout according to the pharmacy policy.

## Cashless Payments: Dummy First, Real Later

### Payment Contract

Create a provider-independent interface such as:

```ts
export type PaymentMethod = "CASH" | "CARD" | "E_WALLET";
export type PaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED";

export type PaymentRequest = {
  saleId: string;
  amount: number;
  currency: string;
  method: Exclude<PaymentMethod, "CASH">;
  idempotencyKey: string;
};

export type PaymentResult = {
  status: PaymentStatus;
  provider: string;
  providerReference: string | null;
  checkoutUrl?: string;
  failureCode?: string;
};

export interface PaymentProvider {
  createPayment(request: PaymentRequest): Promise<PaymentResult>;
  getPayment(providerReference: string): Promise<PaymentResult>;
  cancelPayment(providerReference: string): Promise<PaymentResult>;
  refundPayment(providerReference: string, amount?: number): Promise<PaymentResult>;
}
```

### Dummy Provider

- [ ] Implement `DummyPaymentProvider` behind an environment-selected provider name.
- [x] Provide explicit demo outcomes: success, pending, failure, cancelled, and timeout.
- [x] Make dummy payments visibly labelled as simulation in the UI and receipt.
- [ ] Persist every attempt and status transition in PostgreSQL.
- [ ] Require an idempotency key and return the same result for a repeated key.
- [ ] Never mark a sale as completed until the payment is `PAID` or a valid cash payment is confirmed.
- [ ] Add a test-only endpoint or controlled fixture, never a hidden production bypass.

### Real Provider Adapter

- [ ] Choose the provider based on deployment country, business account availability, fees, webhook support, and sandbox access.
- [ ] Keep provider API keys only in backend environment variables or a secret manager.
- [ ] Implement provider checkout/payment-intent creation, status lookup, cancellation, and refund.
- [ ] Verify webhook signatures and reject replayed or unknown events.
- [ ] Make webhook handling idempotent and store the raw event ID plus processed timestamp.
- [ ] Treat the provider as the payment authority; do not trust a browser success redirect.
- [ ] Add reconciliation for payments that remain pending or disagree with the provider.
- [ ] Never store full card numbers, CVV, or wallet credentials.
- [ ] Use the provider's hosted checkout or tokenization so sensitive payment data does not pass through this application.

### POS Cashless Workflow

1. Create a sale draft with locked prices and stock checks.
2. Create a payment attempt with an idempotency key.
3. For the dummy provider, show a controlled simulated result.
4. For a real provider, redirect to hosted checkout or display the provider payment instructions.
5. Accept payment completion only from a verified backend response or signed webhook.
6. In one database transaction, mark the payment paid, complete the sale, reduce stock, create inventory records, and write the audit record.
7. On failure, leave stock unchanged and keep the sale/payment attempt traceable.
8. Generate a receipt containing method, status, provider, reference, and any required notice.

## Frontend Features

- [ ] Split `src/App.tsx` into layout, auth, dashboard, POS, inventory, suppliers, users, reports, audit, and shared UI modules.
- [ ] Add real API hooks/services instead of direct state mutation.
- [x] Add role-aware navigation and route guards.
- [ ] Add debounced server-side medicine search with pagination and filters.
- [ ] Add barcode keyboard-input handling and camera scanning where browser support permits.
- [x] Show clear `Medicine not found` and `Insufficient stock available` messages.
- [ ] Add medicine reference panel with a clear non-medical-advice notice.
- [ ] Add receiving and stock adjustment workflows for authorized roles.
- [x] Add POS payment selection for cash and cashless methods.
- [ ] Add pending-payment, retry, failure, cancellation, and duplicate-submit states.
- [ ] Add printable thermal and standard receipts.
- [ ] Add accessible labels, focus states, keyboard navigation, and responsive tablet behavior.
- [x] Remove hardcoded dates, fake dashboard metrics, and local-only success messages.

## Audit, Backup, And Operations

- [ ] Audit every login, failed login, CRUD change, stock movement, sale, payment transition, refund, backup, and authorization failure.
- [ ] Make audit records append-only to ordinary application users; allow admin read/filter only.
- [ ] Implement a protected backend backup command using `pg_dump` or the managed provider backup API.
- [ ] Record backup result and metadata without exposing credentials or filesystem paths.
- [ ] Add backup restore instructions and verify a restore in a disposable database.
- [x] Add health checks for API and database readiness.
- [ ] Add structured server logging with secrets and payment data redacted.
- [ ] Add `.env.example` entries for database, session, client origin, payment provider, and backup configuration.

## Testing And Acceptance Criteria

- [ ] Unit-test validation, permissions, totals, payment state transitions, and idempotency.
- [ ] Integration-test migrations, login, logout, CRUD, inventory transactions, and PostgreSQL sales.
- [ ] Test all role boundaries, including direct API requests.
- [ ] Test dummy cashless success, pending, failure, cancellation, timeout, duplicate request, and refund.
- [ ] Test real-provider webhook signature and replay handling using the provider sandbox.
- [ ] Test insufficient stock and rollback after payment or database failure.
- [ ] Test barcode found/not-found flows.
- [ ] Test printable receipt contents.
- [ ] Test backups and restore verification.
- [ ] Run frontend build, formatter, unit tests, API tests, and a browser smoke test before declaring completion.

## Proposed File Organization

Use this target structure gradually; move code only when the corresponding behavior is migrated and tested.

```text
pharmasync/
  db/
    migrations/
    seed/
      seed.ts
    schema.sql
  server/
    app.ts
    config/
    db/
    middleware/
    routes/
      auth.routes.ts
      medicines.routes.ts
      suppliers.routes.ts
      users.routes.ts
      inventory.routes.ts
      sales.routes.ts
      payments.routes.ts
      reports.routes.ts
      audit.routes.ts
      backups.routes.ts
    services/
      auth.service.ts
      inventory.service.ts
      payment.service.ts
      receipt.service.ts
      backup.service.ts
    payments/
      payment-provider.ts
      dummy-payment.provider.ts
      real-payment.provider.ts
    validation/
    tests/
  src/
    app/
    components/
    features/
      auth/
      dashboard/
      pos/
      inventory/
      suppliers/
      users/
      reports/
      audit/
    lib/
      api-client.ts
      auth-client.ts
      permissions.ts
    types/
    test/
  docs/
    IMPLEMENTATION_BACKLOG.md
    OPERATIONS.md
```

## Recommended Implementation Order

1. Move this backlog into `docs/` once the docs directory is created.
2. Add migrations and split seed data from schema creation.
3. Build API configuration, validation, auth middleware, and a typed client.
4. Connect login and read-only medicine/POS data to PostgreSQL.
5. Implement medicine, supplier, user, purchase, and inventory APIs.
6. Implement the provider-independent payment contract and dummy provider.
7. Connect POS checkout, receipt generation, and audit logging.
8. Add real-provider sandbox integration and verified webhooks only after the dummy flow is reliable.
9. Add backups, reports, browser tests, security checks, and deployment documentation.
10. Remove the remaining localStorage and seeded frontend paths.

## Definition Of Done

The system is complete only when the frontend uses PostgreSQL-backed APIs for authoritative data, each role is enforced server-side, sales and inventory are atomic, cashless payments are provider-confirmed or explicitly simulated, audit records are durable, backups are real and tested, and the documented test suite passes.

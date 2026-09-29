-- public.payment_records definition
-- Drop table
-- DROP TABLE public.payment_records;

create table public.payment_records (
	id text not null,
	sale_id text null,
	"method" text null,
	status text null,
	provider text null,
	provider_reference text null,
	idempotency_key text null,
	amount numeric(12, 2) null,
	created_at timestamptz default now() not null,
	updated_at timestamptz default now() not null,
	refund_amount numeric(12, 2) null,
	constraint payment_records_amount_check check ((amount >= (0)::numeric)),
	constraint payment_records_created_at_not_null not null created_at,
	constraint payment_records_id_not_null not null id,
	constraint payment_records_method_check check ((method = any (array['CARD'::text,
'E_WALLET'::text]))),
	constraint payment_records_pkey primary key (id),
	constraint payment_records_refund_amount_check check (((refund_amount >= (0)::numeric)
and (refund_amount <= amount))),
	constraint payment_records_status_check check ((status = any (array['PENDING'::text,
'AUTHORIZED'::text,
'PAID'::text,
'FAILED'::text,
'CANCELLED'::text,
'EXPIRED'::text,
'REFUNDED'::text]))),
	constraint payment_records_updated_at_not_null not null updated_at
);

create unique index payment_records_idempotency_key_uidx on
public.payment_records
    using btree (idempotency_key);

create unique index payment_records_provider_reference_uidx on
public.payment_records
    using btree (provider_reference);

create index payment_records_sale_idx on
public.payment_records
    using btree (sale_id,
created_at);
-- Table Triggers

create trigger payment_status_transition_guard before
update
    of status on
    public.payment_records for each row execute function pharmasync_guard_payment_status_transition();
-- public.payment_records foreign keys

alter table public.payment_records add constraint payment_records_sale_id_fkey foreign key (sale_id) references public.sales(id);

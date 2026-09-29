-- public.sales definition
-- Drop table
-- DROP TABLE public.sales;

create table public.sales (
	id text not null,
	cashier_id text null,
	transaction_date timestamptz default now() not null,
	subtotal numeric(12, 2) null,
	discount numeric(12, 2) null,
	tax numeric(12, 2) null,
	total_amount numeric(12, 2) null,
	payment_method text null,
	amount_received numeric(12, 2) null,
	change_amount numeric(12, 2) null,
	status text null,
	idempotency_key text null,
	constraint sales_amounts_nonnegative_check check (((amount_received >= (0)::numeric)
and (change_amount >= (0)::numeric))),
	constraint sales_cash_received_check check (((payment_method <> 'Cash'::text)
or (status <> 'COMPLETED'::text)
or (amount_received >= total_amount))),
	constraint sales_discount_check check (((discount >= (0)::numeric)
and (discount <= subtotal))),
	constraint sales_id_not_null not null id,
	constraint sales_payment_method_check check ((payment_method = any (array['Cash'::text,
'GCash'::text,
'Maya'::text,
'Card'::text]))),
	constraint sales_pkey primary key (id),
	constraint sales_status_check check ((status = any (array['COMPLETED'::text,
'VOIDED'::text,
'PENDING'::text]))),
	constraint sales_subtotal_nonnegative_check check ((subtotal >= (0)::numeric)),
	constraint sales_tax_nonnegative_check check ((tax >= (0)::numeric)),
	constraint sales_total_nonnegative_check check ((total_amount >= (0)::numeric)),
	constraint sales_totals_check check (((discount <= subtotal)
and (total_amount = ((subtotal - discount) + tax)))),
	constraint sales_transaction_date_not_null not null transaction_date
);

create index sales_date_idx on
public.sales
    using btree (transaction_date);

create unique index sales_idempotency_key_uidx on
public.sales
    using btree (idempotency_key);
-- Table Triggers

create trigger sale_status_transition_guard before
update
    of status on
    public.sales for each row execute function pharmasync_guard_sale_status_transition();
-- public.sales foreign keys

alter table public.sales add constraint sales_cashier_id_fkey foreign key (cashier_id) references public.users(id);

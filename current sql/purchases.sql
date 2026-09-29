-- public.purchases definition
-- Drop table
-- DROP TABLE public.purchases;

create table public.purchases (
	id text not null,
	supplier_id text null,
	purchase_date timestamptz default now() not null,
	reference_number text null,
	total_amount numeric(12, 2) null,
	status text null,
	created_by text null,
	created_at timestamptz not null,
	updated_at timestamptz not null,
	constraint purchases_created_at_not_null not null created_at,
	constraint purchases_id_not_null not null id,
	constraint purchases_pkey primary key (id),
	constraint purchases_purchase_date_not_null not null purchase_date,
	constraint purchases_status_check check ((status = any (array['PENDING'::text,
'RECEIVED'::text,
'CANCELLED'::text]))),
	constraint purchases_total_amount_check check ((total_amount >= (0)::numeric)),
	constraint purchases_updated_at_not_null not null updated_at
);

create unique index purchases_reference_number_uidx on
public.purchases
    using btree (reference_number);

create index purchases_supplier_date_idx on
public.purchases
    using btree (supplier_id,
purchase_date);
-- Table Triggers

create trigger purchase_status_transition_guard before
update
    of status on
    public.purchases for each row execute function pharmasync_guard_purchase_status_transition();
-- public.purchases foreign keys

alter table public.purchases add constraint purchases_created_by_fkey foreign key (created_by) references public.users(id);

alter table public.purchases add constraint purchases_supplier_id_fkey foreign key (supplier_id) references public.suppliers(id);

-- public.inventory_transactions definition
-- Drop table
-- DROP TABLE public.inventory_transactions;

create table public.inventory_transactions (
	id text not null,
	medicine_id text null,
	transaction_type text null,
	quantity int4 not null,
	previous_quantity int4 not null,
	resulting_quantity int4 not null,
	reference_id text null,
	performed_by text null,
	occurred_at timestamptz default now() not null,
	notes text null,
	constraint inventory_transactions_id_not_null not null id,
	constraint inventory_transactions_occurred_at_not_null not null occurred_at,
	constraint inventory_transactions_pkey primary key (id),
	constraint inventory_transactions_previous_quantity_not_null not null previous_quantity,
	constraint inventory_transactions_quantity_not_null not null quantity,
	constraint inventory_transactions_resulting_quantity_not_null not null resulting_quantity,
	constraint inventory_transactions_type_check check ((transaction_type = any (array['PURCHASE'::text,
'SALE'::text,
'RETURN'::text,
'ADJUSTMENT'::text,
'EXPIRED'::text,
'DAMAGED'::text])))
);
-- public.inventory_transactions foreign keys

alter table public.inventory_transactions add constraint inventory_transactions_medicine_id_fkey foreign key (medicine_id) references public.medicines(id);

alter table public.inventory_transactions add constraint inventory_transactions_performed_by_fkey foreign key (performed_by) references public.users(id);

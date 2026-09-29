-- public.suppliers definition
-- Drop table
-- DROP TABLE public.suppliers;

create table public.suppliers (
	id text not null,
	supplier_name text null,
	contact_person text null,
	phone text null,
	email text null,
	address text null,
	status text null,
	created_at timestamptz default now() not null,
	updated_at timestamptz default now() not null,
	constraint suppliers_created_at_not_null not null created_at,
	constraint suppliers_id_not_null not null id,
	constraint suppliers_pkey primary key (id),
	constraint suppliers_status_check check ((status = any (array['ACTIVE'::text,
'INACTIVE'::text]))),
	constraint suppliers_updated_at_not_null not null updated_at
);

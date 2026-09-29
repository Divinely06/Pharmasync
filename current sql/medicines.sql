-- public.medicines definition
-- Drop table
-- DROP TABLE public.medicines;

create table public.medicines (
	id text not null,
	barcode text null,
	generic_name text null,
	brand_name text null,
	medicine_type text null,
	dosage_form text null,
	strength text null,
	prescription_required bool not null,
	description text null,
	dosage_information text null,
	precautions text null,
	contraindications text null,
	storage_information text null,
	supplier_id text null,
	unit_price numeric(12, 2) null,
	quantity int4 not null,
	reorder_level int4 not null,
	expiration_date date not null,
	batch_number text null,
	status text null,
	created_at timestamptz default now() not null,
	updated_at timestamptz default now() not null,
	constraint medicines_created_at_not_null not null created_at,
	constraint medicines_expiration_date_not_null not null expiration_date,
	constraint medicines_id_not_null not null id,
	constraint medicines_pkey primary key (id),
	constraint medicines_prescription_required_not_null not null prescription_required,
	constraint medicines_quantity_check check ((quantity >= 0)),
	constraint medicines_quantity_not_null not null quantity,
	constraint medicines_reorder_level_check check ((reorder_level >= 0)),
	constraint medicines_reorder_level_not_null not null reorder_level,
	constraint medicines_status_check check ((status = any (array['ACTIVE'::text,
'INACTIVE'::text]))),
	constraint medicines_unit_price_check check ((unit_price >= (0)::numeric)),
	constraint medicines_updated_at_not_null not null updated_at
);

create index medicines_barcode_idx on
public.medicines
    using btree (barcode);

create unique index medicines_barcode_uidx on
public.medicines
    using btree (barcode);

create index medicines_expiration_idx on
public.medicines
    using btree (expiration_date);

create index medicines_search_idx on
public.medicines
    using btree (generic_name,
brand_name,
barcode);

create index medicines_stock_idx on
public.medicines
    using btree (quantity,
reorder_level);

create index medicines_supplier_idx on
public.medicines
    using btree (supplier_id);
-- public.medicines foreign keys

alter table public.medicines add constraint medicines_supplier_id_fkey foreign key (supplier_id) references public.suppliers(id);

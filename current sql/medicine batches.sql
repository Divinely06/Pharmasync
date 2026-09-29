-- public.medicine_batches definition
-- Drop table
-- DROP TABLE public.medicine_batches;

create table public.medicine_batches (
	id text not null,
	medicine_id text null,
	batch_number text null,
	expiration_date date not null,
	quantity int4 not null,
	created_at timestamptz default now() not null,
	updated_at timestamptz default now() not null,
	constraint medicine_batches_created_at_not_null not null created_at,
	constraint medicine_batches_expiration_date_not_null not null expiration_date,
	constraint medicine_batches_id_not_null not null id,
	constraint medicine_batches_pkey primary key (id),
	constraint medicine_batches_quantity_check check ((quantity >= 0)),
	constraint medicine_batches_quantity_not_null not null quantity,
	constraint medicine_batches_updated_at_not_null not null updated_at
);

create index medicine_batches_fefo_idx on
public.medicine_batches
    using btree (medicine_id,
expiration_date)
where
(quantity > 0);

create unique index medicine_batches_medicine_batch_uidx on
public.medicine_batches
    using btree (medicine_id,
batch_number);
-- public.medicine_batches foreign keys

alter table public.medicine_batches add constraint medicine_batches_medicine_id_fkey foreign key (medicine_id) references public.medicines(id);

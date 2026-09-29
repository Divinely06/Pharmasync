-- public.sale_item_batches definition
-- Drop table
-- DROP TABLE public.sale_item_batches;

create table public.sale_item_batches (
	sale_item_id text not null,
	batch_id text not null,
	quantity int4 not null,
	constraint sale_item_batches_batch_id_not_null not null batch_id,
	constraint sale_item_batches_pkey primary key (sale_item_id, batch_id),
	constraint sale_item_batches_quantity_check check ((quantity > 0)),
	constraint sale_item_batches_quantity_not_null not null quantity,
	constraint sale_item_batches_sale_item_id_not_null not null sale_item_id
);

create index sale_item_batches_batch_idx on
public.sale_item_batches
    using btree (batch_id);
-- public.sale_item_batches foreign keys

alter table public.sale_item_batches add constraint sale_item_batches_batch_id_fkey foreign key (batch_id) references public.medicine_batches(id);

alter table public.sale_item_batches add constraint sale_item_batches_sale_item_id_fkey foreign key (sale_item_id) references public.sale_items(id);

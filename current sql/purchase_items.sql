-- public.purchase_items definition
-- Drop table
-- DROP TABLE public.purchase_items;

create table public.purchase_items (
	id text not null,
	purchase_id text null,
	medicine_id text null,
	quantity int4 not null,
	unit_cost numeric(12, 2) null,
	subtotal numeric(12, 2) null,
	batch_number text null,
	expiration_date date not null,
	constraint purchase_items_expiration_date_not_null not null expiration_date,
	constraint purchase_items_id_not_null not null id,
	constraint purchase_items_pkey primary key (id),
	constraint purchase_items_quantity_check check ((quantity > 0)),
	constraint purchase_items_quantity_not_null not null quantity,
	constraint purchase_items_subtotal_check check ((subtotal = ((quantity)::numeric * unit_cost))),
	constraint purchase_items_subtotal_nonnegative_check check ((subtotal >= (0)::numeric)),
	constraint purchase_items_unit_cost_check check ((unit_cost >= (0)::numeric))
);
-- public.purchase_items foreign keys

alter table public.purchase_items add constraint purchase_items_medicine_id_fkey foreign key (medicine_id) references public.medicines(id);

alter table public.purchase_items add constraint purchase_items_purchase_id_fkey foreign key (purchase_id) references public.purchases(id);

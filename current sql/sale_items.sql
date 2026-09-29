-- public.sale_items definition
-- Drop table
-- DROP TABLE public.sale_items;

create table public.sale_items (
	id text not null,
	sale_id text null,
	medicine_id text null,
	quantity int4 not null,
	unit_price numeric(12, 2) null,
	subtotal numeric(12, 2) null,
	constraint sale_items_id_not_null not null id,
	constraint sale_items_pkey primary key (id),
	constraint sale_items_quantity_check check ((quantity > 0)),
	constraint sale_items_quantity_not_null not null quantity,
	constraint sale_items_subtotal_check check ((subtotal = ((quantity)::numeric * unit_price))),
	constraint sale_items_subtotal_nonnegative_check check ((subtotal >= (0)::numeric)),
	constraint sale_items_unit_price_check check ((unit_price >= (0)::numeric))
);
-- public.sale_items foreign keys

alter table public.sale_items add constraint sale_items_medicine_id_fkey foreign key (medicine_id) references public.medicines(id);

alter table public.sale_items add constraint sale_items_sale_id_fkey foreign key (sale_id) references public.sales(id);

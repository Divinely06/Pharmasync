-- public.payment_events definition
-- Drop table
-- DROP TABLE public.payment_events;

create table public.payment_events (
	id text not null,
	payment_id text null,
	previous_status text null,
	status text null,
	event_type text null,
	performed_by text null,
	occurred_at timestamptz default now() not null,
	metadata jsonb not null,
	constraint payment_events_id_not_null not null id,
	constraint payment_events_metadata_not_null not null metadata,
	constraint payment_events_occurred_at_not_null not null occurred_at,
	constraint payment_events_pkey primary key (id),
	constraint payment_events_previous_status_check check (((previous_status is null)
or (previous_status = any (array['PENDING'::text,
'AUTHORIZED'::text,
'PAID'::text,
'FAILED'::text,
'CANCELLED'::text,
'EXPIRED'::text,
'REFUNDED'::text])))),
	constraint payment_events_status_check check ((status = any (array['PENDING'::text,
'AUTHORIZED'::text,
'PAID'::text,
'FAILED'::text,
'CANCELLED'::text,
'EXPIRED'::text,
'REFUNDED'::text])))
);

create index payment_events_payment_date_idx on
public.payment_events
    using btree (payment_id,
occurred_at);
-- public.payment_events foreign keys

alter table public.payment_events add constraint payment_events_payment_id_fkey foreign key (payment_id) references public.payment_records(id);

alter table public.payment_events add constraint payment_events_performed_by_fkey foreign key (performed_by) references public.users(id);

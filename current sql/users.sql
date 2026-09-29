-- public.users definition
-- Drop table
-- DROP TABLE public.users;

create table public.users (
	id text not null,
	username text null,
	password_hash text null,
	full_name text null,
	"role" text null,
	email text null,
	status text null,
	created_at timestamptz default now() not null,
	updated_at timestamptz default now() not null,
	last_login timestamptz null,
	constraint users_created_at_not_null not null created_at,
	constraint users_id_not_null not null id,
	constraint users_pkey primary key (id),
	constraint users_role_check check ((role = any (array['ADMIN'::text,
'PHARMACIST'::text,
'CASHIER'::text]))),
	constraint users_status_check check ((status = any (array['ACTIVE'::text,
'INACTIVE'::text]))),
	constraint users_updated_at_not_null not null updated_at
);

create unique index users_active_email_lower_uidx on
public.users
    using btree (lower(email))
where
(status = 'ACTIVE'::text);

create unique index users_active_username_lower_uidx on
public.users
    using btree (lower(username))
where
(status = 'ACTIVE'::text);

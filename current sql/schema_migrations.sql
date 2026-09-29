-- public.schema_migrations definition
-- Drop table
-- DROP TABLE public.schema_migrations;

create table public.schema_migrations (
	"version" int4 not null,
	applied_at timestamptz default now() not null,
	constraint schema_migrations_applied_at_not_null not null applied_at,
	constraint schema_migrations_pkey primary key (version),
	constraint schema_migrations_version_not_null not null version
);

create unique index schema_migrations_version_uidx on
public.schema_migrations
    using btree (version);

-- public.sessions definition
-- Drop table
-- DROP TABLE public.sessions;

create table public.sessions (
	token_hash text not null,
	user_id text not null,
	expires_at timestamptz not null,
	created_at timestamptz default now() not null,
	constraint sessions_created_at_not_null not null created_at,
	constraint sessions_expires_at_not_null not null expires_at,
	constraint sessions_pkey primary key (token_hash),
	constraint sessions_token_hash_not_null not null token_hash,
	constraint sessions_user_id_not_null not null user_id
);
-- public.sessions foreign keys

alter table public.sessions add constraint sessions_user_id_fkey foreign key (user_id) references public.users(id) on
delete
    cascade;

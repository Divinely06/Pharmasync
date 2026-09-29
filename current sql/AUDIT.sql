-- public.audit_logs definition
-- Drop table
-- DROP TABLE public.audit_logs;

create table public.audit_logs (
	id text not null,
	user_id text not null,
	"action" text not null,
	entity_type text not null,
	entity_id text not null,
	occurred_at timestamptz default now() not null,
	metadata jsonb default '{}'::jsonb not null,
	success bool not null,
	constraint audit_logs_action_not_null not null action,
	constraint audit_logs_entity_id_not_null not null entity_id,
	constraint audit_logs_entity_type_not_null not null entity_type,
	constraint audit_logs_id_not_null not null id,
	constraint audit_logs_metadata_not_null not null metadata,
	constraint audit_logs_occurred_at_not_null not null occurred_at,
	constraint audit_logs_pkey primary key (id),
	constraint audit_logs_success_not_null not null success,
	constraint audit_logs_user_id_not_null not null user_id
);

create index audit_date_idx on
public.audit_logs
    using btree (occurred_at);

create index audit_user_date_idx on
public.audit_logs
    using btree (user_id,
occurred_at);
-- Table Triggers

create trigger audit_logs_append_only before
delete
    or
update
    on
    public.audit_logs for each row execute function pharmasync_prevent_audit_mutation();
-- public.audit_logs foreign keys

alter table public.audit_logs add constraint audit_logs_user_id_fkey foreign key (user_id) references public.users(id);

-- public.backup_history definition
-- Drop table
-- DROP TABLE public.backup_history;

create table public.backup_history (
	id text not null,
	requested_at timestamptz default now() not null,
	completed_at timestamptz null,
	status text null,
	file_name text null,
	file_size_bytes int8 null,
	requested_by text null,
	error_message text null,
	file_format text null
);
-- public.backup_history foreign keys

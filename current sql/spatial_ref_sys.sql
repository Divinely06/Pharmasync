-- public.spatial_ref_sys definition
-- Drop table
-- DROP TABLE public.spatial_ref_sys;

create table public.spatial_ref_sys (
	srid int4 not null,
	auth_name varchar(256) null,
	auth_srid int4 null,
	srtext varchar(2048) null,
	proj4text varchar(2048) null,
	constraint spatial_ref_sys_srid_not_null not null srid
);

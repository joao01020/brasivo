select to_regclass('public.mandate_source_events') as mandate_source_events;
select to_regclass('public.mandate_sync_state') as mandate_sync_state;
select to_regclass('public.notifications') as notifications;
select column_name,data_type from information_schema.columns where table_schema='public' and table_name='notifications' order by ordinal_position;

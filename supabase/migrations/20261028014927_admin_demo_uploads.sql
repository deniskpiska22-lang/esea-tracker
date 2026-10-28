create table public.match_demo_uploads (
 id uuid primary key default gen_random_uuid(),
 match_id text not null references public.matches(id) on delete cascade,
 created_by uuid not null references public.profiles(id),
 object_path text not null unique,
 file_name text not null,
 size_bytes bigint not null check(size_bytes between 8 and 268435456),
 status text not null default 'uploading' check(status in ('uploading','pending','processing','retry','done','rejected')),
 attempts integer not null default 0,
 lease_token uuid, lease_until timestamptz,
 last_error text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.match_demo_uploads enable row level security;
revoke all on public.match_demo_uploads from public,anon,authenticated;
grant select on public.match_demo_uploads to authenticated;
grant all on public.match_demo_uploads to service_role;
create policy demo_upload_admin_read on public.match_demo_uploads for select to authenticated
 using(exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin));
create index demo_upload_due_idx on public.match_demo_uploads(updated_at)
 where status in ('pending','retry','processing');
create index demo_upload_match_idx on public.match_demo_uploads(match_id,created_at desc);

insert into storage.buckets(id,name,public,file_size_limit)
 values('match-demo-inbox','match-demo-inbox',false,268435456);
create policy demo_upload_admin_insert on storage.objects for insert to authenticated with check(
 bucket_id='match-demo-inbox'
 and exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin)
 and exists(select 1 from public.match_demo_uploads u where u.object_path=name
  and u.created_by=(select auth.uid()) and u.status='uploading' and u.created_at>now()-interval '2 hours')
);

create function forum_private.admin_prepare_demo_upload(p_match_id text,p_file_name text,p_size_bytes bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid(); v_path text; v_extension text;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin) then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 if p_file_name is null or length(p_file_name)>200 or p_file_name!~* '\.dem(\.gz|\.zst)?$'
  or p_size_bytes is null or p_size_bytes not between 8 and 268435456 then
  raise exception 'Use a DEM, DEM.GZ or DEM.ZST file up to 256 MB';
 end if;
 perform 1 from public.matches where id=p_match_id and status in ('FINISHED','MATCH_STATUS_FINISHED')
  and jsonb_typeof(map_scores)='array' and jsonb_array_length(map_scores)>0 for update;
 if not found then raise exception 'A finished match with recorded map scores is required'; end if;
 if (select count(*) from public.match_demo_uploads where match_id=p_match_id
  and status in ('uploading','pending','processing','retry') and created_at>now()-interval '24 hours')>=5 then
  raise exception 'Five demo files are already queued for this match';
 end if;
 v_extension:=substring(lower(p_file_name) from '(\.dem(?:\.gz|\.zst)?)$');
 v_path:=p_match_id||'/'||v_id::text||v_extension;
 insert into public.match_demo_uploads(id,match_id,created_by,object_path,file_name,size_bytes)
 values(v_id,p_match_id,(select auth.uid()),v_path,p_file_name,p_size_bytes);
 return jsonb_build_object('id',v_id,'path',v_path,'bucket','match-demo-inbox');
end $$;
revoke all on function forum_private.admin_prepare_demo_upload(text,text,bigint) from public,anon,authenticated;
grant execute on function forum_private.admin_prepare_demo_upload(text,text,bigint) to authenticated;
create function public.admin_prepare_demo_upload(p_match_id text,p_file_name text,p_size_bytes bigint)
returns jsonb language sql security invoker set search_path='' as $$
 select forum_private.admin_prepare_demo_upload(p_match_id,p_file_name,p_size_bytes);
$$;
revoke all on function public.admin_prepare_demo_upload(text,text,bigint) from public,anon,authenticated;
grant execute on function public.admin_prepare_demo_upload(text,text,bigint) to authenticated;

create function forum_private.admin_commit_demo_upload(p_upload_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_upload public.match_demo_uploads%rowtype;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin) then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 select * into v_upload from public.match_demo_uploads where id=p_upload_id and created_by=(select auth.uid()) for update;
 if not found or v_upload.status<>'uploading' then raise exception 'Upload is not awaiting a file'; end if;
 if not exists(select 1 from storage.objects where bucket_id='match-demo-inbox' and name=v_upload.object_path
  and (metadata->>'size')::bigint=v_upload.size_bytes) then raise exception 'The uploaded file size does not match'; end if;
 update public.match_demo_uploads set status='pending',updated_at=now() where id=p_upload_id;
 return true;
end $$;
revoke all on function forum_private.admin_commit_demo_upload(uuid) from public,anon,authenticated;
grant execute on function forum_private.admin_commit_demo_upload(uuid) to authenticated;
create function public.admin_commit_demo_upload(p_upload_id uuid) returns boolean
language sql security invoker set search_path='' as $$ select forum_private.admin_commit_demo_upload(p_upload_id); $$;
revoke all on function public.admin_commit_demo_upload(uuid) from public,anon,authenticated;
grant execute on function public.admin_commit_demo_upload(uuid) to authenticated;

create function forum_private.admin_abort_demo_upload(p_upload_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not exists(select 1 from public.profiles where id=(select auth.uid()) and is_admin) then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 update public.match_demo_uploads set status='rejected',last_error='Upload did not complete',updated_at=now()
 where id=p_upload_id and created_by=(select auth.uid()) and status='uploading';
 return found;
end $$;
revoke all on function forum_private.admin_abort_demo_upload(uuid) from public,anon,authenticated;
grant execute on function forum_private.admin_abort_demo_upload(uuid) to authenticated;
create function public.admin_abort_demo_upload(p_upload_id uuid) returns boolean
language sql security invoker set search_path='' as $$ select forum_private.admin_abort_demo_upload(p_upload_id); $$;
revoke all on function public.admin_abort_demo_upload(uuid) from public,anon,authenticated;
grant execute on function public.admin_abort_demo_upload(uuid) to authenticated;

create function public.claim_match_demo_upload() returns setof public.match_demo_uploads
language plpgsql security invoker set search_path='' as $$
begin
 return query update public.match_demo_uploads u set status='processing',attempts=u.attempts+1,
  lease_token=gen_random_uuid(),lease_until=now()+interval '15 minutes',updated_at=now()
 where u.id=(select q.id from public.match_demo_uploads q where q.status in ('pending','retry')
  or (q.status='processing' and q.lease_until<now()) order by q.updated_at limit 1 for update skip locked)
 returning u.*;
end $$;
revoke all on function public.claim_match_demo_upload() from public,anon,authenticated;
grant execute on function public.claim_match_demo_upload() to service_role;

create function public.finish_match_demo_upload(p_id uuid,p_lease_token uuid,p_result jsonb,p_error text,p_retry boolean default false)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_upload public.match_demo_uploads%rowtype; v_existing jsonb;
begin
 select * into v_upload from public.match_demo_uploads where id=p_id and status='processing'
  and lease_token=p_lease_token and lease_until>now() for update;
 if not found then return false; end if;
 if p_result is not null and p_error is null then
  select demo_round_stats into v_existing from public.matches where id=v_upload.match_id for update;
  if exists(select 1 from jsonb_array_elements(v_existing) r where r->>'map'=p_result->>'map'
   and (r->'teams',r->'halfLength',r->'version') is distinct from (p_result->'teams',p_result->'halfLength',p_result->'version')) then
   p_error:='This file conflicts with previously verified map statistics';
  else
   update public.matches set demo_round_stats=(select coalesce(jsonb_agg(r),'[]'::jsonb) from jsonb_array_elements(v_existing) r
    where r->>'map'<>p_result->>'map')||jsonb_build_array(p_result) where id=v_upload.match_id;
  end if;
 end if;
 update public.match_demo_uploads set status=case when p_error is null and p_result is not null then 'done'
  when p_retry and v_upload.attempts<3 then 'retry' else 'rejected' end,
  last_error=left(p_error,500),lease_token=null,lease_until=null,updated_at=now() where id=p_id;
 return true;
end $$;
revoke all on function public.finish_match_demo_upload(uuid,uuid,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.finish_match_demo_upload(uuid,uuid,jsonb,text,boolean) to service_role;

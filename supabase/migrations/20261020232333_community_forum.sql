-- Public reading; all writes go through authenticated, validated RPCs.
create schema if not exists forum_private;
revoke all on schema forum_private from public, anon, authenticated;
grant usage on schema forum_private to anon, authenticated;
create table forum_private.moderators (
 user_id uuid primary key references public.profiles(id) on delete cascade
);
-- Preserve the site's existing administrators without trusting editable user metadata.
insert into forum_private.moderators select id from public.profiles where is_admin;
create table forum_private.user_state (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 last_topic timestamptz, last_reply timestamptz, last_report timestamptz,
 blocked_until timestamptz
);
revoke all on all tables in schema forum_private from public, anon, authenticated;
alter table forum_private.moderators enable row level security;
alter table forum_private.user_state enable row level security;

create function forum_private.is_moderator() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from forum_private.moderators where user_id=(select auth.uid()));
$$;
revoke all on function forum_private.is_moderator() from public;
grant execute on function forum_private.is_moderator() to anon, authenticated;

-- Ordinary users must never be able to promote themselves through profile updates.
create function forum_private.protect_admin_flag() returns trigger language plpgsql set search_path='' as $$
begin
 if new.is_admin is distinct from old.is_admin and current_user not in ('postgres','service_role','supabase_admin') then
  raise exception 'Administrator permissions are managed by the server' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function forum_private.protect_admin_flag() from public, anon, authenticated;
create trigger protect_admin_flag before update on public.profiles for each row execute function forum_private.protect_admin_flag();

create table public.forum_topics (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id),
 title text not null check(char_length(btrim(title)) between 5 and 140),
 body text not null check(char_length(btrim(body)) between 10 and 10000),
 category text not null check(category in ('esea','recruitment','tactics','feedback')),
 language text not null check(language in ('ru','en','de','pt','es','fr','it')),
 pinned boolean not null default false, locked boolean not null default false, hidden boolean not null default false,
 reply_count integer not null default 0 check(reply_count>=0),
 created_at timestamptz not null default now(), last_activity_at timestamptz not null default now()
);
create table public.forum_posts (
 id uuid primary key default gen_random_uuid(),
 topic_id uuid not null references public.forum_topics(id) on delete cascade,
 user_id uuid not null references public.profiles(id),
 body text not null check(char_length(btrim(body)) between 1 and 10000),
 hidden boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.forum_reports (
 id uuid primary key default gen_random_uuid(),
 topic_id uuid not null references public.forum_topics(id) on delete cascade,
 post_id uuid references public.forum_posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id),
 reason text not null check(char_length(btrim(reason)) between 1 and 500),
 resolved boolean not null default false, created_at timestamptz not null default now()
);
create unique index forum_reports_unique_target on public.forum_reports(user_id,topic_id,coalesce(post_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index forum_topics_activity on public.forum_topics(pinned desc,last_activity_at desc,id) where not hidden;
create index forum_topics_category_activity on public.forum_topics(category,last_activity_at desc) where not hidden;
create index forum_topics_language_activity on public.forum_topics(language,last_activity_at desc) where not hidden;
create index forum_topics_author on public.forum_topics(user_id);
create index forum_posts_thread on public.forum_posts(topic_id,created_at,id);
create index forum_posts_author on public.forum_posts(user_id);
create index forum_reports_queue on public.forum_reports(resolved,created_at);
create index forum_reports_topic on public.forum_reports(topic_id);
create index forum_reports_post on public.forum_reports(post_id);
alter table public.forum_topics enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_reports enable row level security;
revoke all on public.forum_topics,public.forum_posts,public.forum_reports from public, anon, authenticated;
grant select on public.forum_topics,public.forum_posts to anon, authenticated;
grant select on public.forum_reports to authenticated;
create policy forum_topics_read on public.forum_topics for select to anon,authenticated using(not hidden or (select forum_private.is_moderator()));
create policy forum_posts_read on public.forum_posts for select to anon,authenticated using((not hidden and exists(select 1 from public.forum_topics t where t.id=topic_id and not t.hidden)) or (select forum_private.is_moderator()));
create policy forum_reports_read on public.forum_reports for select to authenticated using((select forum_private.is_moderator()));

create function forum_private.session_info() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('moderator',forum_private.is_moderator(),'blocked',coalesce((select blocked_until>now() from forum_private.user_state where user_id=auth.uid()),false));
$$;
revoke all on function forum_private.session_info() from public;
grant execute on function forum_private.session_info() to authenticated;
create function public.forum_session() returns jsonb language sql stable security invoker set search_path='' as $$ select forum_private.session_info(); $$;
revoke all on function public.forum_session() from public,anon;
grant execute on function public.forum_session() to authenticated;

create function forum_private.write(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); tid uuid; pid uuid; target public.forum_topics; post public.forum_posts; state forum_private.user_state;
 is_mod boolean; new_id uuid; stamp timestamptz:=clock_timestamp(); subject uuid;
begin
 if actor is null then raise exception 'FORUM_LOGIN_REQUIRED' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=actor) then raise exception 'FORUM_PROFILE_REQUIRED'; end if;
 is_mod:=forum_private.is_moderator();
 insert into forum_private.user_state(user_id) values(actor) on conflict do nothing;
 select * into state from forum_private.user_state where user_id=actor for update;
 if state.blocked_until>stamp then raise exception 'FORUM_BLOCKED' using errcode='42501'; end if;
 if p_action='create' then
  if state.last_topic>stamp-interval '60 seconds' then raise exception 'FORUM_RATE_LIMIT'; end if;
  insert into public.forum_topics(user_id,title,body,category,language) values(actor,btrim(p_payload->>'title'),btrim(p_payload->>'body'),p_payload->>'category',p_payload->>'language') returning id into new_id;
  update forum_private.user_state set last_topic=stamp where user_id=actor;
  return jsonb_build_object('id',new_id);
 end if;
 if p_action in ('block_user','unblock_user') then
  if not is_mod then raise exception 'FORUM_FORBIDDEN' using errcode='42501'; end if;
  subject:=(p_payload->>'user_id')::uuid;
  if exists(select 1 from forum_private.moderators where user_id=subject) then raise exception 'FORUM_FORBIDDEN'; end if;
  insert into forum_private.user_state(user_id,blocked_until) values(subject,case when p_action='block_user' then stamp+interval '7 days' end)
  on conflict(user_id) do update set blocked_until=excluded.blocked_until;
  return '{}'::jsonb;
 end if;
 if p_action='resolve_report' then
  if not is_mod then raise exception 'FORUM_FORBIDDEN' using errcode='42501'; end if;
  update public.forum_reports set resolved=true where id=(p_payload->>'id')::uuid;
  return '{}'::jsonb;
 end if;
 tid:=(p_payload->>'topic_id')::uuid;
 select * into target from public.forum_topics where id=tid for update;
 if not found or (target.hidden and not is_mod) then raise exception 'FORUM_NOT_FOUND'; end if;
 if p_action='reply' then
  if target.locked then raise exception 'FORUM_LOCKED'; end if;
  if state.last_reply>stamp-interval '10 seconds' then raise exception 'FORUM_RATE_LIMIT'; end if;
  insert into public.forum_posts(topic_id,user_id,body) values(tid,actor,btrim(p_payload->>'body')) returning id into new_id;
  update public.forum_topics set reply_count=reply_count+1,last_activity_at=stamp where id=tid;
  update forum_private.user_state set last_reply=stamp where user_id=actor;
  return jsonb_build_object('id',new_id);
 elsif p_action='report' then
  if state.last_report>stamp-interval '30 seconds' then raise exception 'FORUM_RATE_LIMIT'; end if;
  pid:=nullif(p_payload->>'post_id','')::uuid;
  if pid is not null and not exists(select 1 from public.forum_posts where id=pid and topic_id=tid and not hidden) then raise exception 'FORUM_NOT_FOUND'; end if;
  insert into public.forum_reports(topic_id,post_id,user_id,reason) values(tid,pid,actor,btrim(p_payload->>'reason')) on conflict do nothing;
  update forum_private.user_state set last_report=stamp where user_id=actor;
 elsif p_action='moderate_topic' then
  if not is_mod then raise exception 'FORUM_FORBIDDEN' using errcode='42501'; end if;
  update public.forum_topics set pinned=coalesce((p_payload->>'pinned')::boolean,pinned),locked=coalesce((p_payload->>'locked')::boolean,locked),hidden=coalesce((p_payload->>'hidden')::boolean,hidden) where id=tid;
 elsif p_action in ('hide_post','restore_post') then
  pid:=(p_payload->>'post_id')::uuid;
  select * into post from public.forum_posts where id=pid and topic_id=tid for update;
  if not found then raise exception 'FORUM_NOT_FOUND'; end if;
  if not is_mod and (post.user_id<>actor or p_action='restore_post') then raise exception 'FORUM_FORBIDDEN' using errcode='42501'; end if;
  update public.forum_posts set hidden=(p_action='hide_post') where id=pid;
  update public.forum_topics set reply_count=(select count(*) from public.forum_posts where topic_id=tid and not hidden),
    last_activity_at=greatest(created_at,coalesce((select max(created_at) from public.forum_posts where topic_id=tid and not hidden),created_at)) where id=tid;
 else raise exception 'FORUM_INVALID_ACTION';
 end if;
 return '{}'::jsonb;
end $$;
revoke all on function forum_private.write(text,jsonb) from public,anon;
grant execute on function forum_private.write(text,jsonb) to authenticated;
create function public.forum_write(p_action text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select forum_private.write(p_action,p_payload); $$;
revoke all on function public.forum_write(text,jsonb) from public,anon;
grant execute on function public.forum_write(text,jsonb) to authenticated;
grant all on public.forum_topics,public.forum_posts,public.forum_reports to service_role;
notify pgrst,'reload schema';

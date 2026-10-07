-- Extend the small indexed sitemap inventory; do not paginate the large matches table.
alter table public.seo_profile_urls drop constraint seo_profile_urls_kind_check;
alter table public.seo_profile_urls add constraint seo_profile_urls_kind_check check(kind in ('teams','players','matches'));
create sequence public.seo_match_position_seq;
insert into public.seo_profile_urls(kind,entity_id,position,url,updated_at)
 select 'matches',id,nextval('public.seo_match_position_seq'),'/match/'||id,updated_at
 from public.matches where nullif(team1_name,'') is not null and nullif(team2_name,'') is not null
 and status not in ('CANCELLED','CANCELED','MATCH_STATUS_CANCELLED','MATCH_STATUS_CANCELED','ABORTED','MATCH_STATUS_ABORTED') order by id;
-- This function is trigger-only, has no public execute grants and writes public URL metadata only.
create function public.sync_match_seo_url()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' then
  delete from public.seo_profile_urls where kind='matches' and entity_id=old.id;
  return old;
 end if;
 if nullif(new.team1_name,'') is null or nullif(new.team2_name,'') is null
 or new.status in ('CANCELLED','CANCELED','MATCH_STATUS_CANCELLED','MATCH_STATUS_CANCELED','ABORTED','MATCH_STATUS_ABORTED') then
  delete from public.seo_profile_urls where kind='matches' and entity_id=new.id;
  return new;
 end if;
 update public.seo_profile_urls set updated_at=new.updated_at where kind='matches' and entity_id=new.id;
 if not found then
  insert into public.seo_profile_urls(kind,entity_id,position,url,updated_at)
   values('matches',new.id,nextval('public.seo_match_position_seq'),'/match/'||new.id,new.updated_at);
 end if;
 return new;
end $$;
revoke all on function public.sync_match_seo_url() from public,anon,authenticated;
create trigger match_seo_url after insert or update of team1_name,team2_name,status,team1_score,team2_score,map_scores on public.matches
 for each row execute function public.sync_match_seo_url();
create trigger match_seo_url_delete after delete on public.matches
 for each row execute function public.sync_match_seo_url();

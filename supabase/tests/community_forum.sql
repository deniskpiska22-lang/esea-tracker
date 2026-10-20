-- Runs only inside a transaction; users, posts and moderation fixtures are rolled back.
begin;
select set_config('forum_test.a',gen_random_uuid()::text,true),set_config('forum_test.b',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) select current_setting('forum_test.a')::uuid,'forum-qa-'||current_setting('forum_test.a')||'@example.invalid',jsonb_build_object('username','qa_'||substr(replace(current_setting('forum_test.a'),'-',''),1,16));
insert into auth.users(id,email,raw_user_meta_data) select current_setting('forum_test.b')::uuid,'forum-qa-'||current_setting('forum_test.b')||'@example.invalid',jsonb_build_object('username','qa_'||substr(replace(current_setting('forum_test.b'),'-',''),1,16));
set local role anon;
do $$ begin
 perform 1 from public.forum_topics limit 1;
 begin perform public.forum_write('create','{}'); raise exception 'FAIL: guest wrote'; exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('forum_test.a'),true);
do $$ declare topic jsonb; begin
 begin perform public.forum_write('create','{"title":"X","body":"Too short","category":"esea","language":"ru"}'); raise exception 'FAIL: invalid input accepted'; exception when check_violation then null; end;
 topic:=public.forum_write('create','{"title":"Forum QA topic","body":"Temporary integration fixture","category":"esea","language":"ru","pinned":true}');
 perform set_config('forum_test.topic',topic->>'id',true);
 if (select pinned from public.forum_topics where id=(topic->>'id')::uuid) then raise exception 'FAIL: client pinned'; end if;
 begin perform public.forum_write('create','{"title":"Too soon topic","body":"Temporary integration fixture","category":"esea","language":"ru"}'); raise exception 'FAIL: spam'; exception when raise_exception then if sqlerrm<>'FORUM_RATE_LIMIT' then raise; end if; end;
 begin insert into public.forum_topics(user_id,title,body,category,language) values(auth.uid(),'Direct write','Bypassing the RPC','esea','ru'); raise exception 'FAIL: direct insert'; exception when insufficient_privilege then null; end;
 begin update public.profiles set is_admin=true where id=auth.uid(); raise exception 'FAIL: self promoted'; exception when insufficient_privilege then null; end;
 update public.profiles set bio='Ordinary profile editing still works' where id=auth.uid();
 begin perform public.forum_write('moderate_topic',jsonb_build_object('topic_id',topic->>'id','hidden',true)); raise exception 'FAIL: unauthorized moderation'; exception when insufficient_privilege then null; end;
 if (public.forum_session()->>'moderator')::boolean then raise exception 'FAIL: ordinary user is moderator'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('forum_test.b'),true);
do $$ declare post jsonb; begin
 post:=public.forum_write('reply',jsonb_build_object('topic_id',current_setting('forum_test.topic'),'body','Reply fixture','user_id',current_setting('forum_test.a')));
 perform set_config('forum_test.post',post->>'id',true);
 if (select user_id from public.forum_posts where id=(post->>'id')::uuid)<>auth.uid() then raise exception 'FAIL: author spoof'; end if;
 if (select reply_count from public.forum_topics where id=current_setting('forum_test.topic')::uuid)<>1 then raise exception 'FAIL: counter'; end if;
 begin perform public.forum_write('reply',jsonb_build_object('topic_id',current_setting('forum_test.topic'),'body','Spam')); raise exception 'FAIL: reply spam'; exception when raise_exception then if sqlerrm<>'FORUM_RATE_LIMIT' then raise; end if; end;
 perform public.forum_write('report',jsonb_build_object('topic_id',current_setting('forum_test.topic'),'reason','QA report'));
 if exists(select 1 from public.forum_reports) then raise exception 'FAIL: reports exposed'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('forum_test.a'),true);
do $$ begin
 begin perform public.forum_write('hide_post',jsonb_build_object('topic_id',current_setting('forum_test.topic'),'post_id',current_setting('forum_test.post'))); raise exception 'FAIL: hide other author'; exception when insufficient_privilege then null; end;
end $$;
set local role postgres;
insert into forum_private.moderators(user_id) values(current_setting('forum_test.a')::uuid);
set local role authenticated;
do $$ begin
 if not (public.forum_session()->>'moderator')::boolean then raise exception 'FAIL: moderator session'; end if;
 if not exists(select 1 from public.forum_reports where topic_id=current_setting('forum_test.topic')::uuid) then raise exception 'FAIL: moderation queue'; end if;
 perform public.forum_write('hide_post',jsonb_build_object('topic_id',current_setting('forum_test.topic'),'post_id',current_setting('forum_test.post')));
 if (select reply_count from public.forum_topics where id=current_setting('forum_test.topic')::uuid)<>0 then raise exception 'FAIL: hidden post counter'; end if;
 perform public.forum_write('restore_post',jsonb_build_object('topic_id',current_setting('forum_test.topic'),'post_id',current_setting('forum_test.post')));
 if (select reply_count from public.forum_topics where id=current_setting('forum_test.topic')::uuid)<>1 then raise exception 'FAIL: restored post counter'; end if;
 perform public.forum_write('moderate_topic',jsonb_build_object('topic_id',current_setting('forum_test.topic'),'locked',true));
 perform public.forum_write('block_user',jsonb_build_object('user_id',current_setting('forum_test.b')));
end $$;
select set_config('request.jwt.claim.sub',current_setting('forum_test.b'),true);
do $$ begin
 if not (public.forum_session()->>'blocked')::boolean then raise exception 'FAIL: restriction not applied'; end if;
 begin perform public.forum_write('reply',jsonb_build_object('topic_id',current_setting('forum_test.topic'),'body','Blocked')); raise exception 'FAIL: blocked user posted'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('forum_test.a'),true);
do $$ begin
 perform public.forum_write('unblock_user',jsonb_build_object('user_id',current_setting('forum_test.b')));
end $$;
select set_config('request.jwt.claim.sub',current_setting('forum_test.b'),true);
do $$ begin
 begin perform public.forum_write('reply',jsonb_build_object('topic_id',current_setting('forum_test.topic'),'body','Locked')); raise exception 'FAIL: closed topic accepted reply'; exception when raise_exception then if sqlerrm<>'FORUM_LOCKED' then raise; end if; end;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 if not exists(select 1 from public.forum_topics where id=current_setting('forum_test.topic')::uuid) then raise exception 'FAIL: guest cannot read visible topic'; end if;
 if not exists(select 1 from public.forum_posts where topic_id=current_setting('forum_test.topic')::uuid) then raise exception 'FAIL: guest cannot read visible reply'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('forum_test.a'),true);
do $$ begin
 perform public.forum_write('moderate_topic',jsonb_build_object('topic_id',current_setting('forum_test.topic'),'hidden',true));
end $$;
select set_config('request.jwt.claim.sub',current_setting('forum_test.b'),true);
do $$ begin
 if exists(select 1 from public.forum_topics where id=current_setting('forum_test.topic')::uuid) then raise exception 'FAIL: hidden topic exposed'; end if;
 if exists(select 1 from public.forum_posts where topic_id=current_setting('forum_test.topic')::uuid) then raise exception 'FAIL: hidden topic replies exposed'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 if exists(select 1 from public.forum_topics where id=current_setting('forum_test.topic')::uuid) then raise exception 'FAIL: hidden topic exposed to guest'; end if;
end $$;
set local role postgres;
select jsonb_build_object('passed',true,'checks',24,'fixtures','transaction rolled back') as forum_security_test;
rollback;

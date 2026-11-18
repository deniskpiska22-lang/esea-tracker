-- Restore normal league publishing after the owner clarified the scope.
-- Rating values and historical results are not changed by this migration.
update public.rating_publication_control
set paused=false,
reason='Owner clarification: normal ESEA season retains legacy scoring and normal scheduled updates; new policy only for approved scheduled qualifiers',
updated_at=now()
where id;

import { safeWebUrl, cleanSocialLinks } from '../../utils/adminWorkspace.js';
import { demoUploadMatchId, validDemoUpload } from '../../utils/demoUpload.js';
export function requireData(response) {
  if (response.error) throw response.error;
  return response.data;
}
export function newsPatch(draft, now = new Date().toISOString()) {
  const image = safeWebUrl(draft.image_url);
  if (image === null) throw new Error('Use a valid HTTP or HTTPS URL.');
  const title = String(draft.title || '').trim(), slug = String(draft.slug || '').trim();
  if (!title || title.length > 500 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 500) throw new Error('Check the title and URL slug.');
  return { title, slug, summary: draft.summary?.trim() || null, body: String(draft.body || '').trim(), category: draft.category || 'general', image_url: image || null, is_featured: Boolean(draft.is_featured), is_published: Boolean(draft.is_published), published_at: draft.is_published ? draft.published_at || now : draft.published_at || null, updated_at: now };
}
export function createAdminApi(db) {
  const read = async (query, signal) => { const response = await (signal ? query.abortSignal(signal) : query); requireData(response); return response; };
  return {
    preview: false,
    loadDemoMatch: async ({ matchId, signal }) => {
      if (!demoUploadMatchId(matchId)) throw new Error('Enter a match link or FACEIT match ID.');
      const [match, uploads] = await Promise.all([
        read(db.from('matches').select('id,status,team1_name,team2_name,map_scores,demo_round_stats').eq('id', matchId).maybeSingle(), signal),
        read(db.from('match_demo_uploads').select('id,file_name,size_bytes,status,last_error,created_at,updated_at').eq('match_id', matchId).order('created_at', { ascending: false }).limit(20), signal),
      ]);
      return { match: match.data, uploads: uploads.data || [] };
    },
    uploadDemo: async ({ matchId, file }) => {
      if (!demoUploadMatchId(matchId) || !validDemoUpload(file)) throw new Error('Use a DEM, DEM.GZ or DEM.ZST file up to 256 MB.');
      const prepared = requireData(await db.rpc('admin_prepare_demo_upload', { p_match_id: matchId, p_file_name: file.name, p_size_bytes: file.size }));
      if (prepared.bucket !== 'match-demo-inbox' || !prepared.path.startsWith(`${matchId}/${prepared.id}.dem`)) throw new Error('Invalid upload destination');
      try {
        requireData(await db.storage.from('match-demo-inbox').upload(prepared.path, file, { contentType: 'application/octet-stream', upsert: false }));
        requireData(await db.rpc('admin_commit_demo_upload', { p_upload_id: prepared.id }));
      } catch (error) {
        await db.rpc('admin_abort_demo_upload', { p_upload_id: prepared.id });
        throw error;
      }
    },
    loadOverview: async ({ signal } = {}) => (await read(db.rpc('admin_overview'), signal)).data,
    loadTraffic: async ({ signal } = {}) => (await read(db.rpc('admin_site_traffic'), signal)).data,
    loadUsers: async ({ page = 0, filter = 'all', search = '', signal } = {}) => {
      let query = db.from('profiles').select('id,username,display_name,avatar_url,country_code,favorite_team_slug,is_admin,created_at', { count: 'exact' }).order('created_at', { ascending: false }).order('id');
      const value = search.replace(/[^\p{L}\p{N}_ -]/gu, '').trim().slice(0, 100).replaceAll('_', '\\_');
      if (value) query = query.or(`username.ilike.%${value}%,display_name.ilike.%${value}%`);
      if (filter === 'favorites') query = query.not('favorite_team_slug', 'is', null).neq('favorite_team_slug', '');
      if (filter === 'none') query = query.or('favorite_team_slug.is.null,favorite_team_slug.eq.');
      if (filter === 'admins') query = query.eq('is_admin', true);
      const response = await read(query.range(page * 25, page * 25 + 24), signal);
      return { rows: response.data || [], count: response.count || 0 };
    },
    loadTeam: async ({ teamId, signal }) => {
      const [content, roster] = await Promise.all([
        read(db.from('team_profiles').select('description,social_links').eq('team_id', teamId).maybeSingle(), signal),
        read(db.from('team_players').select('player_id,official_photo_url,official_photo_verified,players!team_players_player_id_fkey(nickname,avatar)').eq('team_id', teamId).eq('is_active', true), signal),
      ]);
      return { description: content.data?.description || '', links: content.data?.social_links || [], players: (roster.data || []).map(row => ({ id: row.player_id, nickname: (Array.isArray(row.players) ? row.players[0] : row.players)?.nickname || '—', url: row.official_photo_url || '', official: row.official_photo_verified })) };
    },
    saveTeam: async ({ kind, teamId, draft, player }) => {
      if (kind === 'description') return requireData(await db.rpc('upsert_team_profile', { p_team_id: teamId, p_description: draft.description.trim() || null }));
      if (kind === 'links') return requireData(await db.rpc('set_team_social_links', { p_team_id: teamId, p_social_links: cleanSocialLinks(draft.links) }));
      if (kind === 'photo') {
        const url = safeWebUrl(player.url); if (url === null) throw new Error('Use a valid HTTP or HTTPS URL.');
        return requireData(await db.rpc('set_official_team_photo', { p_team_id: teamId, p_player_id: player.id, p_photo_url: url || null, p_verified: Boolean(url && player.official) }));
      }
      throw new Error('Unknown edit');
    },
    loadForum: async ({ filter, page, signal }) => {
      const query = filter === 'reports' ? db.from('forum_reports').select('id,topic_id,post_id,reason,created_at,topic:forum_topics(id,title,hidden),post:forum_posts(id,body,hidden)', { count: 'exact' }).eq('resolved', false) : db.from('forum_topics').select('id,title,category,language,pinned,locked,hidden,created_at,reply_count', { count: 'exact' });
      const response = await read(query.order('created_at', { ascending: false }).order('id').range(page * 20, page * 20 + 19), signal);
      return { rows: response.data || [], count: response.count || 0 };
    },
    writeForum: async (action, payload) => requireData(await db.rpc('forum_write', { p_action: action, p_payload: payload })),
    loadNews: async ({ page, signal }) => {
      const response = await read(db.from('news').select('id,title,slug,is_published,is_featured,published_at,updated_at', { count: 'exact' }).order('created_at', { ascending: false }).order('id').range(page * 20, page * 20 + 19), signal);
      return { rows: response.data || [], count: response.count || 0 };
    },
    loadArticle: async ({ id, signal }) => (await read(db.from('news').select('id,title,slug,summary,body,category,image_url,is_featured,is_published,published_at,updated_at').eq('id', id).single(), signal)).data,
    saveArticle: async (item, draft) => {
      const patch = newsPatch(draft);
      const query = item.id ? db.from('news').update(patch).eq('id', item.id).eq('updated_at', item.updated_at) : db.from('news').insert(patch);
      const data = requireData(await query.select().maybeSingle());
      if (!data) throw new Error('This article changed. Close and reopen it before saving.');
      return data;
    },
  };
}

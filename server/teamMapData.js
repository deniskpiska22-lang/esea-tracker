import { loadProfile } from './seoData.js';
import { loadTeamMapHistory } from '../src/utils/teamMapStats.js';

export async function loadTeamMapData(client, key) {
  const profile = await loadProfile(client, 'team', key);
  if (!profile) return null;
  const team = profile.entity;
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(team.faceitTeamId || '')) throw new Error('Invalid team identity');
  return {
    team: { faceitTeamId: team.faceitTeamId, name: team.name, profileSlug: team.profileSlug, slug: team.slug, logo: team.logo, country: team.country },
    matches: await loadTeamMapHistory(client, team.faceitTeamId),
  };
}

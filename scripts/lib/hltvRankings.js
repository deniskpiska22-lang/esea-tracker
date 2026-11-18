import { load } from 'cheerio';

export function parseRanking(html, rankingDate, sourceUrl) {
  const $ = load(html);
  const teams = $('.ranked-team').toArray().map(el => {
    const row = $(el);
    const profile = row.find('a[href^="/team/"]').first().attr('href');
    const id = Number(profile?.match(/^\/team\/(\d+)\//)?.[1]);
    const rank = Number(row.find('.position').first().text().replace('#',''));
    const players = row.find('.player-holder a[href^="/player/"]').toArray().map(p => ({
      id: Number($(p).attr('href').split('/')[2]),
      nickname: $(p).find('.nick').text().trim(), url: `https://www.hltv.org${$(p).attr('href')}`,
    }));
    return { id, rank, name: row.find('.teamLine .name').first().text().trim(), players };
  });
  const heading = $('body').text().replace(/\s+/g,' ');
  const dateMatch = heading.match(/World ranking on (\w+) (\d+)(?:st|nd|rd|th)?,? (\d{4})/i);
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const actualDate = dateMatch ? `${dateMatch[3]}-${String(months.indexOf(dateMatch[1].toLowerCase())+1).padStart(2,'0')}-${dateMatch[2].padStart(2,'0')}` : null;
  // Reject a block page, regional list, duplicate teams or incomplete top 30.
  if (teams.length < 30 || teams.some(t => !t.id || !t.rank || !t.name) ||
      new Set(teams.map(t => t.id)).size !== teams.length ||
      teams.slice(0,30).some((t,i) => t.rank !== i+1) ||
      actualDate !== rankingDate) throw new Error('Invalid/incomplete HLTV world ranking');
  return { ranking_date: rankingDate, source_url: sourceUrl, teams };
}

export function parseFaceitIdentity(html) {
  const $ = load(html);
  const ids = new Set();
  // Only explicit account links. Never resolve an HLTV nickname as a FACEIT user.
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const match = href.match(/^https?:\/\/(?:www\.)?faceit\.com\/(?:[a-z]{2}\/)?users\/([0-9a-f-]{36})(?:[/?#]|$)/i);
    if (match) ids.add(match[1].toLowerCase());
  });
  return ids.size === 1 ? [...ids][0] : null;
}

export function rankingUrl(date) {
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  return `https://www.hltv.org/ranking/teams/${date.slice(0,4)}/${months[Number(date.slice(5,7))-1]}/${Number(date.slice(8,10))}`;
}

export function previousMonday(value) {
  const d = new Date(value); d.setUTCHours(0,0,0,0);
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0,10);
}

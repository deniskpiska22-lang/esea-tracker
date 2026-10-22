import { escapeHtml } from './profileSeo.js';
import { buildTeamMapStats, teamMapPath, MAP_NAMES } from '../src/utils/teamMapStats.js';
import { getTeamMapSeo } from '../src/utils/teamMapSeo.js';
import { localizedPath } from '../src/i18n/languages.js';
import { translateText } from '../src/i18n/translate.js';

export function teamMapMetadata(data, map, language) {
  const stats = buildTeamMapStats(data.matches, map);
  const t = value => escapeHtml(translateText(value, language));
  const link = (url, value) => `<a data-entity-link="true" href="${escapeHtml(localizedPath(url, language))}">${escapeHtml(value)}</a>`;
  const facts = [['Times played', stats.played], ['Wins / draws / losses', `${stats.wins} / ${stats.draws} / ${stats.losses}`], ['Win percent', stats.winRate === null ? '—' : `${stats.winRate}%`], ['Total rounds played', stats.totalRounds], ['Rounds won', stats.roundsWon], ['Rounds lost', stats.roundsLost]];
  return { ...getTeamMapSeo(data.team, map, language), bodyLocalized: true, body:
    `<nav>${MAP_NAMES.map(name => link(teamMapPath(data.team, name), name)).join(' · ')}</nav><p>${t('Last 3 months')}</p><dl>${facts.map(([name, value]) => `<dt>${t(name)}</dt><dd>${escapeHtml(value)}</dd>`).join('')}</dl>
    <h2>${t('Matches')}</h2>${stats.played ? `<table><thead><tr>${['Date', 'Team', 'Opponent', 'Event', 'Result'].map(value => `<th>${t(value)}</th>`).join('')}</tr></thead><tbody>${stats.matches.slice(0, 50).map(match => `<tr><td>${escapeHtml(new Date(match.date).toISOString().slice(0, 10))}</td><td>${escapeHtml(match.teamName)}</td><td>${escapeHtml(match.opponent?.name)}</td><td>${escapeHtml(match.event)}</td><td>${link(`/match/${encodeURIComponent(match.id)}`, `${match.teamScore}–${match.opponentScore}`)}</td></tr>`).join('')}</tbody></table>` : `<p>${t('No played maps match these filters.')}</p>`}`,
  };
}

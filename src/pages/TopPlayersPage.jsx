import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Link from '../components/SiteLink.jsx';
import CountryFlag from '../components/CountryFlag.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { playersTx as tx } from '../i18n/playerRankings.js';
import { currentLocale } from '../i18n/languages.js';
import { countryName, COUNTRY_CODES } from '../utils/countries.js';
import './TopPlayersPage.css';

const divisions = ['Advanced','Main','Intermediate','Entry','Open10'];
const regions = ['Europe','North America','South America','Africa','Asia','Oceania'];
const thresholds = [5,10,20,50,100];
const number = value => value == null || !Number.isFinite(Number(value)) ? '—'
  : new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 2 }).format(Number(value));

function Portrait({ logo }) {
  const [failed, setFailed] = useState(null);
  return <span className="rank-player-portrait">
    {logo && logo !== failed && <img className="rank-player-logo" src={logo} alt="" onError={() => setFailed(logo)} />}
    <img className="rank-player-silhouette" src="/player-silhouette.png" alt="" loading="lazy" />
  </span>;
}

export default function TopPlayersPage() {
  const [params, setParams] = useSearchParams();
  const division = divisions.includes(params.get('division')) ? params.get('division') : '';
  const region = regions.includes(params.get('region')) ? params.get('region') : '';
  const country = COUNTRY_CODES.includes((params.get('country') || '').toUpperCase()) ? params.get('country').toUpperCase() : '';
  const minimum = thresholds.includes(Number(params.get('min'))) ? Number(params.get('min')) : 5;
  const search = (params.get('q') || '').slice(0,80);
  const key = JSON.stringify([division,region,minimum,search,country]);
  const [result, setResult] = useState(null);
  const current = result?.key === key ? result : null;
  function change(name, value) {
    setParams(previous => { const next = new URLSearchParams(previous);
      if (value) next.set(name,value); else next.delete(name); return next;
    }, { replace: true });
  }

  useEffect(() => {
    let stopped = false;
    let active = false;
    async function load() {
      if (active || document.hidden) return;
      active = true;
      try {
        if (!supabase) throw new Error('Supabase unavailable');
        const { data, error } = await supabase.rpc('get_player_leaderboard_page', {
          p_division: division || null, p_region: region || null, p_min_matches: minimum, p_search: search, p_country: country || null,
        });
        if (error) throw error;
        if (!stopped) {
          if (country && data.selected_country !== country) {
            setParams(previous => { const next = new URLSearchParams(previous); next.delete('country'); return next; }, {replace:true});
          } else setResult({ key, players: data.players || [], countries: data.countries || [], error: false });
        }
      } catch {
        if (!stopped) setResult({ key, players: [], error: true });
      } finally { active = false; }
    }
    const debounce = setTimeout(load, search ? 250 : 0);
    const interval = setInterval(load, 60000);
    document.addEventListener('visibilitychange',load);
    return () => { stopped = true; clearTimeout(debounce); clearInterval(interval); document.removeEventListener('visibilitychange',load); };
  }, [division,region,minimum,search,country,key,setParams]);

  const countries = (current?.countries || []).filter(row => countryName(row.code)).sort((a,b) => countryName(a.code).localeCompare(countryName(b.code),currentLocale()));
  const players = current?.players || [];
  const from = '/players' + (params.size ? '?' + params : '');
  const playerLink = player => '/players/' + encodeURIComponent(player.nickname || player.player_id);
  const state = { from, label: '← Back to Top Players' };
  return <main className="player-rankings">
    <header className="player-rankings-hero">
      <span className="player-rankings-eyebrow">ESEA · CS2</span>
      <h1>{tx('Top 100 players')}</h1>
      <p>{tx('Overall rating across recorded matches. Division and region follow the current team; country follows player nationality.')}</p>
    </header>
    <form className="player-rankings-filters" onSubmit={event => event.preventDefault()}>
      <label>{tx('Division')}<select value={division} onChange={e=>change('division',e.target.value)}>
        <option value="">{tx('All divisions')}</option>{divisions.map(d=><option key={d} value={d}>{d}</option>)}
      </select></label>
      <label>{tx('Region')}<select value={region} onChange={e=>change('region',e.target.value)}>
        <option value="">{tx('All regions')}</option>{regions.map(r=><option key={r} value={r}>{tx(r)}</option>)}
      </select></label>
      <label>{tx('Country')}<select value={country} disabled={!current || current.error} onChange={e=>change('country',e.target.value)}>
        <option value="">{tx('All countries')}</option>{countries.map(row=><option key={row.code} value={row.code}>{countryName(row.code)} · {number(row.count)}</option>)}
      </select></label>
      <label>{tx('Minimum matches')}<select value={minimum} onChange={e=>change('min',e.target.value)}>
        {thresholds.map(n=><option key={n} value={n}>{n}+</option>)}
      </select></label>
      <label>{tx('Search nickname')}<input type="search" maxLength={80} value={search} onChange={e=>change('q',e.target.value)} /></label>
      <button type="button" onClick={()=>setParams({},{replace:true})}>{tx('Reset filters')}</button>
    </form>
    <p className="player-rankings-note">{tx('Ranks are calculated within the selected filters.')} {tx('Only countries with at least 100 players under the selected filters are shown.')}</p>
    {!current ? <p role="status" className="player-rankings-empty">{tx('Loading...')}</p>
      : current.error ? <p role="alert" className="player-rankings-empty">{tx('Automatic statistics are temporarily unavailable')}</p>
      : !players.length ? <p role="status" className="player-rankings-empty">{tx('No players match these filters.')}</p>
      : <>
        {!search && <div className="player-rankings-podium">{players.slice(0,3).map((player,index)=>
          <Link key={player.player_id} to={playerLink(player)} state={state} className="player-rankings-leader">
            <span className="player-rankings-place">#{index+1}</span>
            <Portrait logo={player.team_logo} />
            <div className="player-rankings-leader-name">{player.country && <CountryFlag country={player.country} />}{player.nickname}</div>
            <span className="player-rankings-team">{player.team_name || '—'}</span>
            <strong>{number(player.rating)}</strong>
            <small>{player.matches_played} {tx('Matches')}</small>
          </Link>)}</div>}
        <div className="player-rankings-table" role="region" aria-label={tx('Top 100 players')} tabIndex={0}>
          <table>
            <thead><tr>{['#','Player','Team','Region','Matches','ADR','K/D','Rating'].map(label=><th scope="col" key={label}>{tx(label)}</th>)}</tr></thead>
            <tbody>{players.map(player=><tr key={player.player_id}>
              <td className="player-rankings-number">{player.position}</td>
              <th scope="row"><Link className="player-rankings-person" to={playerLink(player)} state={state}>
                {player.country && <CountryFlag country={player.country} />}<span>{player.nickname}</span>
              </Link></th>
              <td>{player.team_id ? <Link to={'/teams/'+encodeURIComponent(player.team_slug || player.team_id)}>{player.team_name || '—'}</Link> : '—'}<small>{player.division || '—'}</small></td>
              <td>{player.region ? tx(player.region) : '—'}</td><td>{number(player.matches_played)}</td>
              <td>{number(player.adr)}</td><td>{number(player.kd)}</td><td className="player-rankings-rating">{number(player.rating)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
  </main>;
}

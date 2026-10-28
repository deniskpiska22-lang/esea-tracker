import { useCallback, useState } from 'react';
import { tx } from '../../i18n/translate.js';
import { demoUploadMatchId, validDemoUpload } from '../../utils/demoUpload.js';
import { useAdminData } from './adminDataContext.js';
import { useAdminResource } from './useAdminResource.js';
import { Panel, Notice, Empty, DateLabel } from './AdminUI.jsx';
import Link from '../SiteLink.jsx';
import { matchPublicPath } from '../../utils/matchUrls.js';

export default function DemoUploadsPanel() {
  const api = useAdminData();
  const [input, setInput] = useState('');
  const [matchId, setMatchId] = useState(api.preview ? '1-11111111-1111-4111-8111-111111111111' : '');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const load = useCallback(async options => matchId ? { ...await api.loadDemoMatch({ matchId, ...options }), key: matchId } : null, [api, matchId]);
  const { data, error, loading, refresh } = useAdminResource(load, { pollMs: matchId ? 15000 : 0 });
  const current = data?.key === matchId ? data : null;
  const match = current?.match;
  const finished = ['FINISHED','MATCH_STATUS_FINISHED'].includes(match?.status);
  const upload = async event => {
    event.preventDefault(); setFailure(''); setMessage('');
    if (!validDemoUpload(file)) { setFailure('Use a DEM, DEM.GZ or DEM.ZST file up to 256 MB.'); return; }
    setBusy(true);
    try { await api.uploadDemo({ matchId, file }); setMessage('Demo queued. Results appear after verification.'); refresh(); }
    catch (error) { setFailure(error.message); }
    finally { setBusy(false); }
  };
  return <div className="admin-stack">
    <Panel title="Match demo analysis" description="Upload a demo to calculate pistol wins and CT/T round win rates.">
      <p className="admin-info">{tx('Automatic FACEIT downloads require separate Downloads API access. You can upload a demo you already have.')}</p>
      <form className="admin-stack" onSubmit={event => { event.preventDefault(); const id = demoUploadMatchId(input); if (!id) { setFailure('Enter a match link or FACEIT match ID.'); return; } setFailure(''); setMessage(''); setMatchId(id); setFile(null); }}>
        <label className="admin-field">{tx('Match link or FACEIT ID')}<input value={input} disabled={busy || api.preview} onChange={event => setInput(event.target.value)} placeholder="https://eseatracker.ru/match/1-…" /></label>
        <div><button type="submit" className="admin-btn" disabled={busy || api.preview}>{tx('Find match')}</button></div>
      </form>
      <Notice error>{(failure || error) && tx(failure || error)}</Notice>
      <Notice>{message && tx(message)}</Notice>
    </Panel>
    {matchId && <Panel title={match ? `${match.team1_name} vs ${match.team2_name}` : 'Match'} action={<button className="admin-btn" onClick={refresh} disabled={busy}>{tx('Refresh')}</button>}>
      {(loading || (!current && !error)) && !match ? <Empty>{tx('Loading...')}</Empty> : !match ? <Empty>{tx('Match not found.')}</Empty> : <div className="admin-stack">
        <Link to={matchPublicPath(match)} className="admin-btn">{tx('Open match')} ↗</Link>
        <dl className="admin-summary">{(match.map_scores || []).map((map, i) => <div key={i}><dt>{map.map}</dt><dd>{map.team1_score} : {map.team2_score}</dd></div>)}</dl>
        <p className="admin-info">{tx('Files must match this game: map, Steam IDs and final score are verified. Temporary files are deleted after processing.')}</p>
        {!finished && <Notice error>{tx('Only finished matches can be analysed.')}</Notice>}
        <form className="admin-stack" onSubmit={upload} data-admin-dirty={busy ? 'true' : undefined}>
          <label className="admin-field">{tx('Demo file')}<input key={matchId} type="file" accept=".dem,.dem.gz,.dem.zst,.gz,.zst" disabled={!finished || busy || api.preview} onChange={event => { setFile(event.target.files?.[0] || null); setFailure(''); setMessage(''); }} /></label>
          <small className="admin-info">{tx('DEM, DEM.GZ or DEM.ZST · up to 256 MB · one file per map')}</small>
          <div><button type="submit" className="admin-btn is-primary" disabled={!finished || !file || busy || api.preview}>{tx(busy ? 'Uploading and queueing…' : 'Upload and analyse')}</button></div>
        </form>
        <p className="admin-info">{tx('Verified map results')}: {match.demo_round_stats?.length || 0} / {match.map_scores?.length || 0}</p>
        {api.preview && <p className="admin-info">{tx('Preview only. No files are uploaded.')}</p>}
      </div>}
    </Panel>}
    <Panel title="Uploaded demos">
      {!current?.uploads?.length ? <Empty>{tx('No demos uploaded for this match yet.')}</Empty> : <div className="admin-stack">{current.uploads.map(row => <div className="admin-info" key={row.id}><strong>{row.file_name}</strong> · {(row.size_bytes / 1048576).toFixed(1)} MB · <strong>{tx(row.status)}</strong><div><DateLabel value={row.updated_at} /></div>{row.last_error && <Notice error>{row.last_error}</Notice>}</div>)}</div>}
    </Panel>
  </div>;
}

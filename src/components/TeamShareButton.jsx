import {useEffect,useRef,useState} from 'react';
import {useLanguage} from '../context/LanguageContext.jsx';
import {LANGUAGES} from '../i18n/languages.js';
import {teamShareLabels} from './teamShareLabels.js';
import {shareTeamUrl} from '../utils/teamShare.js';
import {downloadShareCard} from '../utils/shareImage.js';
import TeamShareCard from './TeamShareCard.jsx';
import './TeamShareButton.css';
export default function TeamShareButton({team,variant}){
 const {language}=useLanguage(),l=teamShareLabels(language);
 const [open,setOpen]=useState(false),[cardLanguage,setCardLanguage]=useState(language),[state,setState]=useState({loading:false}),[retry,setRetry]=useState(0),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const dialog=useRef(null),trigger=useRef(null),svg=useRef(null),buffer=useRef(null),busyRef=useRef(false),id=team.faceitTeamId||team.faceit_team_id||team.teamId||team.id;
 useEffect(()=>{
  if(!open)return;
  const node=dialog.current,button=trigger.current;node.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{node.close();document.body.style.overflow=overflow;if(button?.isConnected)button.focus();};
 },[open]);
 useEffect(()=>{
  if(!open)return;
  const controller=new AbortController();
  fetch(`/api/team-share?teamId=${encodeURIComponent(id)}`,{signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error('share');return response.json();
  }).then(data=>{if(!controller.signal.aborted)setState({id,snapshot:data.snapshot,loading:false});}).catch(()=>{if(!controller.signal.aborted)setState({id,error:true,loading:false});});
  return()=>controller.abort();
 },[open,id,retry]);
 const snapshot=state.id===id?state.snapshot:null,c=teamShareLabels(cardLanguage),url=shareTeamUrl(team,cardLanguage);
 const caption=[team.name,snapshot?.rank?c.postRank.replace('{rank}',snapshot.rank):null,snapshot?.change!==null&&snapshot?.change!==undefined?c.postChange.replace('{change}',`${snapshot.change>0?'+':''}${snapshot.change}`):null,`${c.viewProfile}: ${url}`].filter(Boolean).join('\n');
 async function copy(value){setStatus('');try{await navigator.clipboard.writeText(value);setStatus(l.copied);}catch{buffer.current.value=value;buffer.current.focus();buffer.current.select();setStatus(document.execCommand('copy')?l.copied:l.copyManual);}}
 async function download(){if(busyRef.current||!svg.current)return;busyRef.current=true;setBusy(true);setStatus('');try{const result=await downloadShareCard(svg.current,`esea-tracker-${snapshot.date}.png`);setStatus(`${l.downloaded}${result.fallback?` ${l.logoFallback}`:''}`);}catch{setStatus(l.failed);}finally{setBusy(false);busyRef.current=false;}}
 return <><button type="button" className={`team-share-trigger${variant==='tile'?' team-share-trigger--tile':''}`} aria-label={l.share} ref={trigger} onClick={()=>{setCardLanguage(language);setStatus('');setState({id,loading:true});setOpen(true);}}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg><span className="team-share-trigger__label">{l.share}{variant==='tile'&&<small>X · Telegram · Discord</small>}</span></button>
 <dialog ref={dialog} className="team-share-modal" aria-label={l.share} onCancel={()=>setOpen(false)} onClick={event=>{if(event.target===dialog.current)setOpen(false);}}>
 <div className="team-share-top"><div><span>ESEA TRACKER / TEAM CARD</span><h2>{l.title}</h2><p>{l.subtitle}</p></div><button type="button" className="team-share-close" aria-label={l.back} onClick={()=>setOpen(false)}>×</button></div>
 {state.loading||state.id!==id?<div className="team-share-empty" role="status">{l.loading}</div>:state.error?<div className="team-share-empty"><p>{l.failed}</p><button type="button" onClick={()=>{setState({id,loading:true});setRetry(value=>value+1);}}>{l.retry}</button></div>:!snapshot?<div className="team-share-empty">{l.noHistory}</div>:<div className="team-share-content"><div className="team-share-preview"><div className="team-share-card-label"><span>{l.card}</span><select aria-label={l.card} value={cardLanguage} onChange={event=>{setCardLanguage(event.target.value);setStatus('');}}>{LANGUAGES.map(item=><option value={item.code} key={item.code}>{item.name}</option>)}</select></div><div className="team-share-image"><TeamShareCard team={team} snapshot={snapshot} language={cardLanguage} svgRef={svg}/></div><div className="team-share-image-meta"><span>PNG · 1200 × 630 px</span><span>{snapshot.date}</span></div><p className="team-share-period-note">{l.periodNote}</p></div>
 <div className="team-share-actions"><span className="team-share-kicker">{l.ready}</span><div className="team-share-platforms"><span>𝕏</span><span>Telegram</span><span>Discord</span></div><h3>{l.heading}</h3><p>{l.steps}</p><button className="team-share-download" type="button" disabled={busy} onClick={download}>{busy?l.creating:`↓ ${l.download}`}</button><div className="team-share-copy-label"><label htmlFor="team-share-caption">{l.textLabel}</label><button type="button" onClick={()=>copy(caption)}>{l.copyText}</button></div><textarea id="team-share-caption" readOnly value={caption}/><button type="button" className="team-share-copy-link" onClick={()=>copy(url)}>{l.copyLink} ↗</button><div className="team-share-status" role="status">{status}</div></div></div>}
 <div className="team-share-footer"><span>ESEA Tracker</span><button type="button" onClick={()=>setOpen(false)}>{l.back} →</button></div><textarea ref={buffer} aria-label={l.textLabel} className="team-share-buffer" tabIndex={-1}/></dialog></>;
}

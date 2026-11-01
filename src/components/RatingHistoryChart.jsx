import {useId,useMemo,useState} from 'react';
import {AreaChart,Area,XAxis,YAxis,Tooltip,ResponsiveContainer,CartesianGrid} from 'recharts';
import {currentLanguage,currentLocale} from '../i18n/languages.js';
import {normalizeRatingHistory,filterRatingHistory,ratingHistoryChange} from '../utils/ratingHistory.js';
import {ratingHistoryLabels} from './ratingHistoryLabels.js';
import './RatingHistoryChart.css';

const signed=value=>value===null?'—':`${value>0?'+':''}${value}`;
function Delta({value,rank=false}) {
  return <span className={`rating-history__delta ${value>0?'is-up':value<0?'is-down':''}`}>
    {value===null?'—':rank?`${value>0?'↑':value<0?'↓':'·'} ${Math.abs(value)}`:signed(value)}
  </span>;
}
function SnapshotTooltip({active,payload,labels,locale}) {
  if(!active || !payload?.length) return null;
  const row=payload[0].payload;
  return <div className="rating-history__tooltip">
    <time>{new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(row.date)}</time>
    <div className="rating-history__tooltip-grid">
      <div><span>{labels.points}</span><strong>{row.rating??'—'}</strong><Delta value={row.pointsChange}/></div>
      <div><span>{labels.rank}</span><strong>{row.rank?`#${row.rank}`:'—'}</strong><Delta value={row.rankChange} rank/></div>
    </div>
    <small>{labels.vsPrevious}</small>
    {row.rank===null&&<p>{labels.noRank}</p>}
  </div>;
}
export default function RatingHistoryChart({data}) {
  const [months,setMonths]=useState(3);
  const [metric,setMetric]=useState('rating');
  const gradientId=`rating-history-${useId().replace(/:/g,'')}`;
  const labels=ratingHistoryLabels(currentLanguage());
  const locale=currentLocale();
  const rows=useMemo(()=>normalizeRatingHistory(data),[data]);
  const shown=useMemo(()=>filterRatingHistory(rows,months),[rows,months]);
  const last=shown.at(-1);
  const pointsChange=ratingHistoryChange(shown,'rating');
  const rankChange=ratingHistoryChange(shown,'rank');
  const rankMode=metric==='rank';
  const available=shown.filter(row=>row[metric]!==null);
  const shortDate=value=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',timeZone:'UTC'}).format(Number(value));
  const min=available.length?Math.min(...available.map(row=>row[metric])):0;
  const max=available.length?Math.max(...available.map(row=>row[metric])):1;
  const step=rankMode?Math.max(1,Math.ceil((max-min)/5)):Math.max(10,Math.ceil((max-min)/250)*50);
  const low=rankMode?Math.max(1,Math.floor((min-1)/step)*step):Math.max(0,Math.floor((min-15)/step)*step);
  const high=Math.max(low+step,Math.ceil((max+(rankMode?1:15))/step)*step);
  const ticks=Array.from({length:Math.round((high-low)/step)+1},(_,i)=>low+i*step);
  const accent=rankMode?'#78c7af':'#edb16d';
  return <div className="rating-history">
    <div className="rating-history__summary">
      <div className="rating-history__summary-item"><span>{labels.latest} · {labels.points}</span><strong>{last?.rating??'—'}</strong><div><Delta value={pointsChange}/><small>{labels.period}</small></div></div>
      <div className="rating-history__summary-item"><span>{labels.latest} · {labels.rank}</span><strong>{last?.rank?`#${last.rank}`:'—'}</strong><div><Delta value={rankChange} rank/><small>{labels.period}</small></div></div>
      <div className="rating-history__periods" role="group" aria-label={labels.period}>{[[1,labels.month],[3,labels.months],[0,labels.all]].map(([value,label])=><button type="button" key={value} aria-pressed={months===value} onClick={()=>setMonths(value)}>{label}</button>)}</div>
    </div>
    <div className="rating-history__toolbar"><div className="rating-history__metrics" role="group" aria-label={labels.teamRating}>{[['rating',labels.points],['rank',labels.rank]].map(([value,label])=><button type="button" key={value} aria-pressed={metric===value} onClick={()=>setMetric(value)}><i style={{background:value==='rank'?'#78c7af':'#edb16d'}}/>{label}</button>)}</div><span>{labels.hover}</span></div>
    <div className="rating-history__plot">{!available.length?<div className="rating-history__empty">{rankMode?labels.noRank:labels.noData}</div>:<ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{width:900,height:310}}><AreaChart data={shown} margin={{top:20,right:14,bottom:10,left:0}} accessibilityLayer>
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={accent} stopOpacity={.23}/><stop offset="85%" stopColor={accent} stopOpacity={.02}/><stop offset="100%" stopColor={accent} stopOpacity={0}/></linearGradient></defs>
      <CartesianGrid vertical={false} stroke="#a0b0c0" strokeOpacity={.1} strokeDasharray="3 7"/>
      <XAxis dataKey="date" type="number" scale="time" domain={['dataMin','dataMax']} tickFormatter={shortDate} axisLine={false} tickLine={false} tick={{fill:'#8398ad',fontSize:11}} tickMargin={16} minTickGap={40} interval="preserveStartEnd" padding={{left:10,right:12}}/>
      <YAxis orientation="right" domain={[low,high]} ticks={ticks} reversed={rankMode} tickFormatter={value=>rankMode?`#${value}`:value} axisLine={false} tickLine={false} tick={{fill:'#7e94aa',fontSize:11}} width={rankMode?62:48} tickMargin={10} allowDecimals={false}/>
      <Tooltip content={<SnapshotTooltip labels={labels} locale={locale}/>} cursor={{stroke:accent,strokeOpacity:.4,strokeDasharray:'4 5'}} wrapperStyle={{outline:'none'}}/>
      <Area type="linear" baseValue={rankMode?high:low} dataKey={metric} stroke={accent} strokeWidth={2.5} fill={`url(#${gradientId})`} isAnimationActive={false} connectNulls={false}
        dot={({cx,cy,index,value})=>value!==null && (index===shown.length-1||available.length===1)?<g key={index}><circle cx={cx} cy={cy} r={9} fill={accent} opacity={.09}/><circle cx={cx} cy={cy} r={4} fill={accent} stroke="#14202c" strokeWidth={2}/></g>:<g key={index}/>}
        activeDot={{r:5,fill:accent,stroke:'#15202b',strokeWidth:3}}/>
    </AreaChart></ResponsiveContainer>}</div>
    {shown.length>0&&<div className="rating-history__footer"><span>{new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(shown[0].date)} — {new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(last.date)}</span><span>{labels.snapshots}: {shown.length}</span></div>}
  </div>;
}

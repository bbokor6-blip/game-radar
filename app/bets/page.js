"use client";
import { useEffect, useMemo, useState } from "react";
import { parseAgentQuery, searchGames, queryExplanation } from "../../lib/agentSearch";
import { gameMetadata } from "../../lib/gameMetadata";
import { betIndexTier } from "../../lib/indexTiers";
import RadarMenu from "../components/RadarMenu";
import IndexTierFilter, { BET_INDEX_FILTERS, filterByTier } from "../components/IndexTierFilter";

const LEAGUES=[["nfl","NFL"],["cfb","COLLEGE FBS"]];

function footballRange(offset=0){
  const now=new Date();
  const day=now.getDay();
  const daysSinceTuesday=(day+5)%7;
  const start=new Date(now);
  start.setHours(12,0,0,0);
  start.setDate(now.getDate()-daysSinceTuesday+(offset*7));
  const end=new Date(start);
  end.setDate(start.getDate()+6);
  const fmt=d=>d.toISOString().slice(0,10);
  return {start:fmt(start),end:fmt(end),startDate:start,endDate:end};
}

function rangeLabel(r){
  const a=r.startDate.toLocaleDateString([],{month:"short",day:"numeric"});
  const b=r.endDate.toLocaleDateString([],{month:"short",day:"numeric"});
  return a+"–"+b;
}
function weekName(offset){
  if(offset===-1)return "LAST WEEK";
  if(offset===0)return "THIS WEEK";
  if(offset===1)return "NEXT WEEK";
  if(offset>1)return "LOOK AHEAD · +"+offset;
  return "PAST WEEK";
}
function WeekSelector({weekOffset,setWeekOffset,range,min=0,max=4}){
  return <div className="weekSelector" aria-label="Select football week">
    <button disabled={weekOffset<=min} onClick={()=>setWeekOffset(x=>Math.max(min,x-1))} aria-label="Previous week">‹</button>
    <div>
      <span>{weekName(weekOffset)}</span>
      <strong>{rangeLabel(range)}</strong>
    </div>
    <button disabled={weekOffset>=max} onClick={()=>setWeekOffset(x=>Math.min(max,x+1))} aria-label="Next week">›</button>
  </div>;
}

function gameTime(game){
  return new Date(game.date).toLocaleString([],{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
}

function teamDisplay(team){
  return (team.rank?"#"+team.rank+" ":"")+team.short;
}

function matchup(game){
  return teamDisplay(game.away)+" @ "+teamDisplay(game.home);
}
function gameDateLabel(game){
  return new Date(game.date).toLocaleString([],{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).toUpperCase();
}
function rankedCount(game){
  return [game.home?.rank,game.away?.rank].filter(Boolean).length;
}
function TeamMini({team}){
  return <span className="teamMini">{team?.logo?<img src={team.logo} alt=""/>:<i/>}<b>{teamDisplay(team)}</b></span>;
}

function formatAmerican(odds){
  const n=Number(odds);
  if(!Number.isFinite(n)||n===0)return "—";
  return (n>0?"+":"")+Math.round(n);
}

function oddsText(odds){
  const n=Number(odds);
  if(!Number.isFinite(n)||n===0)return "ODDS N/A";
  return (n>0?"+":"")+Math.round(n);
}

function moneyText(n){
  const v=Number(n);
  if(!Number.isFinite(v))return "—";
  return "$"+v.toFixed(2);
}
function pickKeyForOpportunity(item){
  if(item.type==="SPREAD")return item.side+"-spread";
  return item.side;
}
function savedPickId(league,weekStart,gameId,key){
  return [league,weekStart,gameId,key].join("|");
}
function featuredOpportunities(games){
  const out=games.filter(game=>game.officialPick&&game.bestOpportunity)
    .map(game=>({...game.bestOpportunity,game}));
  return out.sort((a,b)=>b.index-a.index||((b.game.interest?.score||0)-(a.game.interest?.score||0)));
}

function decimalOdds(american){
  const n=Number(american);
  if(!Number.isFinite(n)||Math.abs(n)<100)return null;
  return n>0?1+n/100:1+100/Math.abs(n);
}
function parlayPayout(legs,stake=10){
  const decimals=legs.map(x=>decimalOdds(x.americanOdds));
  if(decimals.some(x=>x==null))return null;
  const decimal=decimals.reduce((a,b)=>a*b,1);
  const total=Math.round(stake*decimal*100)/100;
  const american=decimal>=2?Math.round((decimal-1)*100):Math.round(-100/(decimal-1));
  return {american,total,profit:Math.round((total-stake)*100)/100};
}
function featuredParlays(pool,league){
  const source=pool.filter(x=>x.americanOdds!=null).slice(0,14);
  const configs=[{size:2,label:"SPOTLIGHT 2-LEG"},{size:3,label:"FEATURED 3-LEG"},{size:4,label:"SATURDAY 4-LEG"}];
  return configs.map(config=>{
    let best=null;
    function walk(start,chosen){
      if(chosen.length===config.size){
        if(new Set(chosen.map(x=>x.game.id)).size!==chosen.length)return;
        const ranked=chosen.filter(x=>rankedCount(x.game)>0).length;
        const sleepers=chosen.filter(x=>rankedCount(x.game)===0).length;
        if(league==="cfb"){
          if(ranked===0)return;
          if(config.size>=3&&ranked<2)return;
          if(chosen.some(x=>rankedCount(x.game)===0&&x.index<70))return;
          if(sleepers>1)return;
        }
        const score=chosen.reduce((s,x)=>s+x.index,0)/chosen.length+(ranked*1.5)+(sleepers===1?1.5:0);
        if(!best||score>best.score)best={legs:chosen.slice(),score,ranked,sleepers};
        return;
      }
      for(let i=start;i<source.length;i++)walk(i+1,[...chosen,source[i]]);
    }
    walk(0,[]);
    return best?{...best,...config,payout:parlayPayout(best.legs,10)}:null;
  }).filter(Boolean);
}
function ParlayCard({parlay}){
  return <article className="parlayCard">
    <div className="parlayTop">
      <span>{parlay.label}</span>
      {parlay.sleepers?<b>SLEEPER INCLUDED</b>:parlay.ranked>=2?<b>TOP 25 FOCUS</b>:null}
    </div>
    <div className="parlayLegList">
      {parlay.legs.map((leg,i)=><div key={leg.game.id+"-"+leg.type}>
        <span>{i+1}</span>
        <div><strong>{leg.pick}</strong><small>{matchup(leg.game)} · {gameDateLabel(leg.game)}</small></div>
        <em>{leg.index}</em>
      </div>)}
    </div>
    {parlay.payout?<div className="parlayPayout"><span>$10 PARLAY</span><strong>{formatAmerican(parlay.payout.american)}</strong><small>TOTAL RETURN {moneyText(parlay.payout.total)}</small></div>:null}
  </article>;
}

function BetPickCard({item,featured=false,league,weekStart,weekLabel,weekOffset,isSaved,onToggleSave}){
  const g=item.game;
  const meta=gameMetadata(g);
  const saved={
    id:savedPickId(league,weekStart,g.id,pickKeyForOpportunity(item)),
    league,weekStart,weekLabel,gameId:g.id,key:pickKeyForOpportunity(item),
    matchup:matchup(g),gameDate:g.date,pick:item.pick,odds:item.americanOdds,index:item.index,
    source:"BetRadar"
  };
  const tier=betIndexTier(item.index);
  return <article className={"brPickCard indexTier-"+tier.key+" "+(featured?"featured ":"")+(item.noBrainer?"noBrainer ":"")}>
    <div className="brPickTop">
      <div className="brMatchup">
        <TeamMini team={g.away}/><em>@</em><TeamMini team={g.home}/>
      </div>
      <span className="brKickoff">{gameTime(g)}</span>
    </div>
    <div className="brPickMain">
      <div>
        <span className="brPickLabel">{item.officialStatus==="LOCKED"?"OFFICIAL PICK · LOCKED":"UPCOMING PICK"} · {item.type}</span>
        <h3>{item.pick} <small>{oddsText(item.americanOdds)}{item.officialStatus==="LOCKED"?" AT LOCK":""}</small></h3>
      </div>
      <div className="brIndex">
        <strong>{item.index}</strong>
        <span>{betIndexTier(item.index).label}</span>
      </div>
    </div>
    <div className="brMeta">
      {meta.rankedMatchup?<span>Ranked Matchup</span>:meta.rankedInvolved?<span>Ranked Team</span>:null}
      {meta.conferenceGame?<span>Conference Game</span>:null}
      {meta.rivalry?<span>Rivalry</span>:null}
      {meta.broadcasts?.[0]?<span>{meta.broadcasts[0]}</span>:null}
      {g.marketConsensus?.line||g.market?.details?<span>{g.marketConsensus?.line||g.market?.details}</span>:null}
    </div>
    <p className="brWhy">{item.why}</p>
    <div className="brActions">
      <button className={isSaved?"saved":""} onClick={()=>onToggleSave(saved)}>{isSaved?"★ Saved":"☆ Save pick"}</button>
      <details>
        <summary>Why this score</summary>
        <div className="brEvidence">
          {(item.evidence||[]).map((x,i)=><span key={i}>{x}</span>)}
          <span>BetIndex slate rank: {item.index}</span>
          {item.lockedIndex!=null?<span>Score recorded at lock: {item.lockedIndex}</span>:null}
          <span>{g.marketConsensus?.providerCount||0} market source{g.marketConsensus?.providerCount===1?"":"s"}</span>
        </div>
      </details>
    </div>
  </article>;
}

function BetGameRow({game,league,weekStart,weekLabel,savedIds,onToggleSave}){
  const best=game.bestOpportunity;
  const market=game.marketConsensus||{};
  const meta=gameMetadata(game);
  const key=best?pickKeyForOpportunity(best):null;
  const id=key?savedPickId(league,weekStart,game.id,key):null;
  const saved=best?{
    id,league,weekStart,weekLabel,gameId:game.id,key,
    matchup:matchup(game),gameDate:game.date,pick:best.pick,odds:best.americanOdds,index:best.index,
    source:"BetRadar All Games"
  }:null;
  return <article className="brGameRow">
    <div className="brGameTeams">
      <div><TeamMini team={game.away}/><em>@</em><TeamMini team={game.home}/></div>
      <small>{gameTime(game)}</small>
    </div>
    <div className="brGameContext">
      {meta.conferenceGame?<span>Conference</span>:null}
      {meta.rankedMatchup?<span>Ranked vs Ranked</span>:meta.rankedInvolved?<span>Ranked</span>:null}
      {meta.broadcasts?.[0]?<span>{meta.broadcasts[0]}</span>:null}
    </div>
    <div className="brMarket">
      <span>Market</span>
      <strong>{market.line||"Pending"}</strong>
      {market.total!=null?<small>O/U {market.total}</small>:null}
    </div>
    <div className="brBest">
      <span>{game.officialPick?.locked?"Official pick":"Upcoming pick"}</span>
      <strong>{best?.pick||"Pending · more than 7 days away"}</strong>
      <small>{best?best.index+" · "+betIndexTier(best.index).label:"No pick yet"}</small>
    </div>
    {best?<button className={"brSave "+(savedIds.has(id)?"saved":"")} onClick={()=>onToggleSave(saved)}>{savedIds.has(id)?"★":"☆"}</button>:<span/>}
  </article>;
}

function BetFilterDrawer({open,onClose,games,filters,setFilters}){
  if(!open)return null;
  const conferences=[...new Set(games.flatMap(g=>[g.home?.conference,g.away?.conference]).filter(Boolean))].sort();
  const teams=[...new Map(games.flatMap(g=>[g.away,g.home]).filter(Boolean).map(t=>[String(t.id),t])).values()].sort((a,b)=>String(a.location||a.name).localeCompare(String(b.location||b.name)));
  const networks=[...new Set(games.flatMap(g=>g.broadcasts||[]).filter(Boolean))].sort();
  return <div className="brFilterScrim" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <aside className="brFilterDrawer">
      <div className="brFilterHead"><strong>Filters</strong><button onClick={onClose}>Done</button></div>
      <label>Conference<select value={filters.conference} onChange={e=>setFilters(x=>({...x,conference:e.target.value}))}><option value="">All conferences</option>{conferences.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Team<select value={filters.team} onChange={e=>setFilters(x=>({...x,team:e.target.value}))}><option value="">All teams</option>{teams.map(t=><option value={String(t.id)} key={t.id}>{t.location||t.name}</option>)}</select></label>
      <label>TV network<select value={filters.network} onChange={e=>setFilters(x=>({...x,network:e.target.value}))}><option value="">Any network</option>{networks.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Bet type<select value={filters.type} onChange={e=>setFilters(x=>({...x,type:e.target.value}))}><option value="">Spread + totals</option><option value="spread">Spreads</option><option value="total">Totals</option></select></label>
      <label>Minimum BetIndex<select value={filters.minIndex} onChange={e=>setFilters(x=>({...x,minIndex:e.target.value}))}><option value="">Any signal</option><option value="55">Lean · 55+</option><option value="70">Strong · 70+</option><option value="80">Best Bet · 80+</option></select></label>
      <div className="grFilterChecks">
        <label><input type="checkbox" checked={filters.ranked} onChange={e=>setFilters(x=>({...x,ranked:e.target.checked}))}/> Ranked games</label>
        <label><input type="checkbox" checked={filters.close} onChange={e=>setFilters(x=>({...x,close:e.target.checked}))}/> Close spreads</label>
      </div>
      <button className="grClearFilters" onClick={()=>setFilters({conference:"",team:"",network:"",type:"",minIndex:"",ranked:false,close:false})}>Clear filters</button>
    </aside>
  </div>;
}

export default function BetsPage(){
  const[league,setLeague]=useState("nfl");
  const[prefsReady,setPrefsReady]=useState(false);
  const[data,setData]=useState({games:[],methodology:null,generatedAt:null});
  const[ledger,setLedger]=useState({weeks:[],record:{}});
  const[weekOffset,setWeekOffset]=useState(0);
  const[betSheet,setBetSheet]=useState([]);
  const[sheetReady,setSheetReady]=useState(false);
  const[query,setQuery]=useState("");
  const[agentSpec,setAgentSpec]=useState(null);
  const[agentMessage,setAgentMessage]=useState("");
  const[filtersOpen,setFiltersOpen]=useState(false);
  const[indexTier,setIndexTier]=useState("all");
  const[filters,setFilters]=useState({conference:"",team:"",network:"",type:"",minIndex:"",ranked:false,close:false});
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const range=useMemo(()=>footballRange(weekOffset),[weekOffset]);
  const weekLabel=rangeLabel(range);

  useEffect(()=>{
    if(typeof window==="undefined")return;
    const params=new URLSearchParams(window.location.search);
    const qLeague=params.get("league");
    const saved=window.localStorage.getItem("gameRadarLeague");
    const qWeek=Number(params.get("weekOffset"));
    setLeague(qLeague==="cfb"||qLeague==="nfl"?qLeague:saved==="cfb"?"cfb":"nfl");
    if(Number.isFinite(qWeek)&&params.has("weekOffset"))setWeekOffset(Math.max(0,Math.min(4,qWeek)));
    try{setBetSheet(JSON.parse(window.localStorage.getItem("gameRadarBetSheet")||"[]"));}catch{setBetSheet([])}
    setSheetReady(true);
    setPrefsReady(true);
  },[]);

  useEffect(()=>{
    if(!prefsReady||typeof window==="undefined")return;
    window.localStorage.setItem("gameRadarLeague",league);
    const url=new URL(window.location.href);
    url.searchParams.set("league",league);
    url.searchParams.set("weekOffset",String(weekOffset));
    window.history.replaceState({},"",url.pathname+url.search);
  },[league,weekOffset,prefsReady]);

  useEffect(()=>{
    if(!sheetReady||typeof window==="undefined")return;
    window.localStorage.setItem("gameRadarBetSheet",JSON.stringify(betSheet));
  },[betSheet,sheetReady]);

  useEffect(()=>{
    if(!prefsReady)return;
    let ignore=false;
    async function load(){
      try{
        setLoading(true);
        const [r,historyResponse]=await Promise.all([
          fetch("/api/bets?league="+league+"&start="+range.start+"&end="+range.end,{cache:"no-store"}),
          fetch("/api/radar-picks",{cache:"no-store"})
        ]);
        if(!r.ok||!historyResponse.ok)throw new Error();
        const [json,history]=await Promise.all([r.json(),historyResponse.json()]);
        if(!ignore){setData(json);setLedger(history);setError("")}
      }catch{if(!ignore)setError("BetRadar temporarily unavailable.")}
      finally{if(!ignore)setLoading(false)}
    }
    load();
    const timer=setInterval(()=>{if(document.visibilityState==="visible")load()},30*60*1000);
    return()=>{ignore=true;clearInterval(timer)}
  },[league,weekOffset,prefsReady]);

  const games=(data.games||[]).filter(g=>g.sport===league);
  const selectedWeek=(ledger.weeks||[]).find(w=>w.league===league&&w.weekStart===range.start);
  const archives=(ledger.weeks||[]).filter(w=>w.league===league&&w.weekStart!==range.start).slice().reverse();
  const savedIds=useMemo(()=>new Set(betSheet.map(x=>x.id)),[betSheet]);
  const weekSheet=useMemo(()=>betSheet.filter(x=>x.league===league&&x.weekStart===range.start).sort((a,b)=>new Date(a.gameDate)-new Date(b.gameDate)),[betSheet,league,range.start]);

  function toggleSavedPick(pick){
    setBetSheet(current=>current.some(x=>x.id===pick.id)?current.filter(x=>x.id!==pick.id):[...current,{...pick,savedAt:new Date().toISOString()}]);
  }
  function clearWeekSheet(){setBetSheet(current=>current.filter(x=>!(x.league===league&&x.weekStart===range.start)))}
  function savedFromGame(game){
    const best=game.bestOpportunity;
    if(!best)return null;
    const key=pickKeyForOpportunity(best);
    return {id:savedPickId(league,range.start,game.id,key),league,weekStart:range.start,weekLabel,gameId:game.id,key,matchup:matchup(game),gameDate:game.date,pick:best.pick,odds:best.americanOdds,index:best.index,source:"BetRadar Search"};
  }
  function runSearch(text){
    const spec=parseAgentQuery(text,{currentLeague:league,currentWeekOffset:weekOffset,games});
    setQuery(text);
    if(spec.isSaveAction){
      const prior=agentSpec?searchGames(games,agentSpec):[];
      const picks=prior.map(savedFromGame).filter(Boolean).slice(0,spec.saveCount||3);
      if(!picks.length){setAgentMessage("Search first, then ask to save the best picks.");return}
      setBetSheet(current=>{
        const map=new Map(current.map(x=>[x.id,x]));
        for(const pick of picks)map.set(pick.id,{...pick,savedAt:new Date().toISOString()});
        return [...map.values()];
      });
      setAgentMessage("Saved "+picks.length+" picks.");
      return;
    }
    setAgentMessage("");
    setAgentSpec(spec);
    if(spec.league!==league)setLeague(spec.league);
    if(spec.weekOffset!==weekOffset)setWeekOffset(Math.max(0,Math.min(4,spec.weekOffset)));
  }
  function submitSearch(e){e.preventDefault();if(query.trim())runSearch(query.trim())}

  const filteredGames=useMemo(()=>filterByTier(games.filter(game=>{
    const meta=gameMetadata(game);
    if(filters.conference&&!meta.conferences.includes(filters.conference))return false;
    if(filters.team&&String(game.home.id)!==filters.team&&String(game.away.id)!==filters.team)return false;
    if(filters.network&&!meta.broadcasts.includes(filters.network))return false;
    if(filters.minIndex&&Number(game.bestOpportunity?.index||0)<Number(filters.minIndex))return false;
    if(filters.ranked&&!meta.rankedInvolved)return false;
    if(filters.close&&(meta.spread==null||meta.spread>7.5))return false;
    if(filters.type&&game.bestOpportunity?.type?.toLowerCase()!==filters.type)return false;
    return true;
  }),game=>game.bestOpportunity?.index??game.betIndex?.score??0,indexTier,BET_INDEX_FILTERS),[games,filters,indexTier]);

  const opportunities=featuredOpportunities(filteredGames).filter(item=>!filters.type||item.type.toLowerCase()===filters.type);
  const top=opportunities.slice(0,10);
  const featured=top[0]||null;
  const nextBest=top.slice(1,5);
  const allGames=filteredGames.slice().sort((a,b)=>(b.bestOpportunity?.index||0)-(a.bestOpportunity?.index||0)||new Date(a.date)-new Date(b.date));

  const searchResults=useMemo(()=>{
    if(!agentSpec||agentSpec.isSaveAction||agentSpec.league!==league||agentSpec.weekOffset!==weekOffset)return [];
    return searchGames(games,agentSpec).slice(0,10);
  },[games,agentSpec,league,weekOffset]);

  const activeFilters=[];
  if(filters.conference)activeFilters.push(["conference",filters.conference]);
  if(filters.team){
    const t=games.flatMap(g=>[g.home,g.away]).find(t=>String(t.id)===filters.team);
    if(t)activeFilters.push(["team",t.location||t.name]);
  }
  if(filters.network)activeFilters.push(["network",filters.network]);
  if(filters.type)activeFilters.push(["type",filters.type==="spread"?"Spreads":"Totals"]);
  if(filters.minIndex)activeFilters.push(["minIndex",filters.minIndex+"+ Index"]);
  if(filters.ranked)activeFilters.push(["ranked","Ranked"]);
  if(filters.close)activeFilters.push(["close","Close spreads"]);

  function removeFilter(key){setFilters(x=>({...x,[key]:typeof x[key]==="boolean"?false:""}))}

  const parlays=featuredParlays(opportunities,league).slice(0,2);

  return <main className="brPage">
    <header className="brHeader">
      <a className="brLogo" href="/bets">BET<span>RADAR</span></a>
      <div className="brLeagueToggle">
        <button className={league==="nfl"?"active":""} onClick={()=>setLeague("nfl")}>NFL</button>
        <button className={league==="cfb"?"active":""} onClick={()=>setLeague("cfb")}>College</button>
      </div>
      <form className="brSearch" onSubmit={submitSearch}>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search teams, conferences, high-conviction bets, or ask what to bet…"/>
        <button type="submit">Search</button>
      </form>
      <a className="brSavedLink" href="#saved">★ My Bets <span>{weekSheet.length}</span></a>
      <a className="brGameLink" href={"/scores?league="+league+"&week="+weekOffset}>GameRadar</a>
      <RadarMenu current="/bets" className="suiteMenu"/>
    </header>

    <nav className="brPrimaryNav">
      <div className="brPrimaryLinks">
        <a href="#top">Our Picks</a>
        <a href="#all">All Games</a>
        <a href="#track-record">Track Record</a>
        <a href="#parlays">Parlays</a>
      </div>
      <div className="brPrimaryTools">
        <WeekSelector weekOffset={weekOffset} setWeekOffset={setWeekOffset} range={range}/>
        <button className="brFilterButton" onClick={()=>setFiltersOpen(true)}>Filters{activeFilters.length?" · "+activeFilters.length:""}</button>
      </div>
    </nav>

    <IndexTierFilter items={games} scoreOf={game=>game.bestOpportunity?.index??game.betIndex?.score??0} value={indexTier} onChange={setIndexTier} indexName="BETINDEX" tiers={BET_INDEX_FILTERS}/>

    {activeFilters.length?<div className="grActiveFilters">{activeFilters.map(([key,label])=><button key={key} onClick={()=>removeFilter(key)}>{label} ×</button>)}</div>:null}

    {agentSpec&&!agentSpec.isSaveAction?<section className="brSearchResults">
      <div className="grSectionHead">
        <div><h2>Search results</h2><p>{queryExplanation(agentSpec)}</p></div>
        <button onClick={()=>{setAgentSpec(null);setQuery("")}}>Clear</button>
      </div>
      <div className="grSearchChips">{agentSpec.chips.map(chip=><span key={chip}>{chip}</span>)}</div>
      <div className="brGameList">
        {searchResults.length?searchResults.map(game=><BetGameRow key={game.id} game={game} league={league} weekStart={range.start} weekLabel={weekLabel} savedIds={savedIds} onToggleSave={toggleSavedPick}/>):<div className="grEmpty">No bets match that search.</div>}
      </div>
    </section>:null}
    {agentMessage?<div className="brMessage">{agentMessage}</div>:null}

    {error?<div className="grEmpty">{error}</div>:null}
    {loading?<div className="grEmpty">Loading BetRadar…</div>:<>
      <section className="brSection" id="top">
        <div className="grSectionHead">
          <div><h2>Our Picks</h2><p>{weekName(weekOffset)} · {weekLabel} · one official pick per game. Locked selections remain fixed when the model or line moves.</p></div>
          <button onClick={()=>setFiltersOpen(true)}>Narrow board</button>
        </div>
        {featured?<BetPickCard item={featured} featured league={league} weekStart={range.start} weekLabel={weekLabel} weekOffset={weekOffset} isSaved={savedIds.has(savedPickId(league,range.start,featured.game.id,pickKeyForOpportunity(featured)))} onToggleSave={toggleSavedPick}/>:<div className="grEmpty">Picks appear when games enter the seven-day window.</div>}
        {nextBest.length?<div className="brTopGrid">{nextBest.map(item=><BetPickCard key={item.game.id+"-"+item.type} item={item} league={league} weekStart={range.start} weekLabel={weekLabel} weekOffset={weekOffset} isSaved={savedIds.has(savedPickId(league,range.start,item.game.id,pickKeyForOpportunity(item)))} onToggleSave={toggleSavedPick}/>)}</div>:null}
      </section>

      <section className="brSection" id="saved">
        <div className="grSectionHead">
          <div><h2>My Bets</h2><p>{weekSheet.length?weekSheet.length+" saved for "+weekLabel:"Save picks and they’ll appear here."}</p></div>
          {weekSheet.length?<button onClick={clearWeekSheet}>Clear week</button>:null}
        </div>
        {weekSheet.length?<div className="brSavedList">{weekSheet.map(pick=><div className="brSavedRow" key={pick.id}>
          <div><strong>{pick.pick}</strong><span>{pick.matchup}</span></div>
          <span>{new Date(pick.gameDate).toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"})}</span>
          <strong>{pick.index??"—"}</strong>
          <button onClick={()=>toggleSavedPick(pick)}>Remove</button>
        </div>)}</div>:<div className="brEmptyInline">No saved bets yet.</div>}
      </section>

      <section className="brSection" id="all">
        <div className="grSectionHead">
          <div><h2>All Games</h2><p>The same official picks shown above, including lower-ranked picks on the full slate.</p></div>
        </div>
        <div className="brGameList">
          {allGames.length?allGames.map(game=><BetGameRow key={game.id} game={game} league={league} weekStart={range.start} weekLabel={weekLabel} savedIds={savedIds} onToggleSave={toggleSavedPick}/>):<div className="grEmpty">No games match these filters.</div>}
        </div>
      </section>

      <section className="brSection" id="track-record">
        <div className="grSectionHead"><div><h2>Track Record</h2><p>Official picks and results in one place. A pick marked Picked is awaiting kickoff; results are graded after the game.</p></div>
          <strong>{ledger.record?.decisions?ledger.record.wins+"–"+ledger.record.losses:"No graded picks yet"}</strong>
        </div>
        <div className="brGameList">
          {games.filter(g=>g.officialPick).slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).map(game=>{
            const pick=game.officialPick;
            const status=pick.result&&pick.result!=="PENDING"?pick.result:new Date(game.date)>new Date()?"PICKED":"AWAITING RESULT";
            return <div className="brSavedRow" key={game.id}>
              <div><strong>{pick.pick}</strong><span>{matchup(game)} · {pick.locked?"LOCKED":"MODEL PICK"}</span></div>
              <span>{gameTime(game)}</span><strong>{status}</strong>
            </div>;
          })}
        </div>
        {selectedWeek?<p className="brRecordNote">{games.filter(g=>g.officialPick?.locked).length} locked picks on this week's live schedule · {games.filter(g=>g.officialPick&&!g.officialPick.locked).length} upcoming model picks. Unmatched archived fixtures are excluded from the board.</p>:null}
        {archives.length?<details className="brMethod"><summary>Previous weeks</summary>
          {archives.map(week=><details key={week.league+week.weekStart}><summary>{week.label||week.weekStart} · {(week.picks||[]).filter(p=>p.result==="W").length}–{(week.picks||[]).filter(p=>p.result==="L").length}</summary>
            <div className="brGameList">{(week.picks||[]).map(p=><div className="brSavedRow" key={p.gameId}><div><strong>{p.pick}</strong><span>{p.matchup}</span></div><strong>{p.result==="PENDING"?"AWAITING RESULT":p.result}</strong></div>)}</div>
          </details>)}
        </details>:null}
      </section>

      <section className="brSection brSecondary" id="parlays">
        <div className="grSectionHead"><div><h2>Parlays</h2><p>Combinations use only official picks. Payouts use recorded prices; verify current lines and odds before betting.</p></div></div>
        {parlays.length?<div className="brParlayGrid">{parlays.map((p,i)=><ParlayCard key={i} parlay={p}/>)}</div>:<div className="brEmptyInline">No qualifying parlay combinations yet.</div>}
        <details className="brMethod">
          <summary>BetRadar scoring and methodology</summary>
          <p>Locked picks keep their original selection, line and score. The visible BetIndex ranks those official picks against this week's slate; the lock score appears under “Why this score.” New games receive a model pick within seven days. BetIndex is not a win probability. Check the locked line against the current market before betting. <a href="/indexes">Read the full index guide →</a></p>
        </details>
      </section>
    </>}

    <BetFilterDrawer open={filtersOpen} onClose={()=>setFiltersOpen(false)} games={games} filters={filters} setFilters={setFilters}/>
  </main>;
}

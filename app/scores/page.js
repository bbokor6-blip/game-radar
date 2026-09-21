"use client";
import { useEffect, useMemo, useState } from "react";
import { parseAgentQuery, searchGames, queryExplanation } from "../../lib/agentSearch";
import { gameMetadata } from "../../lib/gameMetadata";

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

function rangeLabel(range){
  const a=range.startDate.toLocaleDateString([],{month:"short",day:"numeric"});
  const b=range.endDate.toLocaleDateString([],{month:"short",day:"numeric"});
  return a+"–"+b;
}
function weekName(offset){
  if(offset===-1)return "LAST WEEK";
  if(offset===0)return "THIS WEEK";
  if(offset===1)return "NEXT WEEK";
  if(offset>1)return "LOOK AHEAD · +"+offset;
  return "PAST WEEK";
}
function WeekSelector({weekOffset,setWeekOffset,range,min=-8,max=4,onChange}){
  function shift(next){setWeekOffset(next);onChange?.(next)}
  return <div className="weekSelector" aria-label="Select football week">
    <button disabled={weekOffset<=min} onClick={()=>shift(Math.max(min,weekOffset-1))} aria-label="Previous week">‹</button>
    <div>
      <span>{weekName(weekOffset)}</span>
      <strong>{rangeLabel(range)}</strong>
    </div>
    <button disabled={weekOffset>=max} onClick={()=>shift(Math.min(max,weekOffset+1))} aria-label="Next week">›</button>
  </div>;
}

function kickoff(game){
  return new Date(game.date).toLocaleString([],{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
}

function todayKey(date=new Date()){
  return new Date(date).toLocaleDateString("en-CA");
}

function gameDayKey(game){
  return new Date(game.date).toLocaleDateString("en-CA");
}

function marketLine(game){
  if(!game.market)return "Line pending";
  return game.market.details || (game.market.spread!=null?"Spread "+game.market.spread:"Line pending");
}

function network(game){
  return game.broadcasts?.[0]||null;
}

function isUpsetAlert(game){
  if(game.sport!=="cfb"||game.state!=="in")return false;
  if(game.away.rank&&!game.home.rank&&Number(game.home.score)>Number(game.away.score))return true;
  if(game.home.rank&&!game.away.rank&&Number(game.away.score)>Number(game.home.score))return true;
  return false;
}

function importanceLabel(game){
  const meta=gameMetadata(game);
  if(isUpsetAlert(game))return "Upset Alert";
  if(game.state==="in"&&Math.abs(Number(game.home.score)-Number(game.away.score))<=8)return "Close Game";
  if(meta.rivalry)return "Rivalry";
  if(meta.rankedMatchup)return "Ranked Matchup";
  if((game.interest?.score||0)>=76)return "Must Watch";
  if(meta.conferenceGame)return "Conference Game";
  if(meta.undefeatedInvolved)return "Undefeated Team";
  if(meta.spread!=null&&meta.spread<=7.5)return "Close Game";
  return "Worth Watching";
}

function contextLine(game){
  const meta=gameMetadata(game);
  const bits=[];
  if(meta.bothWinning)bits.push("Both teams have winning records");
  else if(meta.undefeatedInvolved)bits.push("Undefeated team involved");
  if(meta.rivalry)bits.push("Rivalry game");
  else if(meta.conferenceGame)bits.push("Conference matchup");
  if(meta.postseason)bits.push("Postseason");
  if(meta.broadcasts[0])bits.push(meta.broadcasts[0]);
  return bits.slice(0,2).join(" · ");
}
function whyInteresting(game){
  const reason=String(game?.interest?.reason||"").trim();
  if(reason)return reason.charAt(0).toUpperCase()+reason.slice(1);
  const context=contextLine(game);
  if(context)return context+".";
  if(game.state==="in")return "Live now and worth tracking.";
  return "One of the stronger games on this week's board.";
}

function Team({team,showScore,poss,favorite,onToggleFavorite}){
  const last=team.lastGame;
  return <div className="grTeam">
    <button className={"grFavStar "+(favorite?"active":"")} onClick={()=>onToggleFavorite(team.id)} aria-label={favorite?"Remove favorite":"Add favorite"}>{favorite?"★":"☆"}</button>
    {team.logo?<img className="grTeamLogo" src={team.logo} alt=""/>:<span className="grTeamLogo grLogoFallback"/>}
    <div className="grTeamText">
      <div className="grTeamName">{team.rank?<span className="grRank">#{team.rank}</span>:null}<strong>{team.location||team.short}</strong>{poss?<span className="grPoss">●</span>:null}</div>
      <span>{team.record||"Record unavailable"}{team.conference?" · "+team.conference:""}</span>
      {last?<small className="grLastResult">Last: {last.result} {last.pointsFor}-{last.pointsAgainst} {last.homeAway==="away"?"at":"vs"} {last.opponent}</small>:null}
    </div>
    {showScore?<div className="grScore">{team.score}</div>:null}
  </div>;
}

function GameMeta({game}){
  const meta=gameMetadata(game);
  const items=[];
  if(network(game))items.push(network(game));
  if(game.state==="pre")items.push(marketLine(game));
  if(game.market?.overUnder!=null)items.push("O/U "+game.market.overUnder);
  if(meta.venue)items.push(meta.venue);
  return <div className="grMeta">{items.slice(0,3).map(x=><span key={x}>{x}</span>)}</div>;
}

function GameCard({game,featured=false,favorites,onToggleFavorite,league,weekOffset}){
  const live=game.state==="in";
  const final=game.state==="post";
  const showScore=live||final;
  const label=importanceLabel(game);
  const status=live?(game.status||[game.period?"Q"+game.period:null,game.clock].filter(Boolean).join(" ")):final?"Final":kickoff(game);
  const context=contextLine(game);

  return <article className={"grGameCard "+(featured?"featured ":"")+(live?"live ":"")}>
    <div className="grGameTop">
      <span className={"grStatus "+(live?"live":"")}>{live?"● LIVE · "+status:status}</span>
      <div className="grGameSignals">
        <span className="grImportance">{label}</span>
        <span className="grRadarMark" title="RadarIndex" aria-label={"RadarIndex score "+(game.radarIndex?.score??game.interest?.score??"unavailable")}>{game.radarIndex?.score??game.interest?.score??"—"}</span>
      </div>
    </div>
    <div className="grTeams">
      <Team team={game.away} showScore={showScore} poss={game.possessionId===game.away.id} favorite={favorites.has(String(game.away.id))} onToggleFavorite={onToggleFavorite}/>
      <Team team={game.home} showScore={showScore} poss={game.possessionId===game.home.id} favorite={favorites.has(String(game.home.id))} onToggleFavorite={onToggleFavorite}/>
    </div>
    <GameMeta game={game}/>
    <div className="grWhyInteresting">
      <span>Why this game is interesting</span>
      <p>{whyInteresting(game)}</p>
    </div>
    {live&&game.downDistance?<div className="grContext grLiveContext">{game.downDistance}</div>:null}
    <details className="grDetails">
      <summary>More game details</summary>
      <div>
        {context?<span>{context}</span>:null}
        {game.venueCity?<span>{game.venueCity}{game.venueState?", "+game.venueState:""}</span>:null}
        <span>RadarIndex: <strong>{game.radarIndex?.score??game.interest?.score??"—"}</strong></span>
        <a href={"/bets?league="+league+"&weekOffset="+Math.max(0,weekOffset)+"&game="+game.id}>Open in BetRadar →</a>
      </div>
    </details>
  </article>;
}

function FilterDrawer({open,onClose,games,filters,setFilters,favoritesOnly,setFavoritesOnly}){
  const conferences=[...new Set(games.flatMap(g=>[g.home?.conference,g.away?.conference]).filter(Boolean))].sort();
  const teams=[...new Map(games.flatMap(g=>[g.away,g.home]).filter(Boolean).map(t=>[String(t.id),t])).values()].sort((a,b)=>String(a.location||a.name).localeCompare(String(b.location||b.name)));
  const networks=[...new Set(games.flatMap(g=>g.broadcasts||[]).filter(Boolean))].sort();
  if(!open)return null;
  return <div className="grFilterScrim" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <aside className="grFilterDrawer">
      <div className="grFilterHead"><strong>Filters</strong><button onClick={onClose}>Done</button></div>
      <label>Conference<select value={filters.conference} onChange={e=>setFilters(x=>({...x,conference:e.target.value}))}><option value="">All conferences</option>{conferences.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Team<select value={filters.team} onChange={e=>setFilters(x=>({...x,team:e.target.value}))}><option value="">All teams</option>{teams.map(t=><option value={String(t.id)} key={t.id}>{t.location||t.name}</option>)}</select></label>
      <label>Kickoff<select value={filters.window} onChange={e=>setFilters(x=>({...x,window:e.target.value}))}><option value="">Any time</option><option>EARLY</option><option>AFTERNOON</option><option>PRIMETIME</option><option>LATE</option></select></label>
      <label>TV network<select value={filters.network} onChange={e=>setFilters(x=>({...x,network:e.target.value}))}><option value="">Any network</option>{networks.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Max spread<select value={filters.spread} onChange={e=>setFilters(x=>({...x,spread:e.target.value}))}><option value="">Any spread</option><option value="3.5">3.5</option><option value="7.5">7.5</option><option value="10">10</option><option value="14">14</option></select></label>
      <div className="grFilterChecks">
        <label><input type="checkbox" checked={filters.ranked} onChange={e=>setFilters(x=>({...x,ranked:e.target.checked}))}/> Ranked games</label>
        <label><input type="checkbox" checked={filters.close} onChange={e=>setFilters(x=>({...x,close:e.target.checked}))}/> Close games</label>
        <label><input type="checkbox" checked={favoritesOnly} onChange={e=>setFavoritesOnly(e.target.checked)}/> Favorites only</label>
      </div>
      <button className="grClearFilters" onClick={()=>{setFilters({conference:"",team:"",window:"",network:"",spread:"",ranked:false,close:false});setFavoritesOnly(false)}}>Clear filters</button>
    </aside>
  </div>;
}

export default function Scores(){
  const[league,setLeague]=useState("nfl");
  const[weekOffset,setWeekOffset]=useState(0);
  const[view,setView]=useState("live");
  const[data,setData]=useState({games:[],generatedAt:null});
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const[query,setQuery]=useState("");
  const[agentSpec,setAgentSpec]=useState(null);
  const[filtersOpen,setFiltersOpen]=useState(false);
  const[filters,setFilters]=useState({conference:"",team:"",window:"",network:"",spread:"",ranked:false,close:false});
  const[favorites,setFavorites]=useState(new Set());
  const[favoritesOnly,setFavoritesOnly]=useState(false);
  const[ready,setReady]=useState(false);

  const range=useMemo(()=>footballRange(weekOffset),[weekOffset]);

  useEffect(()=>{
    if(typeof window==="undefined")return;
    const params=new URLSearchParams(window.location.search);
    const qLeague=params.get("league");
    const saved=window.localStorage.getItem("gameRadarLeague");
    setLeague(qLeague==="cfb"||qLeague==="nfl"?qLeague:saved==="cfb"?"cfb":"nfl");
    const week=Number(params.get("week"));
    if(Number.isFinite(week)&&params.has("week"))setWeekOffset(Math.max(-8,Math.min(4,week)));
    try{setFavorites(new Set(JSON.parse(window.localStorage.getItem("gameRadarFavorites")||"[]").map(String)))}catch{}
    setReady(true);
  },[]);

  useEffect(()=>{
    if(!ready||typeof window==="undefined")return;
    window.localStorage.setItem("gameRadarLeague",league);
    window.localStorage.setItem("gameRadarFavorites",JSON.stringify([...favorites]));
    const url=new URL(window.location.href);
    url.searchParams.set("league",league);
    url.searchParams.set("week",String(weekOffset));
    window.history.replaceState({},"",url.pathname+url.search);
  },[league,weekOffset,favorites,ready]);

  async function load(){
    try{
      const r=await fetch("/api/games?league="+league+"&start="+range.start+"&end="+range.end,{cache:"no-store"});
      if(!r.ok)throw new Error();
      setData(await r.json());
      setError("");
    }catch{setError("Score feed temporarily unavailable.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{if(!ready)return;setLoading(true);load()},[league,weekOffset,ready]);

  const hasLive=(data.games||[]).some(g=>g.state==="in");
  useEffect(()=>{
    if(!ready||weekOffset!==0)return;
    const timer=setInterval(()=>{if(document.visibilityState==="visible")load()},hasLive?30000:300000);
    return()=>clearInterval(timer);
  },[ready,league,weekOffset,hasLive]);

  function toggleFavorite(id){
    setFavorites(current=>{
      const next=new Set(current);
      const key=String(id);
      if(next.has(key))next.delete(key); else next.add(key);
      return next;
    });
  }

  const games=(data.games||[]).filter(g=>g.sport===league);
  const filtered=useMemo(()=>games.filter(game=>{
    const meta=gameMetadata(game);
    if(filters.conference&&!meta.conferences.includes(filters.conference))return false;
    if(filters.team&&String(game.home.id)!==filters.team&&String(game.away.id)!==filters.team)return false;
    if(filters.window&&meta.kickoffWindow!==filters.window)return false;
    if(filters.network&&!meta.broadcasts.includes(filters.network))return false;
    if(filters.spread&&(meta.spread==null||meta.spread>Number(filters.spread)))return false;
    if(filters.ranked&&!meta.rankedInvolved)return false;
    if(filters.close){
      const liveClose=game.state==="in"&&Math.abs(Number(game.home.score)-Number(game.away.score))<=8;
      const preClose=game.state==="pre"&&meta.spread!=null&&meta.spread<=7.5;
      if(!liveClose&&!preClose)return false;
    }
    if(favoritesOnly&&!favorites.has(String(game.home.id))&&!favorites.has(String(game.away.id)))return false;
    if(view==="today"&&gameDayKey(game)!==todayKey())return false;
    if(view==="live"&&game.state!=="in"&&hasLive)return false;
    return true;
  }),[games,filters,favoritesOnly,favorites,view,hasLive]);

  const radarScore=g=>g.radarIndex?.score??g.interest?.score??0;
  const live=filtered.filter(g=>g.state==="in").sort((a,b)=>radarScore(b)-radarScore(a));
  const upcoming=filtered.filter(g=>g.state==="pre").sort((a,b)=>radarScore(b)-radarScore(a)||new Date(a.date)-new Date(b.date));
  const finals=filtered.filter(g=>g.state==="post").sort((a,b)=>new Date(b.date)-new Date(a.date));
  const featured=live[0]||upcoming[0]||null;
  const otherLive=featured&&featured.state==="in"?live.slice(1):live;
  const worth=upcoming.filter(g=>g.id!==featured?.id).slice(0,4);
  const allUpcoming=upcoming.filter(g=>g.id!==featured?.id&&!worth.some(w=>w.id===g.id)).sort((a,b)=>new Date(a.date)-new Date(b.date));

  const activeFilterChips=[];
  if(filters.conference)activeFilterChips.push(["conference",filters.conference]);
  if(filters.team){
    const t=games.flatMap(g=>[g.home,g.away]).find(t=>String(t.id)===filters.team);
    if(t)activeFilterChips.push(["team",t.location||t.name]);
  }
  if(filters.window)activeFilterChips.push(["window",filters.window]);
  if(filters.network)activeFilterChips.push(["network",filters.network]);
  if(filters.spread)activeFilterChips.push(["spread","Spread ≤ "+filters.spread]);
  if(filters.ranked)activeFilterChips.push(["ranked","Ranked"]);
  if(filters.close)activeFilterChips.push(["close","Close games"]);
  if(favoritesOnly)activeFilterChips.push(["favorites","Favorites"]);

  function removeFilter(key){
    if(key==="favorites"){setFavoritesOnly(false);return;}
    setFilters(x=>({...x,[key]:typeof x[key]==="boolean"?false:""}));
  }

  function submitSearch(e){
    e.preventDefault();
    if(!query.trim()){setAgentSpec(null);return;}
    const spec=parseAgentQuery(query.trim(),{currentLeague:league,currentWeekOffset:weekOffset,games});
    setAgentSpec(spec);
    if(spec.league!==league)setLeague(spec.league);
    if(spec.weekOffset!==weekOffset)setWeekOffset(spec.weekOffset);
  }

  const searchResults=useMemo(()=>{
    if(!agentSpec||agentSpec.isSaveAction||agentSpec.league!==league||agentSpec.weekOffset!==weekOffset)return [];
    return searchGames(games,agentSpec).slice(0,8);
  },[games,agentSpec,league,weekOffset]);

  return <main className="grPage">
    <header className="grHeader">
      <a className="grLogo" href="/scores">GAME<span>RADAR</span></a>
      <div className="grLeagueToggle">
        <button className={league==="nfl"?"active":""} onClick={()=>setLeague("nfl")}>NFL</button>
        <button className={league==="cfb"?"active":""} onClick={()=>setLeague("cfb")}>College</button>
      </div>
      <form className="grSearch" onSubmit={submitSearch}>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search teams, conferences, ranked games, or ask what to watch…"/>
        <button type="submit">Search</button>
      </form>
      <button className={"grHeaderButton "+(favoritesOnly?"active":"")} onClick={()=>setFavoritesOnly(x=>!x)}>★ Favorites</button>
      <a className="grBetLink" href={"/bets?league="+league+"&weekOffset="+Math.max(0,weekOffset)}>BetRadar</a>
      <details className="suiteMenu"><summary>☰</summary><div><a href="/weekly">Weekly Radar</a><a href="/pickradar">PickRadar</a><a href="/scores">GameRadar</a><a href="/bets">BetRadar</a><a href="/">Home</a></div></details>
    </header>

    <nav className="grPrimaryNav">
      <div className="grPrimaryLinks">
        <button className={view==="live"&&weekOffset===0?"active":""} disabled={weekOffset!==0} onClick={()=>setView("live")}>Live</button>
        <button className={view==="today"&&weekOffset===0?"active":""} disabled={weekOffset!==0} onClick={()=>setView("today")}>Today</button>
        <button className={view==="week"?"active":""} onClick={()=>setView("week")}>{weekOffset===0?"This Week":weekOffset===-1?"Last Week":weekOffset===1?"Next Week":"Week Board"}</button>
      </div>
      <div className="grPrimaryTools">
        <WeekSelector weekOffset={weekOffset} setWeekOffset={setWeekOffset} range={range} onChange={()=>setView("week")}/>
        <button className="grFilterButton" onClick={()=>setFiltersOpen(true)}>Filters{activeFilterChips.length?" · "+activeFilterChips.length:""}</button>
      </div>
    </nav>

    {activeFilterChips.length?<div className="grActiveFilters">{activeFilterChips.map(([key,label])=><button key={key} onClick={()=>removeFilter(key)}>{label} ×</button>)}</div>:null}

    {agentSpec?<section className="grSearchResults">
      <div className="grSectionHead">
        <div><h2>Search results</h2><p>{queryExplanation(agentSpec)}</p></div>
        <button onClick={()=>{setAgentSpec(null);setQuery("")}}>Clear</button>
      </div>
      <div className="grSearchChips">{agentSpec.chips.map(chip=><span key={chip}>{chip}</span>)}</div>
      <div className="grCompactList">{searchResults.length?searchResults.map(g=><GameCard key={g.id} game={g} favorites={favorites} onToggleFavorite={toggleFavorite} league={league} weekOffset={weekOffset}/>):<div className="grEmpty">No games match that search.</div>}</div>
    </section>:null}

    {error?<div className="grEmpty">{error}</div>:null}
    {loading?<div className="grEmpty">Loading games…</div>:<>
      {featured?<section className="grSection grLeadSection">
        <div className="grSectionHead"><div><h2>{featured.state==="in"?"Live Now":"Worth Watching Next"}</h2><p>{featured.state==="in"?"The game that deserves your attention right now.":"The top upcoming game on the board."}</p></div></div>
        <GameCard game={featured} featured favorites={favorites} onToggleFavorite={toggleFavorite} league={league} weekOffset={weekOffset}/>
      </section>:null}

      {otherLive.length?<section className="grSection">
        <div className="grSectionHead"><div><h2>Live Now</h2><p>{otherLive.length} more live game{otherLive.length===1?"":"s"}.</p></div></div>
        <div className="grCompactList">{otherLive.map(g=><GameCard key={g.id} game={g} favorites={favorites} onToggleFavorite={toggleFavorite} league={league} weekOffset={weekOffset}/>)}</div>
      </section>:null}

      {worth.length?<section className="grSection">
        <div className="grSectionHead"><div><h2>Worth Watching Next</h2><p>Competitive games and contextual matchups rising to the top.</p></div></div>
        <div className="grWorthGrid">{worth.map(g=><GameCard key={g.id} game={g} favorites={favorites} onToggleFavorite={toggleFavorite} league={league} weekOffset={weekOffset}/>)}</div>
      </section>:null}

      {allUpcoming.length?<section className="grSection">
        <div className="grSectionHead"><div><h2>All Games</h2><p>{rangeLabel(range)}</p></div></div>
        <div className="grCompactList">{allUpcoming.map(g=><GameCard key={g.id} game={g} favorites={favorites} onToggleFavorite={toggleFavorite} league={league} weekOffset={weekOffset}/>)}</div>
      </section>:null}

      {finals.length?<section className="grSection">
        <div className="grSectionHead"><div><h2>Final Scores</h2><p>Completed games from this view.</p></div></div>
        <div className="grCompactList finals">{finals.map(g=><GameCard key={g.id} game={g} favorites={favorites} onToggleFavorite={toggleFavorite} league={league} weekOffset={weekOffset}/>)}</div>
      </section>:null}

      {!featured&&!otherLive.length&&!worth.length&&!allUpcoming.length&&!finals.length?<div className="grEmpty">No games match this view.</div>:null}
    </>}

    <FilterDrawer open={filtersOpen} onClose={()=>setFiltersOpen(false)} games={games} filters={filters} setFilters={setFilters} favoritesOnly={favoritesOnly} setFavoritesOnly={setFavoritesOnly}/>
  </main>;
}

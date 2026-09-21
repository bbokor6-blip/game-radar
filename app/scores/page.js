"use client";
import { useEffect, useMemo, useState } from "react";

const LEAGUES=[
  ["nfl","NFL","Every NFL game"],
  ["cfb","COLLEGE FBS","Every FBS game · Top 25 featured"]
];
const MODES=[
  ["recap","RECAP","What happened last week?"],
  ["live","THIS WEEK / LIVE GAMES","Live first · full weekly board"],
  ["ahead","WEEK AHEAD","What should I circle?"]
];

function footballRange(offset){
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

function gameTime(game){
  return new Date(game.date).toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"});
}

function matchupLabel(game){
  return game.away.short+" @ "+game.home.short;
}

function marketLine(game){
  if(!game.market) return "LINE PENDING";
  return game.market.details || (game.market.spread!=null ? "SPREAD "+game.market.spread : "LINE PENDING");
}

function closeCallout(game){
  if(game.state==="pre"){
    const spread=Math.abs(Number(game.market?.spread));
    if(Number.isFinite(spread)&&spread<10){
      return "PROJECTED CLOSE · "+spread+" PT SPREAD";
    }
    return null;
  }
  const diff=Math.abs(Number(game.home.score)-Number(game.away.score));
  if(diff<10){
    if(diff===0) return game.state==="in"?"TIED GAME":"TIED AT END OF REGULATION";
    return (game.state==="in"?"CLOSE GAME":"CLOSE FINISH")+" · "+diff+" PT MARGIN";
  }
  return null;
}

function betIdea(game){
  const spread=Math.abs(Number(game.market?.spread));
  const total=Number(game.market?.overUnder);
  if(!Number.isFinite(spread)) return "WAIT FOR LINE";
  if(spread<=3 && Number.isFinite(total) && total>=50) return "HIGH-TOTAL TOSS-UP";
  if(spread<=3) return "CLOSE-SPREAD GAME";
  if(spread<10 && Number.isFinite(total) && total>=48) return "CLOSE GAME + ACTIVE TOTAL";
  if(spread<10) return "UNDER-10 SPREAD";
  if(Number.isFinite(total) && total>=55) return "TOTAL WORTH WATCHING";
  return "MARKET WATCH";
}

function TeamLine({team,possession,showScore=true}){
  return <div className="teamLine">
    <div className="teamLeft">
      {team.logo?<img src={team.logo} alt="" className="teamLogo"/>:<div className="teamLogo fallback"/>}
      <div className="teamMeta">
        <div className="teamLabel">
          {team.rank?<span className="rankTag">#{team.rank}</span>:null}
          <span>{team.short}</span>
          {possession?<span className="ball">●</span>:null}
        </div>
        <div className="record">{team.record||""}</div>
      </div>
    </div>
    <div className="plainScore">{showScore?team.score:"—"}</div>
  </div>;
}

function GameRow({game,mode}){
  const live=game.state==="in";
  const showScore=game.state!=="pre";
  const close=closeCallout(game);
  const hot=live&&game.interest.score>=82;
  const watch=live&&game.interest.score>=58;
  const cls=[hot?"hot":"",watch&&!hot?"watch":"",close?"closeMatch":""].filter(Boolean).join(" ");

  return <article className={"gameRow "+cls}>
    <div className="gameRowTop">
      <span>{game.sport==="cfb"?"COLLEGE FBS":"NFL"}</span>
      <span className={live?"liveText":""}>{live?"● LIVE":game.state==="post"?"FINAL":gameTime(game)}</span>
    </div>

    {close?<div className="closeCallout">{close}</div>:null}

    <div className="gameRowBody">
      <div className="scoreSide">
        <TeamLine team={game.away} possession={game.possessionId===game.away.id} showScore={showScore}/>
        <TeamLine team={game.home} possession={game.possessionId===game.home.id} showScore={showScore}/>
      </div>
      <div className="interestSide">
        <span className="interestLabel">{live?"LIVE INTEREST":game.state==="post"?(mode==="recap"?"RECAP":"FINAL"):game.state==="pre"?"FUTURE INTEREST":"GAME INTEREST"}</span>
        <strong>{game.interest.score}</strong>
        <small>{game.interest.tier}</small>
      </div>
    </div>

    {mode==="ahead"?<div className="lineBar">
      <span>{marketLine(game)}</span>
      {game.market?.overUnder!=null?<span>O/U {game.market.overUnder}</span>:null}
    </div>:null}

    <div className="reasonLine">{game.interest.reason}{live&&game.downDistance?" · "+game.downDistance:""}</div>
  </article>;
}

function BetBoard({games,league}){
  const rows=games
    .filter(g=>g.state==="pre"&&g.marketInterest&&g.marketInterest.score>0)
    .sort((a,b)=>b.marketInterest.score-a.marketInterest.score)
    .slice(0,10);

  return <aside className="betPanel">
    <div className="betHeader">
      <span>{league==="nfl"?"NFL":"COLLEGE"} BETTING RADAR</span>
      <h3>TOP 10 MARKET GAMES</h3>
      <p>The most interesting betting setups based on spread tightness, totals and matchup context.</p>
    </div>
    {rows.length?rows.map((g,i)=><div className="betRow" key={g.id}>
      <div className="betRank">{i+1}</div>
      <div className="betMain">
        <strong>{matchupLabel(g)}</strong>
        <span>{marketLine(g)}{g.market?.overUnder!=null?" · O/U "+g.market.overUnder:""}</span>
        <small>{betIdea(g)}</small>
      </div>
      <div className="betScore">{g.marketInterest.score}</div>
    </div>):<div className="betEmpty">BETTING LINES HAVE NOT POPULATED YET.</div>}
    <div className="betFoot">This ranks betting-market intrigue. It is not a prediction of which side will cover.</div>
  </aside>;
}

export default function Home(){
  const[league,setLeague]=useState("nfl");
  const[weekOffset,setWeekOffset]=useState(0);
  const[mode,setMode]=useState("live");
  const[data,setData]=useState({games:[],generatedAt:null});
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const[refreshing,setRefreshing]=useState(false);

  const range=useMemo(()=>footballRange(weekOffset),[weekOffset]);

  function chooseMode(next){
    setMode(next);
    if(next==="recap")setWeekOffset(-1);
    if(next==="live")setWeekOffset(0);
    if(next==="ahead")setWeekOffset(1);
  }

  async function load(manual=false,offset=weekOffset,currentLeague=league){
    if(manual)setRefreshing(true);
    try{
      const w=footballRange(offset);
      const r=await fetch("/api/games?league="+currentLeague+"&start="+w.start+"&end="+w.end,{cache:"no-store"});
      if(!r.ok)throw new Error();
      setData(await r.json());
      setError("");
    }catch{
      setError("SCORE FEED TEMPORARILY OFFLINE");
    }finally{
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(()=>{
    setLoading(true);
    load(false,weekOffset,league);
    if(mode!=="live"||weekOffset!==0)return;
    const poll=()=>{if(typeof document==="undefined"||document.visibilityState==="visible")load(false,0,league);};
    const timer=setInterval(poll,30000);
    const onVisibility=()=>{if(document.visibilityState==="visible")load(false,0,league);};
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{clearInterval(timer);document.removeEventListener("visibilitychange",onVisibility)};
  },[league,weekOffset,mode]);

  const games=(data.games||[]).filter(g=>g.sport===league);
  const live=games.filter(g=>g.state==="in").sort((a,b)=>b.interest.score-a.interest.score);
  const finals=games.filter(g=>g.state==="post").sort((a,b)=>new Date(b.date)-new Date(a.date));
  const upcoming=games.filter(g=>g.state==="pre").sort((a,b)=>new Date(a.date)-new Date(b.date));
  const weekNumber=games.find(g=>g.week)?.week||null;
  const weekTitle=(league==="nfl"?"NFL":"COLLEGE")+(weekNumber?" WEEK "+weekNumber:" FOOTBALL WEEK")+" · "+rangeLabel(range);

  return <main className="shell">
    <a className="suiteHome" href="/">← GAME RADAR HOME</a>
    <nav className="productSwitcher" aria-label="Game Radar products">
      <a className="betradar" href="/bets">
        <strong>BETRADAR</strong>
        <small>Bets · confidence · teasers</small>
      </a>
      <a className="active gameradar" href="/scores">
        <strong>GAMERADAR</strong>
        <small>Live scores · what to watch</small>
      </a>
    </nav>

    <header className="stadiumHeader">
      <div>
        <div className="brand">GAME<span>RADAR</span></div>
        <div className="headerKicker">FOOTBALL INTELLIGENCE BOARD</div>
        <h1>GAMERADAR</h1>
        <p>Live scores, close games and the football worth watching right now.</p>
      </div>
      <div className="headerActions"><button className="refresh" onClick={()=>load(true)}>{refreshing?"SCANNING":"↻ SCAN"}</button></div>
    </header>

    <div className="leagueSwitchBlock scoreLeagueSwitch">
      <span className="switchLabel">CHOOSE LEAGUE</span>
      <nav className="leagueHero" aria-label="League">
      {LEAGUES.map(([v,title,sub])=><button key={v} className={league===v?"active":""} onClick={()=>setLeague(v)}>
        <strong>{title}</strong><small>{sub}</small>
      </button>)}
      </nav>
    </div>

    <nav className="modeRail" aria-label="Timeframe">
      {MODES.map(([v,title,q])=><button key={v} className={mode===v?"active":""} onClick={()=>chooseMode(v)}>
        <span>{title}</span><small>{q}</small>
      </button>)}
    </nav>

    <section className="weekBoard">
      <button aria-label="Previous football week" onClick={()=>setWeekOffset(x=>Math.max(-8,x-1))}>‹</button>
      <div>
        <span>SELECTED FOOTBALL WEEK</span>
        <strong>{weekTitle}</strong>
      </div>
      <button aria-label="Next football week" onClick={()=>setWeekOffset(x=>Math.min(2,x+1))}>›</button>
    </section>

    {error?<div className="notice error">{error}</div>:null}

    {loading?<div className="notice">SCANNING THE BOARD...</div>:<>
      {mode==="recap"?<>
        <div className="sectionIntro"><span>RECAP</span><h2>THE GAMES THAT WERE WORTH IT</h2><p>Finished games ranked by closeness, drama and matchup importance.</p></div>
        <section className="scoreList">
          {finals.length?finals.map(g=><GameRow key={g.id} game={g} mode="recap"/>):<div className="notice">NO FINALS FOUND FOR THIS FOOTBALL WEEK</div>}
        </section>
      </>:mode==="ahead"?<>
        <div className="sectionIntro"><span>WEEK AHEAD</span><h2>EVERY UPCOMING GAME GETS A FUTURE INTEREST SCORE</h2><p>Close projected matchups matter most. Spread, records and matchup context shape every 0–100 score.</p></div>
        <div className="aheadGrid">
          <section className="scoreList">
            <div className="listHeader"><span>UPCOMING GAMES</span><span>INTEREST</span></div>
            {upcoming.length?upcoming.map(g=><GameRow key={g.id} game={g} mode="ahead"/>):<div className="notice">NO UPCOMING GAMES FOUND FOR THIS FOOTBALL WEEK</div>}
          </section>
          <BetBoard games={upcoming} league={league}/>
        </div>
      </>:<>
        {live.length?<section className="weekScoreSection livePriority">
          <div className="sectionIntro"><span>● LIVE NOW</span><h2>WHAT DESERVES YOUR SCREEN</h2><p>Live games are always pinned to the top, with the highest-interest games first.</p></div>
          <div className="scoreList">
            {live.map(g=><GameRow key={g.id} game={g} mode="live"/>)}
          </div>
        </section>:null}

        {upcoming.length?<section className="weekScoreSection">
          <div className="sectionIntro"><span>UP NEXT THIS WEEK</span><h2>UPCOMING</h2><p>Everything still to come in the selected football week.</p></div>
          <div className="scoreList">
            {upcoming.map(g=><GameRow key={g.id} game={g} mode="current"/>)}
          </div>
        </section>:null}

        <section className="weekScoreSection">
          <div className="sectionIntro"><span>FINAL THIS WEEK</span><h2>COMPLETED GAMES</h2><p>Every completed game from the selected football week, newest first.</p></div>
          <div className="scoreList">
            {finals.length?finals.map(g=><GameRow key={g.id} game={g} mode="current"/>):<div className="notice">NO COMPLETED GAMES YET THIS WEEK</div>}
          </div>
        </section>

        {!live.length&&!upcoming.length&&!finals.length?<div className="notice">NO GAMES FOUND FOR THIS FOOTBALL WEEK</div>:null}
      </>}
    </>}

    <footer>
      {mode==="live"?"THIS WEEK / LIVE GAMES · AUTO-SCAN 30 SEC":"GAME COMMAND CENTER"}
      {data.generatedAt?" · "+new Date(data.generatedAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}):""}
      <div>{league==="nfl"?"NFL · ALL GAMES":"COLLEGE · ALL FBS GAMES"} · CLOSE MATCHUPS WEIGHTED HEAVILY</div>
    </footer>
  </main>;
}

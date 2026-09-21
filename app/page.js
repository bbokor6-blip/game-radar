"use client";
import { useEffect, useMemo, useState } from "react";

const LEAGUES=[["all","ALL"],["nfl","NFL"],["cfb","COLLEGE TOP 25"]];
const MODES=[
  ["recap","RECAP","What happened?"],
  ["live","LIVE","What matters now?"],
  ["ahead","WEEK AHEAD","What should I circle?"]
];

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

function betIdea(game){
  const spread=Math.abs(Number(game.market?.spread));
  const total=Number(game.market?.overUnder);
  if(!Number.isFinite(spread)) return "WAIT FOR LINE";
  if(spread<=3 && Number.isFinite(total) && total>=50) return "HIGH-TOTAL TOSS-UP";
  if(spread<=3) return "CLOSE-SPREAD GAME";
  if(spread<=7 && Number.isFinite(total) && total>=48) return "SPREAD + TOTAL";
  if(spread<=7) return "ONE-SCORE SPREAD";
  if(Number.isFinite(total) && total>=55) return "TOTAL WORTH WATCHING";
  return "MARKET WATCH";
}

function TeamLine({team,possession,showScore=true}){
  return <div className="teamLine">
    <div className="teamLeft">
      {team.logo?<img src={team.logo} alt="" className="teamLogo"/>:<div className="teamLogo fallback"/>}
      <div className="teamMeta">
        <div className="teamLabel">{team.rank?<span className="rankTag">#{team.rank}</span>:null}{team.short}{possession?<span className="ball">●</span>:null}</div>
        <div className="record">{team.record||""}</div>
      </div>
    </div>
    <div className="plainScore">{showScore?team.score:"—"}</div>
  </div>;
}

function GameRow({game,mode,index}){
  const live=game.state==="in";
  const showScore=game.state!=="pre";
  const hot=live&&game.interest.score>=82;
  const watch=live&&game.interest.score>=58;
  const cls=hot?"hot":watch?"watch":"";
  return <article className={"gameRow "+cls}>
    <div className="gameRowTop">
      <span className="leaguePill">{game.sport==="cfb"?"COLLEGE TOP 25":"NFL"}</span>
      <span className={live?"liveText":""}>{live?"● LIVE":game.state==="post"?"FINAL":gameTime(game)}</span>
    </div>
    <div className="gameRowBody">
      <div className="scoreSide">
        <TeamLine team={game.away} possession={game.possessionId===game.away.id} showScore={showScore}/>
        <TeamLine team={game.home} possession={game.possessionId===game.home.id} showScore={showScore}/>
      </div>
      <div className="interestSide">
        <span className="interestLabel">{mode==="recap"?"RECAP":live?"LIVE INTEREST":"FUTURE INTEREST"}</span>
        <strong>{game.interest.score}</strong>
        <small>{game.interest.tier}</small>
      </div>
    </div>
    {mode==="ahead"?<div className="lineBar"><span>{marketLine(game)}</span>{game.market?.overUnder!=null?<span>O/U {game.market.overUnder}</span>:null}</div>:null}
    <div className="reasonLine">{game.interest.reason}{live&&game.downDistance?" · "+game.downDistance:""}</div>
  </article>;
}

function BetBoard({games}){
  const rows=games
    .filter(g=>g.state==="pre"&&g.marketInterest&&g.marketInterest.score>0)
    .sort((a,b)=>b.marketInterest.score-a.marketInterest.score)
    .slice(0,10);
  return <aside className="betPanel">
    <div className="betHeader">
      <span>BETTING RADAR</span>
      <h3>TOP 10 BETTING SPOTS</h3>
      <p>Games with the most interesting market setup. These are watchlist ideas, not predicted winners.</p>
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
    <div className="betFoot">BETTING RADAR ranks market intrigue using spread tightness, totals and matchup context. It does not estimate betting edge or expected value.</div>
  </aside>;
}

export default function Home(){
  const[league,setLeague]=useState("all");
  const[weekOffset,setWeekOffset]=useState(0);
  const[mode,setMode]=useState("live");
  const[data,setData]=useState({games:[],generatedAt:null});
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const[refreshing,setRefreshing]=useState(false);

  function range(offset){
    const now=new Date(),day=now.getDay(),start=new Date(now);
    start.setDate(now.getDate()-day+(offset*7));
    const end=new Date(start);end.setDate(start.getDate()+6);
    const fmt=d=>d.toISOString().slice(0,10);
    return{start:fmt(start),end:fmt(end)};
  }

  function chooseMode(next){
    setMode(next);
    if(next==="recap")setWeekOffset(-1);
    if(next==="live")setWeekOffset(0);
    if(next==="ahead")setWeekOffset(1);
  }

  async function load(manual=false,offset=weekOffset){
    if(manual)setRefreshing(true);
    try{
      const w=range(offset);
      const r=await fetch("/api/games?start="+w.start+"&end="+w.end,{cache:"no-store"});
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
    load(false,weekOffset);
    if(mode!=="live"||weekOffset!==0)return;
    const timer=setInterval(()=>load(false,0),30000);
    return()=>clearInterval(timer);
  },[weekOffset,mode]);

  const filtered=useMemo(()=>league==="all"?data.games:data.games.filter(g=>g.sport===league),[data.games,league]);
  const live=filtered.filter(g=>g.state==="in").sort((a,b)=>b.interest.score-a.interest.score);
  const finals=filtered.filter(g=>g.state==="post").sort((a,b)=>b.interest.score-a.interest.score);
  const upcoming=filtered.filter(g=>g.state==="pre").sort((a,b)=>b.interest.score-a.interest.score);
  const liveBoard=live.length?live:filtered.filter(g=>g.state==="post").sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,10);

  return <main className="shell">
    <header className="stadiumHeader">
      <div>
        <div className="brand">GAME<span>RADAR</span></div>
        <div className="headerKicker">FOOTBALL INTELLIGENCE BOARD</div>
        <h1>GAME COMMAND CENTER</h1>
        <p>Look back. Watch live. Know what is worth circling next.</p>
      </div>
      <button className="refresh" onClick={()=>load(true)}>{refreshing?"SCANNING":"↻ SCAN"}</button>
    </header>

    <nav className="modeRail" aria-label="View">
      {MODES.map(([v,title,q])=><button key={v} className={mode===v?"active":""} onClick={()=>chooseMode(v)}>
        <span>{title}</span><small>{q}</small>
      </button>)}
    </nav>

    <section className="controlDeck">
      <div className="leagueBlock">
        <span className="controlLabel">LEAGUE</span>
        <div className="leagueToggle">
          {LEAGUES.map(([v,l])=><button key={v} className={league===v?"active":""} onClick={()=>setLeague(v)}>{l}</button>)}
        </div>
      </div>
      <label className="weekPicker">WEEK
        <select value={weekOffset} onChange={e=>setWeekOffset(Number(e.target.value))}>
          <option value="1">NEXT WEEK</option>
          <option value="0">CURRENT WEEK</option>
          <option value="-1">LAST WEEK</option>
          <option value="-2">2 WEEKS AGO</option>
          <option value="-3">3 WEEKS AGO</option>
          <option value="-4">4 WEEKS AGO</option>
        </select>
      </label>
    </section>

    {error?<div className="notice error">{error}</div>:null}
    {loading?<div className="notice">SCANNING THE BOARD...</div>:<>
      {mode==="recap"?<>
        <div className="sectionIntro"><span>RECAP</span><h2>THE GAMES THAT WERE WORTH IT</h2><p>Completed games ranked by drama, closeness and context.</p></div>
        <section className="scoreList">
          {finals.length?finals.map((g,i)=><GameRow key={g.id} game={g} mode="recap" index={i}/>):<div className="notice">NO FINALS FOUND FOR THIS WEEK</div>}
        </section>
      </>:mode==="ahead"?<>
        <div className="sectionIntro"><span>WEEK AHEAD</span><h2>EVERY UPCOMING GAME GETS A SCORE</h2><p>Future Interest is 0–100 and uses betting spread, matchup quality, records and Top 25 context.</p></div>
        <div className="aheadGrid">
          <section className="scoreList">
            <div className="listHeader"><span>UPCOMING GAMES</span><span>FUTURE INTEREST</span></div>
            {upcoming.length?upcoming.map((g,i)=><GameRow key={g.id} game={g} mode="ahead" index={i}/>):<div className="notice">NO UPCOMING GAMES FOUND</div>}
          </section>
          <BetBoard games={upcoming}/>
        </div>
      </>:<>
        <div className="sectionIntro"><span>LIVE</span><h2>{live.length?"WHAT DESERVES YOUR SCREEN":"LATEST SCORES"}</h2><p>{live.length?"Live games ranked by urgency and rescored every 30 seconds.":"No game is live right now. Showing the latest completed scores."}</p></div>
        <section className="scoreList">
          {liveBoard.length?liveBoard.map((g,i)=><GameRow key={g.id} game={g} mode={g.state==="in"?"live":"recap"} index={i}/>):<div className="notice">NO GAMES FOUND</div>}
        </section>
      </>}
    </>}

    <footer>{mode==="live"?"LIVE BOARD · AUTO-SCAN 30 SEC":"GAME COMMAND CENTER"}{data.generatedAt?" · "+new Date(data.generatedAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}):""}<div>NFL: all games · College: Top 25 games · Future Interest updates as lines and records change</div></footer>
  </main>;
}

"use client";
import { useEffect, useMemo, useState } from "react";
import { parseAgentQuery, searchGames, queryExplanation, spreadForGame } from "../../lib/agentSearch";

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
  return new Date(game.date).toLocaleString([],{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
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

function ShareButton({params,title="Game Radar"}){
  const[copied,setCopied]=useState(false);
  async function share(){
    if(typeof window==="undefined")return;
    const url=new URL("/scores",window.location.origin);
    Object.entries(params||{}).forEach(([key,value])=>{if(value!=null&&value!=="")url.searchParams.set(key,String(value));});
    try{
      if(navigator.share)await navigator.share({title,url:url.toString()});
      else if(navigator.clipboard)await navigator.clipboard.writeText(url.toString());
      else return;
      setCopied(true);
      setTimeout(()=>setCopied(false),1400);
    }catch{}
  }
  return <button className="shareMini" onClick={share} type="button">{copied?"COPIED":"SHARE"}</button>;
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

function GameRow({game,mode,league,weekOffset=0}){
  const live=game.state==="in";
  const showScore=game.state!=="pre";
  const close=closeCallout(game);
  const hot=live&&game.interest.score>=82;
  const watch=live&&game.interest.score>=58;
  const cls=[hot?"hot":"",watch&&!hot?"watch":"",close?"closeMatch":""].filter(Boolean).join(" ");

  return <article id={"game-"+game.id} className={"gameRow "+cls}>
    <div className="gameRowTop">
      <span>{game.sport==="cfb"?"COLLEGE FBS":"NFL"}</span>
      <div className="gameRowStatus">
        <span className={live?"liveText":""}>{live?"● LIVE":game.state==="post"?"FINAL":gameTime(game)}</span>
        <ShareButton params={{league,week:weekOffset,mode:mode==="current"?"live":mode,game:game.id}} title={matchupLabel(game)}/>
      </div>
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

function AgentScoreCard({game,league,weekOffset}){
  const spread=spreadForGame(game);
  const conferences=[game.away?.conference,game.home?.conference].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i);
  return <article className="agentGameCard scoreAgentCard">
    <div className="agentGameTeams">
      <div className="agentTeamPair">
        <span>{game.away.logo?<img src={game.away.logo} alt=""/>:null}<b>{game.away.rank?"#"+game.away.rank+" ":""}{game.away.short}</b></span>
        <em>@</em>
        <span>{game.home.logo?<img src={game.home.logo} alt=""/>:null}<b>{game.home.rank?"#"+game.home.rank+" ":""}{game.home.short}</b></span>
      </div>
      <small>{gameTime(game)}</small>
    </div>
    <div className="agentGameSignals">
      <span>{conferences.length?conferences.join(" · "):league==="cfb"?"COLLEGE":"NFL"}</span>
      <strong>{spread!=null?"SPREAD "+spread:marketLine(game)}</strong>
    </div>
    <div className="agentScore"><span>GAMERADAR</span><strong>{game.interest?.score||"—"}</strong></div>
    <a className="agentOpen" href={"/bets?league="+league+"&weekOffset="+Math.max(0,weekOffset)+"&game="+game.id}>OPEN IN BETRADAR →</a>
  </article>;
}

function GameOfMoment({game,league,weekOffset}){
  if(!game)return null;
  const status=[game.status,game.downDistance].filter(Boolean).join(" · ");
  return <section id={"game-"+game.id} className="gameMoment">
    <div className="momentTop">
      <div><span>● LIVE</span><strong>GAME OF THE MOMENT</strong></div>
      <ShareButton params={{league,week:weekOffset,mode:"live",game:game.id}} title={matchupLabel(game)}/>
    </div>
    <div className="momentScore">
      <div><div className="momentTeam">{game.away.logo?<img src={game.away.logo} alt=""/>:null}<small>{game.away.rank?"#"+game.away.rank+" ":""}{game.away.short}</small></div><strong>{game.away.score}</strong></div>
      <span>—</span>
      <div><div className="momentTeam">{game.home.logo?<img src={game.home.logo} alt=""/>:null}<small>{game.home.rank?"#"+game.home.rank+" ":""}{game.home.short}</small></div><strong>{game.home.score}</strong></div>
    </div>
    <div className="momentMeta">
      <span>{status||"LIVE NOW"}</span>
      <b>INTEREST {game.interest.score}</b>
    </div>
    <p>{game.interest.reason}{game.downDistance?" · "+game.downDistance:""}</p>
  </section>;
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
  const[prefsReady,setPrefsReady]=useState(false);
  const[data,setData]=useState({games:[],generatedAt:null});
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const[refreshing,setRefreshing]=useState(false);
  const[agentQuery,setAgentQuery]=useState("");
  const[agentSpec,setAgentSpec]=useState(null);

  const range=useMemo(()=>footballRange(weekOffset),[weekOffset]);
  const hasLiveNow=(data.games||[]).some(g=>g.sport===league&&g.state==="in");

  useEffect(()=>{
    if(typeof window==="undefined")return;
    const params=new URLSearchParams(window.location.search);
    const qLeague=params.get("league");
    const saved=window.localStorage.getItem("gameRadarLeague");
    const qMode=params.get("mode");
    const qWeek=Number(params.get("week"));
    const nextMode=["recap","live","ahead"].includes(qMode)?qMode:"live";
    setLeague(qLeague==="cfb"||qLeague==="nfl"?qLeague:saved==="cfb"?"cfb":"nfl");
    setMode(nextMode);
    setWeekOffset(Number.isFinite(qWeek)&&params.has("week")?Math.max(-8,Math.min(2,qWeek)):nextMode==="recap"?-1:nextMode==="ahead"?1:0);
    setPrefsReady(true);
  },[]);

  useEffect(()=>{
    if(!prefsReady||typeof window==="undefined")return;
    window.localStorage.setItem("gameRadarLeague",league);
    const url=new URL(window.location.href);
    url.searchParams.set("league",league);
    url.searchParams.set("mode",mode);
    url.searchParams.set("week",String(weekOffset));
    window.history.replaceState({},"",url.pathname+url.search+url.hash);
  },[league,mode,weekOffset,prefsReady]);

  function runAgentText(text){
    const spec=parseAgentQuery(text,{currentLeague:league,currentWeekOffset:weekOffset});
    setAgentQuery(text);
    if(spec.isSaveAction){
      setAgentSpec({...spec,actionMessage:"SAVE ACTIONS LIVE IN BETRADAR — OPEN A RESULT THERE TO ADD IT TO YOUR SHEET."});
      return;
    }
    setAgentSpec(spec);
    if(spec.league!==league)setLeague(spec.league);
    if(spec.weekOffset!==weekOffset){
      setWeekOffset(Math.max(-8,Math.min(2,spec.weekOffset)));
      setMode(spec.weekOffset===0?"live":"ahead");
    }
  }
  function submitAgent(e){
    e?.preventDefault();
    if(agentQuery.trim())runAgentText(agentQuery.trim());
  }

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
    if(!prefsReady)return;
    setLoading(true);
    load(false,weekOffset,league);
  },[league,weekOffset,mode,prefsReady]);

  useEffect(()=>{
    if(!prefsReady||mode!=="live"||weekOffset!==0)return;
    const delay=hasLiveNow?30000:5*60*1000;
    const poll=()=>{if(typeof document==="undefined"||document.visibilityState==="visible")load(false,0,league);};
    const timer=setInterval(poll,delay);
    const onVisibility=()=>{if(document.visibilityState==="visible")load(false,0,league);};
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{clearInterval(timer);document.removeEventListener("visibilitychange",onVisibility)};
  },[league,weekOffset,mode,prefsReady,hasLiveNow]);

  const games=(data.games||[]).filter(g=>g.sport===league);
  const live=games.filter(g=>g.state==="in").sort((a,b)=>b.interest.score-a.interest.score);
  const finals=games.filter(g=>g.state==="post").sort((a,b)=>new Date(b.date)-new Date(a.date));
  const upcoming=games.filter(g=>g.state==="pre").sort((a,b)=>new Date(a.date)-new Date(b.date));
  const agentResults=useMemo(()=>{
    if(!agentSpec||agentSpec.isSaveAction||agentSpec.league!==league||agentSpec.weekOffset!==weekOffset)return [];
    return searchGames(games,agentSpec);
  },[games,agentSpec,league,weekOffset]);
  const gameOfMoment=live[0]||null;
  const otherLive=live.slice(1);
  const weekNumber=games.find(g=>g.week)?.week||null;
  const weekTitle=(league==="nfl"?"NFL":"COLLEGE")+(weekNumber?" WEEK "+weekNumber:" FOOTBALL WEEK")+" · "+rangeLabel(range);

  useEffect(()=>{
    if(loading||!games.length||typeof window==="undefined")return;
    const game=new URLSearchParams(window.location.search).get("game");
    if(!game)return;
    setTimeout(()=>document.getElementById("game-"+game)?.scrollIntoView({behavior:"smooth",block:"center"}),80);
  },[loading,games.length,league,weekOffset]);

  return <main className="shell">
    <a className="suiteHome" href="/">← GAME RADAR HOME</a>
    <nav className="productSwitcher" aria-label="Game Radar products">
      <a className="betradar" href={"/bets?league="+league+"&weekOffset="+Math.max(0,weekOffset)}>
        <strong>BETRADAR</strong>
        <small>Bets · confidence · teasers</small>
      </a>
      <a className="active gameradar" href={"/scores?league="+league+"&mode="+mode+"&week="+weekOffset}>
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

    <section className="askRadar askRadarFeatured">
      <div className="askRadarHead">
        <div>
          <span className="askEyebrow">✦ ASK GAMERADAR</span>
          <h2>FIND THE GAMES THAT MATTER TO YOU</h2>
          <p>Ask for close games, conference matchups, ranked teams, kickoff windows, or what deserves your screen right now.</p>
        </div>
        <div className="askRadarBadge">AI SEARCH</div>
      </div>
      <form className="askRadarForm" onSubmit={submitAgent}>
        <input value={agentQuery} onChange={e=>setAgentQuery(e.target.value)} placeholder="Try: Give me the tight Big Ten + SEC games this week"/>
        <button type="submit">ASK GAMERADAR →</button>
      </form>
      <div className="askPrompts">
        {[
          "Tight Big Ten + SEC games this week",
          "Top 25 games with spreads under 10",
          "Close games Saturday after 7 PM",
          "Best games next week"
        ].map(prompt=><button key={prompt} onClick={()=>runAgentText(prompt)}>{prompt}</button>)}
      </div>
      {agentSpec?<div className="agentInterpretation">
        <div className="agentChips">{agentSpec.chips.map(chip=><span key={chip}>{chip}</span>)}</div>
        <p>{agentSpec.actionMessage||queryExplanation(agentSpec)}</p>
      </div>:null}
      {agentSpec&&!agentSpec.isSaveAction?<div className="agentResults">
        <div className="agentResultsHead"><strong>{loading?"SEARCHING…":agentResults.length+" GAME"+(agentResults.length===1?"":"S")+" FOUND"}</strong><span>STRUCTURED SEARCH · REAL GAME DATA</span></div>
        {!loading&&agentResults.length?agentResults.map(game=><AgentScoreCard key={game.id} game={game} league={league} weekOffset={weekOffset}/>):!loading?<div className="notice">NO GAMES MATCH THAT SEARCH.</div>:null}
      </div>:null}
    </section>

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
          {finals.length?finals.map(g=><GameRow key={g.id} game={g} mode="recap" league={league} weekOffset={weekOffset}/>):<div className="notice">NO FINALS FOUND FOR THIS FOOTBALL WEEK</div>}
        </section>
      </>:mode==="ahead"?<>
        <div className="sectionIntro"><span>WEEK AHEAD</span><h2>EVERY UPCOMING GAME GETS A FUTURE INTEREST SCORE</h2><p>Close projected matchups matter most. Spread, records and matchup context shape every 0–100 score.</p></div>
        <div className="aheadGrid">
          <section className="scoreList">
            <div className="listHeader"><span>UPCOMING GAMES</span><span>INTEREST</span></div>
            {upcoming.length?upcoming.map(g=><GameRow key={g.id} game={g} mode="ahead" league={league} weekOffset={weekOffset}/>):<div className="notice">NO UPCOMING GAMES FOUND FOR THIS FOOTBALL WEEK</div>}
          </section>
          <BetBoard games={upcoming} league={league}/>
        </div>
      </>:<>
        {live.length?<section className="weekScoreSection livePriority">
          <div className="sectionIntro"><span>● LIVE NOW</span><h2>WHAT DESERVES YOUR SCREEN</h2><p>GameRadar pins the best live action to the top, then ranks every other live game underneath it.</p></div>
          <GameOfMoment game={gameOfMoment} league={league} weekOffset={weekOffset}/>
          {otherLive.length?<div className="scoreList otherLiveList">
            {otherLive.map(g=><GameRow key={g.id} game={g} mode="live" league={league} weekOffset={weekOffset}/>)}
          </div>:null}
        </section>:null}

        {upcoming.length?<section className="weekScoreSection">
          <div className="sectionIntro"><span>UP NEXT THIS WEEK</span><h2>UPCOMING</h2><p>Everything still to come in the selected football week.</p></div>
          <div className="scoreList">
            {upcoming.map(g=><GameRow key={g.id} game={g} mode="current" league={league} weekOffset={weekOffset}/>)}
          </div>
        </section>:null}

        <section className="weekScoreSection">
          <div className="sectionIntro"><span>FINAL THIS WEEK</span><h2>COMPLETED GAMES</h2><p>Every completed game from the selected football week, newest first.</p></div>
          <div className="scoreList">
            {finals.length?finals.map(g=><GameRow key={g.id} game={g} mode="current" league={league} weekOffset={weekOffset}/>):<div className="notice">NO COMPLETED GAMES YET THIS WEEK</div>}
          </div>
        </section>

        {!live.length&&!upcoming.length&&!finals.length?<div className="notice">NO GAMES FOUND FOR THIS FOOTBALL WEEK</div>:null}
      </>}
    </>}

    <footer>
      {mode==="live"?(hasLiveNow?"THIS WEEK / LIVE GAMES · LIVE AUTO-SCAN 30 SEC":"THIS WEEK / LIVE GAMES · CHECKING EVERY 5 MIN UNTIL LIVE"):"GAME COMMAND CENTER"}
      {data.generatedAt?" · "+new Date(data.generatedAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}):""}
      <div>{league==="nfl"?"NFL · ALL GAMES":"COLLEGE · ALL FBS GAMES"} · CLOSE MATCHUPS WEIGHTED HEAVILY</div>
    </footer>
  </main>;
}

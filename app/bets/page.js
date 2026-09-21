"use client";
import { useEffect, useMemo, useState } from "react";

const LEAGUES=[["nfl","NFL"],["cfb","COLLEGE FBS"]];

function footballRange(offset=1){
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

function gameTime(game){
  return new Date(game.date).toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"});
}

function pct(n){
  return Number.isFinite(Number(n))?Number(n).toFixed(1)+"%":"—";
}

function money(n){
  if(!Number.isFinite(Number(n)))return "—";
  const v=Number(n);
  return (v>=0?"+":"")+v.toFixed(1)+"%";
}

function signed(n){
  if(!Number.isFinite(Number(n)))return "—";
  const v=Number(n);
  return (v>0?"+":"")+v.toFixed(1);
}

function matchup(game){
  return game.away.short+" @ "+game.home.short;
}

function top25(game){
  return Boolean(game.home.rank||game.away.rank);
}

function allCandidates(games){
  const out=[];
  for(const game of games){
    if(game.bets?.spreadBet)out.push({...game.bets.spreadBet,game});
    if(game.bets?.totalBet)out.push({...game.bets.totalBet,game});
  }
  return out.sort((a,b)=>b.evAtMinus110-a.evAtMinus110||b.confidence-a.confidence);
}

function teaserCandidate(game){
  const bet=game.bets?.spreadBet;
  const market=game.marketConsensus;
  if(!bet||!Number.isFinite(Number(market?.homeMargin)))return null;

  const side=bet.side;
  const marketSpread=side==="home"?-Number(market.homeMargin):Number(market.homeMargin);
  if(marketSpread<-8.5||marketSpread>3.5)return null;

  const teased=marketSpread+6;
  const team=side==="home"?game.home.short:game.away.short;
  const modelSupport=Math.max(0,Number(bet.evAtMinus110)||0);
  const keyBonus=(marketSpread<=-4&&marketSpread>=-8.5)||(marketSpread>=1.5&&marketSpread<=3.5)?10:4;
  return {
    game,
    team,
    original:marketSpread,
    teased,
    label:team+" "+(teased>0?"+":"")+teased.toFixed(1),
    score:Math.round((bet.confidence||50)+modelSupport+keyBonus),
    why:marketSpread<0?"Favorite moved through key numbers":"Underdog pushed farther above a touchdown"
  };
}

function EdgeCard({item,rank}){
  const g=item.game;
  return <article className="edgeCard">
    <div className="edgeCardTop">
      <span>#{rank} · {item.type}</span>
      <strong>{item.confidence} CONF</strong>
    </div>
    <div className="edgeMatch">{top25(g)?<span className="featuredTag">TOP 25</span>:null}{matchup(g)} <small>{gameTime(g)}</small></div>
    <h3>{item.pick}</h3>

    <div className="edgeCompare">
      <div><span>MARKET</span><strong>{item.type==="SPREAD"?g.marketConsensus?.line:g.marketConsensus?.total??"—"}</strong></div>
      <div><span>RADAR</span><strong>{item.type==="SPREAD"?g.projection?.line:g.projection?.total??"—"}</strong></div>
      <div><span>MODEL EDGE</span><strong>{signed(item.edge)} pts</strong></div>
    </div>

    <div className="edgeStats">
      <div><span>EST. COVER</span><strong>{pct(item.coverProbability)}</strong></div>
      <div><span>EST. EV @ -110</span><strong className={Number(item.evAtMinus110)>0?"positiveEV":""}>{money(item.evAtMinus110)}</strong></div>
      <div><span>BOOKS</span><strong>{g.marketConsensus?.providerCount||1}</strong></div>
    </div>

    <p>{item.reason}</p>
    <div className="projectionLine">RADAR PROJECTED SCORE · {g.projection?.projectedScore}</div>
  </article>;
}

function TeaserCard({size,legs}){
  const names={2:"The Little Tickle",3:"Triple Tingle",4:"Four-Leg Flutter",5:"Five-Leg Fever"};
  return <article className="teaserCard">
    <div className="teaserBadge">{size}-WAY · 6 PT</div>
    <h3>{names[size]}</h3>
    <div className="teaserLegs">
      {legs.map((leg,i)=><div key={leg.game.id+"-"+i}>
        <span>{i+1}</span>
        <div><strong>{leg.label}</strong><small>{leg.game.away.short} @ {leg.game.home.short} · {leg.why}</small></div>
      </div>)}
    </div>
    <p>Built from spread legs where the Radar model already leans to that side, then applies a six-point teaser move. Each added leg raises parlay risk.</p>
  </article>;
}

function FullBoardRow({game}){
  const spread=game.bets?.spreadBet;
  const total=game.bets?.totalBet;
  return <article className="modelBoardRow">
    <div className="modelMatch">
      <strong>{top25(game)?<span className="featuredTag">TOP 25</span>:null}{matchup(game)}</strong>
      <small>{gameTime(game)} · {game.projection?.projectedScore}</small>
    </div>
    <div><span>MARKET LINE</span><strong>{game.marketConsensus?.line||"—"}</strong><small>{game.marketConsensus?.providerCount||1} book{game.marketConsensus?.providerCount===1?"":"s"}</small></div>
    <div><span>RADAR LINE</span><strong>{game.projection?.line||"—"}</strong><small>{spread?"Edge "+spread.edge:"No edge"}</small></div>
    <div><span>MARKET TOTAL</span><strong>{game.marketConsensus?.total??"—"}</strong><small>{total?total.pick:"—"}</small></div>
    <div><span>RADAR TOTAL</span><strong>{game.projection?.total??"—"}</strong><small>{total?"Edge "+total.edge:"No edge"}</small></div>
  </article>;
}

export default function BetsPage(){
  const[league,setLeague]=useState("nfl");
  const[data,setData]=useState({games:[],model:null});
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const range=useMemo(()=>footballRange(1),[]);

  useEffect(()=>{
    let ignore=false;
    async function load(){
      setLoading(true);
      try{
        const r=await fetch("/api/bets?league="+league+"&start="+range.start+"&end="+range.end,{cache:"no-store"});
        if(!r.ok)throw new Error();
        const json=await r.json();
        if(!ignore){setData(json);setError("");}
      }catch{
        if(!ignore)setError("RADAR MODEL TEMPORARILY OFFLINE");
      }finally{
        if(!ignore)setLoading(false);
      }
    }
    load();
    return()=>{ignore=true};
  },[league]);

  const games=data.games||[];
  const candidates=allCandidates(games);
  const strongest=candidates.filter(x=>Number(x.evAtMinus110)>0).slice(0,16);
  const fallback=candidates.slice(0,16);
  const displayed=strongest.length>=6?strongest:fallback;
  const teaserPool=games.map(teaserCandidate).filter(Boolean).sort((a,b)=>b.score-a.score);
  const calibration=data.model?.calibration;

  return <main className="betsShell">
    <header className="betsHero">
      <div>
        <a className="backLink" href="/">← GAME COMMAND CENTER</a>
        <div className="betsKicker">NEXT FOOTBALL WEEK · {rangeLabel(range)}</div>
        <h1>BET LAB</h1>
        <p>Radar now makes its own projected spread and total, compares them with the public market, and estimates the size of the model edge.</p>
      </div>
    </header>

    <nav className="betsLeagueToggle">
      {LEAGUES.map(([v,label])=><button key={v} className={league===v?"active":""} onClick={()=>setLeague(v)}>{label}</button>)}
    </nav>

    <section className="sourceStrip">
      <span>MARKET REFERENCE</span>
      <a href={league==="nfl"?"https://www.covers.com/sport/football/nfl/odds":"https://www.covers.com/sport/football/ncaaf/odds"} target="_blank" rel="noreferrer">COVERS ↗</a>
      <a href={league==="nfl"?"https://www.actionnetwork.com/nfl/odds":"https://www.actionnetwork.com/ncaaf/odds"} target="_blank" rel="noreferrer">ACTION ↗</a>
      <span className="sourceNote">Radar uses the public scoreboard market feed and, where available, multi-book consensus lines. Always recheck the current number before betting.</span>
    </section>

    {error?<div className="notice error">{error}</div>:null}
    {loading?<div className="notice">RUNNING RADAR MODEL...</div>:<>
      <section className="modelCard">
        <div className="modelCardTitle">
          <span>RADAR MODEL v1.0</span>
          <h2>PROJECT THE GAME FIRST. THEN COMPARE IT TO THE MARKET.</h2>
        </div>
        <div className="modelMetrics">
          <div><span>SEASON GAMES</span><strong>{data.model?.completedGames??0}</strong></div>
          <div><span>AVG PTS / TEAM</span><strong>{data.model?.leagueAveragePoints??"—"}</strong></div>
          <div><span>BACKTEST SAMPLE</span><strong>{calibration?.samples??0}</strong></div>
          <div><span>MARGIN MAE</span><strong>{calibration?.marginMae??"—"}</strong></div>
          <div><span>TOTAL MAE</span><strong>{calibration?.totalMae??"—"}</strong></div>
        </div>
        <p>{data.model?.method}. Estimated cover probability and EV use the model's observed prediction-error distribution when enough backtest games exist; early-season fallback uncertainty is used otherwise.</p>
      </section>

      <section className="betSection">
        <div className="betSectionHead">
          <span>01</span><div><h2>“NO-BRAINER MONEY MAKERS”*</h2><p>*Still tongue-in-cheek. Now ranked by actual Radar-vs-market model edge rather than generic matchup interest.</p></div>
        </div>
        <div className="edgeGrid">
          {displayed.length?displayed.map((item,i)=><EdgeCard key={item.game.id+"-"+item.type} item={item} rank={i+1}/>):<div className="notice">NOT ENOUGH MARKET DATA YET.</div>}
        </div>
      </section>

      <section className="betSection">
        <div className="betSectionHead">
          <span>02</span><div><h2>FUN TICKLE TEASERS</h2><p>Teaser legs now start with a Radar side lean before we move the number.</p></div>
        </div>
        <div className="teaserGrid">
          {[2,3,4,5].filter(n=>teaserPool.length>=n).map(n=><TeaserCard key={n} size={n} legs={teaserPool.slice(0,n)}/>)}
          {!teaserPool.length?<div className="notice">NO MODEL-SUPPORTED TEASER LEGS YET.</div>:null}
        </div>
      </section>

      <section className="betSection">
        <div className="betSectionHead">
          <span>03</span><div><h2>RADAR vs. MARKET</h2><p>The full board. This is where you can see whether the model actually disagrees with the spread or total.</p></div>
        </div>
        <div className="modelBoard">
          {games.map(game=><FullBoardRow key={game.id} game={game}/>)}
        </div>
      </section>
    </>}

    <footer className="betsFooter">MODEL EDGES ARE ESTIMATES, NOT GUARANTEES · LINES MOVE · RECHECK BEFORE WAGERING</footer>
  </main>;
}

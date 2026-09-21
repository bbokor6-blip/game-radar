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

function teamDisplay(team){
  return (team.rank?"#"+team.rank+" ":"")+team.short;
}

function matchup(game){
  return teamDisplay(game.away)+" @ "+teamDisplay(game.home);
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
  return out.sort((a,b)=>(b.confidence||0)-(a.confidence||0)||(b.evAtMinus110||0)-(a.evAtMinus110||0));
}

function confidenceClass(n){
  if(n>=80)return "best";
  if(n>=70)return "strong";
  if(n>=60)return "lean";
  return "pass";
}

function comparisonText(item){
  const g=item.game;
  if(item.type==="SPREAD"){
    return "Radar "+(g.projection?.line||"—")+" vs market "+(g.marketConsensus?.line||"—")+" · "+item.edge+" pt edge";
  }
  return "Radar total "+(g.projection?.total??"—")+" vs market "+(g.marketConsensus?.total??"—")+" · "+item.edge+" pt edge";
}

function SimplePick({item,rank}){
  const cls=confidenceClass(item.confidence||0);
  return <article className={"simplePick "+cls}>
    <div className="simplePickRank">#{rank}</div>
    <div className="simplePickMain">
      <div className="simpleMatch">
        {top25(item.game)?<span className="featuredTag">TOP 25</span>:null}
        <strong>{matchup(item.game)}</strong>
        <small>{gameTime(item.game)} · {item.type}</small>
      </div>
      <h3>{item.pick}</h3>
      <p>{comparisonText(item)}</p>
      <div className="simpleWhy">
        <span>MODEL: {item.confidenceLabel||"PASS"}</span>
        <small>Est. cover {Number(item.coverProbability||0).toFixed(1)}% · EV {Number(item.evAtMinus110||0)>=0?"+":""}{Number(item.evAtMinus110||0).toFixed(1)}%</small>
      </div>
    </div>
    <div className="confidenceIndex">
      <span>CONFIDENCE</span>
      <strong>{item.confidence||0}</strong>
      <small>{item.confidenceLabel||"PASS"}</small>
    </div>
  </article>;
}

function teaserCandidate(game){
  const bet=game.bets?.spreadBet;
  const market=game.marketConsensus;
  if(!bet||!Number.isFinite(Number(market?.homeMargin))||(bet.confidence||0)<65)return null;

  const side=bet.side;
  const marketSpread=side==="home"?-Number(market.homeMargin):Number(market.homeMargin);
  if(marketSpread<-8.5||marketSpread>3.5)return null;

  const teased=marketSpread+6;
  const team=side==="home"?game.home.short:game.away.short;
  const keyBonus=(marketSpread<=-4&&marketSpread>=-8.5)||(marketSpread>=1.5&&marketSpread<=3.5)?8:3;
  return {
    game,
    label:team+" "+(teased>0?"+":"")+teased.toFixed(1),
    score:(bet.confidence||0)+keyBonus,
    why:marketSpread<0?"Favorite moved through key numbers":"Underdog moved above a touchdown"
  };
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
    <p>For fun, not certainty: adding legs compounds the risk even when each individual move looks attractive.</p>
  </article>;
}

function BoardRow({game}){
  const candidates=[game.bets?.spreadBet,game.bets?.totalBet].filter(Boolean).sort((a,b)=>(b.confidence||0)-(a.confidence||0));
  const best=candidates[0];
  return <article className="simpleBoardRow">
    <div>
      <strong>{top25(game)?<span className="featuredTag">TOP 25</span>:null}{matchup(game)}</strong>
      <small>{gameTime(game)}</small>
    </div>
    <div><span>BEST LOOK</span><strong>{best?.pick||"PASS"}</strong></div>
    <div><span>CONF.</span><strong className={confidenceClass(best?.confidence||0)}>{best?.confidence||0}</strong></div>
    <div><span>RADAR SCORE</span><strong>{game.projection?.projectedScore||"—"}</strong></div>
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
  const topBets=candidates.filter(x=>(x.confidence||0)>=60).slice(0,10);
  const teaserPool=games.map(teaserCandidate).filter(Boolean).sort((a,b)=>b.score-a.score);

  return <main className="betsShell">
    <header className="betsHero simpleHero">
      <div>
        <a className="backLink" href="/">← GAME COMMAND CENTER</a>
        <div className="betsKicker">NEXT FOOTBALL WEEK · {rangeLabel(range)}</div>
        <h1>BET LAB</h1>
        <p>One number to keep it simple: the <strong>Radar Confidence Index</strong>. Higher means the model sees a larger edge and has more reason to trust it.</p>
      </div>
    </header>

    <nav className="betsLeagueToggle">
      {LEAGUES.map(([v,label])=><button key={v} className={league===v?"active":""} onClick={()=>setLeague(v)}>{label}</button>)}
    </nav>

    <section className="confidenceLegend">
      <div className="best"><strong>80–95</strong><span>BEST BET</span></div>
      <div className="strong"><strong>70–79</strong><span>STRONG</span></div>
      <div className="lean"><strong>60–69</strong><span>LEAN</span></div>
      <div className="pass"><strong>&lt;60</strong><span>PASS</span></div>
    </section>

    {error?<div className="notice error">{error}</div>:null}
    {loading?<div className="notice">RUNNING RADAR MODEL...</div>:<>
      <section className="betSection simpleBetSection">
        <div className="betSectionHead">
          <span>01</span>
          <div>
            <h2>TOP 10 BETS THIS WEEK</h2>
            <p>Sorted by Radar Confidence. You should be able to screenshot this list and send it to the group chat.</p>
          </div>
        </div>
        <div className="simplePickList">
          {topBets.length?topBets.map((item,i)=><SimplePick key={item.game.id+"-"+item.type} item={item} rank={i+1}/>):<div className="notice">NO BETS CLEAR THE CONFIDENCE FLOOR YET.</div>}
        </div>
      </section>

      <section className="betSection">
        <div className="betSectionHead">
          <span>02</span>
          <div><h2>FUN TICKLE TEASERS</h2><p>Only uses spread legs that already score at least 65 on the Radar Confidence Index.</p></div>
        </div>
        <div className="teaserGrid">
          {[2,3,4,5].filter(n=>teaserPool.length>=n).map(n=><TeaserCard key={n} size={n} legs={teaserPool.slice(0,n)}/>)}
          {!teaserPool.length?<div className="notice">NO TEASER LEGS CLEAR THE CONFIDENCE FLOOR YET.</div>:null}
        </div>
      </section>

      <section className="betSection">
        <div className="betSectionHead">
          <span>03</span>
          <div><h2>EVERY GAME</h2><p>A compact board for everything else. Best model look first; PASS means the model does not see enough separation.</p></div>
        </div>
        <div className="simpleBoard">
          {games.map(game=><BoardRow key={game.id} game={game}/>)}
        </div>
      </section>

      <details className="modelDetails">
        <summary>How does the Confidence Index work?</summary>
        <div>
          <p>The 0–100 index combines five things: the size of the Radar-vs-market edge, estimated cover probability, how much season data exists for both teams, agreement across available market lines, and how many books contribute to the consensus.</p>
          <p>The model still projects the spread and total independently first. The technical backtest is underneath the index, not something you need to read every time.</p>
          <div className="detailMetrics">
            <span>Season games: <strong>{data.model?.completedGames??0}</strong></span>
            <span>Backtest sample: <strong>{data.model?.calibration?.samples??0}</strong></span>
            <span>Margin MAE: <strong>{data.model?.calibration?.marginMae??"—"}</strong></span>
            <span>Total MAE: <strong>{data.model?.calibration?.totalMae??"—"}</strong></span>
          </div>
        </div>
      </details>
    </>}

    <footer className="betsFooter">CONFIDENCE IS A MODEL INDEX, NOT A GUARANTEE · LINES MOVE · RECHECK BEFORE WAGERING</footer>
  </main>;
}

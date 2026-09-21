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

function indexClass(n){
  if(n>=78)return "best";
  if(n>=68)return "strong";
  if(n>=58)return "lean";
  return "pass";
}

function allOpportunities(games){
  const out=[];
  for(const game of games){
    if(game.opportunities?.spread)out.push({...game.opportunities.spread,game});
    if(game.opportunities?.total)out.push({...game.opportunities.total,game});
  }
  return out.sort((a,b)=>b.index-a.index);
}

function OpportunityCard({item,rank}){
  const g=item.game;
  const cls=indexClass(item.index);
  return <article className={"simplePick "+cls}>
    <div className="simplePickRank">#{rank}</div>
    <div className="simplePickMain">
      <div className="simpleMatch">
        <strong>{matchup(g)}</strong>
        <small>{gameTime(g)} · {item.type}</small>
      </div>
      <h3>{item.pick}</h3>
      {item.index>=68?<div className="interestingWhy"><span>WHY THIS IS INTERESTING</span><p>{item.why}</p></div>:<p>{item.why}</p>}
      <div className="evidenceChips">
        {(item.evidence||[]).map((x,i)=><span key={i}>{x}</span>)}
      </div>
      <div className="simpleWhy">
        <span>MARKET: {g.marketConsensus?.line||g.market?.details||"LINE PENDING"}</span>
        {g.marketConsensus?.total!=null?<small>O/U {g.marketConsensus.total}</small>:null}
      </div>
    </div>
    <div className="confidenceIndex">
      <span>RADAR INDEX</span>
      <strong>{item.index}</strong>
      <small>{item.label}</small>
    </div>
  </article>;
}

function teaserCandidate(game){
  const market=game.marketConsensus;
  if(!Number.isFinite(Number(market?.homeMargin)))return null;

  const abs=Math.abs(Number(market.homeMargin));
  const homeFav=Number(market.homeMargin)>0;
  const favorite=homeFav?game.home:game.away;
  const dog=homeFav?game.away:game.home;
  const spreadOpp=game.opportunities?.spread;

  let team=null,original=null,teased=null,why="";
  if(abs>=4&&abs<=8.5){
    team=favorite;
    original=-abs;
    teased=original+6;
    const crossed=[];
    if(original<=-7&&teased>-7)crossed.push("7");
    if(original<=-3&&teased>-3)crossed.push("3");
    why="A 6-point teaser takes "+favorite.short+" from "+original.toFixed(1)+" to "+(teased>0?"+":"")+teased.toFixed(1)+(crossed.length?" and moves through "+crossed.join(" and "):"")+".";
  }else if(abs>=1.5&&abs<=3.5){
    team=dog;
    original=abs;
    teased=original+6;
    const crossed=[];
    if(original<3&&teased>=3)crossed.push("3");
    if(original<7&&teased>=7)crossed.push("7");
    why="A 6-point teaser takes "+dog.short+" from +"+original.toFixed(1)+" to +"+teased.toFixed(1)+(crossed.length?" and moves through "+crossed.join(" and "):"")+".";
  }else{
    return null;
  }

  const supported=spreadOpp&&spreadOpp.side===(team.id===game.home.id?"home":"away");
  const score=Math.round(64+(supported?Math.max(0,(spreadOpp.index||0)-58)*.6:0)+(game.sport==="nfl"?4:0));
  return {
    game,
    label:team.short+" "+(teased>0?"+":"")+teased.toFixed(1),
    score,
    why:supported?why+" Bet Radar already likes that side.":why+" The line itself makes this an interesting teaser shape."
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
        <div><strong>{leg.label}</strong><small>{matchup(leg.game)} · {leg.why}</small></div>
      </div>)}
    </div>
    <p>Fun structure built only from spread opportunities that already clear the Radar Index floor. More legs still means more risk.</p>
  </article>;
}

function BoardRow({game}){
  const best=game.bestOpportunity;
  return <article className="simpleBoardRow">
    <div>
      <strong>{matchup(game)}</strong>
      <small>{gameTime(game)}</small>
    </div>
    <div><span>MARKET</span><strong>{game.marketConsensus?.line||game.market?.details||"—"}</strong></div>
    <div><span>BEST LOOK</span><strong>{best?.pick||"PASS"}</strong></div>
    <div><span>RADAR</span><strong className={indexClass(best?.index||0)}>{best?.index||0}</strong></div>
  </article>;
}

export default function BetsPage(){
  const[league,setLeague]=useState("nfl");
  const[data,setData]=useState({games:[],methodology:null});
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
        if(!ignore)setError("BET RADAR TEMPORARILY OFFLINE");
      }finally{
        if(!ignore)setLoading(false);
      }
    }
    load();
    return()=>{ignore=true};
  },[league]);

  const games=data.games||[];
  const opportunities=allOpportunities(games);
  const top=opportunities.filter(x=>x.index>=58).slice(0,10);
  const teaserPool=games.map(teaserCandidate).filter(Boolean).sort((a,b)=>b.score-a.score);

  return <main className="betsShell">
    <header className="betsHero simpleHero">
      <div>
        <a className="backLink" href="/">← GAME COMMAND CENTER</a>
        <div className="betsKicker">NEXT FOOTBALL WEEK · {rangeLabel(range)}</div>
        <h1>BET LAB</h1>
        <p>No fake projected line. Bet Radar simply surfaces the most interesting opportunities using actual season results, ATS/total trends and the current public market.</p>
      </div>
    </header>

    <nav className="betsLeagueToggle">
      {LEAGUES.map(([v,label])=><button key={v} className={league===v?"active":""} onClick={()=>setLeague(v)}>{label}</button>)}
    </nav>

    <section className="confidenceLegend">
      <div className="best"><strong>78+</strong><span>STRONG LOOK</span></div>
      <div className="strong"><strong>68–77</strong><span>INTERESTING</span></div>
      <div className="lean"><strong>58–67</strong><span>WATCH</span></div>
      <div className="pass"><strong>&lt;58</strong><span>PASS</span></div>
    </section>

    {error?<div className="notice error">{error}</div>:null}
    {loading?<div className="notice">BUILDING THE BET RADAR...</div>:<>
      <section className="betSection simpleBetSection">
        <div className="betSectionHead">
          <span>01</span>
          <div>
            <h2>TOP 10 OPPORTUNITIES</h2>
            <p>Not a probability of winning. The Radar Index tells you how much evidence there is that a bet is worth a closer look.</p>
          </div>
        </div>
        <div className="simplePickList">
          {top.length?top.map((item,i)=><OpportunityCard key={item.game.id+"-"+item.type} item={item} rank={i+1}/>):<div className="notice">NOT ENOUGH TREND + MARKET EVIDENCE YET.</div>}
        </div>
      </section>

      <section className="betSection">
        <div className="betSectionHead">
          <span>02</span>
          <div><h2>FUN TICKLE TEASERS</h2><p>Built from teaser-friendly market lines first, then boosted when Bet Radar already likes the same side.</p></div>
        </div>
        <div className="teaserGrid">
          {[2,3,4,5].filter(n=>teaserPool.length>=n).map(n=><TeaserCard key={n} size={n} legs={teaserPool.slice(0,n)}/>)}
          {!teaserPool.length?<div className="notice">NO TEASER LEGS CLEAR THE RADAR FLOOR YET.</div>:null}
        </div>
      </section>

      <section className="betSection">
        <div className="betSectionHead">
          <span>03</span>
          <div><h2>EVERY GAME</h2><p>Current market number plus the strongest trend-based opportunity, if one exists.</p></div>
        </div>
        <div className="simpleBoard">
          {games.map(game=><BoardRow key={game.id} game={game}/>)}
        </div>
      </section>

      <details className="modelDetails">
        <summary>What goes into the Radar Index?</summary>
        <div>
          <p>It is deliberately simple: season ATS performance, recent ATS form, over/under trends, sample size, agreement across available market lines, and how similar spreads/totals have actually performed earlier this season.</p>
          <p>It does not invent a “true” spread and it does not claim an 80 Index means an 80% chance of winning.</p>
          <div className="detailMetrics">
            <span>Completed games reviewed: <strong>{data.methodology?.historyGames??0}</strong></span>
            <span>Historical spread lines used: <strong>{data.methodology?.historicalSpreadGames??0}</strong></span>
            <span>Historical totals used: <strong>{data.methodology?.historicalTotalGames??0}</strong></span>
            <span>Method: <strong>Trend + market history + current line</strong></span>
          </div>
        </div>
      </details>
    </>}

    <footer className="betsFooter">RADAR INDEX = STRENGTH OF OPPORTUNITY SIGNAL, NOT WIN PROBABILITY · RECHECK LINES BEFORE WAGERING</footer>
  </main>;
}

"use client";
import { useEffect, useMemo, useState } from "react";

const LEAGUES=[["nfl","NFL"],["cfb","COLLEGE TOP 25"]];

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

function recordPct(record){
  const m=String(record||"").match(/(\d+)-(\d+)/);
  if(!m)return .5;
  const w=Number(m[1]),l=Number(m[2]),t=w+l;
  return t?w/t:.5;
}

function parseMarket(game){
  const details=String(game.market?.details||"").trim();
  const m=details.match(/^([A-Z0-9]+)\s+([+-]?\d+(?:\.\d+)?)$/);
  if(!m)return null;
  const favorite=m[1];
  const line=Number(m[2]);
  if(!Number.isFinite(line))return null;
  return {favorite,line,abs:Math.abs(line)};
}

function teamByShort(game,abbr){
  if(game.home.short===abbr)return game.home;
  if(game.away.short===abbr)return game.away;
  return null;
}

function otherTeam(game,team){
  return team?.id===game.home.id?game.away:game.home;
}

function sideLean(game){
  const market=parseMarket(game);
  if(!market)return null;
  const fav=teamByShort(game,market.favorite);
  if(!fav)return null;
  const dog=otherTeam(game,fav);
  const favPct=recordPct(fav.record),dogPct=recordPct(dog.record);
  const recordEdge=favPct-dogPct;
  const rankEdge=(fav.rank?26-fav.rank:0)-(dog.rank?26-dog.rank:0);
  let pick,why,score=54;

  if(market.abs<=3.5){
    if(recordEdge>=.12||rankEdge>=6){
      pick=fav.short+" "+market.line;
      why="Small number with a measurable team-quality edge.";
      score+=16;
    }else{
      pick=dog.short+" +"+market.abs;
      why="Near pick'em game; taking the points in a tight matchup.";
      score+=12;
    }
  }else if(market.abs<10){
    if(dogPct>=favPct-.10){
      pick=dog.short+" +"+market.abs;
      why="Competitive underdog getting meaningful points.";
      score+=15;
    }else{
      pick=fav.short+" "+market.line;
      why="Favorite has the stronger profile without laying double digits.";
      score+=11;
    }
  }else{
    return null;
  }

  score+=Math.round((game.interest?.score||50)*.12);
  if(game.sport==="cfb"&&fav.rank&&(!dog.rank||fav.rank<dog.rank))score+=5;
  return {type:"SPREAD",pick,why,score:Math.min(88,score)};
}

function totalLean(game,median){
  const total=Number(game.market?.overUnder);
  const market=parseMarket(game);
  if(!Number.isFinite(total)||!market)return null;
  let pick=null,why="",score=55;
  if(total<=median-4&&market.abs<7.5){
    pick="OVER "+total;
    why="Low total paired with a relatively close spread.";
    score+=10;
  }else if(total>=median+5&&market.abs>=9){
    pick="UNDER "+total;
    why="High total paired with a wider projected margin.";
    score+=9;
  }else{
    return null;
  }
  score+=Math.round((game.interest?.score||50)*.10);
  return {type:"TOTAL",pick,why,score:Math.min(82,score)};
}

function teaserCandidate(game){
  const market=parseMarket(game);
  if(!market)return null;
  const fav=teamByShort(game,market.favorite);
  if(!fav)return null;
  const dog=otherTeam(game,fav);

  if(market.abs>=4&&market.abs<=8.5){
    const teased=market.line+6;
    return {
      label:fav.short+" "+(teased>0?"+":"")+teased.toFixed(teased%1?1:0),
      score:82-Math.abs(6-market.abs)*2,
      why:"Moves a favorite through key numbers."
    };
  }
  if(market.abs>=1.5&&market.abs<=3.5){
    const teased=market.abs+6;
    return {
      label:dog.short+" +"+teased.toFixed(teased%1?1:0),
      score:80-Math.abs(2.5-market.abs)*2,
      why:"Moves a short underdog above a touchdown."
    };
  }
  return null;
}

function BetCard({item}){
  return <article className="pickCard">
    <div className="pickTop"><span>{item.type}</span><strong>{item.score}</strong></div>
    <h3>{item.pick}</h3>
    <div className="pickGame">{item.game.away.short} @ {item.game.home.short}</div>
    <p>{item.why}</p>
    <div className="pickMeta">
      <span>{item.game.market?.details||"LINE PENDING"}</span>
      {item.game.market?.overUnder!=null?<span>O/U {item.game.market.overUnder}</span>:null}
    </div>
  </article>;
}

function TeaserCard({legs,size}){
  return <article className="teaserCard">
    <div className="teaserBadge">{size}-WAY</div>
    <h3>{size===2?"The Little Tickle":size===3?"Triple Tingle":size===4?"Four-Leg Flutter":"Five-Leg Fever"}</h3>
    <div className="teaserLegs">
      {legs.map((leg,i)=><div key={i}><span>{i+1}</span><strong>{leg.label}</strong></div>)}
    </div>
    <p>6-point teaser concept built around crossing key numbers. Fun structure, higher variance as legs stack up.</p>
  </article>;
}

export default function BetsPage(){
  const[league,setLeague]=useState("nfl");
  const[data,setData]=useState({games:[]});
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const range=useMemo(()=>footballRange(1),[]);

  useEffect(()=>{
    let ignore=false;
    async function load(){
      setLoading(true);
      try{
        const r=await fetch("/api/games?league="+league+"&start="+range.start+"&end="+range.end,{cache:"no-store"});
        if(!r.ok)throw new Error();
        const json=await r.json();
        if(!ignore){setData(json);setError("");}
      }catch{
        if(!ignore)setError("BETTING BOARD TEMPORARILY OFFLINE");
      }finally{
        if(!ignore)setLoading(false);
      }
    }
    load();
    return()=>{ignore=true};
  },[league]);

  const upcoming=(data.games||[]).filter(g=>g.state==="pre"&&g.market);
  const totals=upcoming.map(g=>Number(g.market?.overUnder)).filter(Number.isFinite).sort((a,b)=>a-b);
  const median=totals.length?totals[Math.floor(totals.length/2)]:(league==="nfl"?45:52);

  const picks=upcoming.flatMap(game=>{
    const out=[];
    const side=sideLean(game);
    const total=totalLean(game,median);
    if(side)out.push({...side,game});
    if(total)out.push({...total,game});
    return out;
  }).sort((a,b)=>b.score-a.score);

  const teasers=upcoming.map(game=>teaserCandidate(game)).filter(Boolean).sort((a,b)=>b.score-a.score);
  const fullBoard=upcoming.slice().sort((a,b)=>(b.interest?.score||0)-(a.interest?.score||0));

  return <main className="betsShell">
    <header className="betsHero">
      <div>
        <a className="backLink" href="/">← GAME COMMAND CENTER</a>
        <div className="betsKicker">WEEK AHEAD · {rangeLabel(range)}</div>
        <h1>BET LAB</h1>
        <p>Public-market lines, matchup context and a little chaos. Nothing here is guaranteed; the names are more confident than the math.</p>
      </div>
    </header>

    <nav className="betsLeagueToggle">
      {LEAGUES.map(([v,label])=><button key={v} className={league===v?"active":""} onClick={()=>setLeague(v)}>{label}</button>)}
    </nav>

    <section className="sourceStrip">
      <span>PUBLIC LINE SOURCES</span>
      <a href={league==="nfl"?"https://www.covers.com/sport/football/nfl/odds":"https://www.covers.com/sport/football/ncaaf/odds"} target="_blank" rel="noreferrer">COVERS ↗</a>
      <a href={league==="nfl"?"https://www.actionnetwork.com/nfl/odds":"https://www.actionnetwork.com/ncaaf/odds"} target="_blank" rel="noreferrer">ACTION ↗</a>
      <span className="sourceNote">Board lines update from the public scoreboard market feed and should be rechecked before placing a wager.</span>
    </section>

    {error?<div className="notice error">{error}</div>:null}
    {loading?<div className="notice">BUILDING THE BOARD...</div>:<>
      <section className="betSection">
        <div className="betSectionHead">
          <span>01</span><div><h2>“NO-BRAINER MONEY MAKERS”*</h2><p>*Tongue-in-cheek. These are the strongest model leans, not guaranteed winners.</p></div>
        </div>
        <div className="pickGrid">
          {picks.length?picks.slice(0,14).map((item,i)=><BetCard key={item.game.id+"-"+item.type+"-"+i} item={item}/>):<div className="notice">NOT ENOUGH POSTED LINES YET.</div>}
        </div>
      </section>

      <section className="betSection">
        <div className="betSectionHead">
          <span>02</span><div><h2>FUN TICKLE TEASERS</h2><p>2-, 3-, 4- and 5-leg teaser ideas built from the cleanest key-number moves.</p></div>
        </div>
        <div className="teaserGrid">
          {[2,3,4,5].filter(n=>teasers.length>=n).map(n=><TeaserCard key={n} size={n} legs={teasers.slice(0,n)}/>)}
          {!teasers.length?<div className="notice">NOT ENOUGH TEASER-FRIENDLY LINES YET.</div>:null}
        </div>
      </section>

      <section className="betSection">
        <div className="betSectionHead">
          <span>03</span><div><h2>FULL BETTING BOARD</h2><p>Every upcoming game with a posted line, sorted by Future Interest.</p></div>
        </div>
        <div className="fullBetBoard">
          {fullBoard.map(game=><article className="fullBetRow" key={game.id}>
            <div>
              <strong>{game.away.short} @ {game.home.short}</strong>
              <small>{new Date(game.date).toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"})}</small>
            </div>
            <div><span>LINE</span><strong>{game.market?.details||"—"}</strong></div>
            <div><span>O/U</span><strong>{game.market?.overUnder??"—"}</strong></div>
            <div><span>INTEREST</span><strong>{game.interest?.score??0}</strong></div>
          </article>)}
        </div>
      </section>
    </>}

    <footer className="betsFooter">BET LAB · PUBLIC MARKET DATA · RECHECK LINES BEFORE WAGERING</footer>
  </main>;
}

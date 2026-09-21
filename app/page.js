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
  if(n>=80)return "best";
  if(n>=70)return "strong";
  if(n>=60)return "lean";
  return "pass";
}

function formatAmerican(odds){
  const n=Number(odds);
  if(!Number.isFinite(n)||n===0)return "—";
  return (n>0?"+":"")+Math.round(n);
}

function tenDollarReturn(odds){
  const n=Number(odds);
  if(!Number.isFinite(n)||n===0)return null;
  const profit=n>0?10*(n/100):10*(100/Math.abs(n));
  return Math.round((10+profit)*100)/100;
}

function formatSpread(n){
  const v=Number(n);
  if(!Number.isFinite(v))return "—";
  if(Math.abs(v)<.05)return "PK";
  return (v>0?"+":"")+v.toFixed(1);
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

function allOpportunities(games){
  const out=[];
  for(const game of games){
    if(game.opportunities?.spread)out.push({...game.opportunities.spread,game});
    if(game.opportunities?.total)out.push({...game.opportunities.total,game});
  }
  return out.sort((a,b)=>b.index-a.index||((b.game.interest?.score||0)-(a.game.interest?.score||0)));
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
      <div className="pickHeadline">
        <h3>{item.pick} <span className="betOdds">{oddsText(item.americanOdds)}</span></h3>
        {item.index>=80?<span className="convictionBadge">HIGH CONVICTION</span>:item.index>=70?<span className="convictionBadge medium">STRONG INTEREST</span>:null}
      </div>
      {item.payout?<div className="payoutStrip">
        <span>$10 BET</span>
        <strong>WIN {moneyText(item.payout.profit)}</strong>
        <small>TOTAL RETURN {moneyText(item.payout.totalReturn)}</small>
      </div>:<div className="payoutStrip unavailable"><span>ODDS NOT AVAILABLE</span><small>Payout will appear when the market price loads.</small></div>}
      {item.index>=80?<div className="interestingWhy convictionWhy"><span>WHY WE HAVE CONVICTION</span><p>{item.why}</p></div>:item.index>=70?<div className="interestingWhy"><span>WHY THIS IS INTERESTING</span><p>{item.why}</p></div>:<p>{item.why}</p>}
      <div className="evidenceChips">
        {(item.evidence||[]).map((x,i)=><span key={i}>{x}</span>)}
      </div>
      <div className="simpleWhy">
        <span>MARKET: {g.marketConsensus?.line||g.market?.details||"LINE PENDING"}</span>
        {g.marketConsensus?.total!=null?<small>O/U {g.marketConsensus.total}</small>:null}
      </div>
    </div>
    <div className="confidenceIndex">
      <span>BETRADAR INDEX</span>
      <strong>{item.index}</strong>
      <small>{item.index>=80?"STRONG LOOK":item.index>=70?"INTERESTING":item.index>=60?"WATCH":"LOW CONFIDENCE"}</small>
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

  let side=spreadOpp?.side||null;
  let quality=0;
  if(abs>=4&&abs<=8.5){
    side=side||(homeFav?"home":"away");
    quality+=16;
  }else if(abs>=1.5&&abs<=3.5){
    side=side||(homeFav?"away":"home");
    quality+=14;
  }else{
    side=side||(homeFav?"away":"home");
    quality-=Math.min(12,Math.max(0,abs-10));
  }

  const team=side==="home"?game.home:game.away;
  const original=side==="home"?-Number(market.homeMargin):Number(market.homeMargin);
  const teased=original+6;
  const crossed=[];
  if(original<3&&teased>=3)crossed.push("3");
  if(original<7&&teased>=7)crossed.push("7");
  if(original<=-7&&teased>-7)crossed.push("-7");
  if(original<=-3&&teased>-3)crossed.push("-3");

  const supported=Boolean(spreadOpp&&spreadOpp.side===side);
  const score=Math.round(52+quality+(supported?Math.max(6,(spreadOpp.index||0)-55):0)+(crossed.length*4)+(game.sport==="nfl"?3:0));
  return {
    game,
    label:team.short+" "+formatSpread(teased),
    score,
    why:"Moves "+team.short+" from "+formatSpread(original)+" to "+formatSpread(teased)+(crossed.length?" through key numbers "+crossed.join(" and "):"")+(supported?". BetRadar already leans to this side.":".")
  };
}

function bestTeasers(pool,size,count){
  const source=pool.slice(0,12);
  const combos=[];
  function walk(start,chosen){
    if(chosen.length===size){
      const score=chosen.reduce((sum,x)=>sum+x.score,0)/size;
      combos.push({legs:chosen.slice(),score});
      return;
    }
    for(let i=start;i<source.length;i++)walk(i+1,[...chosen,source[i]]);
  }
  walk(0,[]);
  return combos.sort((a,b)=>b.score-a.score).slice(0,count);
}
function TeaserCard({size,legs,number}){
  return <article className="teaserCard compactTeaser">
    <div className="teaserBadge">{size}-LEG TEASER #{number}</div>
    <div className="teaserLegs">
      {legs.map((leg,i)=><div key={leg.game.id+"-"+i}>
        <span>{i+1}</span>
        <div><strong>{leg.label}</strong><small>{matchup(leg.game)}</small></div>
      </div>)}
    </div>
  </article>;
}

function BoardRow({game}){
  const best=game.bestOpportunity;
  const market=game.marketConsensus||{};
  const available=Boolean(market.available);
  const homeSpread=Number.isFinite(Number(market.homeMargin))?-Number(market.homeMargin):null;
  const awaySpread=Number.isFinite(Number(market.homeMargin))?Number(market.homeMargin):null;
  const total=Number.isFinite(Number(market.total))?Number(market.total):null;
  const spreadSide=game.opportunities?.spread?.side;
  const totalSide=game.opportunities?.total?.side;

  const options=available?[
    {key:"away-spread",label:teamDisplay(game.away),base:teamDisplay(game.away)+" "+formatSpread(awaySpread),odds:market.awaySpreadOdds,tease:teamDisplay(game.away)+" "+formatSpread(awaySpread+6),suggested:spreadSide==="away"},
    {key:"home-spread",label:teamDisplay(game.home),base:teamDisplay(game.home)+" "+formatSpread(homeSpread),odds:market.homeSpreadOdds,tease:teamDisplay(game.home)+" "+formatSpread(homeSpread+6),suggested:spreadSide==="home"},
    {key:"over",label:"OVER",base:total==null?"—":"OVER "+total.toFixed(1),odds:market.overOdds,tease:total==null?"—":"OVER "+(total-6).toFixed(1),suggested:totalSide==="over"},
    {key:"under",label:"UNDER",base:total==null?"—":"UNDER "+total.toFixed(1),odds:market.underOdds,tease:total==null?"—":"UNDER "+(total+6).toFixed(1),suggested:totalSide==="under"}
  ]:[];

  return <article className="gameTableRow openRow">
    <div className="gameTableSummary">
      <div className="tableMatch"><strong>{matchup(game)}</strong><small>{gameTime(game)}</small></div>
      <div className="tableMarket"><span>MARKET</span><strong>{market.line||"PENDING"}</strong>{total!=null?<small>O/U {total.toFixed(1)}</small>:null}</div>
      <div className="tableBest"><span>BEST LOOK</span><strong>{best?.pick||"—"}</strong>{best?.index>=80?<small className="tableConviction">HIGH CONVICTION</small>:null}</div>
      <div className={"tableIndex "+indexClass(best?.index??0)}><span>BETRADAR</span><strong>{best?.index??"—"}</strong></div>
    </div>

    {!available?<div className="gameTableUnavailable">MARKET LINE NOT AVAILABLE YET</div>:<div className="gameTableExpand alwaysVisible">
      {options.map(option=>{
        const totalReturn=tenDollarReturn(option.odds);
        return <div className={"tableBetOption "+(option.suggested?"suggested":"")} key={option.key}>
          <div className="tableBetTop"><span>{option.label}</span>{option.suggested?<b>BETRADAR LIKES</b>:null}</div>
          <div className="tableTease"><span>SUGGESTED TEASE</span><strong>{option.tease}</strong></div>
          <div className="tableStraight"><span>GAME LINE</span><strong>{option.base}</strong><em>{formatAmerican(option.odds)}</em></div>
          {totalReturn!=null?<small>{"$10 → $"+totalReturn.toFixed(2)}</small>:null}
        </div>;
      })}
    </div>}
  </article>;
}

export default function BetsPage(){
  const[league,setLeague]=useState("nfl");
  const[data,setData]=useState({games:[],methodology:null});
  const[showAllGames,setShowAllGames]=useState(false);
  const[collegeSort,setCollegeSort]=useState("radar");
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const range=useMemo(()=>footballRange(1),[]);

  useEffect(()=>{
    let ignore=false;
    async function load(){
      setShowAllGames(false);
      setCollegeSort("radar");
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
  const orderedGames=useMemo(()=>{
    if(league!=="cfb"||collegeSort!=="top25")return games;
    return games.slice().sort((a,b)=>{
      const aRanks=[a.home?.rank,a.away?.rank].filter(Boolean);
      const bRanks=[b.home?.rank,b.away?.rank].filter(Boolean);
      const aRanked=aRanks.length>0?1:0;
      const bRanked=bRanks.length>0?1:0;
      if(aRanked!==bRanked)return bRanked-aRanked;
      const aBest=aRanks.length?Math.min(...aRanks):99;
      const bBest=bRanks.length?Math.min(...bRanks):99;
      if(aBest!==bBest)return aBest-bBest;
      const aTwo=aRanks.length===2?1:0;
      const bTwo=bRanks.length===2?1:0;
      if(aTwo!==bTwo)return bTwo-aTwo;
      return (b.opportunityIndex||0)-(a.opportunityIndex||0);
    });
  },[games,league,collegeSort]);
  const visibleGames=showAllGames?orderedGames:orderedGames.slice(0,15);
  const opportunities=allOpportunities(games);
  const top=opportunities.slice(0,10);
  const teaserPool=games.map(teaserCandidate).filter(Boolean).sort((a,b)=>b.score-a.score);
  const teaserGroups=[
    {size:2,count:2,items:bestTeasers(teaserPool,2,2)},
    {size:3,count:3,items:bestTeasers(teaserPool,3,3)},
    {size:4,count:2,items:bestTeasers(teaserPool,4,2)},
    {size:5,count:1,items:bestTeasers(teaserPool,5,1)}
  ];

  return <main className="betsShell">
    <header className="betsHero simpleHero">
      <div>
        <a className="backLink" href="/scores">LIVE SCORE CENTER →</a>
        <div className="betsKicker">NEXT FOOTBALL WEEK · {rangeLabel(range)}</div>
        <h1>BETRADAR</h1>
        <p>BetRadar surfaces the most interesting games and the strongest betting signals from actual season results, historical market lines and the current line. Every suggested bet shows the odds, $10-unit payout and BetRadar Index.</p>
      </div>
    </header>

    <nav className="betsLeagueToggle">
      {LEAGUES.map(([v,label])=><button key={v} className={league===v?"active":""} onClick={()=>setLeague(v)}>{label}</button>)}
    </nav>


    <section className="confidenceLegend">
      <div className="best"><strong>80+</strong><span>STRONG LOOK</span></div>
      <div className="strong"><strong>70–79</strong><span>INTERESTING</span></div>
      <div className="lean"><strong>60–69</strong><span>WATCH</span></div>
      <div className="pass"><strong>&lt;60</strong><span>LOW CONFIDENCE</span></div>
    </section>
    {error?<div className="notice error">{error}</div>:null}
    {loading?<div className="notice">BUILDING THE BET RADAR...</div>:<>
      <section className="betSection simpleBetSection">
        <div className="betSectionHead">
          <span>01</span>
          <div>
            <h2>TOP 10 BETS OF THE WEEK</h2>
            <p>The strongest real BetRadar signals for the week, ranked by confidence and then by game interest. When the evidence is especially strong, BetRadar calls it out as HIGH CONVICTION.</p>
          </div>
        </div>
        <div className="simplePickList">
          {top.length?top.map((item,i)=><OpportunityCard key={item.game.id+"-"+item.type} item={item} rank={i+1}/>):<div className="notice">NOT ENOUGH TREND + MARKET EVIDENCE YET.</div>}
        </div>
      </section>

      <section className="betSection">
        <div className="betSectionHead">
          <span>02</span>
          <div><h2>BEST TEASERS</h2><p>2 two-leg teasers · 3 three-leg teasers · 2 four-leg teasers · 1 five-leg teaser. Built from the strongest teaser-friendly lines.</p></div>
        </div>
        <div className="teaserGrid">
          {teaserGroups.flatMap(group=>group.items.map((combo,i)=><TeaserCard key={group.size+"-"+i} size={group.size} number={i+1} legs={combo.legs}/>))}
          {!teaserPool.length?<div className="notice">NO TEASER-FRIENDLY LINES AVAILABLE YET.</div>:null}
        </div>
      </section>

      <section className="betSection">
        <div className="betSectionHead everyGameHead">
          <span>03</span>
          <div>
            <h2>EVERY GAME</h2>
            <p>{league==="cfb"&&collegeSort==="top25"?"Top 25 games are pushed to the top, then the rest of the FBS slate follows.":"Starts with the 15 most interesting games. Tease lines stay visible on every shown game; expand the slate only when you want the rest."}</p>
          </div>
          {league==="cfb"?<div className="collegeSort">
            <button className={collegeSort==="radar"?"active":""} onClick={()=>{setCollegeSort("radar");setShowAllGames(false)}}>BETRADAR</button>
            <button className={collegeSort==="top25"?"active":""} onClick={()=>{setCollegeSort("top25");setShowAllGames(false)}}>TOP 25 FIRST</button>
          </div>:null}
        </div>
        <div className="simpleBoard">
          {visibleGames.map(game=><BoardRow key={game.id} game={game}/>)}
        </div>
        {orderedGames.length>15?<button className="showMoreGames" onClick={()=>setShowAllGames(v=>!v)}>
          {showAllGames?"SHOW TOP 15 ONLY":"SHOW ALL "+orderedGames.length+" GAMES"}
        </button>:null}
      </section>

      <details className="modelDetails">
        <summary>What goes into the BetRadar Index?</summary>
        <div>
          <p>It is deliberately simple: season ATS performance, recent ATS form, over/under trends, sample size, agreement across available market lines, and how similar spreads/totals have actually performed earlier this season.</p>
          <p>The BetRadar Index is a relative signal score, not a win probability. Higher means more supporting evidence from team ATS/total history, similar past market lines and the current market. Low scores simply mean the evidence is thin.</p>
          <div className="detailMetrics">
            <span>Completed games reviewed: <strong>{data.methodology?.historyGames??0}</strong></span>
            <span>Historical games with odds reloaded: <strong>{data.methodology?.historicalOddsGamesHydrated??0}</strong></span>
            <span>Historical spread lines used: <strong>{data.methodology?.historicalSpreadGames??0}</strong></span>
            <span>Historical totals used: <strong>{data.methodology?.historicalTotalGames??0}</strong></span>
            <span>Method: <strong>Trend + market history + current line</strong></span>
          </div>
        </div>
      </details>
    </>}

    <footer className="betsFooter">BETRADAR INDEX = STRENGTH OF OPPORTUNITY SIGNAL, NOT WIN PROBABILITY · $10 UNIT · RECHECK LINES BEFORE WAGERING</footer>
  </main>;
}

"use client";
import { useEffect, useMemo, useState } from "react";
import { parseAgentQuery, searchGames, queryExplanation, spreadForGame } from "../../lib/agentSearch";
import { metadataChips } from "../../lib/gameMetadata";

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
function opportunityTag(item){
  if(item.game.sport!=="cfb")return item.index>=78?"PREMIER SPOT":"NFL";
  const ranked=rankedCount(item.game);
  if(ranked===2)return "TOP 25 MATCHUP";
  if(ranked===1)return "RANKED MATCHUP";
  return item.index>=76?"SLEEPER PICK":"UNDER THE RADAR";
}
function featuredOpportunities(games){
  return allOpportunities(games).filter(item=>{
    if(item.game.sport!=="cfb")return true;
    const ranked=rankedCount(item.game);
    if(ranked>0)return item.index>=60;
    return item.index>=76&&(item.game.interest?.score||0)>=50;
  }).sort((a,b)=>b.index-a.index||rankedCount(b.game)-rankedCount(a.game)||((b.game.interest?.score||0)-(a.game.interest?.score||0)));
}
function TeamMini({team}){
  return <span className="teamMini">{team?.logo?<img src={team.logo} alt=""/>:<i/>}<b>{teamDisplay(team)}</b></span>;
}
function GameMetaStrip({game,limit=3}){
  const chips=metadataChips(game,limit);
  return chips.length?<div className="gameMetaStrip">{chips.map(chip=><span key={chip}>{chip}</span>)}</div>:null;
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
function marketNumber(value){
  if(value===null||value===undefined||value==="")return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}
function marketFreshness(ts,now=Date.now()){
  if(!ts)return "CHECK PENDING";
  const minutes=Math.max(0,Math.floor((now-new Date(ts).getTime())/60000));
  if(minutes<2)return "CHECKED NOW";
  if(minutes<=60)return "CHECKED "+minutes+"M AGO";
  return "STALE · "+minutes+"M AGO";
}
function ShareButton({path,params,title="Game Radar"}){
  const[copied,setCopied]=useState(false);
  async function share(){
    if(typeof window==="undefined")return;
    const url=new URL(path,window.location.origin);
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

function pickKeyForOpportunity(item){
  if(item.type==="SPREAD")return item.side+"-spread";
  return item.side;
}
function savedPickId(league,weekStart,gameId,key){
  return [league,weekStart,gameId,key].join("|");
}
function allOpportunities(games){
  const out=[];
  for(const game of games){
    if(game.opportunities?.spread)out.push({...game.opportunities.spread,game});
    if(game.opportunities?.total)out.push({...game.opportunities.total,game});
  }
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
    const combos=[];
    function walk(start,chosen){
      if(chosen.length===config.size){
        if(new Set(chosen.map(x=>x.game.id)).size!==chosen.length)return;
        const ranked=chosen.filter(x=>rankedCount(x.game)>0).length;
        const sleepers=chosen.filter(x=>rankedCount(x.game)===0).length;
        if(league==="cfb"){
          if(ranked===0)return;
          if(config.size>=3&&ranked<2)return;
          if(chosen.some(x=>rankedCount(x.game)===0&&x.index<76))return;
          if(sleepers>1)return;
        }
        const score=chosen.reduce((s,x)=>s+x.index,0)/chosen.length+(ranked*1.5)+(sleepers===1?1.5:0);
        combos.push({legs:chosen.slice(),score,ranked,sleepers});
        return;
      }
      for(let i=start;i<source.length;i++)walk(i+1,[...chosen,source[i]]);
    }
    walk(0,[]);
    const best=combos.sort((a,b)=>b.score-a.score)[0];
    return best?{...best,...config,payout:parlayPayout(best.legs,10)}:null;
  }).filter(Boolean);
}
function OpportunityCard({item,rank,league,generatedAt,weekStart,weekLabel,weekOffset,isSaved,onToggleSave}){
  const g=item.game;
  const cls=indexClass(item.index);
  return <article id={"bet-"+g.id+"-"+item.type.toLowerCase()} className={"simplePick "+cls+(rank<=3?" featuredPick":"")}>
    <div className="simplePickRank">#{rank}</div>
    <div className="simplePickMain">
      <div className="simpleMatch">
        <div className="pickTagRow"><span className="matchupTag">{opportunityTag(item)}</span>{rank<=3?<span className="topPickTag">TOP {rank}</span>:null}</div>
        <div className="matchupVisual"><TeamMini team={g.away}/><em>@</em><TeamMini team={g.home}/></div>
        <small className="gameDate">{gameDateLabel(g)} · {item.type}</small>
        <ShareButton path="/bets" params={{league,game:g.id,bet:item.type.toLowerCase(),weekOffset}} title={matchup(g)+" · "+item.pick}/>
        <button className={"savePick "+(isSaved?"saved":"")} type="button" onClick={()=>onToggleSave({
          id:savedPickId(league,weekStart,g.id,pickKeyForOpportunity(item)),
          league,weekStart,weekLabel,gameId:g.id,key:pickKeyForOpportunity(item),
          matchup:matchup(g),gameDate:g.date,pick:item.pick,odds:item.americanOdds,index:item.index,
          source:"BetRadar Top Picks"
        })}>{isSaved?"★ SAVED":"☆ SAVE PICK"}</button>
      </div>
      <div className="pickHeadline">
        <h3>{item.pick} <span className="betOdds">{oddsText(item.americanOdds)}</span></h3>
        {item.noBrainer?<span className="convictionBadge noBrainer">NO BRAINER</span>:item.highConviction?<span className="convictionBadge">HIGH CONVICTION</span>:null}
      </div>
      {item.payout?<div className="payoutStrip">
        <span>$10 BET</span>
        <strong>WIN {moneyText(item.payout.profit)}</strong>
        <small>TOTAL RETURN {moneyText(item.payout.totalReturn)}</small>
      </div>:<div className="payoutStrip unavailable"><span>ODDS NOT AVAILABLE</span><small>Payout will appear when the market price loads.</small></div>}
      <GameMetaStrip game={g} limit={3}/>
      <div className="pickReason">
        <span>WHY IT'S HERE</span>
        <p>{item.why}</p>
      </div>
      <details className="pickDetails">
        <summary>MARKET + EVIDENCE</summary>
        <div className="evidenceChips">
          {(item.evidence||[]).map((x,i)=><span key={i}>{x}</span>)}
        </div>
        <div className="simpleWhy">
          <span>MARKET: {g.marketConsensus?.line||g.market?.details||"LINE PENDING"}</span>
          {g.marketConsensus?.total!=null?<small>O/U {g.marketConsensus.total}</small>:null}
          <small>{g.marketConsensus?.providerCount?g.marketConsensus.providerCount+" BOOK"+(g.marketConsensus.providerCount===1?"":"S")+" · ":""}{marketFreshness(generatedAt)}</small>
        </div>
      </details>
    </div>
    <div className="confidenceIndex">
      <span>BETRADAR INDEX</span>
      <strong>{item.index}</strong>
      <small>{item.index>80?"NO BRAINER":item.index>70?"HIGH CONVICTION":item.index>=60?"WATCH":"LOW CONFIDENCE"}</small>
    </div>
  </article>;
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

function teaserCandidate(game){
  const market=game.marketConsensus;
  if(marketNumber(market?.homeMargin)==null)return null;

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
  const ranked=rankedCount(game);
  if(game.sport==="cfb"&&ranked===0&&(!spreadOpp||spreadOpp.index<76))return null;
  const matchupBonus=game.sport==="cfb"?(ranked===2?8:ranked===1?4:2):3;
  const score=Math.round(52+quality+(supported?Math.max(6,(spreadOpp.index||0)-55):0)+(crossed.length*4)+matchupBonus);
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

function AgentGameCard({game,league,weekStart,weekLabel,weekOffset,isSaved,onSave}){
  const best=game.bestOpportunity;
  const spread=spreadForGame(game);
  const conference=[game.away?.conference,game.home?.conference].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i);
  return <article className="agentGameCard">
    <div className="agentGameTeams">
      <div className="matchupVisual"><TeamMini team={game.away}/><em>@</em><TeamMini team={game.home}/></div>
      <small>{gameDateLabel(game)}</small>
    </div>
    <div className="agentGameSignals">
      <span>{conference.length?conference.join(" · "):league==="cfb"?"COLLEGE":"NFL"}</span>
      <strong>{spread!=null?"SPREAD "+spread:"LINE PENDING"}</strong>
      <GameMetaStrip game={game} limit={3}/>
    </div>
    <div className="agentScore"><span>GAMERADAR</span><strong>{game.interest?.score||"—"}</strong></div>
    <div className="agentScore bet"><span>BETRADAR</span><strong>{best?.index||"—"}</strong></div>
    {best?<button className={"savePick "+(isSaved?"saved":"")} type="button" onClick={()=>onSave(game)}>
      {isSaved?"★ SAVED":"☆ SAVE "+best.pick}
    </button>:<span className="agentNoBet">NO BET SIGNAL</span>}
  </article>;
}

function BoardRow({game,league,generatedAt,weekStart,weekLabel,weekOffset,savedIds,onToggleSave}){
  const best=game.bestOpportunity;
  const market=game.marketConsensus||{};
  const available=Boolean(market.available);
  const homeMargin=marketNumber(market.homeMargin);
  const total=marketNumber(market.total);
  const homeSpread=homeMargin==null?null:-homeMargin;
  const awaySpread=homeMargin==null?null:homeMargin;
  const spreadSide=game.opportunities?.spread?.side;
  const totalSide=game.opportunities?.total?.side;

  const options=available?[
    {key:"away-spread",label:teamDisplay(game.away),base:awaySpread==null?"—":teamDisplay(game.away)+" "+formatSpread(awaySpread),odds:market.awaySpreadOdds,tease:awaySpread==null?"—":teamDisplay(game.away)+" "+formatSpread(awaySpread+6),suggested:spreadSide==="away"},
    {key:"home-spread",label:teamDisplay(game.home),base:homeSpread==null?"—":teamDisplay(game.home)+" "+formatSpread(homeSpread),odds:market.homeSpreadOdds,tease:homeSpread==null?"—":teamDisplay(game.home)+" "+formatSpread(homeSpread+6),suggested:spreadSide==="home"},
    {key:"over",label:"OVER",base:total==null?"—":"OVER "+total.toFixed(1),odds:market.overOdds,tease:total==null?"—":"OVER "+(total-6).toFixed(1),suggested:totalSide==="over"},
    {key:"under",label:"UNDER",base:total==null?"—":"UNDER "+total.toFixed(1),odds:market.underOdds,tease:total==null?"—":"UNDER "+(total+6).toFixed(1),suggested:totalSide==="under"}
  ]:[];

  return <article id={"game-"+game.id} className="gameTableRow openRow">
    <div className="gameTableSummary">
      <div className="tableMatch"><strong>{matchup(game)}</strong><small>{gameTime(game)}</small><ShareButton path="/bets" params={{league,game:game.id,weekOffset}} title={matchup(game)}/></div>
      <div className="tableMarket"><span>MARKET</span><strong>{market.line||"PENDING"}</strong>{total!=null?<small>O/U {total.toFixed(1)}</small>:null}<small>{market.providerCount?market.providerCount+" BOOK"+(market.providerCount===1?"":"S")+" · ":""}{marketFreshness(generatedAt)}</small></div>
      <div className="tableBest"><span>BEST LOOK</span><strong>{best?.pick||"—"}</strong>{best?.noBrainer?<small className="tableConviction noBrainerText">NO BRAINER</small>:best?.highConviction?<small className="tableConviction">HIGH CONVICTION</small>:null}</div>
      <div className={"tableIndex "+indexClass(best?.index??0)}><span>BETRADAR</span><strong>{best?.index??"—"}</strong></div>
    </div>

    {!available?<div className="gameTableUnavailable">MARKET LINE NOT AVAILABLE YET</div>:<div className="gameTableExpand alwaysVisible">
      {options.map(option=>{
        const totalReturn=tenDollarReturn(option.odds);
        return <div className={"tableBetOption "+(option.suggested?"suggested":"")} key={option.key}>
          <div className="tableBetTop"><span>{option.label}</span>{option.suggested?<b>BETRADAR LIKES</b>:null}</div>
          <div className="tableTease"><span>SUGGESTED TEASE</span><strong>{option.tease}</strong></div>
          <div className="tableStraight"><span>GAME LINE</span><strong>{option.base}</strong><em>{formatAmerican(option.odds)}</em></div>
          <button className={"savePick compact "+(savedIds.has(savedPickId(league,weekStart,game.id,option.key))?"saved":"")} type="button" onClick={()=>onToggleSave({
            id:savedPickId(league,weekStart,game.id,option.key),
            league,weekStart,weekLabel,gameId:game.id,key:option.key,
            matchup:matchup(game),gameDate:game.date,pick:option.base,odds:option.odds,
            index:option.suggested?game.bestOpportunity?.index||null:null,
            source:option.suggested?"BetRadar Likes":"Every Game"
          })}>{savedIds.has(savedPickId(league,weekStart,game.id,option.key))?"★ SAVED":"☆ SAVE"}</button>
          {totalReturn!=null?<small>{"$10 → $"+totalReturn.toFixed(2)}</small>:null}
        </div>;
      })}
    </div>}
  </article>;
}

export default function BetsPage(){
  const[league,setLeague]=useState("nfl");
  const[prefsReady,setPrefsReady]=useState(false);
  const[data,setData]=useState({games:[],methodology:null,generatedAt:null});
  const[nowTick,setNowTick]=useState(()=>Date.now());
  const[weekOffset,setWeekOffset]=useState(1);
  const[betSheet,setBetSheet]=useState([]);
  const[sheetReady,setSheetReady]=useState(false);
  const[showAllGames,setShowAllGames]=useState(false);
  const[boardSort,setBoardSort]=useState("index");
  const[signalFilter,setSignalFilter]=useState("all");
  const[topType,setTopType]=useState("all");
  const[agentQuery,setAgentQuery]=useState("");
  const[agentSpec,setAgentSpec]=useState(null);
  const[agentMessage,setAgentMessage]=useState("");
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const range=useMemo(()=>footballRange(weekOffset),[weekOffset]);
  const weekLabel=rangeLabel(range);

  useEffect(()=>{
    if(typeof window==="undefined")return;
    const params=new URLSearchParams(window.location.search);
    const q=params.get("league");
    const saved=window.localStorage.getItem("gameRadarLeague");
    const qWeek=Number(params.get("weekOffset"));
    setLeague(q==="cfb"||q==="nfl"?q:saved==="cfb"?"cfb":"nfl");
    if(Number.isFinite(qWeek)&&params.has("weekOffset"))setWeekOffset(Math.max(0,Math.min(4,qWeek)));
    try{setBetSheet(JSON.parse(window.localStorage.getItem("gameRadarBetSheet")||"[]"));}catch{setBetSheet([]);}
    setSheetReady(true);
    setPrefsReady(true);
  },[]);

  useEffect(()=>{
    if(!prefsReady||typeof window==="undefined")return;
    window.localStorage.setItem("gameRadarLeague",league);
    const url=new URL(window.location.href);
    url.searchParams.set("league",league);
    url.searchParams.set("weekOffset",String(weekOffset));
    window.history.replaceState({},"",url.pathname+url.search+url.hash);
  },[league,weekOffset,prefsReady]);

  useEffect(()=>{
    if(!sheetReady||typeof window==="undefined")return;
    window.localStorage.setItem("gameRadarBetSheet",JSON.stringify(betSheet));
  },[betSheet,sheetReady]);

  useEffect(()=>{
    const timer=setInterval(()=>setNowTick(Date.now()),60000);
    return()=>clearInterval(timer);
  },[]);

  useEffect(()=>{
    if(!prefsReady)return;
    let ignore=false;
    async function load(initial=false){
      if(initial){
        setShowAllGames(false);
        setBoardSort("index");
        setSignalFilter("all");
        setTopType("all");
        setLoading(true);
      }
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
    load(true);
    const timer=setInterval(()=>{
      if(typeof document==="undefined"||document.visibilityState==="visible")load(false);
    },30*60*1000);
    return()=>{ignore=true;clearInterval(timer)};
  },[league,weekOffset,prefsReady]);

  function toggleSavedPick(pick){
    setBetSheet(current=>current.some(x=>x.id===pick.id)?current.filter(x=>x.id!==pick.id):[...current,{...pick,savedAt:new Date().toISOString()}]);
  }
  function clearWeekSheet(){
    setBetSheet(current=>current.filter(x=>!(x.league===league&&x.weekStart===range.start)));
  }
  function savedFromGame(game){
    const best=game.bestOpportunity;
    if(!best)return null;
    const key=pickKeyForOpportunity(best);
    return {
      id:savedPickId(league,range.start,game.id,key),
      league,weekStart:range.start,weekLabel,gameId:game.id,key,
      matchup:matchup(game),gameDate:game.date,pick:best.pick,odds:best.americanOdds,index:best.index,
      source:"Ask GameRadar"
    };
  }
  function saveAgentGame(game){
    const pick=savedFromGame(game);
    if(pick)toggleSavedPick(pick);
  }
  function runAgentText(text){
    const spec=parseAgentQuery(text,{currentLeague:league,currentWeekOffset:weekOffset,games:(data.games||[])});
    setAgentQuery(text);
    if(spec.isSaveAction){
      const prior=agentSpec?searchGames((data.games||[]).filter(g=>g.sport===league),agentSpec):[];
      const picks=prior.map(savedFromGame).filter(Boolean).slice(0,spec.saveCount||3);
      if(!picks.length){setAgentMessage("RUN A SEARCH FIRST, THEN ASK ME TO SAVE THE BEST PICKS.");return;}
      setBetSheet(current=>{
        const map=new Map(current.map(x=>[x.id,x]));
        for(const pick of picks)map.set(pick.id,{...pick,savedAt:new Date().toISOString()});
        return [...map.values()];
      });
      setAgentMessage("SAVED "+picks.length+" PICKS TO YOUR BETTING SHEET.");
      return;
    }
    setAgentSpec(spec);
    setAgentMessage("");
    if(spec.league!==league)setLeague(spec.league);
    if(spec.weekOffset!==weekOffset)setWeekOffset(spec.weekOffset);
  }
  function submitAgent(e){
    e?.preventDefault();
    if(agentQuery.trim())runAgentText(agentQuery.trim());
  }

  const games=(data.games||[]).filter(g=>g.sport===league);
  const savedIds=useMemo(()=>new Set(betSheet.map(x=>x.id)),[betSheet]);
  const weekSheet=useMemo(()=>betSheet
    .filter(x=>x.league===league&&x.weekStart===range.start)
    .sort((a,b)=>new Date(a.gameDate)-new Date(b.gameDate)),[betSheet,league,range.start]);
  const agentResults=useMemo(()=>{
    if(!agentSpec||agentSpec.league!==league||agentSpec.weekOffset!==weekOffset)return [];
    return searchGames(games,agentSpec);
  },[games,agentSpec,league,weekOffset]);
  const filteredGames=useMemo(()=>{
    if(signalFilter==="70plus")return games.filter(g=>(g.bestOpportunity?.index||0)>=70);
    if(signalFilter==="conviction")return games.filter(g=>Boolean(g.bestOpportunity?.highConviction));
    return games;
  },[games,signalFilter]);

  const orderedGames=useMemo(()=>{
    const list=filteredGames.slice();
    if(boardSort==="kickoff")return list.sort((a,b)=>new Date(a.date)-new Date(b.date));
    if(boardSort==="interest")return list.sort((a,b)=>(b.interest?.score||0)-(a.interest?.score||0)||(b.opportunityIndex||0)-(a.opportunityIndex||0));
    if(boardSort==="top25"&&league==="cfb"){
      return list.sort((a,b)=>{
        const aRanks=[a.home?.rank,a.away?.rank].filter(Boolean);
        const bRanks=[b.home?.rank,b.away?.rank].filter(Boolean);
        const aRanked=aRanks.length?1:0;
        const bRanked=bRanks.length?1:0;
        if(aRanked!==bRanked)return bRanked-aRanked;
        const aTwo=aRanks.length===2?1:0;
        const bTwo=bRanks.length===2?1:0;
        if(aTwo!==bTwo)return bTwo-aTwo;
        const aBest=aRanks.length?Math.min(...aRanks):99;
        const bBest=bRanks.length?Math.min(...bRanks):99;
        if(aBest!==bBest)return aBest-bBest;
        return (b.opportunityIndex||0)-(a.opportunityIndex||0);
      });
    }
    return list.sort((a,b)=>(b.opportunityIndex||0)-(a.opportunityIndex||0)||(b.interest?.score||0)-(a.interest?.score||0));
  },[filteredGames,boardSort,league]);

  const visibleGames=showAllGames?orderedGames:orderedGames.slice(0,15);
  const opportunities=featuredOpportunities(games);

  useEffect(()=>{
    if(loading||!games.length||typeof window==="undefined")return;
    const params=new URLSearchParams(window.location.search);
    const game=params.get("game");
    if(!game)return;
    const bet=params.get("bet");
    const id=bet?"bet-"+game+"-"+bet:"game-"+game;
    setTimeout(()=>{
      const target=document.getElementById(id)||document.getElementById("game-"+game);
      target?.scrollIntoView({behavior:"smooth",block:"center"});
    },80);
  },[loading,games.length,league]);
  const top=opportunities.filter(item=>topType==="all"||item.type.toLowerCase()===topType).slice(0,10);
  const parlays=featuredParlays(opportunities,league);
  const teaserPool=games.map(teaserCandidate).filter(Boolean).sort((a,b)=>b.score-a.score);
  const teaserGroups=[
    {size:2,count:2,items:bestTeasers(teaserPool,2,2)},
    {size:3,count:3,items:bestTeasers(teaserPool,3,3)},
    {size:4,count:2,items:bestTeasers(teaserPool,4,2)},
    {size:5,count:1,items:bestTeasers(teaserPool,5,1)}
  ];

  return <main className="betsShell">
    <a className="suiteHome" href="/">← GAME RADAR HOME</a>
    <nav className="productSwitcher" aria-label="Game Radar products">
      <a className="active betradar" href={"/bets?league="+league+"&weekOffset="+weekOffset}>
        <strong>BETRADAR</strong>
        <small>Bets · confidence · teasers</small>
      </a>
      <a className="gameradar" href={"/scores?league="+league+"&week="+weekOffset+"&mode="+(weekOffset===0?"live":"ahead")}>
        <strong>GAMERADAR</strong>
        <small>Live scores · what to watch</small>
      </a>
    </nav>

    <header className="betsHero simpleHero">
      <div>
        <div className="betsKicker">{weekOffset===0?"THIS FOOTBALL WEEK":"LOOK AHEAD · +"+weekOffset+" WEEK"+(weekOffset===1?"":"S")} · {weekLabel}</div>
        <h1>BETRADAR</h1>
        <p>BetRadar surfaces the most interesting games and the strongest betting signals from actual season results, historical market lines and the current line. Every suggested bet shows the odds, $10-unit payout and BetRadar Index.</p>
      </div>
    </header>

    <section className="heroStats">
      <div><span>FEATURED PICKS</span><strong>{top.length}</strong></div>
      <div><span>HIGH CONVICTION 71+</span><strong>{top.filter(x=>x.highConviction).length}</strong></div>
      <div><span>SAVED THIS WEEK</span><strong>{weekSheet.length}</strong></div>
    </section>

    <section className="askRadar askRadarFeatured">
      <div className="askRadarHead">
        <div>
          <span className="askEyebrow">✦ ASK GAMERADAR</span>
          <h2>SEARCH FOOTBALL LIKE YOU TALK ABOUT IT</h2>
          <p>Find tight conference games, ranked matchups, sleeper bets, or the strongest BetRadar signals without digging through the board.</p>
        </div>
        <div className="askRadarBadge">AI SEARCH</div>
      </div>
      <form className="askRadarForm" onSubmit={submitAgent}>
        <input value={agentQuery} onChange={e=>setAgentQuery(e.target.value)} placeholder="Try: Give me the tight Big Ten + SEC games this week"/>
        <button type="submit">ASK GAMERADAR →</button>
      </form>
      <div className="askPrompts">
        {[
          "Tight Big Ten + SEC games",
          "Ranked vs ranked",
          "SEC underdogs BetRadar likes",
          "Primetime high-conviction bets",
          "Save the best 3"
        ].map(prompt=><button key={prompt} onClick={()=>runAgentText(prompt)}>{prompt}</button>)}
      </div>
      {agentSpec&&!agentSpec.isSaveAction?<div className="agentInterpretation">
        <div className="agentChips">{agentSpec.chips.map(chip=><span key={chip}>{chip}</span>)}</div>
        <p>{queryExplanation(agentSpec)}</p>
      </div>:null}
      {agentMessage?<div className="agentMessage">{agentMessage}</div>:null}
      {agentSpec&&!agentSpec.isSaveAction?<div className="agentResults">
        <div className="agentResultsHead"><strong>{loading?"SEARCHING…":agentResults.length+" GAME"+(agentResults.length===1?"":"S")+" FOUND"}</strong><span>RESULTS USE LIVE GAMERADAR DATA — NOT GENERATED MATCHUPS</span></div>
        {!loading&&agentResults.length?agentResults.map(game=>{
          const best=game.bestOpportunity;
          const id=best?savedPickId(league,range.start,game.id,pickKeyForOpportunity(best)):null;
          return <AgentGameCard key={game.id} game={game} league={league} weekStart={range.start} weekLabel={weekLabel} weekOffset={weekOffset} isSaved={id?savedIds.has(id):false} onSave={saveAgentGame}/>;
        }):!loading?<div className="notice">NO GAMES MATCH THAT SEARCH. TRY WIDENING THE SPREAD OR REMOVING A FILTER.</div>:null}
      </div>:null}
    </section>

    <nav className="betsSectionNav" aria-label="BetRadar sections">
      <a href="#top-bets"><strong>TOP BETS</strong><small>Ranked signals</small></a>
      <a href="#bet-sheet"><strong>MY BETS</strong><small>{weekSheet.length} saved</small></a>
      <a href="#parlays"><strong>PARLAYS</strong><small>Curated cards</small></a>
      <a href="#every-game"><strong>ALL GAMES</strong><small>Full data board</small></a>
    </nav>

    <div className="leagueSwitchBlock">
      <span className="switchLabel">CHOOSE LEAGUE</span>
      <nav className="betsLeagueToggle" aria-label="League">
        {LEAGUES.map(([v,label])=><button key={v} className={league===v?"active":""} onClick={()=>setLeague(v)}>{label}</button>)}
      </nav>
    </div>

    <section className="betWeekNav">
      <div>
        <span>BETTING WEEK</span>
        <strong>{weekOffset===0?"THIS WEEK":weekOffset===1?"NEXT WEEK":"+"+weekOffset+" WEEKS"} · {weekLabel}</strong>
      </div>
      <div className="betWeekButtons">
        {[0,1,2,3,4].map(offset=><button key={offset} className={weekOffset===offset?"active":""} onClick={()=>setWeekOffset(offset)}>
          {offset===0?"THIS":offset===1?"NEXT":"+"+offset}
        </button>)}
      </div>
    </section>

    <section className={"marketTrust "+(data.generatedAt&&Date.now()-new Date(data.generatedAt).getTime()>60*60000?"stale":"")}>
      <span>MARKET STATUS</span>
      <strong>{marketFreshness(data.generatedAt,nowTick)}</strong>
      <small>LINES CACHED ≤15 MIN · {data.methodology?.currentOddsGamesHydrated??0}/{data.methodology?.currentGames??0} GAMES MULTI-BOOK CHECKED</small>
    </section>

    <section className="betSheet" id="bet-sheet">
      <div className="betSheetHead">
        <div>
          <span>MY BETTING SHEET</span>
          <h2>{weekSheet.length?weekSheet.length+" SAVED PICK"+(weekSheet.length===1?"":"S"):"BUILD YOUR CARD"}</h2>
          <p>Save the bets you want to remember for {weekLabel}. Your sheet stays on this device while you move around BetRadar. {betSheet.length>weekSheet.length?betSheet.length-weekSheet.length+" more saved in other weeks.":""}</p>
        </div>
        {weekSheet.length?<button onClick={clearWeekSheet}>CLEAR WEEK</button>:null}
      </div>
      {weekSheet.length?<div className="betSheetRows">
        {weekSheet.map(pick=><div className="betSheetRow" key={pick.id}>
          <div><strong>{pick.pick}</strong><small>{pick.matchup}</small></div>
          <div><span>GAME</span><strong>{new Date(pick.gameDate).toLocaleString([],{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</strong></div>
          <div><span>ODDS</span><strong>{formatAmerican(pick.odds)}</strong></div>
          <div><span>INDEX</span><strong>{pick.index??"—"}</strong></div>
          <button onClick={()=>toggleSavedPick(pick)}>REMOVE</button>
        </div>)}
      </div>:<div className="betSheetEmpty">Tap ☆ SAVE PICK on a BetRadar recommendation or ☆ SAVE on any game line below.</div>}
    </section>

    <section className="confidenceLegend">
      <div className="best"><strong>81+</strong><span>NO BRAINER</span></div>
      <div className="strong"><strong>71–80</strong><span>HIGH CONVICTION</span></div>
      <div className="lean"><strong>60–70</strong><span>WATCH</span></div>
      <div className="pass"><strong>&lt;60</strong><span>LOW CONFIDENCE</span></div>
    </section>
    {error?<div className="notice error">{error}</div>:null}
    {loading?<div className="notice">BUILDING THE BET RADAR...</div>:<>
      <section className="betSection simpleBetSection" id="top-bets">
        <div className="betSectionHead filterableHead">
          <span>01</span>
          <div>
            <h2>TOP 10 BETS OF THE WEEK</h2>
            <p>Ranked by BetRadar Index first. Scores above 70 are HIGH CONVICTION; scores above 80 are labeled NO BRAINER. College picks still favor Top 25 matchups plus the strongest sleeper spots.</p>
          </div>
          <div className="miniFilter" aria-label="Top bet type">
            {[
              ["all","ALL"],
              ["spread","SPREADS"],
              ["total","TOTALS"]
            ].map(([v,label])=><button key={v} className={topType===v?"active":""} onClick={()=>setTopType(v)}>{label}</button>)}
          </div>
        </div>
        <div className="simplePickList">
          {top.length?top.map((item,i)=><OpportunityCard key={item.game.id+"-"+item.type} item={item} rank={i+1} league={league} generatedAt={data.generatedAt} weekStart={range.start} weekLabel={weekLabel} weekOffset={weekOffset} isSaved={savedIds.has(savedPickId(league,range.start,item.game.id,pickKeyForOpportunity(item)))} onToggleSave={toggleSavedPick}/>):<div className="notice">NOT ENOUGH TREND + MARKET EVIDENCE YET.</div>}
        </div>
      </section>

      <section className="betSection" id="parlays">
        <div className="betSectionHead">
          <span>02</span>
          <div><h2>PARLAYS + TEASERS</h2><p>College combinations start with ranked matchups, then allow a genuinely strong sleeper. No filler games just to complete a card.</p></div>
        </div>
        {parlays.length?<div className="parlayGrid">{parlays.map((parlay,i)=><ParlayCard parlay={parlay} key={parlay.label+"-"+i}/>)}</div>:null}
        <div className="subSectionLabel">BEST 6-POINT TEASERS</div>
        <div className="teaserGrid">
          {teaserGroups.flatMap(group=>group.items.map((combo,i)=><TeaserCard key={group.size+"-"+i} size={group.size} number={i+1} legs={combo.legs}/>))}
          {!teaserPool.length?<div className="notice">NO TEASER-FRIENDLY LINES AVAILABLE YET.</div>:null}
        </div>
      </section>

      <section className="betSection" id="every-game">
        <div className="betSectionHead everyGameHead">
          <span>03</span>
          <div>
            <h2>EVERY GAME</h2>
            <p>BetRadar Index is the default ranking because this is the betting board. Use Interest or Kickoff only when you want to browse the slate differently.</p>
          </div>
        </div>

        <div className="boardControls">
          <div className="boardControlGroup">
            <span>SORT</span>
            <button className={boardSort==="index"?"active":""} onClick={()=>{setBoardSort("index");setShowAllGames(false)}}>BET INDEX</button>
            <button className={boardSort==="interest"?"active":""} onClick={()=>{setBoardSort("interest");setShowAllGames(false)}}>GAME INTEREST</button>
            <button className={boardSort==="kickoff"?"active":""} onClick={()=>{setBoardSort("kickoff");setShowAllGames(false)}}>KICKOFF</button>
            {league==="cfb"?<button className={boardSort==="top25"?"active":""} onClick={()=>{setBoardSort("top25");setShowAllGames(false)}}>TOP 25 FIRST</button>:null}
          </div>
          <div className="boardControlGroup">
            <span>FILTER</span>
            <button className={signalFilter==="all"?"active":""} onClick={()=>{setSignalFilter("all");setShowAllGames(false)}}>ALL</button>
            <button className={signalFilter==="70plus"?"active":""} onClick={()=>{setSignalFilter("70plus");setShowAllGames(false)}}>70+ SIGNAL</button>
            <button className={signalFilter==="conviction"?"active":""} onClick={()=>{setSignalFilter("conviction");setShowAllGames(false)}}>HIGH CONVICTION 71+</button>
          </div>
          <div className="boardCount">{orderedGames.length} GAME{orderedGames.length===1?"":"S"}</div>
        </div>
        <div className="simpleBoard">
          {visibleGames.length?visibleGames.map(game=><BoardRow key={game.id} game={game} league={league} generatedAt={data.generatedAt} weekStart={range.start} weekLabel={weekLabel} weekOffset={weekOffset} savedIds={savedIds} onToggleSave={toggleSavedPick}/>):<div className="notice">NO GAMES MATCH THIS FILTER.</div>}
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

    <a className="mobileBetSheet" href="#bet-sheet">MY BETS · {weekSheet.length}</a>

    <footer className="betsFooter">NO BRAINER = BETRADAR INDEX ABOVE 80, NOT A GUARANTEE · BETRADAR INDEX = STRENGTH OF OPPORTUNITY SIGNAL, NOT WIN PROBABILITY · $10 UNIT · MARKET AUTO-REFRESH 30 MIN{data.generatedAt?" · UPDATED "+new Date(data.generatedAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}):""}</footer>
  </main>;
}

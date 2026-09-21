"use client";
import { useEffect, useMemo, useState } from "react";
import { parseAgentQuery, searchGames, queryExplanation, spreadForGame } from "../../lib/agentSearch";
import { metadataChips, gameMetadata } from "../../lib/gameMetadata";
import RadarMenu from "../components/RadarMenu";

const LEAGUES=[["nfl","NFL"],["cfb","COLLEGE FBS"]];

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

function rangeLabel(r){
  const a=r.startDate.toLocaleDateString([],{month:"short",day:"numeric"});
  const b=r.endDate.toLocaleDateString([],{month:"short",day:"numeric"});
  return a+"–"+b;
}
function weekName(offset){
  if(offset===-1)return "LAST WEEK";
  if(offset===0)return "THIS WEEK";
  if(offset===1)return "NEXT WEEK";
  if(offset>1)return "LOOK AHEAD · +"+offset;
  return "PAST WEEK";
}
function WeekSelector({weekOffset,setWeekOffset,range,min=0,max=4}){
  return <div className="weekSelector" aria-label="Select football week">
    <button disabled={weekOffset<=min} onClick={()=>setWeekOffset(x=>Math.max(min,x-1))} aria-label="Previous week">‹</button>
    <div>
      <span>{weekName(weekOffset)}</span>
      <strong>{rangeLabel(range)}</strong>
    </div>
    <button disabled={weekOffset>=max} onClick={()=>setWeekOffset(x=>Math.min(max,x+1))} aria-label="Next week">›</button>
  </div>;
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
  return item.index>=76?"SLEEPER SIGNAL":"UNDER THE RADAR";
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


function BetPickCard({item,featured=false,league,weekStart,weekLabel,weekOffset,isSaved,onToggleSave}){
  const g=item.game;
  const meta=gameMetadata(g);
  const saved={
    id:savedPickId(league,weekStart,g.id,pickKeyForOpportunity(item)),
    league,weekStart,weekLabel,gameId:g.id,key:pickKeyForOpportunity(item),
    matchup:matchup(g),gameDate:g.date,pick:item.pick,odds:item.americanOdds,index:item.index,
    source:"BetRadar"
  };
  return <article className={"brPickCard "+(featured?"featured ":"")+(item.noBrainer?"noBrainer ":"")}>
    <div className="brPickTop">
      <div className="brMatchup">
        <TeamMini team={g.away}/><em>@</em><TeamMini team={g.home}/>
      </div>
      <span className="brKickoff">{gameTime(g)}</span>
    </div>
    <div className="brPickMain">
      <div>
        <span className="brPickLabel">{item.type}</span>
        <h3>{item.pick} <small>{oddsText(item.americanOdds)}</small></h3>
      </div>
      <div className="brIndex">
        <strong>{item.index}</strong>
        <span>{item.noBrainer?"No Brainer":item.highConviction?"High Conviction":item.index>=60?"Watch":"Low Confidence"}</span>
      </div>
    </div>
    <div className="brMeta">
      {meta.rankedMatchup?<span>Ranked Matchup</span>:meta.rankedInvolved?<span>Ranked Team</span>:null}
      {meta.conferenceGame?<span>Conference Game</span>:null}
      {meta.rivalry?<span>Rivalry</span>:null}
      {meta.broadcasts?.[0]?<span>{meta.broadcasts[0]}</span>:null}
      {g.marketConsensus?.line||g.market?.details?<span>{g.marketConsensus?.line||g.market?.details}</span>:null}
    </div>
    <p className="brWhy">{item.why}</p>
    <div className="brActions">
      <button className={isSaved?"saved":""} onClick={()=>onToggleSave(saved)}>{isSaved?"★ Saved":"☆ Save pick"}</button>
      <details>
        <summary>Why this score</summary>
        <div className="brEvidence">
          {(item.evidence||[]).map((x,i)=><span key={i}>{x}</span>)}
          <span>Signal strength: {item.index}</span>
          <span>{g.marketConsensus?.providerCount||0} market source{g.marketConsensus?.providerCount===1?"":"s"}</span>
        </div>
      </details>
    </div>
  </article>;
}

function BetGameRow({game,league,weekStart,weekLabel,savedIds,onToggleSave}){
  const best=game.bestOpportunity;
  const market=game.marketConsensus||{};
  const meta=gameMetadata(game);
  const key=best?pickKeyForOpportunity(best):null;
  const id=key?savedPickId(league,weekStart,game.id,key):null;
  const saved=best?{
    id,league,weekStart,weekLabel,gameId:game.id,key,
    matchup:matchup(game),gameDate:game.date,pick:best.pick,odds:best.americanOdds,index:best.index,
    source:"BetRadar All Games"
  }:null;
  return <article className="brGameRow">
    <div className="brGameTeams">
      <div><TeamMini team={game.away}/><em>@</em><TeamMini team={game.home}/></div>
      <small>{gameTime(game)}</small>
    </div>
    <div className="brGameContext">
      {meta.conferenceGame?<span>Conference</span>:null}
      {meta.rankedMatchup?<span>Ranked vs Ranked</span>:meta.rankedInvolved?<span>Ranked</span>:null}
      {meta.broadcasts?.[0]?<span>{meta.broadcasts[0]}</span>:null}
    </div>
    <div className="brMarket">
      <span>Market</span>
      <strong>{market.line||"Pending"}</strong>
      {market.total!=null?<small>O/U {market.total}</small>:null}
    </div>
    <div className="brBest">
      <span>Best look</span>
      <strong>{best?.pick||"—"}</strong>
      <small>{best?best.index+" · "+(best.noBrainer?"No Brainer":best.highConviction?"High Conviction":best.index>=60?"Watch":"Low Confidence"):"No signal"}</small>
    </div>
    {best?<button className={"brSave "+(savedIds.has(id)?"saved":"")} onClick={()=>onToggleSave(saved)}>{savedIds.has(id)?"★":"☆"}</button>:<span/>}
  </article>;
}

function BetFilterDrawer({open,onClose,games,filters,setFilters}){
  if(!open)return null;
  const conferences=[...new Set(games.flatMap(g=>[g.home?.conference,g.away?.conference]).filter(Boolean))].sort();
  const teams=[...new Map(games.flatMap(g=>[g.away,g.home]).filter(Boolean).map(t=>[String(t.id),t])).values()].sort((a,b)=>String(a.location||a.name).localeCompare(String(b.location||b.name)));
  const networks=[...new Set(games.flatMap(g=>g.broadcasts||[]).filter(Boolean))].sort();
  return <div className="brFilterScrim" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <aside className="brFilterDrawer">
      <div className="brFilterHead"><strong>Filters</strong><button onClick={onClose}>Done</button></div>
      <label>Conference<select value={filters.conference} onChange={e=>setFilters(x=>({...x,conference:e.target.value}))}><option value="">All conferences</option>{conferences.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Team<select value={filters.team} onChange={e=>setFilters(x=>({...x,team:e.target.value}))}><option value="">All teams</option>{teams.map(t=><option value={String(t.id)} key={t.id}>{t.location||t.name}</option>)}</select></label>
      <label>TV network<select value={filters.network} onChange={e=>setFilters(x=>({...x,network:e.target.value}))}><option value="">Any network</option>{networks.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Bet type<select value={filters.type} onChange={e=>setFilters(x=>({...x,type:e.target.value}))}><option value="">Spread + totals</option><option value="spread">Spreads</option><option value="total">Totals</option></select></label>
      <label>Minimum BetRadar Index<select value={filters.minIndex} onChange={e=>setFilters(x=>({...x,minIndex:e.target.value}))}><option value="">Any signal</option><option value="60">60+</option><option value="71">High Conviction 71+</option><option value="81">No Brainer 81+</option></select></label>
      <div className="grFilterChecks">
        <label><input type="checkbox" checked={filters.ranked} onChange={e=>setFilters(x=>({...x,ranked:e.target.checked}))}/> Ranked games</label>
        <label><input type="checkbox" checked={filters.close} onChange={e=>setFilters(x=>({...x,close:e.target.checked}))}/> Close spreads</label>
      </div>
      <button className="grClearFilters" onClick={()=>setFilters({conference:"",team:"",network:"",type:"",minIndex:"",ranked:false,close:false})}>Clear filters</button>
    </aside>
  </div>;
}

export default function BetsPage(){
  const[league,setLeague]=useState("nfl");
  const[prefsReady,setPrefsReady]=useState(false);
  const[data,setData]=useState({games:[],methodology:null,generatedAt:null});
  const[weekOffset,setWeekOffset]=useState(0);
  const[betSheet,setBetSheet]=useState([]);
  const[sheetReady,setSheetReady]=useState(false);
  const[query,setQuery]=useState("");
  const[agentSpec,setAgentSpec]=useState(null);
  const[agentMessage,setAgentMessage]=useState("");
  const[filtersOpen,setFiltersOpen]=useState(false);
  const[filters,setFilters]=useState({conference:"",team:"",network:"",type:"",minIndex:"",ranked:false,close:false});
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const range=useMemo(()=>footballRange(weekOffset),[weekOffset]);
  const weekLabel=rangeLabel(range);

  useEffect(()=>{
    if(typeof window==="undefined")return;
    const params=new URLSearchParams(window.location.search);
    const qLeague=params.get("league");
    const saved=window.localStorage.getItem("gameRadarLeague");
    const qWeek=Number(params.get("weekOffset"));
    setLeague(qLeague==="cfb"||qLeague==="nfl"?qLeague:saved==="cfb"?"cfb":"nfl");
    if(Number.isFinite(qWeek)&&params.has("weekOffset"))setWeekOffset(Math.max(0,Math.min(4,qWeek)));
    try{setBetSheet(JSON.parse(window.localStorage.getItem("gameRadarBetSheet")||"[]"));}catch{setBetSheet([])}
    setSheetReady(true);
    setPrefsReady(true);
  },[]);

  useEffect(()=>{
    if(!prefsReady||typeof window==="undefined")return;
    window.localStorage.setItem("gameRadarLeague",league);
    const url=new URL(window.location.href);
    url.searchParams.set("league",league);
    url.searchParams.set("weekOffset",String(weekOffset));
    window.history.replaceState({},"",url.pathname+url.search);
  },[league,weekOffset,prefsReady]);

  useEffect(()=>{
    if(!sheetReady||typeof window==="undefined")return;
    window.localStorage.setItem("gameRadarBetSheet",JSON.stringify(betSheet));
  },[betSheet,sheetReady]);

  useEffect(()=>{
    if(!prefsReady)return;
    let ignore=false;
    async function load(){
      try{
        setLoading(true);
        const r=await fetch("/api/bets?league="+league+"&start="+range.start+"&end="+range.end,{cache:"no-store"});
        if(!r.ok)throw new Error();
        const json=await r.json();
        if(!ignore){setData(json);setError("")}
      }catch{if(!ignore)setError("BetRadar temporarily unavailable.")}
      finally{if(!ignore)setLoading(false)}
    }
    load();
    const timer=setInterval(()=>{if(document.visibilityState==="visible")load()},30*60*1000);
    return()=>{ignore=true;clearInterval(timer)}
  },[league,weekOffset,prefsReady]);

  const games=(data.games||[]).filter(g=>g.sport===league);
  const savedIds=useMemo(()=>new Set(betSheet.map(x=>x.id)),[betSheet]);
  const weekSheet=useMemo(()=>betSheet.filter(x=>x.league===league&&x.weekStart===range.start).sort((a,b)=>new Date(a.gameDate)-new Date(b.gameDate)),[betSheet,league,range.start]);

  function toggleSavedPick(pick){
    setBetSheet(current=>current.some(x=>x.id===pick.id)?current.filter(x=>x.id!==pick.id):[...current,{...pick,savedAt:new Date().toISOString()}]);
  }
  function clearWeekSheet(){setBetSheet(current=>current.filter(x=>!(x.league===league&&x.weekStart===range.start)))}
  function savedFromGame(game){
    const best=game.bestOpportunity;
    if(!best)return null;
    const key=pickKeyForOpportunity(best);
    return {id:savedPickId(league,range.start,game.id,key),league,weekStart:range.start,weekLabel,gameId:game.id,key,matchup:matchup(game),gameDate:game.date,pick:best.pick,odds:best.americanOdds,index:best.index,source:"BetRadar Search"};
  }
  function runSearch(text){
    const spec=parseAgentQuery(text,{currentLeague:league,currentWeekOffset:weekOffset,games});
    setQuery(text);
    if(spec.isSaveAction){
      const prior=agentSpec?searchGames(games,agentSpec):[];
      const picks=prior.map(savedFromGame).filter(Boolean).slice(0,spec.saveCount||3);
      if(!picks.length){setAgentMessage("Search first, then ask to save the best picks.");return}
      setBetSheet(current=>{
        const map=new Map(current.map(x=>[x.id,x]));
        for(const pick of picks)map.set(pick.id,{...pick,savedAt:new Date().toISOString()});
        return [...map.values()];
      });
      setAgentMessage("Saved "+picks.length+" picks.");
      return;
    }
    setAgentMessage("");
    setAgentSpec(spec);
    if(spec.league!==league)setLeague(spec.league);
    if(spec.weekOffset!==weekOffset)setWeekOffset(Math.max(0,Math.min(4,spec.weekOffset)));
  }
  function submitSearch(e){e.preventDefault();if(query.trim())runSearch(query.trim())}

  const filteredGames=useMemo(()=>games.filter(game=>{
    const meta=gameMetadata(game);
    if(filters.conference&&!meta.conferences.includes(filters.conference))return false;
    if(filters.team&&String(game.home.id)!==filters.team&&String(game.away.id)!==filters.team)return false;
    if(filters.network&&!meta.broadcasts.includes(filters.network))return false;
    if(filters.minIndex&&Number(game.bestOpportunity?.index||0)<Number(filters.minIndex))return false;
    if(filters.ranked&&!meta.rankedInvolved)return false;
    if(filters.close&&(meta.spread==null||meta.spread>7.5))return false;
    if(filters.type&&!game.opportunities?.[filters.type])return false;
    return true;
  }),[games,filters]);

  const opportunities=featuredOpportunities(filteredGames).filter(item=>!filters.type||item.type.toLowerCase()===filters.type);
  const top=opportunities.slice(0,10);
  const featured=top[0]||null;
  const nextBest=top.slice(1,5);
  const allGames=filteredGames.slice().sort((a,b)=>(b.bestOpportunity?.index||0)-(a.bestOpportunity?.index||0)||new Date(a.date)-new Date(b.date));

  const searchResults=useMemo(()=>{
    if(!agentSpec||agentSpec.isSaveAction||agentSpec.league!==league||agentSpec.weekOffset!==weekOffset)return [];
    return searchGames(games,agentSpec).slice(0,10);
  },[games,agentSpec,league,weekOffset]);

  const activeFilters=[];
  if(filters.conference)activeFilters.push(["conference",filters.conference]);
  if(filters.team){
    const t=games.flatMap(g=>[g.home,g.away]).find(t=>String(t.id)===filters.team);
    if(t)activeFilters.push(["team",t.location||t.name]);
  }
  if(filters.network)activeFilters.push(["network",filters.network]);
  if(filters.type)activeFilters.push(["type",filters.type==="spread"?"Spreads":"Totals"]);
  if(filters.minIndex)activeFilters.push(["minIndex",filters.minIndex+"+ Index"]);
  if(filters.ranked)activeFilters.push(["ranked","Ranked"]);
  if(filters.close)activeFilters.push(["close","Close spreads"]);

  function removeFilter(key){setFilters(x=>({...x,[key]:typeof x[key]==="boolean"?false:""}))}

  const parlays=featuredParlays(opportunities,league).slice(0,2);

  return <main className="brPage">
    <header className="brHeader">
      <a className="brLogo" href="/bets">BET<span>RADAR</span></a>
      <div className="brLeagueToggle">
        <button className={league==="nfl"?"active":""} onClick={()=>setLeague("nfl")}>NFL</button>
        <button className={league==="cfb"?"active":""} onClick={()=>setLeague("cfb")}>College</button>
      </div>
      <form className="brSearch" onSubmit={submitSearch}>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search teams, conferences, high-conviction bets, or ask what to bet…"/>
        <button type="submit">Search</button>
      </form>
      <a className="brSavedLink" href="#saved">★ My Bets <span>{weekSheet.length}</span></a>
      <a className="brGameLink" href={"/scores?league="+league+"&week="+weekOffset}>GameRadar</a>
      <RadarMenu current="/bets" className="suiteMenu"/>
    </header>

    <nav className="brPrimaryNav">
      <div className="brPrimaryLinks">
        <a href="#top">Top Signals</a>
        <a href="#all">All Games</a>
        <a href="#parlays">Parlays</a>
      </div>
      <div className="brPrimaryTools">
        <WeekSelector weekOffset={weekOffset} setWeekOffset={setWeekOffset} range={range}/>
        <button className="brFilterButton" onClick={()=>setFiltersOpen(true)}>Filters{activeFilters.length?" · "+activeFilters.length:""}</button>
      </div>
    </nav>

    {activeFilters.length?<div className="grActiveFilters">{activeFilters.map(([key,label])=><button key={key} onClick={()=>removeFilter(key)}>{label} ×</button>)}</div>:null}

    {agentSpec&&!agentSpec.isSaveAction?<section className="brSearchResults">
      <div className="grSectionHead">
        <div><h2>Search results</h2><p>{queryExplanation(agentSpec)}</p></div>
        <button onClick={()=>{setAgentSpec(null);setQuery("")}}>Clear</button>
      </div>
      <div className="grSearchChips">{agentSpec.chips.map(chip=><span key={chip}>{chip}</span>)}</div>
      <div className="brGameList">
        {searchResults.length?searchResults.map(game=><BetGameRow key={game.id} game={game} league={league} weekStart={range.start} weekLabel={weekLabel} savedIds={savedIds} onToggleSave={toggleSavedPick}/>):<div className="grEmpty">No bets match that search.</div>}
      </div>
    </section>:null}
    {agentMessage?<div className="brMessage">{agentMessage}</div>:null}

    {error?<div className="grEmpty">{error}</div>:null}
    {loading?<div className="grEmpty">Loading BetRadar…</div>:<>
      <section className="brSection" id="top">
        <div className="grSectionHead">
          <div><h2>Top Signals</h2><p>{weekName(weekOffset)} · {weekLabel} · live model signals, not locked Radar Picks</p></div>
          <button onClick={()=>setFiltersOpen(true)}>Narrow board</button>
        </div>
        {featured?<BetPickCard item={featured} featured league={league} weekStart={range.start} weekLabel={weekLabel} weekOffset={weekOffset} isSaved={savedIds.has(savedPickId(league,range.start,featured.game.id,pickKeyForOpportunity(featured)))} onToggleSave={toggleSavedPick}/>:<div className="grEmpty">No qualifying betting signals yet.</div>}
        {nextBest.length?<div className="brTopGrid">{nextBest.map(item=><BetPickCard key={item.game.id+"-"+item.type} item={item} league={league} weekStart={range.start} weekLabel={weekLabel} weekOffset={weekOffset} isSaved={savedIds.has(savedPickId(league,range.start,item.game.id,pickKeyForOpportunity(item)))} onToggleSave={toggleSavedPick}/>)}</div>:null}
      </section>

      <section className="brSection" id="saved">
        <div className="grSectionHead">
          <div><h2>My Bets</h2><p>{weekSheet.length?weekSheet.length+" saved for "+weekLabel:"Save picks and they’ll appear here."}</p></div>
          {weekSheet.length?<button onClick={clearWeekSheet}>Clear week</button>:null}
        </div>
        {weekSheet.length?<div className="brSavedList">{weekSheet.map(pick=><div className="brSavedRow" key={pick.id}>
          <div><strong>{pick.pick}</strong><span>{pick.matchup}</span></div>
          <span>{new Date(pick.gameDate).toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"})}</span>
          <strong>{pick.index??"—"}</strong>
          <button onClick={()=>toggleSavedPick(pick)}>Remove</button>
        </div>)}</div>:<div className="brEmptyInline">No saved bets yet.</div>}
      </section>

      <section className="brSection" id="all">
        <div className="grSectionHead">
          <div><h2>All Games</h2><p>Strongest current BetRadar signal from every game with a market.</p></div>
        </div>
        <div className="brGameList">
          {allGames.length?allGames.map(game=><BetGameRow key={game.id} game={game} league={league} weekStart={range.start} weekLabel={weekLabel} savedIds={savedIds} onToggleSave={toggleSavedPick}/>):<div className="grEmpty">No games match these filters.</div>}
        </div>
      </section>

      <section className="brSection brSecondary" id="parlays">
        <div className="grSectionHead"><div><h2>Parlays</h2><p>Curated combinations from the same underlying BetRadar signals.</p></div></div>
        {parlays.length?<div className="brParlayGrid">{parlays.map((p,i)=><ParlayCard key={i} parlay={p}/>)}</div>:<div className="brEmptyInline">No qualifying parlay combinations yet.</div>}
        <details className="brMethod">
          <summary>BetRadar scoring and methodology</summary>
          <p>BetRadar Index measures signal strength, not win probability. No Brainer means above 80; High Conviction means above 70. Recheck sportsbook lines before wagering.</p>
        </details>
      </section>
    </>}

    <BetFilterDrawer open={filtersOpen} onClose={()=>setFiltersOpen(false)} games={games} filters={filters} setFilters={setFilters}/>
  </main>;
}

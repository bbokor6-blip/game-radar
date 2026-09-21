"use client";
import { useEffect, useMemo, useState } from "react";
import { gameMetadata } from "../../lib/gameMetadata";
import { getWeeklyEditorial, editorialTake } from "../../lib/weeklyEditorial";
import RadarMenu from "../components/RadarMenu";

function footballRange(offset=0){
  const now=new Date(), day=now.getDay(), daysSinceTuesday=(day+5)%7;
  const start=new Date(now); start.setHours(12,0,0,0); start.setDate(now.getDate()-daysSinceTuesday+(offset*7));
  const end=new Date(start); end.setDate(start.getDate()+6);
  const fmt=d=>d.toISOString().slice(0,10);
  return {start:fmt(start),end:fmt(end),startDate:start,endDate:end};
}
function rangeLabel(r){
  const a=r.startDate.toLocaleDateString([],{month:"short",day:"numeric"});
  const b=r.endDate.toLocaleDateString([],{month:"short",day:"numeric"});
  return a+"–"+b;
}
function weekName(offset){
  if(offset===0)return "THIS WEEK";
  if(offset===1)return "NEXT WEEK";
  return "LOOK AHEAD · +"+offset;
}
function TeamPair({game}){
  return <div className="wrTeams">
    <span>{game.away?.logo?<img src={game.away.logo} alt=""/>:null}<b>{game.away?.rank?"#"+game.away.rank+" ":""}{game.away?.location||game.away?.short}</b></span>
    <em>@</em>
    <span>{game.home?.logo?<img src={game.home.logo} alt=""/>:null}<b>{game.home?.rank?"#"+game.home.rank+" ":""}{game.home?.location||game.home?.short}</b></span>
  </div>;
}
function why(game){
  const r=String(game?.interest?.reason||"").trim();
  if(r)return r.charAt(0).toUpperCase()+r.slice(1)+".";
  const m=gameMetadata(game), parts=[];
  if(m.rankedMatchup)parts.push("Ranked matchup");
  if(m.bothWinning)parts.push("both teams are winning");
  if(m.conferenceGame)parts.push("conference game");
  if(m.rivalry)parts.push("rivalry");
  return parts.length?parts.join(" · ")+".":"One of the strongest games on the board.";
}
function teamFact(team,form){
  if(!form&&!team?.lastGame)return null;
  const bits=[];
  const sample=(form?.last3Wins||0)+(form?.last3Losses||0);
  if(sample)bits.push((team.short||team.location)+": "+form.last3Wins+"-"+form.last3Losses+" last "+sample);
  if(team?.lastGame)bits.push("Last: "+team.lastGame.result+" "+team.lastGame.pointsFor+"-"+team.lastGame.pointsAgainst+" "+(team.lastGame.homeAway==="away"?"at ":"vs ")+team.lastGame.opponent);
  if(Number.isFinite(form?.last3Margin))bits.push((form.last3Margin>=0?"+":"")+form.last3Margin+" avg margin");
  if(form?.atsGames>=2)bits.push(form.atsWins+"-"+(form.atsGames-form.atsWins)+" ATS");
  if(form?.rankedWins)bits.push(form.rankedWins+" ranked win"+(form.rankedWins===1?"":"s"));
  return bits.slice(0,2).join(" · ");
}
function GameSpotlight({game,rank,edition}){
  const meta=gameMetadata(game);
  const awayFact=teamFact(game.away,game.teamForm?.away);
  const homeFact=teamFact(game.home,game.teamForm?.home);
  return <article className="wrGame">
    <div className="wrGameHead">
      <span className="wrRank">#{rank}</span>
      <div><TeamPair game={game}/><small>{new Date(game.date).toLocaleString([],{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}{meta.broadcasts?.[0]?" · "+meta.broadcasts[0]:""}</small></div>
      <span className="wrRadarIndex" title="RadarIndex">{game.radarIndex?.score??game.interest?.score??"—"}</span>
    </div>
    <p>{editorialTake(game,edition)||why(game)}</p>
    {(awayFact||homeFact)?<div className="wrHardFacts">
      <span>NUMBERS THAT MATTER</span>
      {awayFact?<b>{awayFact}</b>:null}
      {homeFact?<b>{homeFact}</b>:null}
    </div>:null}
    <div className="wrGameFoot">
      <div>
        {meta.conferenceGame?<span>Conference</span>:null}
        {meta.rankedMatchup?<span>Ranked vs Ranked</span>:meta.rankedInvolved?<span>Ranked</span>:null}
        {meta.rivalry?<span>Rivalry</span>:null}
        {game.marketConsensus?.line?<span>{game.marketConsensus.line}</span>:null}
      </div>
    </div>
  </article>;
}

export default function Weekly(){
  const[league,setLeague]=useState("nfl");
  const[weekOffset,setWeekOffset]=useState(1);
  const[data,setData]=useState({games:[]});
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const range=useMemo(()=>footballRange(weekOffset),[weekOffset]);

  useEffect(()=>{
    let ignore=false;
    async function load(){
      setLoading(true);
      try{
        const r=await fetch("/api/bets?league="+league+"&start="+range.start+"&end="+range.end,{cache:"no-store"});
        if(!r.ok)throw new Error();
        const json=await r.json();
        if(!ignore){setData(json);setError("")}
      }catch{if(!ignore)setError("Weekly Radar is temporarily unavailable.")}
      finally{if(!ignore)setLoading(false)}
    }
    load();
    return()=>{ignore=true};
  },[league,weekOffset,range.start,range.end]);

  const edition=getWeeklyEditorial(league,range.start);
  const games=(data.games||[]).slice().sort((a,b)=>(b.radarIndex?.score||b.interest?.score||0)-(a.radarIndex?.score||a.interest?.score||0));
  const top=games.slice(0,5);
  const ranked=games.filter(g=>gameMetadata(g).rankedMatchup).length;
  const close=games.filter(g=>{const s=gameMetadata(g).spread;return s!=null&&s<=7.5}).length;

  return <main className="wrPage">
    <header className="wrHeader">
      <a href="/scores" className="wrBrand">GAME<span>RADAR</span></a>
      <nav><button className={league==="nfl"?"active":""} onClick={()=>setLeague("nfl")}>NFL</button><button className={league==="cfb"?"active":""} onClick={()=>setLeague("cfb")}>College</button></nav>
      <div className="wrWeek">
        <button disabled={weekOffset===0} onClick={()=>setWeekOffset(x=>Math.max(0,x-1))}>‹</button>
        <div><span>{weekName(weekOffset)}</span><strong>{rangeLabel(range)}</strong></div>
        <button disabled={weekOffset===4} onClick={()=>setWeekOffset(x=>Math.min(4,x+1))}>›</button>
      </div>
      <RadarMenu current="/weekly" className="wrMenu"/>
    </header>

    <section className="wrHero">
      <div><span className="wrEyebrow">{edition.kicker}</span><h1>{edition.headline}</h1><p>{edition.dek}</p></div>
      <div className="wrPulse"><div><strong>{games.length}</strong><span>games</span></div><div><strong>{close}</strong><span>close lines</span></div>{league==="cfb"?<div><strong>{ranked}</strong><span>ranked clashes</span></div>:null}</div>
    </section>

    {edition.quickHits?.length?<section className="wrQuickHits">
      {edition.quickHits.map((x,i)=><article key={i}><span>{x.eyebrow}</span><h3>{x.title}</h3><p>{x.body}</p></article>)}
    </section>:null}

    {error?<div className="grEmpty">{error}</div>:loading?<div className="grEmpty">Building the weekly radar…</div>:<>
      <section className="wrSection"><div className="wrSectionHead"><div><span>START HERE</span><h2>5 games to know</h2></div><a href={"/scores?league="+league+"&week="+weekOffset}>Full board →</a></div><div className="wrGames">{top.map((g,i)=><GameSpotlight key={g.id} game={g} rank={i+1} edition={edition}/>)}</div></section>
      <section className="wrSection wrTakeaway"><span>THE READ</span><h2>{top[0]?((top[0].away?.location||top[0].away?.short)+" @ "+(top[0].home?.location||top[0].home?.short)):"This week's board"} leads the Radar.</h2><p>{top[0]?(editorialTake(top[0],edition)||why(top[0])):"Check back as the slate fills in."}</p></section>
    </>}
  </main>;
}

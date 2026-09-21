"use client";
import { useEffect, useMemo, useState } from "react";

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
function ResultBadge({result}){
  const value=result||"PENDING";
  return <span className={"rpResult "+value.toLowerCase()}>{value}</span>;
}
function weekRecord(picks=[]){
  const graded=picks.filter(p=>["W","L","PUSH"].includes(p.result));
  const wins=graded.filter(p=>p.result==="W").length;
  const losses=graded.filter(p=>p.result==="L").length;
  const pushes=graded.filter(p=>p.result==="PUSH").length;
  return {wins,losses,pushes,decisions:wins+losses};
}

export default function RadarPicks(){
  const[league,setLeague]=useState("nfl");
  const[weekOffset,setWeekOffset]=useState(1);
  const[ledger,setLedger]=useState({weeks:[],record:{}});
  const[loading,setLoading]=useState(true);
  const range=useMemo(()=>footballRange(weekOffset),[weekOffset]);

  useEffect(()=>{
    let ignore=false;
    async function load(){
      setLoading(true);
      try{
        const res=await fetch("/api/radar-picks",{cache:"no-store"});
        const history=await res.json();
        if(!ignore)setLedger(history);
      }finally{if(!ignore)setLoading(false)}
    }
    load();
    return()=>{ignore=true};
  },[]);

  const selectedWeek=(ledger.weeks||[]).find(w=>w.league===league&&w.weekStart===range.start)||null;
  const picks=(selectedWeek?.picks||[]).filter(p=>p.type!=="PASS");
  const record=weekRecord(picks);
  const archive=(ledger.weeks||[]).filter(w=>w.league===league&&w.weekStart!==range.start).slice().reverse();

  return <main className="rpPage">
    <header className="rpHeader">
      <a href="/pickradar" className="rpBrand">PICK<span>RADAR</span></a>
      <div className="rpLeague"><button className={league==="nfl"?"active":""} onClick={()=>setLeague("nfl")}>NFL</button><button className={league==="cfb"?"active":""} onClick={()=>setLeague("cfb")}>College</button></div>
      <div className="rpWeek">
        <button disabled={weekOffset===0} onClick={()=>setWeekOffset(x=>Math.max(0,x-1))}>‹</button>
        <div><span>{weekName(weekOffset)}</span><strong>{rangeLabel(range)}</strong></div>
        <button disabled={weekOffset===4} onClick={()=>setWeekOffset(x=>Math.min(4,x+1))}>›</button>
      </div>
      <details className="wrMenu"><summary>☰</summary><div><a href="/weekly">Weekly Radar</a><a href="/pickradar">PickRadar</a><a href="/scores">GameRadar</a><a href="/bets">BetRadar</a></div></details>
    </header>

    <section className="rpHero">
      <div>
        <span>LOCKED MODEL PICKS</span>
        <h1>These are the ones we're actually standing behind.</h1>
        <p>Only selected PickRadar selections appear here. Once a weekly card is locked, the pick and line do not move. After the games, we grade the exact recommendation W, L, or PUSH and carry the record forward.</p>
      </div>
      <div className="rpStats">
        <div><strong>{picks.length||"—"}</strong><span>locked picks</span></div>
        <div><strong>{selectedWeek?.lockedAt?new Date(selectedWeek.lockedAt).toLocaleDateString([],{month:"short",day:"numeric"}):"—"}</strong><span>locked</span></div>
        <div><strong>{record.decisions?record.wins+"–"+record.losses:"—"}</strong><span>week record</span></div>
      </div>
    </section>

    {loading?<div className="grEmpty">Loading locked picks…</div>:selectedWeek?<>
      <section className="rpBoard">
        {picks.map((pick,i)=><article className="rpGame" key={pick.gameId}>
          <div className="rpScore">{pick.radarIndex??"—"}</div>
          <div className="rpMain">
            <div className="rpMatchup"><strong>{pick.matchup}</strong><span>{pick.gameDate?new Date(pick.gameDate).toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"}):""}</span></div>
            <div className="rpPreferred"><span>OFFICIAL PICK {i+1}</span><strong>{pick.pick}</strong><small>{pick.betRadarIndex} BetRadar Index · {pick.type}{pick.americanOdds?" · "+(pick.americanOdds>0?"+":"")+pick.americanOdds:""}</small></div>
            <p>{pick.why}</p>
            <small className="rpLockedLine">Locked line: {pick.line||pick.pick}</small>
          </div>
          <ResultBadge result={pick.result}/>
        </article>)}
      </section>
      {!picks.length?<div className="grEmpty">No official picks were strong enough to lock for this week.</div>:null}
    </>:<div className="grEmpty">This week's official picks have not been locked yet. We only publish picks after the scheduled weekly lock.</div>}

    <section className="rpHistory">
      <div className="rpHistoryHead"><div><span>TRACK RECORD</span><h2>Week over week</h2></div><strong>{ledger.record?.decisions?ledger.record.wins+"–"+ledger.record.losses:"No graded picks yet"}</strong></div>
      {archive.length?archive.map(w=>{
        const official=(w.picks||[]).filter(p=>p.type!=="PASS");
        const r=weekRecord(official);
        return <details key={w.league+"-"+w.weekStart}><summary>{w.label||w.weekStart} · {r.decisions?r.wins+"-"+r.losses:"Pending"}</summary><div>{official.map(p=><div className="rpArchiveRow" key={p.gameId}><span>{p.matchup}</span><strong>{p.pick}</strong><ResultBadge result={p.result}/></div>)}</div></details>
      }):<div className="grEmpty">No previous weeks yet. The record begins with the first locked slate.</div>}
    </section>
  </main>;
}

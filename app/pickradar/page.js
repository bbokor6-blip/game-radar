"use client";
import { useEffect, useMemo, useState } from "react";
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
function confidenceBand(index){
  const score=Number(index)||0;
  if(score>=80)return "HIGH CONFIDENCE";
  if(score>=70)return "MODEL LEAN";
  return "FULL-SLATE PICK";
}

export default function RadarPicks(){
  const[league,setLeague]=useState("nfl");
  const[weekOffset,setWeekOffset]=useState(1);
  const[confidence,setConfidence]=useState("all");
  const[ledger,setLedger]=useState({weeks:[],record:{}});
  const[liveSignals,setLiveSignals]=useState({});
  const[liveReady,setLiveReady]=useState(false);
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

  useEffect(()=>{
    let ignore=false;
    async function loadLiveSignals(){
      setLiveReady(false);
      try{
        const res=await fetch("/api/bets?league="+league+"&start="+range.start+"&end="+range.end,{cache:"no-store"});
        if(!res.ok)throw new Error();
        const payload=await res.json();
        const next={};
        for(const game of payload.games||[]){
          next[game.id]={index:game.bestOpportunity?.index??null,pick:game.bestOpportunity?.pick??null};
        }
        if(!ignore)setLiveSignals(next);
      }catch{
        if(!ignore)setLiveSignals({});
      }finally{
        if(!ignore)setLiveReady(true);
      }
    }
    loadLiveSignals();
    return()=>{ignore=true};
  },[league,range.start,range.end]);

  const selectedWeek=(ledger.weeks||[]).find(w=>w.league===league&&w.weekStart===range.start)||null;
  const allPicks=(selectedWeek?.picks||[]).filter(p=>p.type!=="PASS");
  const currentIndex=pick=>liveReady&&Object.hasOwn(liveSignals,pick.gameId)?liveSignals[pick.gameId].index:pick.betRadarIndex??null;
  const picks=allPicks.filter(p=>{
    const index=currentIndex(p)||0;
    return confidence==="all"||(confidence==="high"?index>=80:index>=70&&index<80);
  });
  const record=weekRecord(allPicks);
  const highCount=allPicks.filter(p=>(currentIndex(p)||0)>=80).length;
  const leanCount=allPicks.filter(p=>(currentIndex(p)||0)>=70&&(currentIndex(p)||0)<80).length;
  const archive=(ledger.weeks||[]).filter(w=>w.league===league&&w.weekStart!==range.start).slice().reverse();
  const feedback=ledger.feedback||{};
  const spread=feedback.byType?.SPREAD;
  const total=feedback.byType?.TOTAL;
  const high=feedback.byBand?.["80+"];
  const leans=feedback.byBand?.["70-79"];
  const learned=[spread&&spread.decisions>=6?["SPREADS",spread]:null,total&&total.decisions>=6?["TOTALS",total]:null,high&&high.decisions>=6?["HIGH CONFIDENCE · 80+",high]:null,leans&&leans.decisions>=6?["MODEL LEANS · 70–79",leans]:null].filter(Boolean);

  return <main className="rpPage">
    <header className="rpHeader">
      <a href="/pickradar" className="rpBrand">PICK<span>RADAR</span></a>
      <div className="rpLeague"><button className={league==="nfl"?"active":""} onClick={()=>setLeague("nfl")}>NFL</button><button className={league==="cfb"?"active":""} onClick={()=>setLeague("cfb")}>College</button></div>
      <div className="rpWeek">
        <button disabled={weekOffset===0} onClick={()=>setWeekOffset(x=>Math.max(0,x-1))}>‹</button>
        <div><span>{weekName(weekOffset)}</span><strong>{rangeLabel(range)}</strong></div>
        <button disabled={weekOffset===4} onClick={()=>setWeekOffset(x=>Math.min(4,x+1))}>›</button>
      </div>
      <RadarMenu current="/pickradar" className="wrMenu"/>
    </header>

    <section className="rpHero">
      <div>
        <span>FULL-SLATE MODEL LEDGER</span>
        <h1>One locked pick for every game.</h1>
        <p>PickRadar takes a side on the entire NFL and college slate. High Confidence is reserved for 80+ spread signals; 70–79 is a Model Lean, and totals remain on watch while that model builds a stronger record.</p>
      </div>
      <div className="rpStats">
        <div><strong>{allPicks.length||"—"}</strong><span>games picked</span></div>
        <div><strong>{liveReady?highCount:"—"}</strong><span>current 80+</span></div>
        <div><strong>{selectedWeek?.lockedAt?new Date(selectedWeek.lockedAt).toLocaleDateString([],{month:"short",day:"numeric"}):"—"}</strong><span>locked</span></div>
        <div><strong>{record.decisions?record.wins+"–"+record.losses:"—"}</strong><span>week record</span></div>
      </div>
    </section>

    {loading?<div className="grEmpty">Loading locked picks…</div>:selectedWeek?<>
      <section className="rpFilters" aria-label="Filter picks by confidence">
        <div><strong>SHOW PICKS</strong><span>{picks.length} of {allPicks.length} games</span></div>
        <div>
          <button className={confidence==="all"?"active":""} onClick={()=>setConfidence("all")}>ALL GAMES <b>{allPicks.length}</b></button>
          <button className={confidence==="high"?"active":""} onClick={()=>setConfidence("high")}>BETRADAR · 80+ <b>{highCount}</b></button>
          <button className={confidence==="lean"?"active":""} onClick={()=>setConfidence("lean")}>BETRADAR · 70–79 <b>{leanCount}</b></button>
        </div>
      </section>
      <section className="rpBoard">
        {picks.map((pick,i)=>{const liveIndex=currentIndex(pick);return <article className="rpGame" key={pick.gameId}>
          <div className="rpScore"><small>BETRADAR</small><strong>{liveReady?(liveIndex??"—"):"…"}</strong></div>
          <div className="rpMain">
            <div className="rpMatchup"><strong>{pick.matchup}</strong><span>{pick.gameDate?new Date(pick.gameDate).toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"}):""}</span></div>
            <div className="rpPreferred"><span>OFFICIAL PICK {i+1} · LOCKED {confidenceBand(pick.betRadarIndex)}</span><strong>{pick.pick}</strong><small>{liveReady?"Live BetRadar "+(liveIndex??"—")+" · ":""}{pick.betRadarIndex!=null?"Lock index "+pick.betRadarIndex+" · ":""}{pick.type}{pick.americanOdds?" · "+(pick.americanOdds>0?"+":"")+pick.americanOdds:""}</small></div>
            <p>{pick.why}</p>
            <small className="rpLockedLine">Locked line: {pick.line||pick.pick}{pick.reviewThursday?" · Thursday review scheduled":""}</small>
            {pick.modelProjection?<small className="rpModelInputs">MODEL: {pick.modelProjection.homeMargin>0?"HOME":"AWAY"} BY {Math.abs(pick.modelProjection.homeMargin).toFixed(1)} · PROJECTED TOTAL {pick.modelProjection.total.toFixed(1)} · {pick.modelProjection.historicalGames} PRIOR GAMES</small>:null}
            {pick.closingLineValue!=null?<small className={"rpClv "+(pick.closingLineValue>=0?"positive":"negative")}>CLOSING-LINE VALUE: {pick.closingLineValue>0?"+":""}{pick.closingLineValue}</small>:null}
          </div>
          <ResultBadge result={pick.result}/>
        </article>})}
      </section>
      {!picks.length?<div className="grEmpty">No picks match this confidence filter.</div>:null}
    </>:<div className="grEmpty">This week's official picks have not been locked yet. We only publish picks after the scheduled weekly lock.</div>}

    {learned.length?<section className="rpLearnings">
      <div className="rpHistoryHead"><div><span>MODEL FEEDBACK</span><h2>What PickRadar is learning</h2></div></div>
      <div className="rpLearningGrid">{learned.map(([label,x])=><div key={label}><span>{label}</span><strong>{Math.round((x.winPct||0)*100)}%</strong><small>{x.wins}-{x.losses} on {x.decisions} graded picks</small></div>)}</div>
      <p>Results affect future scoring only after at least 20 graded decisions. Small samples are deliberately pulled toward neutral, and closing-line value is stored separately from wins and losses.</p>
    </section>:null}

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

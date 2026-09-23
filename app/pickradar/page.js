"use client";
import { useEffect, useMemo, useState } from "react";
import RadarMenu from "../components/RadarMenu";
import { betIndexTier } from "../../lib/indexTiers";

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
  return betIndexTier(index).label.toUpperCase();
}

export default function RadarPicks(){
  const[league,setLeague]=useState("nfl");
  const[weekOffset,setWeekOffset]=useState(0);
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
  // PickRadar must be evaluated by the confidence recorded when the pick was
  // locked. A later BetRadar refresh is useful context, but must not rewrite
  // the historical tier, filter, or calibration cohort.
  const lockedIndex=pick=>pick.betRadarIndex??null;
  const currentIndex=pick=>liveReady&&Object.hasOwn(liveSignals,pick.gameId)?liveSignals[pick.gameId].index:null;
  const picks=allPicks.filter(p=>{
    const index=lockedIndex(p)||0;
    return confidence==="all"||
      (confidence==="best"&&index>=80)||
      (confidence==="strong"&&index>=70&&index<80)||
      (confidence==="lean"&&index>=60&&index<70)||
      (confidence==="pass"&&index<60);
  });
  const record=weekRecord(allPicks);
  const bestCount=allPicks.filter(p=>(lockedIndex(p)||0)>=80).length;
  const strongCount=allPicks.filter(p=>(lockedIndex(p)||0)>=70&&(lockedIndex(p)||0)<80).length;
  const leanCount=allPicks.filter(p=>(lockedIndex(p)||0)>=60&&(lockedIndex(p)||0)<70).length;
  const passCount=allPicks.filter(p=>(lockedIndex(p)||0)<60).length;
  const archive=(ledger.weeks||[]).filter(w=>w.league===league&&w.weekStart!==range.start).slice().reverse();
  const feedback=ledger.feedback||{};
  const analysis=ledger.confidenceAnalysis||feedback;
  const spread=analysis.byType?.SPREAD;
  const total=analysis.byType?.TOTAL;
  const learned=[spread&&spread.decisions?["SPREADS",spread]:null,total&&total.decisions?["TOTALS",total]:null].filter(Boolean);
  const confidenceResults=[
    ["BEST BET · 80+",analysis.byBand?.["80+"]],
    ["STRONG · 70–79",analysis.byBand?.["70-79"]],
    ["LEAN · 60–69",analysis.byBand?.["60-69"]],
    ["LOW CONFIDENCE · <60",analysis.byBand?.["<60"]]
  ];

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
        <p>PickRadar takes a side on the entire NFL and college slate. BetIndex grades signal strength: 80+ Best Bet, 70–79 Strong, 60–69 Lean and below 60 Pass.</p>
      </div>
      <div className="rpStats">
        <div><strong>{allPicks.length||"—"}</strong><span>games picked</span></div>
        <div><strong>{liveReady?bestCount:"—"}</strong><span>Best Bets · 80+</span></div>
        <div><strong>{selectedWeek?.lockedAt?new Date(selectedWeek.lockedAt).toLocaleDateString([],{month:"short",day:"numeric"}):"—"}</strong><span>locked</span></div>
        <div><strong>{record.decisions?record.wins+"–"+record.losses:"—"}</strong><span>week record</span></div>
      </div>
    </section>

    {loading?<div className="grEmpty">Loading locked picks…</div>:selectedWeek?<>
      <section className="rpFilters" aria-label="Filter picks by confidence">
        <div><strong>SHOW PICKS</strong><span>{picks.length} of {allPicks.length} games</span></div>
        <div>
          <button className={confidence==="all"?"active":""} onClick={()=>setConfidence("all")}>ALL GAMES <b>{allPicks.length}</b></button>
          <button className={"tierFilter indexTier-green "+(confidence==="best"?"active":"")} onClick={()=>setConfidence("best")}>BEST BET · 80+ <b>{bestCount}</b></button>
          <button className={"tierFilter indexTier-yellow "+(confidence==="strong"?"active":"")} onClick={()=>setConfidence("strong")}>STRONG · 70–79 <b>{strongCount}</b></button>
          <button className={"tierFilter indexTier-orange "+(confidence==="lean"?"active":"")} onClick={()=>setConfidence("lean")}>LEAN · 60–69 <b>{leanCount}</b></button>
          <button className={"tierFilter indexTier-red "+(confidence==="pass"?"active":"")} onClick={()=>setConfidence("pass")}>PASS · &lt;60 <b>{passCount}</b></button>
        </div>
      </section>
      <section className="rpBoard">
        {picks.map((pick,i)=>{const lockIndex=lockedIndex(pick);const liveIndex=currentIndex(pick);const tier=betIndexTier(lockIndex);return <article className="rpGame" key={pick.gameId}>
          <div className={"rpScore indexTier-"+tier.key}><small>LOCKED BETINDEX</small><strong>{lockIndex??"—"}</strong></div>
          <div className="rpMain">
            <div className="rpMatchup"><strong>{pick.matchup}</strong><span>{pick.gameDate?new Date(pick.gameDate).toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"}):""}</span></div>
            <div className="rpPreferred"><span>OFFICIAL PICK {i+1} · LOCKED {confidenceBand(lockIndex)}</span><strong>{pick.pick}</strong><small>{lockIndex!=null?"Lock index "+lockIndex+" · ":""}{liveReady&&liveIndex!=null?"Current BetRadar "+liveIndex+" · ":""}{pick.type}{pick.americanOdds?" · "+(pick.americanOdds>0?"+":"")+pick.americanOdds:""}</small></div>
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

    <section className="rpLearnings">
      <div className="rpHistoryHead"><div><span>BETINDEX CALIBRATION</span><h2>Does confidence predict wins?</h2></div></div>
      <div className="rpLearningGrid">{confidenceResults.map(([label,x])=><div key={label}><span>{label}</span><strong>{x?.decisions?Math.round((x.winPct||0)*100)+"%":"—"}</strong><small>{x?.decisions?x.wins+"-"+x.losses+" on "+x.decisions+" graded picks":"No graded picks yet"}</small></div>)}</div>
      {learned.length?<div className="rpLearningGrid rpTypeLearning">{learned.map(([label,x])=><div key={label}><span>{label}</span><strong>{Math.round((x.winPct||0)*100)}%</strong><small>{x.wins}-{x.losses} on {x.decisions} graded picks</small></div>)}</div>:null}
      <p>Every game stays in the ledger and is analyzed in the BetIndex band recorded at lock. Retrospective archived-line tests use an estimated production-quality signal band and count at reduced weight; future weekly locks count fully.</p>
    </section>

    <section className="rpHistory">
      <div className="rpHistoryHead"><div><span>TRACK RECORD</span><h2>Week over week</h2></div><strong>{ledger.record?.decisions?ledger.record.wins+"–"+ledger.record.losses:"No graded picks yet"}</strong></div>
      {archive.length?archive.map(w=>{
        const official=(w.picks||[]).filter(p=>p.type!=="PASS");
        const r=weekRecord(official);
        return <details key={w.league+"-"+w.weekStart}><summary>{w.label||w.weekStart} · {r.decisions?r.wins+"-"+r.losses:"Pending"}</summary><div>{official.map(p=><div className="rpArchiveRow" key={p.gameId}><span>{p.matchup} · BetIndex {p.betRadarIndex}</span><strong>{p.pick}</strong><ResultBadge result={p.result}/></div>)}</div></details>
      }):<div className="grEmpty">No previous weeks yet. The record begins with the first locked slate.</div>}
    </section>
  </main>;
}

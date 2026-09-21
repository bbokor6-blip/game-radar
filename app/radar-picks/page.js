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
function matchup(g){return (g.away?.location||g.away?.short)+" @ "+(g.home?.location||g.home?.short)}
function officialPick(game){
  const best=game.bestOpportunity;
  if(!best)return {pick:"PASS",index:0,label:"NO OFFICIAL EDGE",why:"No betting signal is strong enough to lock yet.",type:"PASS"};
  return {pick:best.pick,index:best.index,label:best.label,why:best.why,type:best.type,americanOdds:best.americanOdds};
}
function ResultBadge({result}){
  if(!result)return <span className="rpResult pending">PENDING</span>;
  return <span className={"rpResult "+result.toLowerCase()}>{result}</span>;
}
export default function RadarPicks(){
  const[league,setLeague]=useState("nfl");
  const[weekOffset,setWeekOffset]=useState(1);
  const[data,setData]=useState({games:[]});
  const[ledger,setLedger]=useState({weeks:[],record:{}});
  const[loading,setLoading]=useState(true);
  const range=useMemo(()=>footballRange(weekOffset),[weekOffset]);

  useEffect(()=>{
    let ignore=false;
    async function load(){
      setLoading(true);
      try{
        const [betsRes,ledgerRes]=await Promise.all([
          fetch("/api/bets?league="+league+"&start="+range.start+"&end="+range.end,{cache:"no-store"}),
          fetch("/api/radar-picks",{cache:"no-store"})
        ]);
        const [bets,history]=await Promise.all([betsRes.json(),ledgerRes.json()]);
        if(!ignore){setData(bets);setLedger(history)}
      }finally{if(!ignore)setLoading(false)}
    }
    load();
    return()=>{ignore=true};
  },[league,weekOffset,range.start,range.end]);

  const games=(data.games||[]).slice().sort((a,b)=>(b.radarIndex?.score||0)-(a.radarIndex?.score||0));
  const official=games.map(g=>({game:g,pick:officialPick(g)}));
  const bets=official.filter(x=>x.pick.type!=="PASS");
  const passes=official.length-bets.length;
  const avg=bets.length?Math.round(bets.reduce((s,x)=>s+(x.pick.index||0),0)/bets.length):0;
  const archive=(ledger.weeks||[]).filter(w=>w.league===league).slice().reverse();

  return <main className="rpPage">
    <header className="rpHeader">
      <a href="/scores" className="rpBrand">RADAR<span>PICKS</span></a>
      <div className="rpLeague"><button className={league==="nfl"?"active":""} onClick={()=>setLeague("nfl")}>NFL</button><button className={league==="cfb"?"active":""} onClick={()=>setLeague("cfb")}>College</button></div>
      <div className="rpWeek">
        <button disabled={weekOffset===0} onClick={()=>setWeekOffset(x=>Math.max(0,x-1))}>‹</button>
        <div><span>{weekName(weekOffset)}</span><strong>{rangeLabel(range)}</strong></div>
        <button disabled={weekOffset===4} onClick={()=>setWeekOffset(x=>Math.min(4,x+1))}>›</button>
      </div>
      <details className="wrMenu"><summary>☰</summary><div><a href="/weekly">Weekly Radar</a><a href="/radar-picks">Radar Picks</a><a href="/scores">GameRadar</a><a href="/bets">BetRadar</a></div></details>
    </header>

    <section className="rpHero">
      <div><span>THE OFFICIAL BOARD</span><h1>One preferred action for every game.</h1><p>RadarIndex blends betting signal with matchup quality. We lock the preferred bet when there is a real edge, keep the line we recommended, and grade it after the game.</p></div>
      <div className="rpStats"><div><strong>{bets.length}</strong><span>official bets</span></div><div><strong>{passes}</strong><span>passes</span></div><div><strong>{avg||"—"}</strong><span>avg bet signal</span></div></div>
    </section>

    {loading?<div className="grEmpty">Building the board…</div>:<section className="rpBoard">
      {official.map(({game,pick})=><article className="rpGame" key={game.id}>
        <div className="rpScore">{game.radarIndex?.score??game.interest?.score??"—"}</div>
        <div className="rpMain">
          <div className="rpMatchup"><strong>{matchup(game)}</strong><span>{new Date(game.date).toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"})}{game.broadcasts?.[0]?" · "+game.broadcasts[0]:""}</span></div>
          <div className="rpPreferred"><span>PREFERRED PICK</span><strong>{pick.pick}</strong><small>{pick.type==="PASS"?"No bet":pick.index+" BetRadar Index · "+pick.type}</small></div>
          <p>{pick.why}</p>
        </div>
        <ResultBadge/>
      </article>)}
    </section>}

    <section className="rpHistory">
      <div className="rpHistoryHead"><div><span>TRACK RECORD</span><h2>Week over week</h2></div><strong>{ledger.record?.decisions?ledger.record.wins+"–"+ledger.record.losses:"Starts next week"}</strong></div>
      {archive.length?archive.map(w=><details key={w.league+"-"+w.weekStart}><summary>{w.label||w.weekStart} · {w.record?.wins||0}-{w.record?.losses||0}</summary><div>{(w.picks||[]).map(p=><div className="rpArchiveRow" key={p.gameId}><span>{p.matchup}</span><strong>{p.pick}</strong><ResultBadge result={p.result}/></div>)}</div></details>):<div className="grEmpty">No graded weeks yet. The first official snapshot will be locked before next week's games.</div>}
    </section>
  </main>;
}

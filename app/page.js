"use client";
import { useEffect, useMemo, useState } from "react";
const TABS=[["best","RADAR"],["cfb","COLLEGE"],["nfl","NFL"]];

function Team({team,possession}){
 return <div className="team"><div className="teamIdentity">{team.logo?<img src={team.logo} alt="" className="logo"/>:<div className="logoFallback"/>}<div className="teamName">{team.rank?<span className="rank">#{team.rank}</span>:null}<span>{team.short}</span>{team.record?<span className="rank">{team.record}</span>:null}{possession?<span className="ball">●</span>:null}</div></div><div className="teamScore">{team.score}</div></div>
}
function GameCard({game,featured=false}){
 const live=game.state==="in",hot=game.interest.tier==="Turn it on now",watch=game.interest.tier==="Keep an eye on it";
 return <article className={`gameCard ${featured?"featured":""}`}>
  <div className="scoreboardTop"><span className="lamp"/><span className="league">{game.sport==="cfb"?"COLLEGE FOOTBALL":"NFL"}</span><span className={live?"liveFlag":""}>{live?"● LIVE":game.status}</span><span className="screw"/></div>
  <div className="clockPanel"><div className="clockLabel">GAME CLOCK<span>{game.status||"GAME"}</span></div><div className="radarLabel">RADAR<span className="radarScore">{live?String(game.interest.score).padStart(2,"0"):game.state==="post"?"FINAL":"NEXT"}</span></div></div>
  <Team team={game.away} possession={game.possessionId===game.away.id}/>
  <div className="divider"><span>VISITOR</span><span>HOME</span></div>
  <Team team={game.home} possession={game.possessionId===game.home.id}/>
  {live?<><div className={`tier ${hot?"hot":watch?"watch":""}`}>{hot?"▲ TURN IT ON NOW":watch?"◆ KEEP AN EYE ON IT":"SKIP FOR NOW"}</div><div className="why">{game.interest.reason}{game.downDistance?` · ${game.downDistance}`:""}</div><div className="meter"><div className="meterFill" style={{width:`${game.interest.score}%`}}/></div></>:null}
 </article>
}
export default function Home(){
 const[tab,setTab]=useState("best"),[data,setData]=useState({games:[],generatedAt:null}),[loading,setLoading]=useState(true),[error,setError]=useState(""),[refreshing,setRefreshing]=useState(false);
 async function load(manual=false){if(manual)setRefreshing(true);try{const r=await fetch("/api/games",{cache:"no-store"});if(!r.ok)throw new Error();setData(await r.json());setError("")}catch{setError("LIVE FEED TEMPORARILY OFFLINE")}finally{setLoading(false);setRefreshing(false)}}
 useEffect(()=>{load();const timer=setInterval(()=>load(),30000);return()=>clearInterval(timer)},[]);
 const filtered=useMemo(()=>tab==="best"?data.games:data.games.filter(g=>g.sport===tab),[data.games,tab]);
 const live=filtered.filter(g=>g.state==="in");
 const recent=filtered.filter(g=>g.state==="post").sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,12);
 const upcoming=filtered.filter(g=>g.state==="pre").sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(0,10);
 return <main className="shell">
  <header className="stadiumHeader"><div className="bolt b1"/><div className="bolt b2"/><div><div className="brand">GAME<span>RADAR</span></div><div className="headerKicker">LIVE FOOTBALL COMMAND CENTER</div><h1>WHAT SHOULD<br/>I WATCH?</h1><p>Every game on the board. Ranked by urgency.</p></div><button className="refresh" onClick={()=>load(true)}>{refreshing?"SCANNING":"↻ SCAN"}</button></header>
  <nav className="tabs">{TABS.map(([v,l])=><button key={v} className={tab===v?"active":""} onClick={()=>setTab(v)}>{l}</button>)}</nav>
  {error?<div className="notice error">{error}</div>:null}
  {loading?<div className="notice">SCANNING THE BOARD...</div>:<>
   {live.length?<><div className="sectionLabel">LIVE · TOP SIGNAL</div>{live.map((g,i)=><GameCard key={g.id} game={g} featured={i===0}/>)}</>:<div className="notice">NO LIVE GAMES · SHOWING THE REST OF THE BOARD</div>}
   {recent.length?<><div className="sectionLabel">RECENT FINALS</div>{recent.map(g=><GameCard key={g.id} game={g}/>)}</>:null}
   {upcoming.length?<><div className="sectionLabel">NEXT UP</div>{upcoming.map(g=><GameCard key={g.id} game={g}/>)}</>:null}
  </>}
  <footer>LIVE BOARD · AUTO-SCAN 30 SEC {data.generatedAt?`· ${new Date(data.generatedAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}`:""}<div>Records + college rankings shown when available</div></footer>
 </main>
}

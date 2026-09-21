"use client";
import { useEffect, useMemo, useState } from "react";
const TABS=[["best","RADAR"],["cfb","COLLEGE"],["nfl","NFL"]];

function Team({team,possession}){
 return <div className="team"><div className="teamIdentity">{team.logo?<img src={team.logo} alt="" className="logo"/>:<div className="logoFallback"/>}<div className="teamName">{team.rank?<span className="rank">#{team.rank}</span>:null}<span>{team.short}</span>{possession?<span className="ball">●</span>:null}</div></div><div className="teamScore">{team.score}</div></div>
}
function GameCard({game,featured=false}){
 const hot=game.interest.tier==="Turn it on now", watch=game.interest.tier==="Keep an eye on it";
 return <article className={`gameCard ${featured?"featured":""}`}>
  <div className="scoreboardTop"><span className="league">{game.sport==="cfb"?"COLLEGE FOOTBALL":"NFL"}</span><span className="liveFlag">{game.state==="in"?"● LIVE":game.status}</span></div>
  <div className="clockPanel"><span>{game.status||"LIVE"}</span><span className="radarScore">{String(game.interest.score).padStart(2,"0")}</span></div>
  <Team team={game.away} possession={game.possessionId===game.away.id}/>
  <div className="divider"><span>VISITOR</span><span>HOME</span></div>
  <Team team={game.home} possession={game.possessionId===game.home.id}/>
  <div className={`tier ${hot?"hot":watch?"watch":""}`}>{hot?"▲ TURN IT ON NOW":watch?"◆ KEEP AN EYE ON IT":"SKIP FOR NOW"}</div>
  <div className="why">{game.interest.reason}{game.downDistance?` · ${game.downDistance}`:""}</div>
  <div className="meter"><div className="meterFill" style={{width:`${game.interest.score}%`}}/></div>
 </article>
}
export default function Home(){
 const[tab,setTab]=useState("best"),[data,setData]=useState({games:[],generatedAt:null}),[loading,setLoading]=useState(true),[error,setError]=useState(""),[refreshing,setRefreshing]=useState(false);
 async function load(manual=false){if(manual)setRefreshing(true);try{const r=await fetch("/api/games",{cache:"no-store"});if(!r.ok)throw new Error();setData(await r.json());setError("")}catch{setError("LIVE FEED TEMPORARILY OFFLINE")}finally{setLoading(false);setRefreshing(false)}}
 useEffect(()=>{load();const t=setInterval(()=>load(),30000);return()=>clearInterval(t)},[]);
 const visible=useMemo(()=>{const live=data.games.filter(g=>g.state==="in");return tab==="best"?live:live.filter(g=>g.sport===tab)},[data.games,tab]);
 return <main className="shell">
  <header><div><div className="brand">GAME<span>RADAR</span></div><h1>WHAT SHOULD<br/>I WATCH?</h1><p>Live football. Ranked by urgency.</p></div><button className="refresh" onClick={()=>load(true)}>{refreshing?"SCANNING":"↻ SCAN"}</button></header>
  <nav className="tabs">{TABS.map(([v,l])=><button key={v} className={tab===v?"active":""} onClick={()=>setTab(v)}>{l}</button>)}</nav>
  {error?<div className="notice error">{error}</div>:null}
  {loading?<div className="notice">SCANNING THE BOARD...</div>:visible.length?<><div className="sectionLabel">TOP SIGNAL</div><GameCard game={visible[0]} featured/><div className="sectionLabel">ON THE BOARD</div><section>{visible.slice(1,12).map(g=><GameCard key={g.id} game={g}/>)}</section></>:<div className="empty"><div className="digits">00:00</div><h2>NO LIVE {tab==="best"?"FOOTBALL":tab==="cfb"?"COLLEGE GAMES":"NFL GAMES"}</h2><p>The board lights up automatically when games are underway.</p></div>}
  <footer>LIVE BOARD · AUTO-SCAN 30 SEC {data.generatedAt?`· ${new Date(data.generatedAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}`:""}<div>Game Radar urgency score</div></footer>
 </main>
}

"use client";
import { useEffect, useRef, useState } from "react";

const LINKS=[
  ["/","Home"],
  ["/weekly","WeeklyRadar"],
  ["/scores","GameRadar"],
  ["/bets","BetRadar"],
  ["/pickradar","PickRadar"],
  ["/indexes","Index Guide"]
];

export default function RadarMenu({current="",className=""}){
  const[open,setOpen]=useState(false);
  const root=useRef(null);

  useEffect(()=>{
    if(!open)return;
    function closeOnOutside(event){if(!root.current?.contains(event.target))setOpen(false)}
    function closeOnEscape(event){if(event.key==="Escape")setOpen(false)}
    document.addEventListener("pointerdown",closeOnOutside);
    document.addEventListener("keydown",closeOnEscape);
    return()=>{
      document.removeEventListener("pointerdown",closeOnOutside);
      document.removeEventListener("keydown",closeOnEscape);
    };
  },[open]);

  return <div className={("radarMenu "+className).trim()} ref={root}>
    <button className="radarMenuButton" type="button" aria-label={open?"Close navigation":"Open navigation"} aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
      <span/><span/><span/>
    </button>
    {open?<nav className="radarMenuPanel" aria-label="Radar navigation">
      {LINKS.map(([href,label])=><a className={current===href?"active":""} href={href} key={href} onClick={()=>setOpen(false)}>{label}</a>)}
    </nav>:null}
  </div>;
}

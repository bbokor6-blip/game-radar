"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const LINKS=[
  ["/","Home"],
  ["/weekly","WeeklyRadar"],
  ["/scores","GameRadar"],
  ["/bets","BetRadar"],
  ["/indexes","Index Guide"]
];

export default function RadarMenu({current="",className=""}){
  const[open,setOpen]=useState(false);
  const root=useRef(null);
  const panel=useRef(null);
  const[position,setPosition]=useState({top:0,left:0});

  useEffect(()=>{
    if(!open)return;
    function closeOnOutside(event){if(!root.current?.contains(event.target)&&!panel.current?.contains(event.target))setOpen(false)}
    function closeOnEscape(event){if(event.key==="Escape")setOpen(false)}
    function reposition(){
      const rect=root.current?.getBoundingClientRect();
      if(rect)setPosition({top:rect.bottom+6,left:Math.max(8,Math.min(rect.left,window.innerWidth-228))});
    }
    reposition();
    document.addEventListener("pointerdown",closeOnOutside);
    document.addEventListener("keydown",closeOnEscape);
    window.addEventListener("resize",reposition);
    window.addEventListener("scroll",reposition,true);
    return()=>{
      document.removeEventListener("pointerdown",closeOnOutside);
      document.removeEventListener("keydown",closeOnEscape);
      window.removeEventListener("resize",reposition);
      window.removeEventListener("scroll",reposition,true);
    };
  },[open]);

  return <div className={("radarMenu "+className).trim()} ref={root}>
    <button className="radarMenuButton" type="button" aria-label={open?"Close navigation":"Open navigation"} aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
      <span/><span/><span/>
    </button>
    {open?createPortal(<nav ref={panel} className="radarMenuPanel radarMenuFloating" style={position} aria-label="Radar navigation">
      {LINKS.map(([href,label])=><a className={current===href?"active":""} href={href} key={href} onClick={()=>setOpen(false)}>{label}</a>)}
    </nav>,document.body):null}
  </div>;
}

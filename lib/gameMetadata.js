import { conferenceLabel, POWER_CONFERENCES } from "./conferences";

const RIVALRIES = [
  ["Ohio State","Michigan"],["Alabama","Auburn"],["Army","Navy"],["Texas","Oklahoma"],
  ["USC","Notre Dame"],["Georgia","Florida"],["Florida State","Miami"],["Clemson","South Carolina"],
  ["Oregon","Oregon State"],["Washington","Washington State"],["UCLA","USC"],["Minnesota","Wisconsin"],
  ["Iowa","Iowa State"],["Ole Miss","Mississippi State"],["Michigan State","Michigan"],["Purdue","Indiana"]
];

function rivalryName(game){
  const a=String(game?.away?.location||game?.away?.name||"");
  const h=String(game?.home?.location||game?.home?.name||"");
  for(const pair of RIVALRIES){
    const aHit=pair.some(x=>a.toLowerCase().includes(x.toLowerCase()));
    const hHit=pair.some(x=>h.toLowerCase().includes(x.toLowerCase()));
    if(aHit&&hHit)return pair.join(" vs ");
  }
  return null;
}

function finite(value){
  if(value===null||value===undefined||value==="")return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}

function normalized(value){
  return String(value||"").toLowerCase().replace(/[^a-z0-9&]+/g," ").trim();
}

export function teamAliases(team){
  const values=[team?.name,team?.location,team?.short,team?.nickname].filter(Boolean);
  const out=new Set();
  for(const value of values){
    const n=normalized(value);
    if(n)out.add(n);
  }
  return [...out].sort((a,b)=>b.length-a.length);
}

export function rankedCount(game){
  return [game?.home?.rank,game?.away?.rank].filter(Boolean).length;
}

export function spreadValue(game){
  const consensus=finite(game?.marketConsensus?.homeMargin);
  if(consensus!=null)return Math.abs(consensus);
  const market=finite(game?.market?.spread);
  return market==null?null:Math.abs(market);
}

export function totalValue(game){
  const consensus=finite(game?.marketConsensus?.total);
  if(consensus!=null)return consensus;
  return finite(game?.market?.overUnder);
}

export function favoriteSide(game){
  const homeMargin=finite(game?.marketConsensus?.homeMargin);
  if(homeMargin!=null){
    if(Math.abs(homeMargin)<.05)return null;
    return homeMargin>0?"home":"away";
  }
  const details=String(game?.market?.details||"");
  const favorite=[game?.home,game?.away].find(team=>team?.short&&details.toUpperCase().startsWith(String(team.short).toUpperCase()+" "));
  if(favorite)return favorite===game.home?"home":"away";
  return null;
}

export function bestIndex(game){
  return Number(game?.bestOpportunity?.index||game?.opportunityIndex||0)||0;
}

export function convictionTier(game){
  const index=bestIndex(game);
  if(index>80)return "NO BRAINER";
  if(index>70)return "HIGH CONVICTION";
  if(index>=60)return "WATCH";
  return "LOW CONFIDENCE";
}

export function kickoffWindow(game){
  const d=new Date(game?.date);
  if(Number.isNaN(d.getTime()))return null;
  const hour=d.getHours()+d.getMinutes()/60;
  if(hour<14)return "EARLY";
  if(hour<18)return "AFTERNOON";
  if(hour<21)return "PRIMETIME";
  return "LATE";
}

export function marketShape(game){
  const spread=spreadValue(game);
  if(spread==null)return null;
  if(spread<=3.5)return "TOSS-UP";
  if(spread<=7.5)return "ONE-SCORE";
  if(spread<=13.5)return "MEDIUM SPREAD";
  return "BIG FAVORITE";
}

export function totalShape(game){
  const total=totalValue(game);
  if(total==null)return null;
  if(game?.sport==="nfl"){
    if(total<=42)return "LOW TOTAL";
    if(total>=49)return "HIGH TOTAL";
    return "MID TOTAL";
  }
  if(total<=48)return "LOW TOTAL";
  if(total>=60)return "HIGH TOTAL";
  return "MID TOTAL";
}

export function isConferenceGame(game){
  if(game?.conferenceGame)return true;
  const a=game?.away?.conference,b=game?.home?.conference;
  return Boolean(a&&b&&a===b&&a!=="Independent");
}
function parseRecord(record){
  const parts=String(record||"").split("-").map(Number);
  if(parts.length<2||parts.some(n=>!Number.isFinite(n)))return {wins:null,losses:null,ties:null,undefeated:false,winningPct:null};
  const [wins,losses,ties=0]=parts;
  const games=wins+losses+ties;
  return {wins,losses,ties,undefeated:games>0&&losses===0,winningPct:games?((wins+ties*.5)/games):null};
}

export function gameMetadata(game){
  const conferences=[game?.away?.conference,game?.home?.conference].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
  const ranks=[game?.away?.rank,game?.home?.rank].filter(Boolean);
  const fav=favoriteSide(game);
  const spread=spreadValue(game);
  const total=totalValue(game);
  const date=new Date(game?.date);
  const homeRecord=parseRecord(game?.home?.record);
  const awayRecord=parseRecord(game?.away?.record);
  const broadcasts=(game?.broadcasts||[]).filter(Boolean);
  const rivalry=rivalryName(game);
  return {
    conferences,
    conferenceLabels:conferences.map(conferenceLabel),
    conferenceGame:isConferenceGame(game),
    crossConference:Boolean(game?.away?.conference&&game?.home?.conference&&game.away.conference!==game.home.conference),
    powerMatchup:conferences.some(c=>POWER_CONFERENCES.has(c)),
    bothPower:Boolean(game?.away?.conference&&game?.home?.conference&&POWER_CONFERENCES.has(game.away.conference)&&POWER_CONFERENCES.has(game.home.conference)),
    rankedCount:ranks.length,
    rankedMatchup:ranks.length===2,
    rankedInvolved:ranks.length>0,
    top10Involved:ranks.some(r=>r<=10),
    top5Involved:ranks.some(r=>r<=5),
    favoriteSide:fav,
    favoriteTeam:fav?game?.[fav]:null,
    underdogTeam:fav?(fav==="home"?game?.away:game?.home):null,
    spread,
    total,
    marketShape:marketShape(game),
    totalShape:totalShape(game),
    kickoffWindow:kickoffWindow(game),
    day:Number.isNaN(date.getTime())?null:date.toLocaleDateString("en-US",{weekday:"long"}),
    venue:game?.venue||null,
    venueCity:game?.venueCity||null,
    venueState:game?.venueState||null,
    neutralSite:Boolean(game?.neutralSite),
    broadcasts,
    rivalry,
    postseason:Number(game?.seasonType)===3,
    homeRecord,
    awayRecord,
    undefeatedInvolved:homeRecord.undefeated||awayRecord.undefeated,
    bothWinning:homeRecord.winningPct!=null&&awayRecord.winningPct!=null&&homeRecord.winningPct>.5&&awayRecord.winningPct>.5,
    status:game?.state||null,
    live:game?.state==="in",
    upcoming:game?.state==="pre",
    completed:game?.state==="post",
    betIndex:bestIndex(game),
    conviction:convictionTier(game),
    gameInterest:Number(game?.interest?.score||0)||0,
    awayAliases:teamAliases(game?.away),
    homeAliases:teamAliases(game?.home)
  };
}

export function metadataChips(game,limit=4){
  const meta=gameMetadata(game);
  const chips=[];
  if(meta.conferenceGame&&meta.conferences[0])chips.push(conferenceLabel(meta.conferences[0])+" GAME");
  else for(const conference of meta.conferenceLabels.slice(0,2))chips.push(conference);
  if(meta.rivalry)chips.push("RIVALRY");
  if(meta.rankedMatchup)chips.push("RANKED vs RANKED");
  else if(meta.rankedInvolved)chips.push("RANKED TEAM");
  if(meta.marketShape)chips.push(meta.marketShape);
  if(meta.undefeatedInvolved)chips.push("UNDEFEATED");
  if(meta.postseason)chips.push("POSTSEASON");
  if(meta.neutralSite)chips.push("NEUTRAL SITE");
  if(meta.kickoffWindow)chips.push(meta.kickoffWindow);
  if(meta.broadcasts[0])chips.push(meta.broadcasts[0]);
  if(meta.conviction==="NO BRAINER"||meta.conviction==="HIGH CONVICTION")chips.push(meta.conviction);
  return chips.filter((x,i,a)=>a.indexOf(x)===i).slice(0,limit);
}

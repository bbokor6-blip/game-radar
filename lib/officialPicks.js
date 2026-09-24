import { betIndexTier } from "./indexTiers.js";

function sides(value){
  return String(value||"").toLowerCase().split("@").map(side=>side.replace(/[^a-z0-9 ]/g,"").trim());
}
export function sameMatchup(a,b){
  const [awayA,homeA]=sides(a),[awayB,homeB]=sides(b);
  return Boolean(awayA&&homeA&&awayB&&homeB&&
    (awayA===awayB||awayA.startsWith(awayB)||awayB.startsWith(awayA))&&
    (homeA===homeB||homeA.startsWith(homeB)||homeB.startsWith(homeA)));
}

export function mergeOfficialWeeks(ledger,overrides){
  const overrideByKey=new Map((overrides.weeks||[]).map(w=>[w.league+"|"+w.weekStart,w]));
  return (ledger.weeks||[]).map(week=>{
    const override=overrideByKey.get(week.league+"|"+week.weekStart);
    if(!override)return week;
    const picks=(week.picks||[]).map(base=>{
      const match=(override.picks||[]).find(p=>p.gameId===base.gameId||sameMatchup(p.matchup,base.matchup));
      return match?{...base,...match,gameId:base.gameId,matchup:base.matchup,gameDate:base.gameDate||match.gameDate}:base;
    });
    // An override may correct a scheduled game, but cannot invent a fixture.
    return {...week,picks,lockType:"FULL_SLATE_MODEL_LOCK_WITH_OVERRIDES"};
  });
}

function matchup(game){
  return (game.away?.location||game.away?.short)+" @ "+(game.home?.location||game.home?.short);
}
function pickSide(pick,game){
  if(pick.type==="TOTAL")return /^OVER\b/i.test(pick.pick)?"over":"under";
  const text=String(pick.pick||"").toLowerCase();
  for(const side of ["away","home"]){
    const team=game[side];
    if([team?.short,team?.location,team?.name].filter(Boolean).some(name=>text.startsWith(String(name).toLowerCase()+" ")))return side;
  }
  return null;
}

export function attachOfficialPicks(games,weeks,{league,start,now=Date.now()}={}){
  const week=weeks.find(w=>w.league===league&&w.weekStart===start);
  const locked=week?.picks||[];
  const resolved=games.map(game=>{
    const pick=locked.find(p=>p.gameId===game.id)||locked.find(p=>sameMatchup(p.matchup,matchup(game)));
    const nearTerm=Date.parse(game.date)>=now&&Date.parse(game.date)<=now+7*86400000;
    const source=pick||(nearTerm?game.preferredPick:null);
    if(!source||source.type==="PASS"||!source.pick)return {...game,officialPick:null,bestOpportunity:null,opportunities:{},betIndex:{score:0,tier:"Pending",color:"red"}};
    const index=source.betRadarIndex??game.bestOpportunity?.index??0;
    const official={...source,gameId:game.id,gameDate:game.date,locked:Boolean(pick),status:pick?"LOCKED":"PICKED"};
    const opportunity={...game.bestOpportunity,...source,index,type:source.type,side:source.side||pickSide(source,game),
      label:betIndexTier(index).label,why:source.why||"Model pick for this upcoming game.",
      evidence:[pick?"Official PickRadar selection locked "+new Date(pick.lockedAt||week.lockedAt).toLocaleDateString("en-US"):"Current model selection",
        "Pick line: "+(source.line||source.pick),"Market now: "+(game.marketConsensus?.line||"line unavailable")],
      officialStatus:official.status,lockedIndex:pick?index:null};
    return {...game,officialPick:official,preferredPick:official,bestOpportunity:opportunity,
      opportunities:source.type==="SPREAD"?{spread:opportunity}:{total:opportunity},
      betIndex:{score:index,tier:betIndexTier(index).label,color:betIndexTier(index).key,
        source:pick?"locked-pick":"upcoming-model"},opportunityIndex:index};
  });
  // The visible BetIndex ranks the picks we actually publish, rather than a
  // different set of live model candidates. The lock score stays on officialPick.
  const eligible=resolved.filter(g=>g.officialPick&&g.marketConsensus?.available&&g.officialPick.type==="SPREAD")
    .sort((a,b)=>Number(b.officialPick.americanOdds!=null)-Number(a.officialPick.americanOdds!=null)||
      (b.officialPick.betRadarIndex||0)-(a.officialPick.betRadarIndex||0)||String(a.id).localeCompare(String(b.id)));
  const featuredCount=Math.min(eligible.length,Math.ceil(games.length*.30));
  const bestCount=Math.min(eligible.slice(0,featuredCount).filter(g=>g.officialPick.americanOdds!=null).length,Math.ceil(games.length*.08));
  const placement=new Map(eligible.slice(0,featuredCount).map((g,rank)=>[g.id,{rank,best:rank<bestCount}]));
  return resolved.map(game=>{
    if(!game.officialPick)return game;
    const rawIndex=game.officialPick.betRadarIndex||0;
    const place=placement.get(game.id);
    const score=place?(place.best?Math.max(rawIndex,80+bestCount-place.rank-1):
      Math.max(rawIndex,70+Math.floor((featuredCount-place.rank-1)*9/Math.max(1,featuredCount-bestCount)))):rawIndex;
    const index=game.officialPick.type==="TOTAL"?Math.min(69,score):
      game.officialPick.americanOdds==null?Math.min(79,score):score;
    const relativeSlate=place?{rank:place.rank+1,slateSize:games.length,rawIndex}:null;
    const explanation=relativeSlate?`BetIndex ${index} ranks this official pick #${relativeSlate.rank} on the slate; its score at lock was ${rawIndex}. This ranking is not a predicted win rate. ${game.bestOpportunity.why}`:game.bestOpportunity.why;
    const best={...game.bestOpportunity,index,label:betIndexTier(index).label,why:explanation,relativeSlate,
      highConviction:index>=80,noBrainer:false};
    const official={...game.officialPick,currentBetIndex:index};
    return {...game,officialPick:official,preferredPick:official,bestOpportunity:best,
      opportunities:official.type==="SPREAD"?{spread:best}:{total:best},
      betIndex:{score:index,tier:betIndexTier(index).label,color:betIndexTier(index).key,
        rawScore:rawIndex,source:official.locked?"locked-pick-slate-rank":"upcoming-model-slate-rank"},
      opportunityIndex:index};
  });
}

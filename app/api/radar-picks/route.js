import { NextResponse } from "next/server";
import ledger from "../../../data/radar-picks.json";
import overrides from "../../../data/pickradar-overrides.json";
import { buildFeedbackProfile } from "../../../lib/radarFeedback";
import { calibratePickIndex, pickConfidenceBand } from "../../../lib/pickCalibration";

export const dynamic = "force-dynamic";

function matchupSides(value){
  return String(value||"").toLowerCase().split("@").map(side=>side.replace(/[^a-z0-9 ]/g,"").trim());
}
function sameMatchup(a,b){
  const [aa,ah]=matchupSides(a),[ba,bh]=matchupSides(b);
  return Boolean(aa&&ah&&ba&&bh&&(aa.startsWith(ba)||ba.startsWith(aa))&&(ah.startsWith(bh)||bh.startsWith(ah)));
}

export async function GET(){
  const overrideWeeks=Array.isArray(overrides.weeks)?overrides.weeks:[];
  const overrideByKey=new Map(overrideWeeks.map(week=>[week.league+"|"+week.weekStart,week]));
  const baseWeeks=Array.isArray(ledger.weeks)?ledger.weeks:[];
  const baseKeys=new Set(baseWeeks.map(week=>week.league+"|"+week.weekStart));
  const sourceWeeks=baseWeeks.map(week=>{
    const override=overrideByKey.get(week.league+"|"+week.weekStart);
    if(!override)return week;
    const used=new Set();
    const merged=(week.picks||[]).map(base=>{
      const match=(override.picks||[]).find(pick=>pick.gameId===base.gameId||sameMatchup(pick.matchup,base.matchup));
      if(!match)return base;
      used.add(match);
      return {...base,...match,gameId:base.gameId,matchup:base.matchup,gameDate:base.gameDate||match.gameDate};
    });
    for(const pick of override.picks||[])if(!used.has(pick))merged.push(pick);
    return {...week,...override,picks:merged,lockType:"FULL_SLATE_MODEL_LOCK_WITH_OVERRIDES"};
  });
  for(const week of overrideWeeks)if(!baseKeys.has(week.league+"|"+week.weekStart))sourceWeeks.push(week);
  const weeks=sourceWeeks.map(week=>({
    ...week,
    picks:(week.picks||[]).map(pick=>{
      const betRadarIndex=pick.modelVersion==="pickradar-v2"||String(pick.modelVersion||"").startsWith("pickradar-v5")||pick.lockedAt
        ?pick.betRadarIndex
        :calibratePickIndex(pick.betRadarIndex,{league:pick.league||week.league,type:pick.type});
      return {...pick,betRadarIndex,confidenceBand:pickConfidenceBand(betRadarIndex)};
    })
  }));
  const graded=weeks.flatMap(w=>w.picks||[]).filter(p=>["W","L","PUSH"].includes(p.result));
  const wins=graded.filter(p=>p.result==="W").length;
  const losses=graded.filter(p=>p.result==="L").length;
  const pushes=graded.filter(p=>p.result==="PUSH").length;
  const decisions=wins+losses;
  const feedback=buildFeedbackProfile({...ledger,weeks});
  const confidenceAnalysis=buildFeedbackProfile({...ledger,weeks},{includeExcluded:true,useAnalysisIndex:true});
  return NextResponse.json({
    ...ledger,weeks,feedback,confidenceAnalysis,
    record:{wins,losses,pushes,decisions,winPct:decisions?Math.round((wins/decisions)*1000)/10:null}
  },{headers:{"Cache-Control":"no-store"}});
}

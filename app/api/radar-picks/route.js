import { NextResponse } from "next/server";
import ledger from "../../../data/radar-picks.json";
import { buildFeedbackProfile } from "../../../lib/radarFeedback";
import { calibratePickIndex, pickConfidenceBand } from "../../../lib/pickCalibration";

export const dynamic = "force-dynamic";

export async function GET(){
  const weeks=(Array.isArray(ledger.weeks)?ledger.weeks:[]).map(week=>({
    ...week,
    picks:(week.picks||[]).map(pick=>{
      const betRadarIndex=pick.modelVersion==="pickradar-v2"
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
  return NextResponse.json({
    ...ledger,
    feedback,
    record:{
      wins,losses,pushes,
      decisions,
      winPct:decisions?Math.round((wins/decisions)*1000)/10:null
    }
  },{headers:{"Cache-Control":"no-store"}});
}

import { NextResponse } from "next/server";
import ledger from "../../../data/radar-picks.json";
import overrides from "../../../data/pickradar-overrides.json";
import { buildFeedbackProfile } from "../../../lib/radarFeedback";
import { calibratePickIndex, pickConfidenceBand } from "../../../lib/pickCalibration";
import { mergeOfficialWeeks } from "../../../lib/officialPicks";

export const dynamic = "force-dynamic";

export async function GET(){
  const sourceWeeks=mergeOfficialWeeks(ledger,overrides);
  const weeks=sourceWeeks.map(week=>({
    ...week,
    picks:(week.picks||[]).map(pick=>{
      const betRadarIndex=pick.modelVersion==="pickradar-v2"||String(pick.modelVersion||"").startsWith("pickradar-v5")||pick.lockedAt
        ?pick.betRadarIndex
        :calibratePickIndex(pick.betRadarIndex,{league:pick.league||week.league,type:pick.type});
      return {...pick,betRadarIndex,confidenceBand:pickConfidenceBand(betRadarIndex)};
    })
  }));
  const summarize=entries=>{
    const graded=entries.flatMap(w=>w.picks||[]).filter(p=>["W","L","PUSH"].includes(p.result));
    const wins=graded.filter(p=>p.result==="W").length;
    const losses=graded.filter(p=>p.result==="L").length;
    const pushes=graded.filter(p=>p.result==="PUSH").length;
    const decisions=wins+losses;
    return {wins,losses,pushes,decisions,winPct:decisions?Math.round((wins/decisions)*1000)/10:null};
  };
  const feedback=buildFeedbackProfile({...ledger,weeks});
  const confidenceAnalysis=buildFeedbackProfile({...ledger,weeks},{includeExcluded:true,useAnalysisIndex:true});
  return NextResponse.json({
    ...ledger,weeks,feedback,confidenceAnalysis,
    record:summarize(weeks),
    liveRecord:summarize(weeks.filter(w=>w.lockType!=="RETROSPECTIVE_ARCHIVED_LINE_BACKTEST")),
    retrospectiveRecord:summarize(weeks.filter(w=>w.lockType==="RETROSPECTIVE_ARCHIVED_LINE_BACKTEST"))
  },{headers:{"Cache-Control":"no-store"}});
}

import { NextResponse } from "next/server";
import ledger from "../../../data/radar-picks.json";

export const dynamic = "force-dynamic";

export async function GET(){
  const weeks=Array.isArray(ledger.weeks)?ledger.weeks:[];
  const graded=weeks.flatMap(w=>w.picks||[]).filter(p=>["W","L","PUSH"].includes(p.result));
  const wins=graded.filter(p=>p.result==="W").length;
  const losses=graded.filter(p=>p.result==="L").length;
  const pushes=graded.filter(p=>p.result==="PUSH").length;
  const decisions=wins+losses;
  return NextResponse.json({
    ...ledger,
    record:{
      wins,losses,pushes,
      decisions,
      winPct:decisions?Math.round((wins/decisions)*1000)/10:null
    }
  },{headers:{"Cache-Control":"no-store"}});
}

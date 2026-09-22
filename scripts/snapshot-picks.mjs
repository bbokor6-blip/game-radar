import { GET } from "../app/api/bets/route.js";
import fs from "node:fs";
import path from "node:path";
import { pickConfidenceBand, isHighConfidence } from "../lib/pickCalibration.js";

async function main() {
  const league = process.argv[2] === "cfb" ? "cfb" : "nfl";
  const start = process.argv[3];
  const end = process.argv[4];
  if (!start || !end) throw new Error("Usage: snapshot-picks <cfb|nfl> <YYYY-MM-DD> <YYYY-MM-DD>");

  const response = await GET(new Request(`http://localhost/api/bets?league=${league}&start=${start}&end=${end}`));
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail || payload.error || "Unable to load picks");

  const ledgerPath=path.resolve(process.cwd(),"data/radar-picks.json");
  const ledger=JSON.parse(fs.readFileSync(ledgerPath,"utf8"));
  const existing=(ledger.weeks||[]).find(w=>w.league===league&&w.weekStart===start);
  const previous=new Map((existing?.picks||[]).map(p=>[p.matchup,p]));
  const lockedAt=new Date().toISOString();

  // PickRadar is selective: one recommendation per game, maximum five for the week.
  // Require a real 70+ BetRadar signal and prefer games that are also interesting (70+ Game/Radar index when available).
  const candidates=(payload.games||[])
    .map(game=>({game,pick:game.preferredPick,index:game.preferredPick?.betRadarIndex??game.bestOpportunity?.index??0,gameIndex:game.gameIndex??game.radarIndex??null}))
    .filter(x=>x.pick&&x.pick.type!=="PASS"&&x.index>=70&&(x.gameIndex==null||x.gameIndex>=70))
    .sort((a,b)=>(b.index-a.index)||((b.gameIndex||0)-(a.gameIndex||0)))
    .slice(0,5);

  const picks=candidates.map(({game,pick,index,gameIndex})=>{
    const generated={
      ...pick,league,betRadarIndex:index,gameIndex,radarIndex:gameIndex,modelVersion:"pickradar-v3-selective",result:"PENDING",lockedAt,
      selectionBasis:"Selective PickRadar lock: strongest qualifying BetRadar/GameRadar signals",
      confidenceBand:pickConfidenceBand(index),closingMarket:null,closingLineValue:null,
      versionHistory:[{lockedAt,pick:pick.pick,line:pick.line,americanOdds:pick.americanOdds??null,reason:"Initial selective PickRadar lock"}]
    };
    const prior=previous.get(generated.matchup);
    return prior?{...generated,...prior,league,betRadarIndex:prior.betRadarIndex??index,gameIndex:prior.gameIndex??prior.radarIndex??gameIndex,radarIndex:prior.radarIndex??gameIndex}:generated;
  });

  const week={league,weekStart:start,weekEnd:end,label:(league==="cfb"?"College":"NFL")+" · "+start+"–"+end,lockedAt:existing?.lockedAt||lockedAt,lockType:"SELECTIVE_PICKRADAR_LOCK",picks};
  ledger.version=4; ledger.updatedAt=lockedAt;
  ledger.weeks=[...(ledger.weeks||[]).filter(w=>!(w.league===league&&w.weekStart===start)),week];
  fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+"\n");
  process.stdout.write(JSON.stringify({league,start,end,picks:picks.length,highConfidence:picks.filter(p=>isHighConfidence(p.betRadarIndex)).length}));
}
main();

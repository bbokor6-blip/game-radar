import { GET } from "../app/api/bets/route.js";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const league = process.argv[2] === "cfb" ? "cfb" : "nfl";
  const start = process.argv[3];
  const end = process.argv[4];

  if (!start || !end) {
    throw new Error("Usage: snapshot-picks <cfb|nfl> <YYYY-MM-DD> <YYYY-MM-DD>");
  }

  const response = await GET(new Request(`http://localhost/api/bets?league=${league}&start=${start}&end=${end}`));
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail || payload.error || "Unable to load picks");

  const ledgerPath=path.resolve(process.cwd(),"data/radar-picks.json");
  const ledger=JSON.parse(fs.readFileSync(ledgerPath,"utf8"));
  const existing=(ledger.weeks||[]).find(w=>w.league===league&&w.weekStart===start);
  const previous=new Map((existing?.picks||[]).map(p=>[p.matchup,p]));
  const lockedAt=new Date().toISOString();
  const picks=payload.games.map(game=>{
    const generated={
      ...game.preferredPick,
      league,
      result:"PENDING",
      lockedAt,
      selectionBasis:game.preferredPick.fullSlateFallback
        ? "Full-slate fallback model"
        : "BetRadar trend model plus current market consensus",
      confidenceBand:game.preferredPick.betRadarIndex>=80?"ELITE":game.preferredPick.betRadarIndex>=70?"HIGH":"STANDARD",
      versionHistory:[{
        lockedAt,
        pick:game.preferredPick.pick,
        line:game.preferredPick.line,
        americanOdds:game.preferredPick.americanOdds??null,
        reason:"Initial full-slate PickRadar lock"
      }]
    };
    const locked=previous.get(generated.matchup);
    if(!locked)return generated;
    const betRadarIndex=locked.betRadarIndex??generated.betRadarIndex;
    return {
      ...generated,...locked,
      league,betRadarIndex,
      radarIndex:locked.radarIndex??generated.radarIndex,
      confidenceBand:betRadarIndex>=80?"ELITE":betRadarIndex>=70?"HIGH":"STANDARD"
    };
  });
  const week={
    league,weekStart:start,weekEnd:end,
    label:(league==="cfb"?"College":"NFL")+" · "+start+"–"+end,
    lockedAt:existing?.lockedAt||lockedAt,
    lockType:"FULL_SLATE_MODEL_LOCK",
    picks
  };
  ledger.version=3;
  ledger.updatedAt=lockedAt;
  ledger.weeks=[...(ledger.weeks||[]).filter(w=>!(w.league===league&&w.weekStart===start)),week];
  fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+"\n");
  process.stdout.write(JSON.stringify({league,start,end,picks:picks.length,highConfidence:picks.filter(p=>(p.betRadarIndex||0)>=70).length}));
}

main();

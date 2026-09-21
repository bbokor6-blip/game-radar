import { GET } from "../app/api/bets/route.js";

async function main(){
  const league=process.argv[2]==="cfb"?"cfb":"nfl";
  const start=process.argv[3];
  const end=process.argv[4];
  if(!start||!end)throw new Error("Usage: audit-model <cfb|nfl> <start> <end>");
  const response=await GET(new Request(`http://localhost/api/bets?league=${league}&start=${start}&end=${end}`));
  const payload=await response.json();
  if(!response.ok)throw new Error(payload.detail||payload.error);
  const picks=payload.games.map(g=>g.preferredPick);
  process.stdout.write(JSON.stringify({
    league,
    games:picks.length,
    highConfidence:picks.filter(p=>p.betRadarIndex>=80).length,
    modelLeans:picks.filter(p=>p.betRadarIndex>=70&&p.betRadarIndex<80).length,
    totals:picks.filter(p=>p.type==="TOTAL").length,
    highConfidenceTotals:picks.filter(p=>p.type==="TOTAL"&&p.betRadarIndex>=80).length,
    indexRange:[Math.min(...picks.map(p=>p.betRadarIndex)),Math.max(...picks.map(p=>p.betRadarIndex))],
    historyGames:payload.methodology.historyGames,
    powerModel:payload.methodology.powerModel
  },null,2));
}

main();

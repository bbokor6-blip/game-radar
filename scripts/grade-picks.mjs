import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function normalized(value){return String(value||"").toLowerCase().replace(/[^a-z0-9]/g,"");}
function matchupKey(game){return normalized((game.away?.name||game.away?.short)+"@"+(game.home?.name||game.home?.short));}
function resultFromDelta(delta){return Math.abs(delta)<.001?"PUSH":delta>0?"W":"L";}

function inferredSide(pick,game){
  if(pick.side)return pick.side;
  if(pick.type==="TOTAL")return /^(over|under)\b/i.exec(pick.pick)?.[1]?.toLowerCase()||null;
  const label=normalized(String(pick.pick||"").replace(/\s+[+-]?\d+(?:\.\d+)?\s*$/," ").replace(/\s+TO WIN\s*$/i," "));
  for(const side of ["home","away"]){
    if(normalized(game[side]?.short)===label||normalized(game[side]?.name).startsWith(label))return side;
  }
  return null;
}

// The saved selection is the line at lock. Closing odds may have moved and
// must never substitute for a missing locked number when grading a pick.
export function lockedLine(pick,game){
  const side=inferredSide(pick,game);
  if(!side)return null;
  if(pick.type==="MONEYLINE")return {side};
  const number=String(pick.pick||"").match(/([+-]?\d+(?:\.\d+)?)\s*$/);
  const value=number?Number(number[1]):null;
  if(!Number.isFinite(value))return null;
  if(pick.type==="TOTAL")return {side,total:value};
  if(pick.type==="SPREAD")return {side,homeMargin:side==="home"?-value:value};
  return null;
}

export function grade(pick,game,locked){
  const home=Number(game.home.score),away=Number(game.away.score),side=inferredSide(pick,game);
  if(pick.type==="TOTAL")return resultFromDelta(side==="over"?home+away-locked.total:locked.total-home-away);
  if(pick.type==="MONEYLINE")return resultFromDelta(side==="home"?home-away:away-home);
  const spread=side==="home"?-locked.homeMargin:locked.homeMargin;
  return resultFromDelta((side==="home"?home-away:away-home)+spread);
}

async function main(){
  const ledgerPath=path.resolve(process.cwd(),"data/radar-picks.json");
  const snapshot=JSON.parse(fs.readFileSync(path.resolve(process.cwd(),"data/football-source-of-truth.json"),"utf8"));
  if(Date.now()-Date.parse(snapshot.generatedAt)>24*3600000)throw new Error("Refresh the season snapshot before grading picks");
  const ledger=JSON.parse(fs.readFileSync(ledgerPath,"utf8"));
  let graded=0;
  for(const week of ledger.weeks||[]){
    const completed=snapshot.games.filter(g=>g.league===week.league&&g.completed&&g.kickoff.slice(0,10)>=week.weekStart&&g.kickoff.slice(0,10)<=week.weekEnd);
    const byId=new Map(completed.map(g=>[`${g.league}-${g.eventId}`,g]));
    const byMatchup=new Map(completed.map(g=>[matchupKey(g),g]));
    for(const pick of week.picks||[]){
      if(pick.result!=="PENDING")continue;
      const game=byId.get(pick.gameId)||byMatchup.get(normalized(pick.matchup))||completed.find(g=>{
        const [away,home]=String(pick.matchup||"").split("@").map(normalized);
        return away&&home&&[g.away.name,g.away.short].some(x=>normalized(x).includes(away))&&[g.home.name,g.home.short].some(x=>normalized(x).includes(home));
      });
      if(!game)continue;
      const locked=lockedLine(pick,game);
      if(!locked)continue;
      pick.result=grade(pick,game,locked);
      pick.gradingLine=pick.pick;
      pick.finalScore=game.away.score+"–"+game.home.score;
      pick.closingMarket=null;
      pick.closingLineValue=null;
      pick.gradedAt=new Date().toISOString();
      graded++;
    }
  }
  ledger.updatedAt=new Date().toISOString();
  fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+"\n");
  process.stdout.write(JSON.stringify({graded}));
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();

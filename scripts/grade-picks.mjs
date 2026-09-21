import fs from "node:fs";
import path from "node:path";
import { fetchScoreboard, fetchConsensusOdds } from "../lib/espn.js";
import { consensusMarket } from "../lib/opportunity.js";

function normalized(value){return String(value||"").toLowerCase().replace(/[^a-z0-9]/g,"");}
function matchupKey(game){return normalized((game.away?.location||game.away?.short)+"@"+(game.home?.location||game.home?.short));}
function resultFromDelta(delta){return Math.abs(delta)<.001?"PUSH":delta>0?"W":"L";}

function inferredSide(pick,game){
  if(pick.side)return pick.side;
  if(pick.type==="TOTAL")return /^over/i.test(pick.pick)?"over":"under";
  const label=normalized(pick.pick);
  if(label.startsWith(normalized(game.home?.short))||label.startsWith(normalized(game.home?.location)))return "home";
  return "away";
}

function grade(pick,game,locked){
  const home=Number(game.home.score),away=Number(game.away.score),side=inferredSide(pick,game);
  if(pick.type==="TOTAL")return resultFromDelta(side==="over"?home+away-locked.total:locked.total-home-away);
  if(pick.type==="MONEYLINE")return resultFromDelta(side==="home"?home-away:away-home);
  const spread=side==="home"?-locked.homeMargin:locked.homeMargin;
  return resultFromDelta((side==="home"?home-away:away-home)+spread);
}

function closingLineValue(pick,game,locked,closing){
  const side=inferredSide(pick,game);
  if(pick.type==="TOTAL"&&Number.isFinite(locked.total)&&Number.isFinite(closing.total))return Math.round((side==="over"?closing.total-locked.total:locked.total-closing.total)*10)/10;
  if(pick.type==="SPREAD"&&Number.isFinite(locked.homeMargin)&&Number.isFinite(closing.homeMargin)){
    const lockedSpread=side==="home"?-locked.homeMargin:locked.homeMargin;
    const closingSpread=side==="home"?-closing.homeMargin:closing.homeMargin;
    return Math.round((lockedSpread-closingSpread)*10)/10;
  }
  return null;
}

async function main(){
  const ledgerPath=path.resolve(process.cwd(),"data/radar-picks.json");
  const ledger=JSON.parse(fs.readFileSync(ledgerPath,"utf8"));
  let graded=0;
  for(const week of ledger.weeks||[]){
    const games=await fetchScoreboard(week.league,week.weekStart,week.weekEnd);
    const completed=games.filter(g=>g.state==="post");
    const byId=new Map(completed.map(g=>[g.id,g]));
    const byMatchup=new Map(completed.map(g=>[matchupKey(g),g]));
    for(const pick of week.picks||[]){
      if(pick.result!=="PENDING")continue;
      const game=byId.get(pick.gameId)||byMatchup.get(normalized(pick.matchup));
      if(!game)continue;
      const quotes=await fetchConsensusOdds(week.league,game.sourceId,game.competitionId,86400).catch(()=>[]);
      const closing=consensusMarket(game,quotes);
      const locked=pick.lockedMarket||closing;
      if(pick.type==="SPREAD"&&!Number.isFinite(locked.homeMargin))continue;
      if(pick.type==="TOTAL"&&!Number.isFinite(locked.total))continue;
      pick.result=grade(pick,game,locked);
      pick.finalScore=game.away.score+"–"+game.home.score;
      pick.closingMarket={homeMargin:closing.homeMargin??null,total:closing.total??null,providerCount:closing.providerCount||0};
      pick.closingLineValue=closingLineValue(pick,game,locked,closing);
      pick.gradedAt=new Date().toISOString();
      graded++;
    }
  }
  ledger.updatedAt=new Date().toISOString();
  fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+"\n");
  process.stdout.write(JSON.stringify({graded}));
}

main();

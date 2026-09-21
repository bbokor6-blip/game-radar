import { NextResponse } from "next/server";
import { fetchScoreboard, fetchSeasonScoreboard, fetchConsensusOdds } from "../../../lib/espn";
import { rankGames } from "../../../lib/interest";
import { buildPowerModel, calibrateModel, consensusMarket, evaluateGame, projectGame, displayProjectedLine, displayMarketLine } from "../../../lib/radarModel";

export const dynamic = "force-dynamic";

async function mapLimit(items, limit, fn){
  const out=new Array(items.length);
  let cursor=0;
  async function worker(){
    while(true){
      const i=cursor++;
      if(i>=items.length)return;
      try{out[i]=await fn(items[i],i);}catch{out[i]=null;}
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return out;
}

export async function GET(request){
  const {searchParams}=new URL(request.url);
  const league=searchParams.get("league")==="cfb"?"cfb":"nfl";
  const start=searchParams.get("start");
  const end=searchParams.get("end");
  if(!start||!end)return NextResponse.json({error:"start and end are required"},{status:400});

  const year=Number(start.slice(0,4))||new Date().getFullYear();
  try{
    const [weekGames,seasonGames]=await Promise.all([
      fetchScoreboard(league,start,end),
      fetchSeasonScoreboard(league,year)
    ]);

    const rankedUpcoming=rankGames(weekGames.filter(g=>g.state==="pre"));
    const history=seasonGames.filter(g=>g.state==="post"&&new Date(g.date)<new Date(start+"T12:00:00Z"));
    const model=buildPowerModel(history,league);
    const calibration=calibrateModel(history,league);

    const enrichCount=league==="nfl"?32:28;
    const enrichIds=new Set(rankedUpcoming.slice(0,enrichCount).map(g=>g.id));
    const oddsResults=await mapLimit(rankedUpcoming,8,async(game)=>{
      if(!enrichIds.has(game.id))return [];
      return fetchConsensusOdds(league,game.sourceId);
    });

    const games=rankedUpcoming.map((game,index)=>{
      const projection=projectGame(game,model);
      const market=consensusMarket(game,oddsResults[index]||[]);
      const evaluation=evaluateGame(game,projection,market,calibration);
      const candidates=[evaluation.spreadBet,evaluation.totalBet].filter(Boolean);
      const bestBet=candidates.sort((a,b)=>b.evAtMinus110-a.evAtMinus110)[0]||null;
      return {
        ...game,
        projection:{
          ...projection,
          line:displayProjectedLine(game,projection.homeMargin),
          projectedScore:game.away.short+" "+projection.awayPoints+" · "+game.home.short+" "+projection.homePoints
        },
        marketConsensus:{
          ...market,
          line:displayMarketLine(game,market.homeMargin)
        },
        bets:evaluation,
        bestBet,
        modelEdgeScore:bestBet?Math.round(Math.max(0,bestBet.evAtMinus110)*2+bestBet.confidence):0
      };
    }).sort((a,b)=>b.modelEdgeScore-a.modelEdgeScore||b.interest.score-a.interest.score);

    return NextResponse.json({
      generatedAt:new Date().toISOString(),
      league,year,range:{start,end},
      model:{
        version:"Radar Model v1.0",
        method:"Opponent-adjusted scoring margin + recent form + offense/defense scoring blend",
        completedGames:model.completedCount,
        leagueAveragePoints:Math.round(model.leagueAvg*10)/10,
        calibration
      },
      games
    },{headers:{"Cache-Control":"public, s-maxage=300, stale-while-revalidate=300"}});
  }catch(error){
    console.error("bet model error",error);
    return NextResponse.json({error:"Bet model unavailable",detail:String(error?.message||error)},{status:500});
  }
}

import { NextResponse } from "next/server";
import { fetchScoreboard, fetchSeasonScoreboard } from "../../../lib/espn";
import { rankGames } from "../../../lib/interest";
import { enrichGamesWithSeasonContext, seasonCoverage } from "../../../lib/seasonContext";

export const dynamic = "force-dynamic";

async function safe(sport,start,end){
  try{
    return {games:await fetchScoreboard(sport,start,end),ok:true};
  }catch(error){
    console.error(`${sport} scoreboard error`,error);
    return {games:[],ok:false,error:String(error?.message||error)};
  }
}

export async function GET(request){
  const {searchParams}=new URL(request.url);
  const start=searchParams.get("start");
  const end=searchParams.get("end");
  const league=searchParams.get("league")==="cfb"?"cfb":"nfl";

  const result=await safe(league,start,end);
  const rawLeagueGames=result.games.filter(g=>g.sport===league);
  const year=Number(String(start||rawLeagueGames[0]?.date||new Date().getFullYear()).slice(0,4))||new Date().getFullYear();
  const throughWeek=Math.max(1,...rawLeagueGames.map(g=>Number(g.week)||0));
  let seasonGames=[];
  let seasonError=null;
  try{
    seasonGames=await fetchSeasonScoreboard(league,year,throughWeek);
  }catch(error){
    seasonError=String(error?.message||error);
    console.error(`${league} season context error`,error);
  }
  const leagueGames=enrichGamesWithSeasonContext(rawLeagueGames,seasonGames);

  const ranked=rankGames(leagueGames).map(game=>({
    ...game,
    gameIndex:game.interest
  })).sort((a,b)=>(b.gameIndex?.score||0)-(a.gameIndex?.score||0));

  return NextResponse.json({
    generatedAt:new Date().toISOString(),
    league,
    games:ranked,
    range:{start,end},
    health:{
      ok:result.ok,
      count:leagueGames.length,
      error:result.error||null,
      seasonContextOk:!seasonError,
      seasonContextError:seasonError,
      seasonCoverage:seasonCoverage(seasonGames)
    },
    source:league==="cfb"
      ?"ESPN live scoreboard · week-by-week FBS season archive"
      :"ESPN live scoreboard · week-by-week NFL season archive"
  },{headers:{"Cache-Control":"no-store"}});
}

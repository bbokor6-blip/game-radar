import { NextResponse } from "next/server";
import { fetchScoreboard } from "../../../lib/espn";
import { rankGames } from "../../../lib/interest";

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
  const leagueGames=league==="cfb"
    ? result.games.filter(game=>game.home.rank||game.away.rank)
    : result.games;

  return NextResponse.json({
    generatedAt:new Date().toISOString(),
    league,
    games:rankGames(leagueGames),
    range:{start,end},
    health:{
      ok:result.ok,
      count:leagueGames.length,
      rawCount:result.games.length,
      error:result.error||null
    },
    source:league==="cfb"
      ?"ESPN prototype scoreboard · Top 25 games only"
      :"ESPN prototype scoreboard"
  },{headers:{"Cache-Control":"no-store"}});
}

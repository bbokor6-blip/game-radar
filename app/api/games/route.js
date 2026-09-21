import { NextResponse } from "next/server";
import { fetchScoreboard } from "../../../lib/espn";
import { rankGames } from "../../../lib/interest";
import { buildRadarIndex } from "../../../lib/radarIndex";

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
  const leagueGames=result.games.filter(g=>g.sport===league);

  const ranked=rankGames(leagueGames).map(game=>({
    ...game,
    radarIndex:buildRadarIndex(game,game.marketInterest?.score||null)
  })).sort((a,b)=>(b.radarIndex?.score||0)-(a.radarIndex?.score||0));

  return NextResponse.json({
    generatedAt:new Date().toISOString(),
    league,
    games:ranked,
    range:{start,end},
    health:{
      ok:result.ok,
      count:leagueGames.length,
      error:result.error||null
    },
    source:league==="cfb"
      ?"ESPN prototype scoreboard · All FBS games"
      :"ESPN prototype scoreboard"
  },{headers:{"Cache-Control":"no-store"}});
}

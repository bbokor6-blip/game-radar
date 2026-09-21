import { NextResponse } from "next/server";
import { fetchScoreboard } from "../../../lib/espn";
import { rankGames } from "../../../lib/interest";
export const dynamic = "force-dynamic";
async function safe(sport,start,end){try{return await fetchScoreboard(sport,start,end)}catch(error){console.error(`${sport} scoreboard error`,error);return[]}}
export async function GET(request){
 const {searchParams}=new URL(request.url),start=searchParams.get("start"),end=searchParams.get("end");
 const [cfb,nfl]=await Promise.all([safe("cfb",start,end),safe("nfl",start,end)]);
 const top25=cfb.filter(game=>game.home.rank||game.away.rank);
 return NextResponse.json({generatedAt:new Date().toISOString(),games:rankGames([...top25,...nfl]),range:{start,end},sources:{nfl:"scoreboard feed",cfb:"Top 25 games only"}},{headers:{"Cache-Control":"public, s-maxage=20, stale-while-revalidate=40"}});
}
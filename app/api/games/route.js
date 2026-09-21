import { NextResponse } from "next/server";
import { fetchScoreboard } from "../../../lib/espn";
import { rankGames } from "../../../lib/interest";
export const dynamic = "force-dynamic";
async function safe(sport,start,end){try{return {games:await fetchScoreboard(sport,start,end),ok:true}}catch(error){console.error(`${sport} scoreboard error`,error);return{games:[],ok:false,error:String(error?.message||error)}}}
export async function GET(request){
 const {searchParams}=new URL(request.url),start=searchParams.get("start"),end=searchParams.get("end");
 const [cfbResult,nflResult]=await Promise.all([safe("cfb",start,end),safe("nfl",start,end)]);
 const top25=cfbResult.games.filter(game=>game.home.rank||game.away.rank);
 const games=rankGames([...top25,...nflResult.games]);
 return NextResponse.json({generatedAt:new Date().toISOString(),games,range:{start,end},health:{nfl:{ok:nflResult.ok,count:nflResult.games.length,error:nflResult.error||null},cfb:{ok:cfbResult.ok,count:top25.length,rawCount:cfbResult.games.length,error:cfbResult.error||null}},sources:{nfl:"ESPN prototype scoreboard",cfb:"ESPN prototype scoreboard · Top 25 games only"}},{headers:{"Cache-Control":"no-store"}});
}
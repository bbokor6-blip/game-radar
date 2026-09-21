import { NextResponse } from "next/server";
import { fetchScoreboard } from "../../../lib/espn";
import { fetchCfbdGames } from "../../../lib/cfbd";
import { fetchOdds, attachOdds } from "../../../lib/odds";
import { rankGames } from "../../../lib/interest";

export const dynamic = "force-dynamic";

async function safe(fn, fallback=[]) { try { return await fn(); } catch (e) { console.error(e); return fallback; } }

export async function GET() {
  const [espnCfb,nfl,cfbd,nflOdds,cfbOdds]=await Promise.all([
    safe(()=>fetchScoreboard("cfb")), safe(()=>fetchScoreboard("nfl")),
    safe(()=>fetchCfbdGames()), safe(()=>fetchOdds("nfl")), safe(()=>fetchOdds("cfb"))
  ]);

  // ESPN remains the live-state fallback for CFB until CFBD live access is enabled.
  const cfb = espnCfb.length ? espnCfb : cfbd;
  const games=rankGames(attachOdds([...cfb,...nfl],[...cfbOdds,...nflOdds]));

  return NextResponse.json({
    generatedAt:new Date().toISOString(), games,
    sources:{scores:{cfb:espnCfb.length?"espn-fallback":"cfbd",nfl:"espn-fallback"},
      odds:process.env.ODDS_API_KEY?"the-odds-api":"not-configured",
      cfbd:process.env.CFBD_API_KEY?"configured":"not-configured"}
  },{headers:{"Cache-Control":"public, s-maxage=20, stale-while-revalidate=40"}});
}

import { NextResponse } from "next/server";
import { fetchScoreboard } from "../../../lib/espn";
import { rankGames } from "../../../lib/interest";

export const dynamic = "force-dynamic";

async function safe(sport) {
  try { return await fetchScoreboard(sport); }
  catch (error) { console.error(`${sport} scoreboard error`, error); return []; }
}

export async function GET() {
  const [cfb, nfl] = await Promise.all([safe("cfb"), safe("nfl")]);
  const games = rankGames([...cfb, ...nfl]);
  return NextResponse.json(
    { generatedAt: new Date().toISOString(), games, sources: { nfl: "live scoreboard", cfb: "live scoreboard" } },
    { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40" } }
  );
}

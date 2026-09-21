import { NextResponse } from "next/server";
import { fetchScoreboard } from "../../../lib/espn";
import { rankGames } from "../../../lib/interest";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [cfb, nfl] = await Promise.all([
      fetchScoreboard("cfb"),
      fetchScoreboard("nfl")
    ]);

    const games = rankGames([...cfb, ...nfl]);

    return NextResponse.json(
      { generatedAt: new Date().toISOString(), games },
      { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Live score feed is temporarily unavailable.",
        detail: process.env.NODE_ENV === "development" ? String(error) : undefined
      },
      { status: 502 }
    );
  }
}

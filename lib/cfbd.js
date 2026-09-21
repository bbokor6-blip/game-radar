const BASE = "https://api.collegefootballdata.com";

export async function fetchCfbdGames() {
  const key = process.env.CFBD_API_KEY;
  if (!key) return [];

  const now = new Date();
  const year = now.getUTCFullYear();
  const url = new URL(BASE + "/games");
  url.searchParams.set("year", String(year));
  url.searchParams.set("seasonType", "regular");
  url.searchParams.set("classification", "fbs");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    next: { revalidate: 30 }
  });
  if (!res.ok) throw new Error(`CFBD returned ${res.status}`);
  const rows = await res.json();

  return rows.map((g) => ({
    id: `cfb-cfbd-${g.id}`, sourceId: String(g.id), sport: "cfb",
    name: `${g.awayTeam} at ${g.homeTeam}`, date: g.startDate,
    state: g.completed ? "post" : "pre", completed: Boolean(g.completed),
    status: g.completed ? "Final" : new Date(g.startDate).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}),
    period: 0, clock: "", possessionId: null, downDistance: "",
    home:{id:String(g.homeId),name:g.homeTeam,short:g.homeTeam,logo:null,score:Number(g.homePoints||0),rank:null},
    away:{id:String(g.awayId),name:g.awayTeam,short:g.awayTeam,logo:null,score:Number(g.awayPoints||0),rank:null}
  }));
}

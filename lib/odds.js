const BASE = "https://api.the-odds-api.com/v4/sports";
const SPORTS = { nfl: "americanfootball_nfl", cfb: "americanfootball_ncaaf" };

function median(values) {
  const nums = values.filter(Number.isFinite).sort((a,b)=>a-b);
  if (!nums.length) return null;
  const m=Math.floor(nums.length/2);
  return nums.length%2 ? nums[m] : (nums[m-1]+nums[m])/2;
}

export async function fetchOdds(sport) {
  const key=process.env.ODDS_API_KEY;
  if (!key) return [];
  const sportKey=SPORTS[sport];
  const url=new URL(`${BASE}/${sportKey}/odds`);
  url.searchParams.set("apiKey",key);
  url.searchParams.set("regions","us");
  url.searchParams.set("markets","h2h,spreads,totals");
  url.searchParams.set("oddsFormat","american");
  const res=await fetch(url,{next:{revalidate:60}});
  if(!res.ok) throw new Error(`Odds API returned ${res.status}`);
  const rows=await res.json();
  return rows.map((e)=>{
    const spreads=[], totals=[];
    for(const b of e.bookmakers||[]) for(const m of b.markets||[]){
      if(m.key==="spreads"){
        const home=(m.outcomes||[]).find(x=>x.name===e.home_team);
        if(home && Number.isFinite(Number(home.point))) spreads.push(Number(home.point));
      }
      if(m.key==="totals"){
        const over=(m.outcomes||[]).find(x=>x.name==="Over");
        if(over && Number.isFinite(Number(over.point))) totals.push(Number(over.point));
      }
    }
    return {id:e.id,sport,home:e.home_team,away:e.away_team,commenceTime:e.commence_time,
      spread:median(spreads),total:median(totals),bookmakers:(e.bookmakers||[]).length};
  });
}

function clean(s){return String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"").replace(/(university|college|football|the)/g,"");}
export function attachOdds(games, odds) {
  return games.map(g=>{
    const hit=odds.find(o=>{
      const time=Math.abs(new Date(o.commenceTime)-new Date(g.date)) < 6*60*60*1000;
      const home=clean(o.home).includes(clean(g.home.name)) || clean(g.home.name).includes(clean(o.home));
      const away=clean(o.away).includes(clean(g.away.name)) || clean(g.away.name).includes(clean(o.away));
      return time && home && away;
    });
    return hit ? {...g,market:{spread:hit.spread,total:hit.total,bookmakers:hit.bookmakers}} : g;
  });
}

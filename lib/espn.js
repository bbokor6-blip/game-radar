const SOURCES = {
  cfb: "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard",
  nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
};

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function rankOf(competitor) {
  const rank = Number(competitor?.curatedRank?.current);
  return Number.isFinite(rank) && rank > 0 && rank <= 25 ? rank : null;
}
function recordOf(competitor) {
  return competitor?.records?.find((r) => r.type === "total")?.summary ||
    competitor?.records?.[0]?.summary || null;
}
function normalizeEvent(event, sport) {
  const comp = event?.competitions?.[0];
  const competitors = comp?.competitors || [];
  const home = competitors.find((x) => x.homeAway === "home") || competitors[0];
  const away = competitors.find((x) => x.homeAway === "away") || competitors[1];
  if (!home || !away) return null;
  const situation = comp?.situation || {};
  const statusType = event?.status?.type || {};
  const detail = statusType.shortDetail || statusType.detail || "";
  return {
    id: `${sport}-${event.id}`, sourceId: event.id, sport, name: event.name, date: event.date,
    state: statusType.state || "pre", completed: Boolean(statusType.completed), status: detail,
    period: num(event?.status?.period), clock: event?.status?.displayClock || "",
    possessionId: situation.possession || null,
    downDistance: situation.shortDownDistanceText || situation.downDistanceText || "",
    home: { id: home.id, name: home.team?.displayName || "Home", short: home.team?.abbreviation || home.team?.shortDisplayName || "HOME", logo: home.team?.logo || null, score: num(home.score), rank: rankOf(home), record: recordOf(home) },
    away: { id: away.id, name: away.team?.displayName || "Away", short: away.team?.abbreviation || away.team?.shortDisplayName || "AWAY", logo: away.team?.logo || null, score: num(away.score), rank: rankOf(away), record: recordOf(away) }
  };
}
function dateKey(date) {
  return date.toISOString().slice(0,10).replaceAll("-","");
}
export async function fetchScoreboard(sport, startDate, endDate) {
  const base = SOURCES[sport];
  if (!base) throw new Error("Unsupported sport");
  const dates = [];
  if (startDate && endDate) {
    const cursor = new Date(startDate + "T12:00:00Z");
    const end = new Date(endDate + "T12:00:00Z");
    while (cursor <= end && dates.length < 8) {
      dates.push(dateKey(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else {
    const now = new Date();
    for (let offset = -2; offset <= 1; offset++) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() + offset);
      dates.push(dateKey(d));
    }
  }
  const extra = sport === "cfb" ? "&groups=80&limit=100" : "&limit=100";
  const urls = [...dates.map((date) => `${base}?dates=${date}${extra}`)];
  if (!startDate || (new Date(startDate) <= new Date() && new Date(endDate) >= new Date())) urls.unshift(`${base}?${extra.slice(1)}`);
  const payloads = await Promise.all(urls.map(async (url) => {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "GameRadar/0.2" },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Score source returned ${response.status}`);
    return response.json();
  }));
  const events = new Map();
  for (const payload of payloads) for (const event of payload.events || []) events.set(event.id, event);
  return [...events.values()].map((event) => normalizeEvent(event, sport)).filter(Boolean);
}

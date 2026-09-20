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

function normalizeEvent(event, sport) {
  const comp = event?.competitions?.[0];
  const competitors = comp?.competitors || [];
  const home = competitors.find((x) => x.homeAway === "home") || competitors[0];
  const away = competitors.find((x) => x.homeAway === "away") || competitors[1];

  if (!home || !away) return null;

  const situation = comp?.situation || {};
  const statusType = event?.status?.type || {};
  const detail = event?.status?.type?.shortDetail || event?.status?.type?.detail || "";

  return {
    id: `${sport}-${event.id}`,
    sourceId: event.id,
    sport,
    name: event.name,
    date: event.date,
    state: statusType.state || "pre",
    completed: Boolean(statusType.completed),
    status: detail,
    period: num(event?.status?.period),
    clock: event?.status?.displayClock || "",
    possessionId: situation?.possession || null,
    downDistance: situation?.shortDownDistanceText || situation?.downDistanceText || "",
    home: {
      id: home.id,
      name: home.team?.displayName || home.team?.shortDisplayName || "Home",
      short: home.team?.abbreviation || home.team?.shortDisplayName || "HOME",
      logo: home.team?.logo || null,
      score: num(home.score),
      rank: rankOf(home)
    },
    away: {
      id: away.id,
      name: away.team?.displayName || away.team?.shortDisplayName || "Away",
      short: away.team?.abbreviation || away.team?.shortDisplayName || "AWAY",
      logo: away.team?.logo || null,
      score: num(away.score),
      rank: rankOf(away)
    }
  };
}

export async function fetchScoreboard(sport) {
  const url = SOURCES[sport];
  if (!url) throw new Error("Unsupported sport");

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "GameRadar/0.1"
    },
    next: { revalidate: 20 }
  });

  if (!response.ok) {
    throw new Error(`Score source returned ${response.status}`);
  }

  const payload = await response.json();
  return (payload.events || [])
    .map((event) => normalizeEvent(event, sport))
    .filter(Boolean);
}

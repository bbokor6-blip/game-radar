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
  const odds = comp?.odds?.find((o) => o?.details || o?.spread != null) || comp?.odds?.[0] || null;
  const spread = odds?.spread == null ? null : Number(odds.spread);
  const overUnder = odds?.overUnder == null ? null : Number(odds.overUnder);
  const homeMoneyline = odds?.homeTeamOdds?.moneyLine == null ? null : Number(odds.homeTeamOdds.moneyLine);
  const awayMoneyline = odds?.awayTeamOdds?.moneyLine == null ? null : Number(odds.awayTeamOdds.moneyLine);
  const homeSpreadOdds = odds?.homeTeamOdds?.spreadOdds == null ? null : Number(odds.homeTeamOdds.spreadOdds);
  const awaySpreadOdds = odds?.awayTeamOdds?.spreadOdds == null ? null : Number(odds.awayTeamOdds.spreadOdds);
  const overOdds = odds?.overOdds == null ? null : Number(odds.overOdds);
  const underOdds = odds?.underOdds == null ? null : Number(odds.underOdds);
  return {
    id: `${sport}-${event.id}`, sourceId: event.id, sport, name: event.name, date: event.date,
    week: Number(event?.week?.number || comp?.week?.number) || null,
    seasonYear: Number(event?.season?.year || comp?.season?.year) || null,
    state: statusType.state || "pre", completed: Boolean(statusType.completed), status: detail,
    period: num(event?.status?.period), clock: event?.status?.displayClock || "",
    possessionId: situation.possession || null,
    downDistance: situation.shortDownDistanceText || situation.downDistanceText || "",
    market: odds ? {
      details: odds.details || null,
      spread: Number.isFinite(spread) ? spread : null,
      overUnder: Number.isFinite(overUnder) ? overUnder : null,
      provider: odds.provider?.name || null,
      homeMoneyline: Number.isFinite(homeMoneyline) ? homeMoneyline : null,
      awayMoneyline: Number.isFinite(awayMoneyline) ? awayMoneyline : null,
      homeSpreadOdds: Number.isFinite(homeSpreadOdds) ? homeSpreadOdds : null,
      awaySpreadOdds: Number.isFinite(awaySpreadOdds) ? awaySpreadOdds : null,
      overOdds: Number.isFinite(overOdds) ? overOdds : null,
      underOdds: Number.isFinite(underOdds) ? underOdds : null
    } : null,
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
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) { console.error(`Score source ${url} returned ${response.status}`); return { events: [] }; }
    return response.json();
  }));
  const events = new Map();
  for (const payload of payloads) for (const event of payload.events || []) events.set(event.id, event);
  return [...events.values()].map((event) => normalizeEvent(event, sport)).filter(Boolean);
}

export async function fetchSeasonScoreboard(sport, year) {
  const base = SOURCES[sport];
  if (!base) throw new Error("Unsupported sport");
  const extra = sport === "cfb" ? "&groups=80&limit=1000" : "&limit=1000";
  const url = base + "?dates=" + year + "&seasontype=2" + extra;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 900 }
  });
  if (!response.ok) throw new Error("Season scoreboard returned " + response.status);
  const payload = await response.json();
  return (payload.events || []).map((event) => normalizeEvent(event, sport)).filter(Boolean);
}

export async function fetchConsensusOdds(sport, eventId) {
  const league = sport === "cfb" ? "college-football" : "nfl";
  const url = "https://sports.core.api.espn.com/v2/sports/football/leagues/" + league + "/events/" + eventId + "/competitions/" + eventId + "/odds";
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) return [];
  const payload = await response.json();
  return (payload.items || []).map((item) => {
    const spread = Number(item?.spread);
    const overUnder = Number(item?.overUnder);
    const homeFavorite = Boolean(item?.homeTeamOdds?.favorite);
    const awayFavorite = Boolean(item?.awayTeamOdds?.favorite);
    const absSpread = Number.isFinite(spread) ? Math.abs(spread) : null;
    let homeMargin = null;
    if (absSpread != null) {
      if (homeFavorite) homeMargin = absSpread;
      else if (awayFavorite) homeMargin = -absSpread;
    }
    return {
      provider: item?.provider?.name || "Public market",
      providerId: item?.provider?.id || null,
      details: item?.details || null,
      spread: Number.isFinite(spread) ? spread : null,
      homeMargin,
      overUnder: Number.isFinite(overUnder) ? overUnder : null,
      homeSpreadOdds: Number(item?.homeTeamOdds?.spreadOdds) || null,
      awaySpreadOdds: Number(item?.awayTeamOdds?.spreadOdds) || null,
      overOdds: Number(item?.overOdds) || null,
      underOdds: Number(item?.underOdds) || null
    };
  }).filter((item) => item.homeMargin != null || item.overUnder != null);
}

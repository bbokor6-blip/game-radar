import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEASON = Number(process.argv[2]) || new Date().getUTCFullYear();
const SPORTS = [
  { league: "nfl", slug: "nfl", weeks: 18 },
  { league: "cfb", slug: "college-football", weeks: 16, groups: "80" }
];

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function recordOf(competitor) {
  return competitor?.records?.find((record) => record.type === "total")?.summary ||
    competitor?.records?.[0]?.summary || null;
}

function teamRow(competitor) {
  return {
    id: String(competitor?.id || competitor?.team?.id || ""),
    name: competitor?.team?.displayName || null,
    short: competitor?.team?.abbreviation || competitor?.team?.shortDisplayName || null,
    score: numberOrNull(competitor?.score),
    record: recordOf(competitor)
  };
}

function normalize(event, league) {
  const competition = event?.competitions?.[0];
  const competitors = competition?.competitors || [];
  const home = competitors.find((team) => team.homeAway === "home");
  const away = competitors.find((team) => team.homeAway === "away");
  if (!competition || !home || !away) return null;
  const status = event?.status?.type || {};
  const odds = competition?.odds?.find((item) => item?.details || item?.spread != null) || null;
  return {
    league,
    season: Number(event?.season?.year) || SEASON,
    seasonType: Number(event?.season?.type) || 2,
    week: Number(event?.week?.number || competition?.week?.number) || null,
    eventId: String(event.id),
    competitionId: String(competition.id || event.id),
    kickoff: event.date,
    state: status.state || "pre",
    completed: Boolean(status.completed),
    status: status.shortDetail || status.detail || null,
    home: teamRow(home),
    away: teamRow(away),
    neutralSite: Boolean(competition.neutralSite),
    conferenceGame: league === "cfb" ? Boolean(competition.conferenceCompetition) : false,
    venue: competition?.venue?.fullName || null,
    broadcasts: [...new Set((competition?.broadcasts || []).flatMap((broadcast) => broadcast?.names || []).filter(Boolean))],
    market: odds ? {
      details: odds.details || null,
      spread: numberOrNull(odds.spread),
      total: numberOrNull(odds.overUnder),
      provider: odds?.provider?.name || null
    } : null,
    sourceUrl: `https://www.espn.com/${league === "cfb" ? "college-football" : "nfl"}/game/_/gameId/${event.id}`
  };
}

async function fetchWeek(sport, week) {
  const params = new URLSearchParams({
    dates: String(SEASON),
    seasontype: "2",
    week: String(week),
    limit: "100"
  });
  if (sport.groups) params.set("groups", sport.groups);
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/${sport.slug}/scoreboard?${params}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${sport.league} week ${week}: ESPN returned ${response.status}`);
  const payload = await response.json();
  return (payload.events || []).map((event) => normalize(event, sport.league)).filter(Boolean);
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(games) {
  const headers = [
    "league", "season", "week", "event_id", "kickoff_utc", "state", "completed",
    "away_team", "away_abbr", "away_score", "away_record", "home_team", "home_abbr",
    "home_score", "home_record", "neutral_site", "conference_game", "venue", "broadcasts",
    "line", "spread", "total", "market_provider", "source_url"
  ];
  const rows = games.map((game) => [
    game.league.toUpperCase(), game.season, game.week, game.eventId, game.kickoff, game.state, game.completed,
    game.away.name, game.away.short, game.away.score, game.away.record, game.home.name, game.home.short,
    game.home.score, game.home.record, game.neutralSite, game.conferenceGame, game.venue,
    game.broadcasts.join(" / "), game.market?.details, game.market?.spread, game.market?.total,
    game.market?.provider, game.sourceUrl
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

const results = await Promise.all(SPORTS.flatMap((sport) =>
  Array.from({ length: sport.weeks }, (_, index) => fetchWeek(sport, index + 1))
));
const byId = new Map(results.flat().map((game) => [`${game.league}-${game.eventId}`, game]));
const games = [...byId.values()].sort((a, b) =>
  a.league.localeCompare(b.league) || new Date(a.kickoff) - new Date(b.kickoff) || a.eventId.localeCompare(b.eventId)
);
const generatedAt = new Date().toISOString();
const snapshot = {
  schemaVersion: 1,
  generatedAt,
  season: SEASON,
  source: "ESPN week-by-week regular-season scoreboards",
  sourcePages: {
    nfl: "https://www.espn.com/nfl/scoreboard",
    cfb: "https://www.espn.com/college-football/scoreboard"
  },
  counts: Object.fromEntries(SPORTS.map((sport) => {
    const rows = games.filter((game) => game.league === sport.league);
    return [sport.league, { games: rows.length, completed: rows.filter((game) => game.completed).length }];
  })),
  games
};

const dataDir = resolve(ROOT, "data");
await mkdir(dataDir, { recursive: true });
await writeFile(resolve(dataDir, "football-source-of-truth.json"), JSON.stringify(snapshot, null, 2) + "\n");
await writeFile(resolve(dataDir, "football-source-of-truth.csv"), toCsv(games));
console.log(JSON.stringify({ generatedAt, season: SEASON, counts: snapshot.counts }, null, 2));

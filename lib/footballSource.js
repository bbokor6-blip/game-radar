import snapshot from "../data/football-source-of-truth.json";
import { conferenceForTeam, conferenceTier } from "./conferences";

function normalizedTeam(team){
  const conference=conferenceForTeam({displayName:team?.name,abbreviation:team?.short});
  return {
    ...team,
    location:team?.name,
    nickname:null,
    rank:null,
    logo:null,
    conference,
    conferenceTier:conferenceTier(conference),
    subdivision:conference?"FBS":"FCS_OR_OTHER"
  };
}

function normalizedGame(game){
  return {
    id:`${game.league}-${game.eventId}`,
    sourceId:game.eventId,
    competitionId:game.competitionId,
    sport:game.league,
    name:`${game.away.name} at ${game.home.name}`,
    date:game.kickoff,
    week:game.week,
    seasonYear:game.season,
    seasonType:game.seasonType,
    state:game.state,
    completed:game.completed,
    status:game.status||"",
    venue:game.venue,
    neutralSite:game.neutralSite,
    conferenceGame:game.conferenceGame,
    broadcasts:game.broadcasts||[],
    market:game.market?{
      details:game.market.details,
      spread:game.market.spread,
      overUnder:game.market.total,
      provider:game.market.provider
    }:null,
    home:normalizedTeam(game.home),
    away:normalizedTeam(game.away)
  };
}

export function seasonSnapshot(league,year,throughWeek=null){
  return snapshot.games
    .filter(game=>game.league===league&&Number(game.season)===Number(year))
    .filter(game=>throughWeek==null||Number(game.week)<=Number(throughWeek))
    .map(normalizedGame);
}

export function mergeWithSeasonSnapshot(liveGames,league,year,throughWeek=null){
  const merged=new Map(seasonSnapshot(league,year,throughWeek).map(game=>[game.id,game]));
  for(const game of liveGames||[]){
    const fallback=merged.get(game.id);
    merged.set(game.id,fallback?{
      ...fallback,
      ...game,
      home:{...fallback.home,...game.home},
      away:{...fallback.away,...game.away},
      market:game.market||fallback.market
    }:game);
  }
  return [...merged.values()].sort((a,b)=>new Date(a.date)-new Date(b.date));
}

export function footballSourceMetadata(){
  return {
    generatedAt:snapshot.generatedAt,
    season:snapshot.season,
    source:snapshot.source,
    counts:snapshot.counts
  };
}

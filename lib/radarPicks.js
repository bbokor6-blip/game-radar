export function selectOfficialRadarPicks(games,{maxPicks=5,minBetIndex=70,minGameIndex=0}={}){
  return (games||[])
    .filter(game=>game?.bestOpportunity)
    .filter(game=>(game.bestOpportunity.index||0)>=minBetIndex)
    .filter(game=>(game.gameIndex?.score||game.interest?.score||0)>=minGameIndex)
    .sort((a,b)=>(b.bestOpportunity?.index||0)-(a.bestOpportunity?.index||0)||(b.gameIndex?.score||b.interest?.score||0)-(a.gameIndex?.score||a.interest?.score||0))
    .slice(0,maxPicks)
    .map(game=>({
      gameId:game.id,
      matchup:(game.away?.location||game.away?.short)+" @ "+(game.home?.location||game.home?.short),
      gameDate:game.date,
      type:game.bestOpportunity.type,
      pick:game.bestOpportunity.pick,
      americanOdds:game.bestOpportunity.americanOdds??null,
      betRadarIndex:game.bestOpportunity.index,
      gameIndex:game.gameIndex?.score||game.interest?.score||0,
      radarIndex:game.gameIndex?.score||game.interest?.score||0,
      label:game.bestOpportunity.label,
      why:game.bestOpportunity.why,
      line:game.marketConsensus?.line||game.market?.details||null,
      result:"PENDING"
    }));
}

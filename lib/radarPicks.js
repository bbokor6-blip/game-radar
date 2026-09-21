export function selectOfficialRadarPicks(games,{maxPicks=5,minBetIndex=70,minRadarIndex=70}={}){
  return (games||[])
    .filter(game=>game?.bestOpportunity)
    .filter(game=>(game.bestOpportunity.index||0)>=minBetIndex)
    .filter(game=>(game.radarIndex?.score||0)>=minRadarIndex)
    .sort((a,b)=>(b.radarIndex?.score||0)-(a.radarIndex?.score||0)||(b.bestOpportunity?.index||0)-(a.bestOpportunity?.index||0))
    .slice(0,maxPicks)
    .map(game=>({
      gameId:game.id,
      matchup:(game.away?.location||game.away?.short)+" @ "+(game.home?.location||game.home?.short),
      gameDate:game.date,
      type:game.bestOpportunity.type,
      pick:game.bestOpportunity.pick,
      americanOdds:game.bestOpportunity.americanOdds??null,
      betRadarIndex:game.bestOpportunity.index,
      radarIndex:game.radarIndex?.score||0,
      label:game.bestOpportunity.label,
      why:game.bestOpportunity.why,
      line:game.marketConsensus?.line||game.market?.details||null,
      result:"PENDING"
    }));
}

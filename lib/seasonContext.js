function teamKey(team){
  return String(team?.id||team?.short||team?.name||"");
}

function resultFor(team,opponent){
  const pointsFor=Number(team?.score||0);
  const pointsAgainst=Number(opponent?.score||0);
  return pointsFor>pointsAgainst?"W":pointsFor<pointsAgainst?"L":"T";
}

function formatRecord(results){
  const wins=results.filter(x=>x.result==="W").length;
  const losses=results.filter(x=>x.result==="L").length;
  const ties=results.filter(x=>x.result==="T").length;
  return ties?`${wins}-${losses}-${ties}`:`${wins}-${losses}`;
}

function teamResults(history,team,targetGame){
  const id=teamKey(team);
  if(!id)return [];
  const targetTime=new Date(targetGame?.date||0).getTime();
  const includeCurrent=targetGame?.state==="post"||targetGame?.completed;

  return (history||[])
    .filter(game=>{
      if(game?.state!=="post"&&!game?.completed)return false;
      const involved=teamKey(game.home)===id||teamKey(game.away)===id;
      if(!involved)return false;
      if(String(game.id)===String(targetGame?.id))return includeCurrent;
      return new Date(game.date).getTime()<targetTime;
    })
    .map(game=>{
      const home=teamKey(game.home)===id;
      const side=home?game.home:game.away;
      const opponent=home?game.away:game.home;
      const pointsFor=Number(side?.score||0);
      const pointsAgainst=Number(opponent?.score||0);
      return {
        gameId:game.id,
        date:game.date,
        result:resultFor(side,opponent),
        pointsFor,
        pointsAgainst,
        score:`${pointsFor}-${pointsAgainst}`,
        opponent:opponent?.location||opponent?.name||opponent?.short||"Opponent",
        opponentShort:opponent?.short||null,
        homeAway:home?"home":"away"
      };
    })
    .sort((a,b)=>new Date(a.date)-new Date(b.date));
}

function enrichTeam(team,history,targetGame){
  const results=teamResults(history,team,targetGame);
  const previous=results.filter(x=>String(x.gameId)!==String(targetGame?.id));
  const recentResults=previous.slice(-3).reverse();
  return {
    ...team,
    record:results.length?formatRecord(results):team?.record||null,
    recordSource:results.length?"season-results":team?.record?"scoreboard":"unavailable",
    lastGame:recentResults[0]||null,
    recentResults
  };
}

export function enrichGamesWithSeasonContext(games,history){
  return (games||[]).map(game=>({
    ...game,
    home:enrichTeam(game.home,history,game),
    away:enrichTeam(game.away,history,game)
  }));
}

export function seasonCoverage(history){
  const completed=(history||[]).filter(game=>game?.state==="post"||game?.completed);
  const weeks=[...new Set(completed.map(game=>Number(game.week)).filter(Number.isFinite))].sort((a,b)=>a-b);
  return {
    completedGames:completed.length,
    weeks,
    firstGame:completed.length?completed.slice().sort((a,b)=>new Date(a.date)-new Date(b.date))[0].date:null,
    latestGame:completed.length?completed.slice().sort((a,b)=>new Date(b.date)-new Date(a.date))[0].date:null
  };
}

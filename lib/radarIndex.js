function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,n));}

export function buildRadarIndex(game, bettingIndex=null){
  const excitement=Number(game?.interest?.score||0);
  const marketProxy=Number(game?.marketInterest?.score||0);
  const betting=Number.isFinite(Number(bettingIndex))&&Number(bettingIndex)>0
    ? Number(bettingIndex)
    : marketProxy>0?marketProxy:35;

  let score=Math.round((betting*0.60)+(excitement*0.40));

  // An elite RadarIndex should require both a real betting case and a game
  // people actually care about. These caps prevent one dimension from
  // overwhelming the combined metric.
  if(betting<55)score=Math.min(score,74);
  if(excitement<45)score=Math.min(score,82);
  if(betting>=80&&excitement>=80)score+=3;

  score=clamp(score);
  return {
    score,
    betting:Math.round(betting),
    excitement:Math.round(excitement),
    tier:score>=90?"Radar Game":score>=80?"Strong Radar":score>=68?"On the Radar":"Long Shot",
    methodology:"60% betting signal · 40% matchup excitement"
  };
}

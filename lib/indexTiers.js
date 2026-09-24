function normalizeScore(value){
  const score=Number(value);
  return Number.isFinite(score)?Math.max(0,Math.min(100,Math.round(score))):0;
}

export function gameIndexTier(value){
  const score=normalizeScore(value);
  if(score>=80)return {key:"green",label:"Must Watch",range:"80–100"};
  if(score>=65)return {key:"yellow",label:"Worth Watching",range:"65–79"};
  if(score>=50)return {key:"orange",label:"On the Radar",range:"50–64"};
  return {key:"red",label:"Low Interest",range:"0–49"};
}

export function betIndexTier(value){
  const score=normalizeScore(value);
  if(score>=80)return {key:"green",label:"Best Bet",range:"80–100"};
  if(score>=70)return {key:"yellow",label:"Strong",range:"70–79"};
  if(score>=55)return {key:"orange",label:"Lean",range:"55–69"};
  return {key:"red",label:"Pass",range:"0–54"};
}

export function gameIndexScore(game){
  return normalizeScore(game?.gameIndex?.score??game?.interest?.score);
}

export function betIndexScore(game){
  return normalizeScore(game?.betIndex?.score??game?.bestOpportunity?.index??game?.preferredPick?.betRadarIndex);
}

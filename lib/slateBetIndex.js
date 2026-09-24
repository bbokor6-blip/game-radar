import { betIndexTier } from "./indexTiers.js";
import { pickConfidenceBand } from "./pickCalibration.js";

// BetIndex ranks opportunities within the current slate. The raw model score
// remains available for calibration and should never be presented as a win rate.
export function calibrateSlateBetIndexes(games){
  const eligible=games.filter(game=>{
    const spread=game.opportunities?.spread;
    const quality=spread?.evidenceQuality;
    return game.marketConsensus?.available&&Number.isFinite(game.marketConsensus.homeMargin)&&
      quality?.sample>=2&&quality.componentAgreement&&
      !game.preferredPick?.fullSlateFallback&&
      Math.abs(spread.adjustedModelEdge)>=0.5;
  }).sort((a,b)=>{
    const score=game=>{
      const spread=game.opportunities.spread;
      const edge=Math.abs(spread.adjustedModelEdge);
      return spread.index+(spread.americanOdds!=null?10:0)+Math.min(4,edge)*.3-
        Math.max(0,edge-8)*1.5-Math.max(0,Math.abs(game.marketConsensus.homeMargin)-14)*.3;
    };
    return Number(b.opportunities.spread.americanOdds!=null)-Number(a.opportunities.spread.americanOdds!=null)||
      score(b)-score(a)||String(a.id).localeCompare(String(b.id));
  });
  const featuredCount=Math.min(eligible.length,Math.ceil(games.length*.30));
  const bestCount=Math.min(eligible.slice(0,featuredCount).filter(game=>game.opportunities.spread.americanOdds!=null).length,Math.ceil(games.length*.08));
  const promoted=new Map(eligible.slice(0,featuredCount).map((game,rank)=>[game.id,{rank,best:rank<bestCount}]));
  return games.map(game=>{
    const placement=promoted.get(game.id);
    if(!placement)return game;
    const spread=game.opportunities.spread;
    const rawIndex=spread.index;
    const index=placement.best?Math.max(rawIndex,80+Math.max(0,bestCount-placement.rank-1)):
      Math.max(rawIndex,70+Math.floor((featuredCount-placement.rank-1)*9/Math.max(1,featuredCount-bestCount)));
    const relativeSlate={rank:placement.rank+1,eligible:eligible.length,slateSize:games.length,rawIndex};
    const why=`Top ${placement.rank+1} of ${games.length} on this slate by the model's spread signal. The raw signal scored ${rawIndex}; this ${index} BetIndex is a relative slate ranking, not an estimated win rate. ${spread.americanOdds==null?"The sportsbook price is unavailable, so confirm the line and odds before betting. ":""}${game.marketConsensus.providerCount===1?"Only one sportsbook line is available. ":""}${spread.why}`;
    const best={...spread,index,label:pickConfidenceBand(index),highConviction:index>=80,noBrainer:false,why,relativeSlate};
    return {...game,
      opportunities:{...game.opportunities,spread:best},bestOpportunity:best,
      adjustedBettingIndex:index,opportunityIndex:index,
      betIndex:{score:index,tier:betIndexTier(index).label,color:betIndexTier(index).key,rawScore:rawIndex,calibration:"slate-relative"},
      preferredPick:{...game.preferredPick,type:"SPREAD",side:best.side,pick:best.pick,americanOdds:best.americanOdds,
        betRadarIndex:index,feedbackAdjustedBetIndex:rawIndex,confidenceBand:pickConfidenceBand(index),
        label:best.label,why,relativeSlate,feedback:best.feedback,fullSlateFallback:false}
    };
  });
}

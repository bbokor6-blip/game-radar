export function calibrateSlateGameIndexes(rankedGames,tierLabel=()=>null){
  if(rankedGames.length<8)return rankedGames;
  const bands=[
    {high:95,low:80},
    {high:79,low:65},
    {high:64,low:50},
    {high:49,low:35}
  ];
  return rankedGames.map((game,rank)=>{
    const bucket=Math.min(3,Math.floor(rank*4/rankedGames.length));
    const start=Math.ceil(bucket*rankedGames.length/4);
    const end=Math.max(start+1,Math.ceil((bucket+1)*rankedGames.length/4));
    const position=rank-start;
    const slots=Math.max(1,end-start-1);
    const band=bands[bucket];
    const score=Math.round(band.high-((band.high-band.low)*position/slots));
    return {
      ...game,
      interest:{
        ...game.interest,
        score,
        tier:tierLabel(score),
        rawScore:game.interest.score,
        slateRank:rank+1,
        slateSize:rankedGames.length,
        calibration:"slate-quartile"
      }
    };
  });
}

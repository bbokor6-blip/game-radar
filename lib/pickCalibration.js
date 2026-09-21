function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,n));}

export function calibratePickIndex(index,{league,type}={}){
  let score=Math.round(clamp(Number(index)||0));

  // Totals have not cleared break-even in walk-forward testing. Keep collecting
  // them, but do not let a totals trend present as a high-confidence play. The
  // totals model already includes its evidence adjustment, so do not subtract
  // points again here.
  if(type==="TOTAL")score=Math.min(69,score);

  // Compress the uncertain college middle band gently and monotonically instead
  // of creating a cliff where a raw 70 could score below a raw 69.
  if(league==="cfb"&&type==="SPREAD"&&score>=70&&score<80){
    score=70+Math.round((score-70)*.85);
  }

  return Math.round(clamp(score));
}

export function pickConfidenceBand(index){
  const score=Number(index)||0;
  if(score>=80)return "BEST BET";
  if(score>=70)return "STRONG";
  if(score>=60)return "LEAN";
  return "PASS";
}

export function isHighConfidence(index){return (Number(index)||0)>=80;}

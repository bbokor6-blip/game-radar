function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,n));}

export function calibratePickIndex(index,{league,type}={}){
  let score=Math.round(clamp(Number(index)||0));

  // Totals have not cleared break-even in walk-forward testing. Keep collecting
  // them, but do not let a totals trend present as a high-confidence play.
  if(type==="TOTAL")score=Math.min(69,score-6);

  // College signals in the old 70s band were materially overconfident. Preserve
  // genuinely elite 80+ signals while shrinking the unstable middle band.
  if(league==="cfb"&&type==="SPREAD"&&score>=70&&score<80)score-=8;

  return Math.round(clamp(score));
}

export function pickConfidenceBand(index){
  const score=Number(index)||0;
  if(score>=80)return "HIGH CONFIDENCE";
  if(score>=70)return "MODEL LEAN";
  return "FULL-SLATE PICK";
}

export function isHighConfidence(index){return (Number(index)||0)>=80;}

function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function band(index){
  const n=Number(index)||0;
  if(n>=80)return "80+";
  if(n>=70)return "70-79";
  return "<70";
}
function summarize(picks){
  const graded=(picks||[]).filter(p=>p&&p.type!=="PASS"&&["W","L","PUSH"].includes(p.result));
  const wins=graded.filter(p=>p.result==="W").length;
  const losses=graded.filter(p=>p.result==="L").length;
  const pushes=graded.filter(p=>p.result==="PUSH").length;
  const decisions=wins+losses;
  // Beta(3,3) prior deliberately shrinks small samples toward 50%.
  const posterior=(wins+3)/(decisions+6);
  return {wins,losses,pushes,decisions,winPct:decisions?wins/decisions:null,posterior};
}
export function buildFeedbackProfile(ledger){
  const picks=(ledger?.weeks||[]).flatMap(w=>(w.picks||[]).map(p=>({...p,league:p.league||w.league})));
  const graded=picks.filter(p=>p.type!=="PASS"&&["W","L","PUSH"].includes(p.result));
  const byType={};
  const byBand={};
  const byLeague={};
  for(const key of ["SPREAD","TOTAL"])byType[key]=summarize(graded.filter(p=>p.type===key));
  for(const key of ["70-79","80+"])byBand[key]=summarize(graded.filter(p=>band(p.betRadarIndex)===key));
  for(const key of ["nfl","cfb"])byLeague[key]=summarize(graded.filter(p=>p.league===key));
  return {overall:summarize(graded),byType,byBand,byLeague};
}
export function feedbackForPick(profile,{league,type,index}){
  const parts=[
    profile?.byType?.[type],
    profile?.byBand?.[band(index)],
    profile?.byLeague?.[league]
  ].filter(x=>x&&x.decisions>=6);
  if(!parts.length)return {modifier:0,sample:0,note:"Building sample"};
  const weighted=parts.reduce((s,x)=>s+(x.posterior*x.decisions),0)/parts.reduce((s,x)=>s+x.decisions,0);
  const modifier=clamp(Math.round((weighted-.5)*20),-4,4);
  const sample=Math.max(...parts.map(x=>x.decisions));
  return {
    modifier,
    sample,
    winRate:Math.round(weighted*1000)/10,
    note:modifier>0?"Historical results support this profile":modifier<0?"Historical results temper this profile":"Historical results are neutral"
  };
}

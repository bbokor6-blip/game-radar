function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function band(index){
  const n=Number(index)||0;
  if(n>=80)return "80+";
  if(n>=70)return "70-79";
  if(n>=55)return "55-69";
  return "<55";
}
function indexForBand(pick,{useAnalysisIndex=false}={}){
  if(useAnalysisIndex&&pick?.retrospective&&Number.isFinite(Number(pick.analysisBetIndex)))return Number(pick.analysisBetIndex);
  return Number(pick?.betRadarIndex)||0;
}
function calibrationWeight(pick,{includeExcluded=false,retrospectiveWeight=0}={}){
  if(!pick?.excludeFromCalibration)return 1;
  if(includeExcluded)return 1;
  if(pick.retrospective&&retrospectiveWeight>0)return retrospectiveWeight;
  return 0;
}
function summarize(picks,options={}){
  const graded=(picks||[]).filter(p=>p&&p.type!=="PASS"&&["W","L","PUSH"].includes(p.result));
  const wins=graded.filter(p=>p.result==="W").length;
  const losses=graded.filter(p=>p.result==="L").length;
  const pushes=graded.filter(p=>p.result==="PUSH").length;
  const decisions=wins+losses;
  const weightedWins=graded.filter(p=>p.result==="W").reduce((sum,p)=>sum+calibrationWeight(p,options),0);
  const weightedLosses=graded.filter(p=>p.result==="L").reduce((sum,p)=>sum+calibrationWeight(p,options),0);
  const effectiveDecisions=weightedWins+weightedLosses;
  // A 20-decision neutral prior keeps a short streak from rewriting confidence.
  const posterior=(weightedWins+10)/(effectiveDecisions+20);
  return {wins,losses,pushes,decisions,winPct:decisions?wins/decisions:null,weightedWins,weightedLosses,effectiveDecisions,posterior};
}
export function buildFeedbackProfile(ledger,{includeExcluded=false,retrospectiveWeight=0,useAnalysisIndex=false}={}){
  const options={includeExcluded,retrospectiveWeight,useAnalysisIndex};
  const picks=(ledger?.weeks||[]).flatMap(w=>(w.picks||[]).map(p=>({...p,league:p.league||w.league})))
    .filter(p=>calibrationWeight(p,options)>0);
  const graded=picks.filter(p=>p.type!=="PASS"&&["W","L","PUSH"].includes(p.result));
  const byType={};
  const byBand={};
  const byLeague={};
  const byLeagueType={};
  for(const key of ["SPREAD","TOTAL"])byType[key]=summarize(graded.filter(p=>p.type===key),options);
  for(const key of ["<55","55-69","70-79","80+"])byBand[key]=summarize(graded.filter(p=>band(indexForBand(p,options))===key),options);
  for(const key of ["nfl","cfb"])byLeague[key]=summarize(graded.filter(p=>p.league===key),options);
  for(const league of ["nfl","cfb"])for(const type of ["SPREAD","TOTAL"]){
    byLeagueType[league+":"+type]=summarize(graded.filter(p=>p.league===league&&p.type===type),options);
  }
  return {overall:summarize(graded,options),byType,byBand,byLeague,byLeagueType,retrospectiveWeight,useAnalysisIndex};
}
export function feedbackForPick(profile,{league,type,index}){
  const parts=[
    profile?.byType?.[type],
    profile?.byBand?.[band(index)],
    profile?.byLeague?.[league],
    profile?.byLeagueType?.[league+":"+type]
  ].filter(x=>x&&x.effectiveDecisions>=8);
  if(!parts.length)return {modifier:0,sample:0,note:"Building sample"};
  // Compare the shrunk hit rate with the approximate -110 break-even rate.
  // Overlapping cohorts are averaged rather than pooled, avoiding double count.
  const weighted=parts.reduce((s,x)=>s+x.posterior,0)/parts.length;
  const modifier=clamp(Math.round((weighted-.524)*35),-6,6);
  const sample=Math.max(...parts.map(x=>x.decisions));
  const effectiveSample=Math.round(Math.max(...parts.map(x=>x.effectiveDecisions))*10)/10;
  return {
    modifier,
    sample,
    effectiveSample,
    winRate:Math.round(weighted*1000)/10,
    note:modifier>0?"Historical results support this profile":modifier<0?"Historical results temper this profile":"Historical results are neutral"
  };
}

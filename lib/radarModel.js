function mean(values){
  return values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0;
}

function weightedMean(entries,valueOf){
  const usable=entries.filter(entry=>Number.isFinite(valueOf(entry))&&Number(entry.weight)>0);
  const weight=usable.reduce((sum,entry)=>sum+Number(entry.weight),0);
  return weight?usable.reduce((sum,entry)=>sum+(valueOf(entry)*Number(entry.weight)),0)/weight:0;
}

function median(values){
  const a=values.filter(Number.isFinite).slice().sort((x,y)=>x-y);
  if(!a.length)return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}

function stdev(values){
  if(values.length<2)return 0;
  const m=mean(values);
  return Math.sqrt(mean(values.map(v=>(v-m)*(v-m))));
}

function clamp(n,min,max){return Math.max(min,Math.min(max,n));}

function erf(x){
  const sign=x<0?-1:1;
  const a=Math.abs(x);
  const t=1/(1+0.3275911*a);
  const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-a*a);
  return sign*y;
}

function normalCdf(z){return .5*(1+erf(z/Math.sqrt(2)));}

function hfa(sport){return sport==='nfl'?1.5:2.5;}

function teamKey(team){return String(team?.id||team?.short||team?.name||'');}

function blankTeam(team){
  return {
    id:teamKey(team),short:team?.short||'',games:0,effectiveGames:0,pf:0,pa:0,entries:[],
    subdivision:team?.subdivision||null,priorRating:Number(team?.priorRating)||0
  };
}

function crossSubdivisionWeight(game,sport){
  if(sport!=="cfb")return 1;
  const labels=[game.home?.subdivision,game.away?.subdivision];
  return labels.includes("FBS")&&labels.includes("FCS_OR_OTHER")?0.35:1;
}

export function buildPowerModel(games,sport){
  const completed=games.filter(g=>g.state==='post').slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
  const teams=new Map();
  const homeField=hfa(sport);
  const priorGames=sport==='nfl'?3:5;
  const marginCap=sport==='nfl'?28:35;
  let pointSum=0,appearances=0;

  function get(team){
    const id=teamKey(team);
    if(!teams.has(id))teams.set(id,blankTeam(team));
    return teams.get(id);
  }

  for(const game of completed){
    const hs=Number(game.home.score)||0,as=Number(game.away.score)||0;
    const home=get(game.home),away=get(game.away);
    const gameHomeField=game.neutralSite?0:homeField;
    const weight=crossSubdivisionWeight(game,sport);
    const homeMargin=clamp(hs-as-gameHomeField,-marginCap,marginCap);
    home.games++;away.games++;
    home.effectiveGames+=weight;away.effectiveGames+=weight;
    home.pf+=hs*weight;home.pa+=as*weight;away.pf+=as*weight;away.pa+=hs*weight;
    home.entries.push({date:game.date,margin:homeMargin,opp:away.id,weight});
    away.entries.push({date:game.date,margin:-homeMargin,opp:home.id,weight});
    pointSum+=(hs+as)*weight;appearances+=2*weight;
  }

  const leagueAvg=appearances?pointSum/appearances:(sport==='nfl'?22.5:28);
  let ratings=new Map();
  for(const [id,t] of teams)ratings.set(id,t.priorRating);

  for(let iteration=0;iteration<8;iteration++){
    const next=new Map();
    for(const [id,t] of teams){
      const observedWeight=t.entries.reduce((sum,e)=>sum+e.weight,0);
      const observed=t.entries.reduce((sum,e)=>sum+((e.margin+(ratings.get(e.opp)||0))*e.weight),0);
      const value=(observed+(t.priorRating*priorGames))/(observedWeight+priorGames);
      next.set(id,value);
    }
    const center=mean([...next.values()]);
    ratings=new Map([...next].map(([id,v])=>[id,v-center]));
  }

  const output=new Map();
  for(const [id,t] of teams){
    const recent=t.entries.slice(-3);
    const recentMargin=recent.length?weightedMean(recent,e=>e.margin):0;
    const sampleWeight=clamp(t.games/4,0,1);
    const ratingReliability=clamp(t.effectiveGames/(t.effectiveGames+priorGames),0,1);
    const srs=ratings.get(id)||0;
    // Model v5 regularizes disconnected early-season schedules toward a neutral
    // prior. Recent margin is reliability-weighted so one blowout cannot
    // masquerade as a stable team-strength estimate.
    const power=.78*srs+.22*(recentMargin*ratingReliability);
    const offense=t.effectiveGames?leagueAvg+(t.pf/t.effectiveGames-leagueAvg)*sampleWeight:leagueAvg;
    const defenseAllowed=t.effectiveGames?leagueAvg+(t.pa/t.effectiveGames-leagueAvg)*sampleWeight:leagueAvg;
    output.set(id,{...t,power,offense,defenseAllowed,sampleWeight,ratingReliability});
  }

  return {sport,teams:output,leagueAvg,completedCount:completed.length,homeField};
}

export function projectGame(game,model){
  const home=model.teams.get(teamKey(game.home))||blankTeam(game.home);
  const away=model.teams.get(teamKey(game.away))||blankTeam(game.away);
  const hPower=Number(home.power)||0,aPower=Number(away.power)||0;
  const hOff=Number(home.offense)||model.leagueAvg,aOff=Number(away.offense)||model.leagueAvg;
  const hDef=Number(home.defenseAllowed)||model.leagueAvg,aDef=Number(away.defenseAllowed)||model.leagueAvg;

  const gameHomeField=game.neutralSite?0:model.homeField;
  const powerMargin=hPower-aPower+gameHomeField;
  const homePts=model.leagueAvg+.55*(hOff-model.leagueAvg)+.45*(aDef-model.leagueAvg)+gameHomeField/2;
  const awayPts=model.leagueAvg+.55*(aOff-model.leagueAvg)+.45*(hDef-model.leagueAvg)-gameHomeField/2;
  const scoreMargin=homePts-awayPts;
  const margin=.70*powerMargin+.30*scoreMargin;
  const total=homePts+awayPts;
  const projectedHome=(total+margin)/2;
  const projectedAway=(total-margin)/2;

  return {
    homeMargin:Math.round(margin*10)/10,
    total:Math.round(total*10)/10,
    homePoints:Math.round(projectedHome*10)/10,
    awayPoints:Math.round(projectedAway*10)/10,
    homeGames:Number(home.games)||0,
    awayGames:Number(away.games)||0,
    powerMargin:Math.round(powerMargin*10)/10,
    scoreMargin:Math.round(scoreMargin*10)/10,
    reliability:Math.round(Math.min(Number(home.ratingReliability)||0,Number(away.ratingReliability)||0)*100)/100,
    neutralSite:Boolean(game.neutralSite),
    crossSubdivision:Boolean(
      model.sport==='cfb'&&
      [game.home?.subdivision,game.away?.subdivision].includes('FBS')&&
      [game.home?.subdivision,game.away?.subdivision].includes('FCS_OR_OTHER')
    )
  };
}

export function calibrateModel(games,sport){
  const completed=games.filter(g=>g.state==='post').slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
  const marginResiduals=[],totalResiduals=[];
  for(let i=0;i<completed.length;i++){
    const game=completed[i];
    const history=completed.slice(0,i);
    if(history.length<(sport==='nfl'?16:35))continue;
    const model=buildPowerModel(history,sport);
    const home=model.teams.get(teamKey(game.home)),away=model.teams.get(teamKey(game.away));
    if(!home||!away||home.games<1||away.games<1)continue;
    const p=projectGame(game,model);
    const actualMargin=Number(game.home.score)-Number(game.away.score);
    const actualTotal=Number(game.home.score)+Number(game.away.score);
    marginResiduals.push(actualMargin-p.homeMargin);
    totalResiduals.push(actualTotal-p.total);
  }
  const marginSigma=marginResiduals.length>=12?Math.max(8,stdev(marginResiduals)):(sport==='nfl'?13.5:18);
  const totalSigma=totalResiduals.length>=12?Math.max(9,stdev(totalResiduals)):(sport==='nfl'?13:18);
  return {
    samples:marginResiduals.length,
    marginSigma:Math.round(marginSigma*10)/10,
    totalSigma:Math.round(totalSigma*10)/10,
    marginMae:marginResiduals.length?Math.round(mean(marginResiduals.map(Math.abs))*10)/10:null,
    totalMae:totalResiduals.length?Math.round(mean(totalResiduals.map(Math.abs))*10)/10:null,
    fallback:marginResiduals.length<12
  };
}

function parseFallbackMarket(game){
  const details=String(game.market?.details||'').trim();
  const match=details.match(/^([A-Z0-9]+)\s+([+-]?\d+(?:\.\d+)?)$/);
  const abs=game.market?.spread==null?null:Math.abs(Number(game.market.spread));
  let homeMargin=null;
  if(match&&Number.isFinite(abs)){
    const favorite=match[1];
    if(favorite===game.home.short)homeMargin=abs;
    else if(favorite===game.away.short)homeMargin=-abs;
  }
  return {
    homeMargin,
    total:Number.isFinite(Number(game.market?.overUnder))?Number(game.market.overUnder):null,
    providerCount:game.market?1:0,
    providers:game.market?.provider?[game.market.provider]:[],
    spreadDispersion:0,
    totalDispersion:0
  };
}

export function consensusMarket(game,odds){
  const spreads=odds.map(o=>Number(o.homeMargin)).filter(Number.isFinite);
  const totals=odds.map(o=>Number(o.overUnder)).filter(Number.isFinite);
  if(!spreads.length&&!totals.length)return parseFallbackMarket(game);
  const fallback=parseFallbackMarket(game);
  return {
    homeMargin:spreads.length?median(spreads):fallback.homeMargin,
    total:totals.length?median(totals):fallback.total,
    providerCount:new Set(odds.map(o=>o.provider).filter(Boolean)).size,
    providers:[...new Set(odds.map(o=>o.provider).filter(Boolean))],
    spreadDispersion:Math.round(stdev(spreads)*10)/10,
    totalDispersion:Math.round(stdev(totals)*10)/10
  };
}

function fmt(n){return Math.round(n*10)/10;}

function atsLabel(game,homeMargin,side){
  if(homeMargin==null)return null;
  const homeSpread=-homeMargin;
  const line=side==='home'?homeSpread:-homeSpread;
  const team=side==='home'?game.home.short:game.away.short;
  return team+' '+(line>0?'+':'')+fmt(line);
}

function confidenceIndex({edge,p,reliability,dispersion,providerCount,edgeScale,calibration,extremePenalty=0}){
  const edgeSignal=clamp(edge/edgeScale,0,1);
  const probabilitySignal=clamp((p-.5)/.12,0,1);
  const marketAgreement=clamp(1-(dispersion/(edgeScale*.75)),0,1);
  const bookSignal=clamp((providerCount-1)/4,0,1);
  let score=35+(25*edgeSignal)+(15*probabilitySignal)+(12*reliability)+(8*marketAgreement)+(5*bookSignal);
  if(calibration?.fallback)score-=8;
  score-=extremePenalty;
  return Math.round(clamp(score,35,95));
}

export function confidenceLabel(index){
  if(index>=80)return "BEST BET";
  if(index>=70)return "STRONG";
  if(index>=60)return "LEAN";
  return "PASS";
}

export function evaluateGame(game,projection,market,calibration){
  // Early-season uncertainty should reduce conviction rather than systematically
  // pull projected margins toward zero (which can create fake big-underdog value).
  const reliability=clamp(Math.min(projection.homeGames,projection.awayGames)/5,.20,1);
  let spreadBet=null,totalBet=null;

  if(Number.isFinite(market.homeMargin)){
    const rawEdge=projection.homeMargin-market.homeMargin;
    const edge=rawEdge*reliability;
    const side=edge>=0?'home':'away';
    const absEdge=Math.abs(edge);
    const marketSize=Math.abs(market.homeMargin);
    // Extreme college/NFL spreads are intrinsically noisier. Widen uncertainty
    // and trim confidence unless the model has enough evidence to overcome it.
    const extremePenalty=Math.min(12,Math.max(0,marketSize-10)*.8);
    const adjustedSigma=calibration.marginSigma*(1+Math.max(0,marketSize-10)/35);
    const p=normalCdf(absEdge/adjustedSigma);
    const ev=(p*(100/110)-(1-p))*100;
    const confidence=confidenceIndex({
      edge:absEdge,p,reliability,dispersion:market.spreadDispersion||0,
      providerCount:market.providerCount||1,edgeScale:5,calibration,extremePenalty
    });
    spreadBet={
      type:'SPREAD',
      pick:atsLabel(game,market.homeMargin,side),
      edge:fmt(absEdge),
      rawEdge:fmt(Math.abs(rawEdge)),
      coverProbability:fmt(p*100),
      evAtMinus110:fmt(ev),
      confidence,
      confidenceLabel:confidenceLabel(confidence),
      side,
      reason:'Radar margin '+fmt(projection.homeMargin)+' vs market '+fmt(market.homeMargin)+' from the home-team perspective.'
    };
  }

  if(Number.isFinite(market.total)){
    const rawEdge=projection.total-market.total;
    const edge=rawEdge*reliability;
    const absEdge=Math.abs(edge);
    const p=normalCdf(absEdge/calibration.totalSigma);
    const ev=(p*(100/110)-(1-p))*100;
    const confidence=confidenceIndex({
      edge:absEdge,p,reliability,dispersion:market.totalDispersion||0,
      providerCount:market.providerCount||1,edgeScale:7,calibration
    });
    totalBet={
      type:'TOTAL',
      pick:(edge>=0?'OVER ':'UNDER ')+fmt(market.total),
      edge:fmt(absEdge),
      rawEdge:fmt(Math.abs(rawEdge)),
      coverProbability:fmt(p*100),
      evAtMinus110:fmt(ev),
      confidence,
      confidenceLabel:confidenceLabel(confidence),
      side:edge>=0?'over':'under',
      reason:'Radar total '+fmt(projection.total)+' vs market '+fmt(market.total)+'.'
    };
  }

  return {spreadBet,totalBet,reliability:fmt(reliability)};
}

export function displayProjectedLine(game,homeMargin){
  if(!Number.isFinite(homeMargin))return '—';
  if(Math.abs(homeMargin)<.05)return 'PICK';
  const favorite=homeMargin>0?game.home.short:game.away.short;
  return favorite+' -'+Math.abs(homeMargin).toFixed(1);
}

export function displayMarketLine(game,homeMargin){
  if(!Number.isFinite(homeMargin))return game.market?.details||'—';
  if(Math.abs(homeMargin)<.05)return 'PICK';
  const favorite=homeMargin>0?game.home.short:game.away.short;
  return favorite+' -'+Math.abs(homeMargin).toFixed(1);
}

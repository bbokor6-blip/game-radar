function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,n));}
function mean(values){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;}
function median(values){const a=values.filter(Number.isFinite).slice().sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function stdev(values){if(values.length<2)return 0;const m=mean(values);return Math.sqrt(mean(values.map(v=>(v-m)*(v-m))));}
function key(team){return String(team?.id||team?.short||team?.name||'');}
function finiteOrNull(value){
  if(value===null||value===undefined||value==="")return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}

function fallbackMarket(game){
  const details=String(game.market?.details||'').trim();
  const match=details.match(/^([A-Z0-9]+)\s+([+-]?\d+(?:\.\d+)?)$/);
  const abs=Number(game.market?.spread);
  let homeMargin=finiteOrNull(game.market?.homeMargin);
  if(homeMargin==null&&match&&Number.isFinite(abs)){
    const favorite=match[1];
    if(favorite===game.home.short)homeMargin=Math.abs(abs);
    else if(favorite===game.away.short)homeMargin=-Math.abs(abs);
  }
  return {
    homeMargin,
    total:finiteOrNull(game.market?.overUnder),
    homeSpreadOdds:validAmericanPrice(game.market?.homeSpreadOdds),
    awaySpreadOdds:validAmericanPrice(game.market?.awaySpreadOdds),
    overOdds:validAmericanPrice(game.market?.overOdds),
    underOdds:validAmericanPrice(game.market?.underOdds),
    providerCount:game.market?1:0,
    providers:game.market?.provider?[game.market.provider]:[],
    spreadDispersion:0,
    totalDispersion:0
  };
}

function validAmericanPrice(value){
  const n=Number(value);
  return Number.isFinite(n)&&Math.abs(n)>=100&&Math.abs(n)<=250?Math.round(n):null;
}

function marginFromDetails(game,quote){
  const details=String(quote?.details||"").trim();
  const match=details.match(/^([A-Z0-9.]+)\s+([+-]?\d+(?:\.\d+)?)$/i);
  if(match){
    const favorite=match[1].toUpperCase();
    const line=Math.abs(Number(match[2]));
    if(Number.isFinite(line)){
      if(favorite===String(game.home.short||"").toUpperCase())return line;
      if(favorite===String(game.away.short||"").toUpperCase())return -line;
    }
  }
  return finiteOrNull(quote?.homeMargin);
}

function normalizeQuote(game,quote){
  return {
    ...quote,
    homeMargin:marginFromDetails(game,quote),
    overUnder:finiteOrNull(quote?.overUnder),
    homeSpreadOdds:validAmericanPrice(quote?.homeSpreadOdds),
    awaySpreadOdds:validAmericanPrice(quote?.awaySpreadOdds),
    overOdds:validAmericanPrice(quote?.overOdds),
    underOdds:validAmericanPrice(quote?.underOdds)
  };
}

function closestQuote(quotes,key,target,needs){
  return quotes
    .filter(q=>finiteOrNull(q?.[key])!==null&&needs.every(field=>q?.[field]!=null))
    .sort((a,b)=>Math.abs(finiteOrNull(a[key])-target)-Math.abs(finiteOrNull(b[key])-target))[0]||null;
}

export function consensusMarket(game,odds=[]){
  const quotes=odds.map(o=>normalizeQuote(game,o)).filter(o=>o.homeMargin!=null||o.overUnder!=null);
  const fallback=fallbackMarket(game);
  if(!quotes.length)return fallback;

  const spreads=quotes.map(o=>finiteOrNull(o.homeMargin)).filter(v=>v!==null);
  const totals=quotes.map(o=>finiteOrNull(o.overUnder)).filter(v=>v!==null);
  const spreadMedian=spreads.length?median(spreads):fallback.homeMargin;
  const totalMedian=totals.length?median(totals):fallback.total;

  const preferred=quotes.find(q=>String(q.providerId)==="37"||/fanduel/i.test(String(q.provider||"")));
  const preferredSpreadOk=preferred&&Number.isFinite(spreadMedian)&&Number.isFinite(preferred.homeMargin)&&
    Math.abs(preferred.homeMargin-spreadMedian)<=1.5&&preferred.homeSpreadOdds!=null&&preferred.awaySpreadOdds!=null;
  const preferredTotalOk=preferred&&Number.isFinite(totalMedian)&&Number.isFinite(preferred.overUnder)&&
    Math.abs(preferred.overUnder-totalMedian)<=2.0&&preferred.overOdds!=null&&preferred.underOdds!=null;

  const spreadQuote=preferredSpreadOk?preferred:
    (Number.isFinite(spreadMedian)?closestQuote(quotes,"homeMargin",spreadMedian,["homeSpreadOdds","awaySpreadOdds"]):null);
  const totalQuote=preferredTotalOk?preferred:
    (Number.isFinite(totalMedian)?closestQuote(quotes,"overUnder",totalMedian,["overOdds","underOdds"]):null);

  return {
    homeMargin:spreadQuote?.homeMargin??spreadMedian,
    total:totalQuote?.overUnder??totalMedian,
    homeSpreadOdds:spreadQuote?.homeSpreadOdds??fallback.homeSpreadOdds,
    awaySpreadOdds:spreadQuote?.awaySpreadOdds??fallback.awaySpreadOdds,
    overOdds:totalQuote?.overOdds??fallback.overOdds,
    underOdds:totalQuote?.underOdds??fallback.underOdds,
    providerCount:new Set(quotes.map(o=>o.provider).filter(Boolean)).size,
    providers:[...new Set(quotes.map(o=>o.provider).filter(Boolean))],
    spreadDispersion:spreads.length?Math.round(stdev(spreads)*10)/10:fallback.spreadDispersion,
    totalDispersion:totals.length?Math.round(stdev(totals)*10)/10:fallback.totalDispersion,
    spreadSource:spreadQuote?.provider||null,
    totalSource:totalQuote?.provider||null,
    preferredSpreadUsed:Boolean(preferredSpreadOk),
    preferredTotalUsed:Boolean(preferredTotalOk)
  };
}

function teamSpread(game,homeMargin,team){
  if(!Number.isFinite(homeMargin))return null;
  const homeSpread=-homeMargin;
  return key(team)===key(game.home)?homeSpread:-homeSpread;
}

function atsResult(game,homeMargin,team){
  const spread=teamSpread(game,homeMargin,team);
  if(!Number.isFinite(spread))return null;
  const teamScore=key(team)===key(game.home)?Number(game.home.score):Number(game.away.score);
  const oppScore=key(team)===key(game.home)?Number(game.away.score):Number(game.home.score);
  const result=teamScore-oppScore+spread;
  if(result>0)return 1;
  if(result<0)return -1;
  return 0;
}

function pctFromResults(results){
  const decisions=results.filter(x=>x!==0);
  if(!decisions.length)return .5;
  return decisions.filter(x=>x>0).length/decisions.length;
}

function profile(){return {ats:[],totals:[],games:0};}

export function buildTrendProfiles(history){
  const profiles=new Map();
  function get(team){const id=key(team);if(!profiles.has(id))profiles.set(id,profile());return profiles.get(id);}

  for(const game of history.filter(g=>g.state==='post')){
    const market=fallbackMarket(game);
    const home=get(game.home),away=get(game.away);
    home.games++;away.games++;

    const hr=atsResult(game,market.homeMargin,game.home);
    const ar=atsResult(game,market.homeMargin,game.away);
    if(hr!=null){home.ats.push({date:game.date,result:hr});away.ats.push({date:game.date,result:ar});}

    if(Number.isFinite(market.total)){
      const actual=Number(game.home.score)+Number(game.away.score);
      const result=actual>market.total?1:actual<market.total?-1:0;
      home.totals.push({date:game.date,result});
      away.totals.push({date:game.date,result});
    }
  }

  const out=new Map();
  for(const [id,p] of profiles){
    const ats=p.ats.map(x=>x.result);
    const recentAts=p.ats.slice(-3).map(x=>x.result);
    const totals=p.totals.map(x=>x.result);
    const recentTotals=p.totals.slice(-3).map(x=>x.result);
    const atsDecisions=ats.filter(x=>x!==0);
    const recentAtsDecisions=recentAts.filter(x=>x!==0);
    const totalDecisions=totals.filter(x=>x!==0);
    const recentTotalDecisions=recentTotals.filter(x=>x!==0);
    out.set(id,{
      games:p.games,
      atsLineGames:p.ats.length,
      atsGames:atsDecisions.length,
      atsWins:atsDecisions.filter(x=>x>0).length,
      atsPct:pctFromResults(ats),
      atsCoverage:p.games?p.ats.length/p.games:0,
      recentAtsGames:recentAtsDecisions.length,
      recentAtsWins:recentAtsDecisions.filter(x=>x>0).length,
      recentAtsPct:pctFromResults(recentAts),
      overGames:totalDecisions.length,
      totalLineGames:p.totals.length,
      overWins:totalDecisions.filter(x=>x>0).length,
      overPct:pctFromResults(totals),
      totalCoverage:p.games?p.totals.length/p.games:0,
      recentOverGames:recentTotalDecisions.length,
      recentOverWins:recentTotalDecisions.filter(x=>x>0).length,
      recentOverPct:pctFromResults(recentTotals)
    });
  }
  return out;
}

function payoutForOdds(odds,stake=10){
  if(!Number.isFinite(Number(odds))||Number(odds)===0)return null;
  const n=Number(odds);
  const profit=n>0?stake*(n/100):stake*(100/Math.abs(n));
  return {
    stake,
    odds:n,
    profit:Math.round(profit*100)/100,
    totalReturn:Math.round((stake+profit)*100)/100
  };
}

function lineLabel(game,homeMargin,side){
  if(!Number.isFinite(homeMargin))return null;
  const homeSpread=-homeMargin;
  const spread=side==='home'?homeSpread:-homeSpread;
  const team=side==='home'?game.home.short:game.away.short;
  return team+' '+(spread>0?'+':'')+Math.round(spread*10)/10;
}

function recordText(team,profile){
  const record=team?.record||null;
  return record?team.short+' is '+record:team.short+' has '+profile.games+' completed game'+(profile.games===1?'':'s');
}

function atsUsable(profile){
  return profile.games>=2&&profile.atsLineGames>=2&&profile.atsCoverage>=.75;
}

function totalsUsable(profile){
  return profile.games>=2&&profile.totalLineGames>=2&&profile.totalCoverage>=.75;
}

function spreadReason(chosenTeam,otherTeam,chosen,other,pick,vegas,trendUsable,projection,game){
  const records=recordText(chosenTeam,chosen)+' and '+recordText(otherTeam,other)+' from all completed ESPN results. ';
  if(trendUsable){
    const chosenRecord=chosen.atsWins+' of '+chosen.atsGames;
    const otherRecord=other.atsWins+' of '+other.atsGames;
    const recentEdge=chosen.recentAtsGames>=2&&other.recentAtsGames>=2&&chosen.recentAtsPct>other.recentAtsPct+.15;
    return records+chosenTeam.short+' has covered in '+chosenRecord+' verified lined games, compared with '+otherTeam.short+' at '+otherRecord+'. '+
      (recentEdge?chosenTeam.short+' has also been better against the spread across its recent verified lines. ':'')+
      (vegas?' '+vegas.text:'')+
      ' With the current line at '+pick+', '+chosenTeam.short+' is the more interesting side.';
  }
  const coverage='Verified spreads are available for only '+chosen.atsLineGames+' of '+chosen.games+' '+chosenTeam.short+' games and '+other.atsLineGames+' of '+other.games+' '+otherTeam.short+' games, so ATS records are not used as primary evidence. ';
  const model=Number.isFinite(projection?.homeMargin)?'The score-based model projects '+(projection.homeMargin>0?game.home.short:game.away.short)+' by '+Math.abs(projection.homeMargin).toFixed(1)+'. ':'';
  return records+coverage+model+(vegas?vegas.text+' ':'')+'At '+pick+', '+chosenTeam.short+' is the model lean, with confidence limited by the incomplete market history.';
}

function totalReason(game,home,away,market,over){
  const homeRecord=home.overWins+' of '+home.overGames;
  const awayRecord=away.overWins+' of '+away.overGames;
  if(over){
    return game.home.short+' games have gone over their posted total in '+homeRecord+' games, and '+game.away.short+' games have gone over in '+awayRecord+'. With this total set at '+market.total+', both teams are pointing in the same direction.';
  }
  const homeUnder=Math.max(0,home.overGames-home.overWins);
  const awayUnder=Math.max(0,away.overGames-away.overWins);
  return game.home.short+' games have stayed under their posted total in '+homeUnder+' of '+home.overGames+' games, and '+game.away.short+' games have stayed under in '+awayUnder+' of '+away.overGames+'. With this total set at '+market.total+', both teams are pointing toward a lower-scoring game.';
}

function sideOpportunity(game,profiles,market,vegasHistory,sport,projection){
  if(!Number.isFinite(market.homeMargin))return null;
  const empty={games:0,atsLineGames:0,atsGames:0,atsWins:0,atsPct:.5,atsCoverage:0,recentAtsGames:0,recentAtsPct:.5};
  const home=profiles.get(key(game.home))||empty;
  const away=profiles.get(key(game.away))||empty;
  const rawModelEdge=Number.isFinite(projection?.homeMargin)?projection.homeMargin-market.homeMargin:0;
  const reliability=clamp(Number(projection?.reliability)||0,.15,1);
  const marketAnchor=.65-(.20*reliability);
  const modelWeight=1-marketAnchor;
  const modelEdge=rawModelEdge*modelWeight;
  const side=modelEdge>=0?'home':'away';

  const chosen=side==='home'?home:away;
  const other=side==='home'?away:home;
  const chosenTeam=side==='home'?game.home:game.away;
  const otherTeam=side==='home'?game.away:game.home;
  const sample=Math.min(Number(projection?.homeGames)||0,Number(projection?.awayGames)||0);
  const dataQuality=clamp(sample/6,0,1);
  const marketAgreement=market.providerCount>=2?clamp(1-(market.spreadDispersion||0)/2.5,0,1):0;
  const powerEdge=Number(projection?.powerMargin)-market.homeMargin;
  const scoreEdge=Number(projection?.scoreMargin)-market.homeMargin;
  const componentAgreement=Math.sign(powerEdge)===Math.sign(scoreEdge)&&Math.sign(powerEdge)===Math.sign(rawModelEdge);
  const edgeStrength=Math.min(12,Math.abs(modelEdge)*2);
  const outlierPenalty=Math.min(14,Math.max(0,Math.abs(rawModelEdge)-10)*.7);
  const availabilityUncertainty=clamp(Number(game?.availabilityUncertainty)||0,0,1);
  let index=43+edgeStrength+(dataQuality*8)+(reliability*8)+(marketAgreement*7)+(componentAgreement?5:-7);
  // Reward independent agreement only when both teams have a usable sample and
  // more than one book supplies the line. Thin markets retain their existing cap.
  if(sample>=4&&market.providerCount>=2&&componentAgreement)index+=5;
  if(market.providerCount>=3)index+=3;
  if(market.providerCount<2)index-=1;
  if(projection?.crossSubdivision)index-=6;
  index-=outlierPenalty+(availabilityUncertainty*8);
  index=Math.round(clamp(index,40,84));
  if(sample<4||market.providerCount<2)index=Math.min(index,69);

  const pick=lineLabel(game,market.homeMargin,side);
  const americanOdds=side==='home'?market.homeSpreadOdds:market.awaySpreadOdds;
  const evidence=[];
  evidence.push(chosenTeam.short+' record: '+(chosenTeam.record||chosen.games+' games'));
  evidence.push(otherTeam.short+' record: '+(otherTeam.record||other.games+' games'));
  evidence.push('Current market supplies '+Math.round(marketAnchor*100)+'% of the fair-line baseline');
  evidence.push(componentAgreement?'Power and scoring components agree on the side':'Power and scoring components disagree; confidence reduced');
  if(Number.isFinite(projection?.homeMargin))evidence.push('Independent margin '+(projection.homeMargin>0?game.home.short:game.away.short)+' by '+Math.abs(projection.homeMargin).toFixed(1));
  if(projection?.neutralSite)evidence.push('Neutral site: no home-field adjustment');
  if(projection?.crossSubdivision)evidence.push('Cross-subdivision matchup: prior results and confidence are down-weighted');
  if(!evidence.length)evidence.push('Low-confidence lean based on the current market setup');

  return {
    type:'SPREAD',
    pick,
    americanOdds,
    payout:payoutForOdds(americanOdds,10),
    index,
    label:index>=80?'BEST BET':index>=70?'STRONG':index>=55?'LEAN':'PASS',
    why:'Model v5 anchors to the consensus market, then makes a reliability-weighted adjustment from opponent-adjusted scoring. ATS streaks and broad favorite/underdog trends do not determine the side.',
    evidence,
    vegasContext:null,
    highConviction:index>=80,
    noBrainer:index>=85,
    evidenceQuality:{sample,providerCount:market.providerCount||0,trendUsable:false,componentAgreement,reliability,marketAnchor,availabilityUncertainty,atsCoverage:{chosen:chosen.atsCoverage,other:other.atsCoverage}},
    rawModelEdge:Math.round(rawModelEdge*10)/10,
    adjustedModelEdge:Math.round(modelEdge*10)/10,
    fairMargin:Math.round((market.homeMargin+modelEdge)*10)/10,
    side
  };
}

function totalOpportunity(game,profiles,market,vegasHistory,sport,projection){
  if(!Number.isFinite(market.total))return null;
  const empty={games:0,totalLineGames:0,totalCoverage:0,overGames:0,overWins:0,overPct:.5,recentOverPct:.5};
  const home=profiles.get(key(game.home))||empty;
  const away=profiles.get(key(game.away))||empty;
  const sample=Math.min(Number(projection?.homeGames)||0,Number(projection?.awayGames)||0);
  const reliability=clamp(Number(projection?.reliability)||0,.15,1);
  const rawModelEdge=Number.isFinite(projection?.total)?projection.total-market.total:0;
  const modelWeight=.30+(.20*reliability);
  const modelEdge=rawModelEdge*modelWeight;
  const over=modelEdge>=0;
  const dataQuality=clamp(sample/6,0,1);
  const agreement=market.providerCount>=2?clamp(1-(market.totalDispersion||0)/3,0,1):0;
  const outlierPenalty=Math.min(10,Math.max(0,Math.abs(rawModelEdge)-12)*.5);
  let index=40+Math.min(10,Math.abs(modelEdge)*1.5)+(dataQuality*7)+(reliability*7)+(agreement*5)-outlierPenalty;
  if(market.providerCount>=3)index+=3;
  if(market.providerCount<2)index-=1;
  index=Math.round(clamp(index,40,69));

  const americanOdds=over?market.overOdds:market.underOdds;
  const evidence=[];
  evidence.push('Totals are market-anchored and capped below STRONG until separately calibrated');
  if(Number.isFinite(projection?.total))evidence.push('Projected total '+projection.total.toFixed(1)+' vs market '+market.total);
  if(!evidence.length)evidence.push('Low-confidence lean based on the current total');

  return {
    type:'TOTAL',
    pick:(over?'OVER ':'UNDER ')+market.total,
    americanOdds,
    payout:payoutForOdds(americanOdds,10),
    index,
    label:index>=55?'LEAN':'PASS',
    why:'Model v5 anchors to the posted total and applies a reliability-weighted scoring adjustment. Short over/under streaks do not determine the pick.',
    evidence,
    vegasContext:null,
    highConviction:false,
    noBrainer:false,
    evidenceQuality:{sample,providerCount:market.providerCount||0,trendUsable:false,reliability,marketAnchor:1-modelWeight,totalCoverage:{home:home.totalCoverage,away:away.totalCoverage}},
    rawModelEdge:Math.round(rawModelEdge*10)/10,
    adjustedModelEdge:Math.round(modelEdge*10)/10,
    fairTotal:Math.round((market.total+modelEdge)*10)/10,
    side:over?'over':'under'
  };
}

export function evaluateOpportunity(game,profiles,market,vegasHistory,sport,{projection=null}={}){
  const spread=sideOpportunity(game,profiles,market,vegasHistory,sport,projection);
  const total=totalOpportunity(game,profiles,market,vegasHistory,sport,projection);
  return {spread,total};
}

export function marketSummary(game,market){
  if(!Number.isFinite(market.homeMargin))return game.market?.details||'LINE PENDING';
  if(Math.abs(market.homeMargin)<.05)return 'PICK';
  const fav=market.homeMargin>0?game.home.short:game.away.short;
  return fav+' -'+Math.abs(market.homeMargin).toFixed(1);
}


function spreadBucket(absLine){
  if(absLine<=3.5)return {key:"0-3.5",label:"tight spreads (0–3.5)"};
  if(absLine<=7.5)return {key:"4-7.5",label:"one-score spreads (4–7.5)"};
  if(absLine<=13.5)return {key:"8-13.5",label:"medium spreads (8–13.5)"};
  return {key:"14+",label:"big spreads (14+)"};
}

function totalBucket(total,sport){
  if(sport==="nfl"){
    if(total<=42)return {key:"low",label:"lower NFL totals (42 or less)"};
    if(total<49)return {key:"mid",label:"mid-range NFL totals (42.5–48.5)"};
    return {key:"high",label:"higher NFL totals (49+)"};
  }
  if(total<=48)return {key:"low",label:"lower college totals (48 or less)"};
  if(total<60)return {key:"mid",label:"mid-range college totals (48.5–59.5)"};
  return {key:"high",label:"higher college totals (60+)"};
}

export function buildVegasHistory(history,sport){
  const spreadBuckets=new Map();
  const totalBuckets=new Map();
  let spreadGames=0,totalGames=0;
  const completedGames=history.filter(g=>g.state==="post").length;

  function spreadRow(bucket){
    if(!spreadBuckets.has(bucket.key))spreadBuckets.set(bucket.key,{...bucket,games:0,favCovers:0,dogCovers:0,pushes:0,favMarginError:[]});
    return spreadBuckets.get(bucket.key);
  }
  function totalRow(bucket){
    if(!totalBuckets.has(bucket.key))totalBuckets.set(bucket.key,{...bucket,games:0,overs:0,unders:0,pushes:0,totalError:[]});
    return totalBuckets.get(bucket.key);
  }

  for(const game of history.filter(g=>g.state==="post")){
    const market=fallbackMarket(game);
    if(Number.isFinite(market.homeMargin)){
      const absLine=Math.abs(market.homeMargin);
      const bucket=spreadRow(spreadBucket(absLine));
      const homeFav=market.homeMargin>0;
      const fav=homeFav?game.home:game.away;
      const dog=homeFav?game.away:game.home;
      const favScore=Number(fav.score),dogScore=Number(dog.score);
      const favAts=favScore-dogScore-absLine;
      bucket.games++;spreadGames++;
      if(favAts>0)bucket.favCovers++;
      else if(favAts<0)bucket.dogCovers++;
      else bucket.pushes++;
      bucket.favMarginError.push((favScore-dogScore)-absLine);
    }

    if(Number.isFinite(market.total)){
      const bucket=totalRow(totalBucket(market.total,sport));
      const actual=Number(game.home.score)+Number(game.away.score);
      const diff=actual-market.total;
      bucket.games++;totalGames++;
      if(diff>0)bucket.overs++;
      else if(diff<0)bucket.unders++;
      else bucket.pushes++;
      bucket.totalError.push(diff);
    }
  }

  const spreads={};
  for(const [key,row] of spreadBuckets){
    const decisions=row.favCovers+row.dogCovers;
    spreads[key]={
      key,label:row.label,games:row.games,
      favoriteCovers:row.favCovers,underdogCovers:row.dogCovers,pushes:row.pushes,
      favoriteCoverPct:decisions?row.favCovers/decisions:.5,
      underdogCoverPct:decisions?row.dogCovers/decisions:.5,
      avgFavoriteMarginError:row.favMarginError.length?Math.round(mean(row.favMarginError)*10)/10:0
    };
  }

  const totals={};
  for(const [key,row] of totalBuckets){
    const decisions=row.overs+row.unders;
    totals[key]={
      key,label:row.label,games:row.games,
      overs:row.overs,unders:row.unders,pushes:row.pushes,
      overPct:decisions?row.overs/decisions:.5,
      underPct:decisions?row.unders/decisions:.5,
      avgTotalError:row.totalError.length?Math.round(mean(row.totalError)*10)/10:0
    };
  }

  return {
    sport,completedGames,spreadGames,totalGames,
    spreadCoverage:completedGames?spreadGames/completedGames:0,
    totalCoverage:completedGames?totalGames/completedGames:0,
    spreads,totals
  };
}

function spreadVegasContext(game,market,side,vegasHistory){
  if(!vegasHistory||!Number.isFinite(market.homeMargin))return null;
  if(vegasHistory.spreadCoverage<.65)return null;
  const bucket=vegasHistory.spreads?.[spreadBucket(Math.abs(market.homeMargin)).key];
  if(!bucket||bucket.games<5)return null;
  const homeFav=market.homeMargin>0;
  const chosenIsHome=side==="home";
  const chosenIsFavorite=chosenIsHome===homeFav;
  const wins=chosenIsFavorite?bucket.favoriteCovers:bucket.underdogCovers;
  const losses=chosenIsFavorite?bucket.underdogCovers:bucket.favoriteCovers;
  const decisions=wins+losses;
  if(!decisions)return null;
  const rate=wins/decisions;
  return {
    sample:decisions,
    rate,
    support:rate>=.58?1:rate<=.42?-1:0,
    text:(chosenIsFavorite?"Favorites":"Underdogs")+" in "+bucket.label+" have covered "+wins+" of "+decisions+" this season."
  };
}

function totalVegasContext(market,over,vegasHistory,sport){
  if(!vegasHistory||!Number.isFinite(market.total))return null;
  if(vegasHistory.totalCoverage<.65)return null;
  const bucket=vegasHistory.totals?.[totalBucket(market.total,sport).key];
  if(!bucket||bucket.games<5)return null;
  const wins=over?bucket.overs:bucket.unders;
  const losses=over?bucket.unders:bucket.overs;
  const decisions=wins+losses;
  if(!decisions)return null;
  const rate=wins/decisions;
  return {
    sample:decisions,
    rate,
    support:rate>=.58?1:rate<=.42?-1:0,
    text:(over?"Overs":"Unders")+" in "+bucket.label+" have hit "+wins+" of "+decisions+" times this season."
  };
}

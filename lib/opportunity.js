function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,n));}
function mean(values){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;}
function median(values){const a=values.filter(Number.isFinite).slice().sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function stdev(values){if(values.length<2)return 0;const m=mean(values);return Math.sqrt(mean(values.map(v=>(v-m)*(v-m))));}
function key(team){return String(team?.id||team?.short||team?.name||'');}

function fallbackMarket(game){
  const details=String(game.market?.details||'').trim();
  const match=details.match(/^([A-Z0-9]+)\s+([+-]?\d+(?:\.\d+)?)$/);
  const abs=Number(game.market?.spread);
  let homeMargin=null;
  if(match&&Number.isFinite(abs)){
    const favorite=match[1];
    if(favorite===game.home.short)homeMargin=Math.abs(abs);
    else if(favorite===game.away.short)homeMargin=-Math.abs(abs);
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

export function consensusMarket(game,odds=[]){
  const spreads=odds.map(o=>Number(o.homeMargin)).filter(Number.isFinite);
  const totals=odds.map(o=>Number(o.overUnder)).filter(Number.isFinite);
  const fallback=fallbackMarket(game);
  return {
    homeMargin:spreads.length?median(spreads):fallback.homeMargin,
    total:totals.length?median(totals):fallback.total,
    providerCount:spreads.length||totals.length?new Set(odds.map(o=>o.provider).filter(Boolean)).size:fallback.providerCount,
    providers:spreads.length||totals.length?[...new Set(odds.map(o=>o.provider).filter(Boolean))]:fallback.providers,
    spreadDispersion:spreads.length?Math.round(stdev(spreads)*10)/10:fallback.spreadDispersion,
    totalDispersion:totals.length?Math.round(stdev(totals)*10)/10:fallback.totalDispersion
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
      atsGames:atsDecisions.length,
      atsWins:atsDecisions.filter(x=>x>0).length,
      atsPct:pctFromResults(ats),
      recentAtsGames:recentAtsDecisions.length,
      recentAtsWins:recentAtsDecisions.filter(x=>x>0).length,
      recentAtsPct:pctFromResults(recentAts),
      overGames:totalDecisions.length,
      overWins:totalDecisions.filter(x=>x>0).length,
      overPct:pctFromResults(totals),
      recentOverGames:recentTotalDecisions.length,
      recentOverWins:recentTotalDecisions.filter(x=>x>0).length,
      recentOverPct:pctFromResults(recentTotals)
    });
  }
  return out;
}

function lineLabel(game,homeMargin,side){
  if(!Number.isFinite(homeMargin))return null;
  const homeSpread=-homeMargin;
  const spread=side==='home'?homeSpread:-homeSpread;
  const team=side==='home'?game.home.short:game.away.short;
  return team+' '+(spread>0?'+':'')+Math.round(spread*10)/10;
}

function spreadReason(chosenTeam,otherTeam,chosen,other,pick){
  const chosenRecord=chosen.atsWins+' of '+chosen.atsGames;
  const otherRecord=other.atsWins+' of '+other.atsGames;
  const recentEdge=chosen.recentAtsPct>other.recentAtsPct+.15;
  return chosenTeam.short+' has covered the spread in '+chosenRecord+' games, compared with '+otherTeam.short+' at '+otherRecord+'. '+
    (recentEdge?chosenTeam.short+' has also been better against the spread lately. ':'')+
    'With the current line at '+pick+', that makes '+chosenTeam.short+' worth a closer look.';
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

function sideOpportunity(game,profiles,market){
  if(!Number.isFinite(market.homeMargin))return null;
  const home=profiles.get(key(game.home))||{atsGames:0,atsPct:.5,recentAtsPct:.5};
  const away=profiles.get(key(game.away))||{atsGames:0,atsPct:.5,recentAtsPct:.5};
  const homeScore=.65*home.atsPct+.35*home.recentAtsPct;
  const awayScore=.65*away.atsPct+.35*away.recentAtsPct;
  const diff=Math.abs(homeScore-awayScore);
  const side=homeScore>=awayScore?'home':'away';
  const chosen=side==='home'?home:away;
  const other=side==='home'?away:home;
  const chosenTeam=side==='home'?game.home:game.away;
  const otherTeam=side==='home'?game.away:game.home;
  const sample=Math.min(chosen.atsGames,other.atsGames);

  if(sample<2||diff<.12)return null;

  const sampleScore=clamp(sample/5,0,1);
  const agreement=clamp(1-(market.spreadDispersion||0)/2.5,0,1);
  let index=48+(diff*38)+(sampleScore*9)+(agreement*5);
  if(market.providerCount>=3)index+=4;
  index=Math.round(clamp(index,45,88));

  const pick=lineLabel(game,market.homeMargin,side);
  return {
    type:'SPREAD',
    pick,
    index,
    label:index>=78?'STRONG LOOK':index>=68?'INTERESTING':'WATCH',
    why:spreadReason(chosenTeam,otherTeam,chosen,other,pick),
    evidence:[
      chosenTeam.short+' covered '+chosen.atsWins+' of '+chosen.atsGames,
      otherTeam.short+' covered '+other.atsWins+' of '+other.atsGames,
      'Recent form favors '+chosenTeam.short
    ],
    side
  };
}

function totalOpportunity(game,profiles,market){
  if(!Number.isFinite(market.total))return null;
  const home=profiles.get(key(game.home))||{overGames:0,overPct:.5,recentOverPct:.5};
  const away=profiles.get(key(game.away))||{overGames:0,overPct:.5,recentOverPct:.5};
  const sample=Math.min(home.overGames,away.overGames);
  if(sample<2)return null;

  const combined=.35*home.overPct+.35*away.overPct+.15*home.recentOverPct+.15*away.recentOverPct;
  const distance=Math.abs(combined-.5);
  if(distance<.16)return null;
  const over=combined>.5;
  const sampleScore=clamp(sample/5,0,1);
  const agreement=clamp(1-(market.totalDispersion||0)/3,0,1);
  let index=47+(distance*52)+(sampleScore*8)+(agreement*5);
  if(market.providerCount>=3)index+=4;
  index=Math.round(clamp(index,45,86));

  return {
    type:'TOTAL',
    pick:(over?'OVER ':'UNDER ')+market.total,
    index,
    label:index>=78?'STRONG LOOK':index>=68?'INTERESTING':'WATCH',
    why:totalReason(game,home,away,market,over),
    evidence:over?[
      game.home.short+' went over '+home.overWins+' of '+home.overGames,
      game.away.short+' went over '+away.overWins+' of '+away.overGames,
      'Current total: '+market.total
    ]:[
      game.home.short+' stayed under '+Math.max(0,home.overGames-home.overWins)+' of '+home.overGames,
      game.away.short+' stayed under '+Math.max(0,away.overGames-away.overWins)+' of '+away.overGames,
      'Current total: '+market.total
    ],
    side:over?'over':'under'
  };
}

export function evaluateOpportunity(game,profiles,market){
  const spread=sideOpportunity(game,profiles,market);
  const total=totalOpportunity(game,profiles,market);
  return {spread,total};
}

export function marketSummary(game,market){
  if(!Number.isFinite(market.homeMargin))return game.market?.details||'LINE PENDING';
  if(Math.abs(market.homeMargin)<.05)return 'PICK';
  const fav=market.homeMargin>0?game.home.short:game.away.short;
  return fav+' -'+Math.abs(market.homeMargin).toFixed(1);
}

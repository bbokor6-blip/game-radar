function lower(value){return String(value||"").toLowerCase();}
function numberMatch(text,patterns){
  for(const re of patterns){
    const m=text.match(re);
    if(m){const n=Number(m[1]);if(Number.isFinite(n))return n;}
  }
  return null;
}
function spreadAbs(game){
  const homeMargin=game?.marketConsensus?.homeMargin;
  if(homeMargin!==null&&homeMargin!==undefined&&homeMargin!==""){
    const n=Math.abs(Number(homeMargin));
    if(Number.isFinite(n))return n;
  }
  const spread=game?.market?.spread;
  if(spread!==null&&spread!==undefined&&spread!==""){
    const n=Math.abs(Number(spread));
    if(Number.isFinite(n))return n;
  }
  return null;
}
function bestIndex(game){return Number(game?.bestOpportunity?.index||game?.opportunityIndex||0)||0;}
function rankedCount(game){return [game?.home?.rank,game?.away?.rank].filter(Boolean).length;}
function conferenceMatch(game,conferences){
  if(!conferences?.length)return true;
  return conferences.includes(game?.home?.conference)||conferences.includes(game?.away?.conference);
}
function parseHour(text){
  const m=text.match(/(?:after|later than)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if(!m)return null;
  let hour=Number(m[1]);
  const minute=Number(m[2]||0);
  const ap=lower(m[3]);
  if(ap==="pm"&&hour<12)hour+=12;
  if(ap==="am"&&hour===12)hour=0;
  return hour+minute/60;
}

export function parseAgentQuery(input,{currentLeague="cfb",currentWeekOffset=0}={}){
  const raw=String(input||"").trim();
  const q=lower(raw);
  const conferences=[];
  if(/\bbig\s*(ten|10)\b|\bb1g\b/.test(q))conferences.push("Big Ten");
  if(/\bsec\b|southeastern/.test(q))conferences.push("SEC");

  let league=currentLeague;
  if(/\bnfl\b|pro football/.test(q))league="nfl";
  if(/college|cfb|fbs|big\s*(ten|10)|\bb1g\b|\bsec\b/.test(q))league="cfb";

  let weekOffset=currentWeekOffset;
  if(/week after next|two weeks? from now|\+2\s*weeks?/.test(q))weekOffset=2;
  else if(/next week/.test(q))weekOffset=1;
  else if(/this week|current week|this weekend|tonight|today|saturday|sunday/.test(q))weekOffset=0;

  const tight=/(tight|close game|close matchup|one[- ]score|small spread)/.test(q);
  const explicitSpread=numberMatch(q,[
    /spread(?:s)?\s*(?:under|below|less than|<=?)\s*(\d+(?:\.\d+)?)/,
    /(?:under|below|less than|within)\s*(\d+(?:\.\d+)?)\s*(?:points?|pt)?\s*(?:spread|line)?/,
    /(?:spread|line)\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*(?:or less|max)?/
  ]);
  const spreadMax=explicitSpread!=null?explicitSpread:(tight?7.5:null);

  const rankedOnly=/only ranked|ranked matchups? only|top\s*25\s*only/.test(q);
  const rankedInvolved=!rankedOnly&&/(top\s*25|ranked (?:games?|teams?|matchups?))/.test(q);
  const sleeperOnly=/sleepers? only|only sleepers?|under[- ]the[- ]radar only/.test(q);
  const wantsSleepers=/sleepers?|under[- ]the[- ]radar/.test(q);

  let betIndexMin=numberMatch(q,[
    /(?:betradar|bet radar|index|score)\s*(?:over|above|at least|>=?)\s*(\d+)/,
    /(?:over|above|at least)\s*(\d+)\s*(?:betradar|bet radar|index)/
  ]);
  if(/no[ -]?brainer/.test(q)&&betIndexMin==null)betIndexMin=81;
  else if(/high conviction/.test(q)&&betIndexMin==null)betIndexMin=71;

  const day=/\bsaturday\b/.test(q)?"Saturday":/\bsunday\b/.test(q)?"Sunday":/\bthursday\b/.test(q)?"Thursday":/\bfriday\b/.test(q)?"Friday":null;
  const afterHour=parseHour(q);

  let sort="interest";
  if(/best bet|betradar|bet radar|bet index|strongest bet|betting/.test(q))sort="bet";
  else if(tight||spreadMax!=null)sort="tight";
  else if(/kickoff|earliest|schedule|time/.test(q))sort="kickoff";

  const maxResults=numberMatch(q,[
    /(?:top|best|show me|give me)\s+(\d+)\b/,
    /\b(\d+)\s+(?:games?|picks?|bets?)\b/
  ]);

  const isSaveAction=/^save\b|save those|save these|add .*betting sheet|build .*card/.test(q);
  const saveCount=numberMatch(q,[
    /save(?: the)?(?: best| top)?\s*(\d+)/,
    /build(?: me)?(?: a)?\s*(\d+)[- ]leg/,
    /save those\s*(\d+)/
  ])||(isSaveAction?3:null);

  const chips=[];
  chips.push(league==="cfb"?"COLLEGE FBS":"NFL");
  if(conferences.length)chips.push(conferences.join(" + ").toUpperCase());
  chips.push(weekOffset===0?"THIS WEEK":weekOffset===1?"NEXT WEEK":"+"+weekOffset+" WEEKS");
  if(spreadMax!=null)chips.push("SPREAD ≤ "+spreadMax);
  if(rankedOnly)chips.push("TOP 25 ONLY");
  else if(rankedInvolved)chips.push("RANKED INVOLVED");
  if(sleeperOnly)chips.push("SLEEPERS ONLY");
  if(betIndexMin!=null)chips.push("BETRADAR ≥ "+betIndexMin);
  if(day)chips.push(day.toUpperCase());
  if(afterHour!=null)chips.push("AFTER "+Math.floor(afterHour>12?afterHour-12:afterHour)+(afterHour>=12?" PM":" AM"));

  return {
    raw,league,weekOffset,conferences,spreadMax,rankedOnly,rankedInvolved,sleeperOnly,wantsSleepers,
    betIndexMin,day,afterHour,sort,maxResults:maxResults||null,isSaveAction,saveCount,chips
  };
}

export function searchGames(games,spec){
  let out=(games||[]).filter(game=>game?.sport===spec.league);
  out=out.filter(game=>conferenceMatch(game,spec.conferences));

  if(spec.spreadMax!=null)out=out.filter(game=>{
    const n=spreadAbs(game);
    return n!=null&&n<=spec.spreadMax;
  });
  if(spec.rankedOnly)out=out.filter(game=>rankedCount(game)===2);
  else if(spec.rankedInvolved)out=out.filter(game=>rankedCount(game)>=1);

  if(spec.sleeperOnly)out=out.filter(game=>rankedCount(game)===0&&bestIndex(game)>=72);
  if(spec.betIndexMin!=null)out=out.filter(game=>bestIndex(game)>=spec.betIndexMin);
  if(spec.day)out=out.filter(game=>new Date(game.date).toLocaleDateString("en-US",{weekday:"long"})===spec.day);
  if(spec.afterHour!=null)out=out.filter(game=>{
    const d=new Date(game.date);
    return d.getHours()+d.getMinutes()/60>=spec.afterHour;
  });

  out.sort((a,b)=>{
    if(spec.sort==="bet")return bestIndex(b)-bestIndex(a)||(b.interest?.score||0)-(a.interest?.score||0);
    if(spec.sort==="kickoff")return new Date(a.date)-new Date(b.date);
    if(spec.sort==="tight"){
      const sa=spreadAbs(a)??99,sb=spreadAbs(b)??99;
      return sa-sb||(b.interest?.score||0)-(a.interest?.score||0);
    }
    return (b.interest?.score||0)-(a.interest?.score||0)||bestIndex(b)-bestIndex(a);
  });

  return spec.maxResults?out.slice(0,spec.maxResults):out;
}

export function queryExplanation(spec){
  const parts=[];
  if(spec.conferences.length)parts.push("games involving "+spec.conferences.join(" or "));
  else parts.push(spec.league==="cfb"?"college football games":"NFL games");
  if(spec.spreadMax!=null)parts.push("with a spread of "+spec.spreadMax+" points or less");
  if(spec.rankedOnly)parts.push("where both teams are Top 25");
  else if(spec.rankedInvolved)parts.push("involving at least one Top 25 team");
  if(spec.sleeperOnly)parts.push("limited to strong unranked sleeper spots");
  if(spec.betIndexMin!=null)parts.push("with BetRadar Index at least "+spec.betIndexMin);
  return parts.join(", ")+".";
}

export function bestOpportunityForGame(game){
  return game?.bestOpportunity||null;
}

export function spreadForGame(game){
  return spreadAbs(game);
}

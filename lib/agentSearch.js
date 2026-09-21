import { CONFERENCE_ALIASES, POWER_CONFERENCES } from "./conferences";
import { gameMetadata, teamAliases, spreadValue, bestIndex } from "./gameMetadata";

function lower(value){return String(value||"").toLowerCase();}
function numberMatch(text,patterns){
  for(const re of patterns){
    const m=text.match(re);
    if(m){const n=Number(m[1]);if(Number.isFinite(n))return n;}
  }
  return null;
}
function parseHour(text){
  const m=text.match(/(?:after|later than|starting after)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if(!m)return null;
  let hour=Number(m[1]);
  const minute=Number(m[2]||0);
  const ap=lower(m[3]);
  if(ap==="pm"&&hour<12)hour+=12;
  if(ap==="am"&&hour===12)hour=0;
  return hour+minute/60;
}
function normalized(value){
  return lower(value).replace(/[^a-z0-9&]+/g," ").trim();
}
function includesAlias(query,alias){
  if(!alias||alias.length<2)return false;
  const q=" "+normalized(query)+" ";
  const a=" "+normalized(alias)+" ";
  return q.includes(a);
}
function detectTeams(q,games){
  const found=[];
  const seen=new Set();
  for(const game of games||[]){
    for(const side of ["away","home"]){
      const team=game?.[side];
      if(!team||seen.has(team.id))continue;
      seen.add(team.id);
      const aliases=teamAliases(team);
      const matched=aliases.find(alias=>alias.length>=3&&includesAlias(q,alias));
      if(matched)found.push({id:team.id,name:team.location||team.name||team.short,short:team.short,matched});
    }
  }
  return found;
}
function detectConferences(q){
  const found=[];
  for(const item of CONFERENCE_ALIASES){
    if(item.aliases.some(alias=>includesAlias(q,alias)))found.push(item.name);
  }
  return found;
}
function opportunityIsUnderdog(game){
  const meta=gameMetadata(game);
  const side=game?.bestOpportunity?.side;
  if(!side||!meta.favoriteSide)return false;
  return side!==meta.favoriteSide;
}
function opportunityIsFavorite(game){
  const meta=gameMetadata(game);
  const side=game?.bestOpportunity?.side;
  if(!side||!meta.favoriteSide)return false;
  return side===meta.favoriteSide;
}

export function parseAgentQuery(input,{currentLeague="cfb",currentWeekOffset=0,games=[]}={}){
  const raw=String(input||"").trim();
  const q=lower(raw);
  const conferences=detectConferences(q);
  const teams=detectTeams(q,games);

  let league=currentLeague;
  if(/\bnfl\b|pro football/.test(q))league="nfl";
  if(/college|cfb|fbs|power\s*4|p4|group\s*of\s*5|g5/.test(q)||conferences.length)league="cfb";

  let weekOffset=currentWeekOffset;
  if(/week after next|two weeks? from now|\+2\s*weeks?/.test(q))weekOffset=2;
  else if(/next week/.test(q))weekOffset=1;
  else if(/this week|current week|this weekend|tonight|today|saturday|sunday|monday|thursday|friday/.test(q))weekOffset=0;

  const tight=/(tight|close game|close matchup|one[- ]score|small spread|toss[- ]?up)/.test(q);
  const explicitSpread=numberMatch(q,[
    /spread(?:s)?\s*(?:under|below|less than|<=?)\s*(\d+(?:\.\d+)?)/,
    /(?:under|below|less than|within)\s*(\d+(?:\.\d+)?)\s*(?:points?|pt)?\s*(?:spread|line)?/,
    /(?:spread|line)\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*(?:or less|max)?/
  ]);
  const spreadMax=explicitSpread!=null?explicitSpread:(tight?7.5:null);

  const rankedOnly=/ranked\s*(?:vs|v|versus)\s*ranked|both ranked|only ranked matchups|top\s*25\s*only/.test(q);
  const rankedInvolved=!rankedOnly&&/(top\s*25|ranked (?:games?|teams?|matchups?)|ranked team)/.test(q);
  const top10Only=/top\s*10\s*(?:teams?|matchups?|schools?)/.test(q);
  const unrankedOnly=/unranked only|only unranked/.test(q);
  const sleeperOnly=/sleepers? only|only sleepers?|under[- ]the[- ]radar only/.test(q);
  const wantsSleepers=/sleepers?|under[- ]the[- ]radar/.test(q);

  const conferenceGameOnly=/conference games? only|only conference games?|in[- ]conference|same conference/.test(q);
  const nonConferenceOnly=/non[- ]conference|out[- ]of[- ]conference/.test(q);
  const powerOnly=/power\s*4|\bp4\b|power conference/.test(q);
  const g5Only=/group\s*of\s*5|\bg5\b/.test(q);

  const underdogOnly=/underdogs?|dogs\b/.test(q);
  const favoriteOnly=/favorites?|favou?rites?/.test(q)&&!underdogOnly;
  const neutralSiteOnly=/neutral[- ]site|neutral field/.test(q);
  const undefeatedOnly=/undefeated|no losses|without a loss/.test(q);
  const winningTeamsOnly=/winning teams?|winning records?|both winning/.test(q);
  const networks=["ESPN","ESPN2","ABC","FOX","FS1","CBS","NBC","BTN","SEC NETWORK","ACCN","CW"].filter(network=>includesAlias(q,network));

  let state=null;
  if(/live now|\blive\b|in progress/.test(q))state="in";
  else if(/completed|finals?|finished/.test(q))state="post";
  else if(/upcoming|future|later this week|week ahead/.test(q))state="pre";

  let kickoffWindow=null;
  if(/primetime|prime time|night games?|evening/.test(q))kickoffWindow="PRIMETIME";
  else if(/late games?|late night/.test(q))kickoffWindow="LATE";
  else if(/early games?|noon games?|morning/.test(q))kickoffWindow="EARLY";
  else if(/afternoon games?|afternoon/.test(q))kickoffWindow="AFTERNOON";

  const totalMin=numberMatch(q,[
    /total(?:s)?\s*(?:over|above|at least|>=?)\s*(\d+(?:\.\d+)?)/,
    /(?:over|above)\s*(\d+(?:\.\d+)?)\s*(?:point )?total/
  ]);
  const totalMax=numberMatch(q,[
    /total(?:s)?\s*(?:under|below|at most|<=?)\s*(\d+(?:\.\d+)?)/,
    /(?:under|below)\s*(\d+(?:\.\d+)?)\s*(?:point )?total/
  ]);
  const totalShape=/high[- ]scoring|high totals?/.test(q)?"HIGH TOTAL":/low[- ]scoring|low totals?/.test(q)?"LOW TOTAL":null;

  let betIndexMin=numberMatch(q,[
    /(?:betradar|bet radar|index|score)\s*(?:over|above|at least|>=?)\s*(\d+)/,
    /(?:over|above|at least)\s*(\d+)\s*(?:betradar|bet radar|index)/
  ]);
  if(/no[ -]?brainer/.test(q)&&betIndexMin==null)betIndexMin=81;
  else if(/high conviction/.test(q)&&betIndexMin==null)betIndexMin=71;

  const day=/\bmonday\b/.test(q)?"Monday":
    /\bthursday\b/.test(q)?"Thursday":
    /\bfriday\b/.test(q)?"Friday":
    /\bsaturday\b/.test(q)?"Saturday":
    /\bsunday\b/.test(q)?"Sunday":null;
  const afterHour=parseHour(q);

  let sort="interest";
  if(/best bet|betradar|bet radar|bet index|strongest bet|betting|high conviction|no[ -]?brainer/.test(q))sort="bet";
  else if(tight||spreadMax!=null)sort="tight";
  else if(/kickoff|earliest|schedule|time/.test(q))sort="kickoff";
  else if(/biggest games?|best games?|must[- ]watch|worth watching/.test(q))sort="interest";

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
  for(const team of teams.slice(0,3))chips.push(team.name.toUpperCase());
  if(conferences.length)chips.push(conferences.join(" + ").toUpperCase());
  if(powerOnly)chips.push("POWER 4");
  if(g5Only)chips.push("GROUP OF 5");
  chips.push(weekOffset===0?"THIS WEEK":weekOffset===1?"NEXT WEEK":"+"+weekOffset+" WEEKS");
  if(spreadMax!=null)chips.push("SPREAD ≤ "+spreadMax);
  if(rankedOnly)chips.push("RANKED vs RANKED");
  else if(rankedInvolved)chips.push("RANKED INVOLVED");
  if(top10Only)chips.push("TOP 10 INVOLVED");
  if(unrankedOnly)chips.push("UNRANKED ONLY");
  if(conferenceGameOnly)chips.push("CONFERENCE GAME");
  if(nonConferenceOnly)chips.push("NON-CONFERENCE");
  if(underdogOnly)chips.push("UNDERDOG LEAN");
  if(favoriteOnly)chips.push("FAVORITE LEAN");
  if(sleeperOnly)chips.push("SLEEPERS ONLY");
  if(betIndexMin!=null)chips.push("BETRADAR ≥ "+betIndexMin);
  if(totalShape)chips.push(totalShape);
  if(kickoffWindow)chips.push(kickoffWindow);
  if(neutralSiteOnly)chips.push("NEUTRAL SITE");
  if(undefeatedOnly)chips.push("UNDEFEATED INVOLVED");
  if(winningTeamsOnly)chips.push("BOTH WINNING");
  for(const network of networks)chips.push(network);
  if(state)chips.push(state==="in"?"LIVE":state==="post"?"COMPLETED":"UPCOMING");
  if(day)chips.push(day.toUpperCase());
  if(afterHour!=null)chips.push("AFTER "+Math.floor(afterHour>12?afterHour-12:afterHour)+(afterHour>=12?" PM":" AM"));

  return {
    raw,league,weekOffset,conferences,teams,spreadMax,rankedOnly,rankedInvolved,top10Only,unrankedOnly,
    sleeperOnly,wantsSleepers,conferenceGameOnly,nonConferenceOnly,powerOnly,g5Only,underdogOnly,favoriteOnly,
    neutralSiteOnly,undefeatedOnly,winningTeamsOnly,networks,
    state,kickoffWindow,totalMin,totalMax,totalShape,betIndexMin,day,afterHour,sort,maxResults:maxResults||null,
    isSaveAction,saveCount,chips
  };
}

export function searchGames(games,spec){
  let out=(games||[]).filter(game=>game?.sport===spec.league);
  if(spec.conferences?.length)out=out.filter(game=>spec.conferences.includes(game?.home?.conference)||spec.conferences.includes(game?.away?.conference));
  if(spec.teams?.length){
    const ids=new Set(spec.teams.map(t=>String(t.id)));
    out=out.filter(game=>ids.has(String(game?.home?.id))||ids.has(String(game?.away?.id)));
  }

  out=out.filter(game=>{
    const meta=gameMetadata(game);
    if(spec.spreadMax!=null&&(meta.spread==null||meta.spread>spec.spreadMax))return false;
    if(spec.rankedOnly&&meta.rankedCount!==2)return false;
    if(spec.rankedInvolved&&meta.rankedCount<1)return false;
    if(spec.top10Only&&!meta.top10Involved)return false;
    if(spec.unrankedOnly&&meta.rankedCount!==0)return false;
    if(spec.sleeperOnly&&!(meta.rankedCount===0&&meta.betIndex>=72))return false;
    if(spec.conferenceGameOnly&&!meta.conferenceGame)return false;
    if(spec.nonConferenceOnly&&!meta.crossConference)return false;
    if(spec.powerOnly&&!meta.conferences.some(c=>POWER_CONFERENCES.has(c)))return false;
    if(spec.g5Only&&!meta.conferences.some(c=>c&&!POWER_CONFERENCES.has(c)&&c!=="Independent"))return false;
    if(spec.underdogOnly&&!opportunityIsUnderdog(game))return false;
    if(spec.favoriteOnly&&!opportunityIsFavorite(game))return false;
    if(spec.neutralSiteOnly&&!meta.neutralSite)return false;
    if(spec.undefeatedOnly&&!meta.undefeatedInvolved)return false;
    if(spec.winningTeamsOnly&&!meta.bothWinning)return false;
    if(spec.networks?.length&&!spec.networks.some(network=>meta.broadcasts.some(name=>normalized(name).includes(normalized(network)))))return false;
    if(spec.state&&game.state!==spec.state)return false;
    if(spec.kickoffWindow&&meta.kickoffWindow!==spec.kickoffWindow)return false;
    if(spec.totalShape&&meta.totalShape!==spec.totalShape)return false;
    if(spec.totalMin!=null&&(meta.total==null||meta.total<spec.totalMin))return false;
    if(spec.totalMax!=null&&(meta.total==null||meta.total>spec.totalMax))return false;
    if(spec.betIndexMin!=null&&meta.betIndex<spec.betIndexMin)return false;
    if(spec.day&&meta.day!==spec.day)return false;
    if(spec.afterHour!=null){
      const d=new Date(game.date);
      if(d.getHours()+d.getMinutes()/60<spec.afterHour)return false;
    }
    return true;
  });

  out.sort((a,b)=>{
    if(spec.sort==="bet")return bestIndex(b)-bestIndex(a)||(b.interest?.score||0)-(a.interest?.score||0);
    if(spec.sort==="kickoff")return new Date(a.date)-new Date(b.date);
    if(spec.sort==="tight")return (spreadValue(a)??99)-(spreadValue(b)??99)||(b.interest?.score||0)-(a.interest?.score||0);
    return (b.interest?.score||0)-(a.interest?.score||0)||bestIndex(b)-bestIndex(a);
  });

  return spec.maxResults?out.slice(0,spec.maxResults):out;
}

export function queryExplanation(spec){
  const parts=[];
  if(spec.teams?.length)parts.push("games involving "+spec.teams.map(t=>t.name).join(" or "));
  else if(spec.conferences.length)parts.push("games involving "+spec.conferences.join(" or "));
  else if(spec.powerOnly)parts.push("Power 4 games");
  else if(spec.g5Only)parts.push("Group of 5 games");
  else parts.push(spec.league==="cfb"?"college football games":"NFL games");

  if(spec.conferenceGameOnly)parts.push("that are conference matchups");
  if(spec.nonConferenceOnly)parts.push("that are non-conference matchups");
  if(spec.spreadMax!=null)parts.push("with a spread of "+spec.spreadMax+" points or less");
  if(spec.rankedOnly)parts.push("where both teams are ranked");
  else if(spec.rankedInvolved)parts.push("involving at least one ranked team");
  if(spec.top10Only)parts.push("with a Top 10 team involved");
  if(spec.sleeperOnly)parts.push("limited to strong unranked sleeper spots");
  if(spec.underdogOnly)parts.push("where BetRadar leans to the underdog");
  if(spec.favoriteOnly)parts.push("where BetRadar leans to the favorite");
  if(spec.betIndexMin!=null)parts.push("with BetIndex at least "+spec.betIndexMin);
  if(spec.neutralSiteOnly)parts.push("at neutral sites");
  if(spec.undefeatedOnly)parts.push("with an undefeated team involved");
  if(spec.winningTeamsOnly)parts.push("where both teams have winning records");
  if(spec.networks?.length)parts.push("on "+spec.networks.join(" or "));
  if(spec.kickoffWindow)parts.push("in the "+spec.kickoffWindow.toLowerCase()+" window");
  if(spec.state)parts.push(spec.state==="in"?"that are live":spec.state==="post"?"that are finished":"that are upcoming");
  return parts.join(", ")+".";
}

export function bestOpportunityForGame(game){return game?.bestOpportunity||null;}
export function spreadForGame(game){return spreadValue(game);}

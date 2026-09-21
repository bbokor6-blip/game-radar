import { NextResponse } from "next/server";
import { fetchScoreboard, fetchSeasonScoreboard, fetchConsensusOdds } from "../../../lib/espn";
import { rankGames } from "../../../lib/interest";
import { buildTrendProfiles, buildVegasHistory, consensusMarket, evaluateOpportunity, marketSummary } from "../../../lib/opportunity";
import { buildRadarIndex } from "../../../lib/radarIndex";

export const dynamic = "force-dynamic";

async function mapLimit(items,limit,fn){
  const out=new Array(items.length);
  let cursor=0;
  async function worker(){
    while(true){
      const i=cursor++;
      if(i>=items.length)return;
      try{out[i]=await fn(items[i],i);}catch{out[i]=[];}
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return out;
}

function selectRelevantHistory(history,upcoming,league){
  const wanted=new Set(upcoming.flatMap(g=>[String(g.home?.id||""),String(g.away?.id||"")]).filter(Boolean));
  const counts=new Map();
  const selected=[];
  const maxGames=league==="cfb"?48:24;
  const sorted=history.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
  for(const game of sorted){
    const ids=[String(game.home?.id||""),String(game.away?.id||"")];
    const useful=ids.some(id=>wanted.has(id)&&(counts.get(id)||0)<2);
    if(!useful)continue;
    selected.push(game);
    for(const id of ids)if(wanted.has(id))counts.set(id,(counts.get(id)||0)+1);
    if(selected.length>=maxGames)break;
  }
  return selected;
}

function mergeHistoricalMarket(game,market){
  if(!market)return game;
  return {
    ...game,
    market:{
      ...(game.market||{}),
      homeMargin:market.homeMargin,
      overUnder:market.total,
      homeSpreadOdds:market.homeSpreadOdds,
      awaySpreadOdds:market.awaySpreadOdds,
      overOdds:market.overOdds,
      underOdds:market.underOdds,
      provider:market.spreadSource||market.totalSource||game.market?.provider||null
    }
  };
}

export async function GET(request){
  const {searchParams}=new URL(request.url);
  const league=searchParams.get("league")==="cfb"?"cfb":"nfl";
  const start=searchParams.get("start");
  const end=searchParams.get("end");
  if(!start||!end)return NextResponse.json({error:"start and end are required"},{status:400});

  const year=Number(start.slice(0,4))||new Date().getFullYear();
  try{
    const weekGames=(await fetchScoreboard(league,start,end)).filter(g=>g.sport===league);
    const upcoming=rankGames(weekGames.filter(g=>g.state==="pre"));

    let seasonGames=[];
    let historyLoadError=null;
    try{
      seasonGames=(await fetchSeasonScoreboard(league,year)).filter(g=>g.sport===league);
    }catch(error){
      historyLoadError=String(error?.message||error);
      console.error("historical scoreboard error",error);
    }

    const history=seasonGames.filter(g=>g.state==="post"&&new Date(g.date)<new Date(start+"T12:00:00Z"));
    const selectedHistory=selectRelevantHistory(history,upcoming,league);

    // Current lines: hydrate only the highest-interest games. Every other game still
    // uses the fresh line included in the weekly scoreboard payload.
    const currentLimit=league==="cfb"?24:upcoming.length;
    const currentTargets=upcoming.slice(0,currentLimit);
    const [currentOdds,historicalOdds]=await Promise.all([
      mapLimit(currentTargets,8,game=>fetchConsensusOdds(league,game.sourceId,game.competitionId,900)),
      mapLimit(selectedHistory,8,game=>fetchConsensusOdds(league,game.sourceId,game.competitionId,86400))
    ]);

    const currentMarkets=new Map();
    currentTargets.forEach((game,index)=>{
      const quotes=currentOdds[index]||[];
      if(quotes.length)currentMarkets.set(game.id,quotes);
    });

    const historicalMarkets=new Map();
    selectedHistory.forEach((game,index)=>{
      const quotes=historicalOdds[index]||[];
      if(quotes.length)historicalMarkets.set(game.id,consensusMarket(game,quotes));
    });
    const hydratedHistory=history.map(game=>historicalMarkets.has(game.id)?mergeHistoricalMarket(game,historicalMarkets.get(game.id)):game);

    const profiles=buildTrendProfiles(hydratedHistory);
    const vegasHistory=buildVegasHistory(hydratedHistory,league);

    const games=upcoming.map((game)=>{
      const allOdds=currentMarkets.get(game.id)||[];
      const market=consensusMarket(game,allOdds);
      const opportunities=evaluateOpportunity(game,profiles,market,vegasHistory,league);
      const candidates=[opportunities.spread,opportunities.total].filter(Boolean);
      const best=candidates.sort((a,b)=>b.index-a.index)[0]||null;
      const radarIndex=buildRadarIndex(game,best?.index||null);
      const preferredPick=best?{
        gameId:game.id,
        matchup:(game.away?.location||game.away?.short)+" @ "+(game.home?.location||game.home?.short),
        type:best.type,
        pick:best.pick,
        americanOdds:best.americanOdds??null,
        betRadarIndex:best.index,
        radarIndex:radarIndex.score,
        label:best.label,
        why:best.why,
        line:marketSummary(game,market),
        gameDate:game.date,
        status:"OPEN"
      }:{
        gameId:game.id,
        matchup:(game.away?.location||game.away?.short)+" @ "+(game.home?.location||game.home?.short),
        type:"PASS",
        pick:"PASS",
        americanOdds:null,
        betRadarIndex:0,
        radarIndex:radarIndex.score,
        label:"NO OFFICIAL EDGE",
        why:"No betting signal is strong enough to lock yet.",
        line:marketSummary(game,market),
        gameDate:game.date,
        status:"PASS"
      };
      return {
        ...game,
        marketConsensus:{...market,line:marketSummary(game,market),available:Boolean(market.homeMargin!=null||market.total!=null)},
        opportunities,
        bestOpportunity:best,
        preferredPick,
        opportunityIndex:best?.index||0,
        radarIndex
      };
    }).sort((a,b)=>(b.radarIndex?.score||0)-(a.radarIndex?.score||0)||b.opportunityIndex-a.opportunityIndex);

    return NextResponse.json({
      generatedAt:new Date().toISOString(),
      league,year,range:{start,end},
      methodology:{
        name:"Bet Radar",
        description:"Transparent opportunity signals from ATS/total trends, historical market outcomes and current sportsbook lines. Outlier quotes are rejected against the broader market before display.",
        historyGames:history.length,
        historyLoadError,
        currentGames:upcoming.length,
        currentOddsGamesHydrated:currentMarkets.size,
        historicalOddsGamesHydrated:historicalMarkets.size,
        historicalSpreadGames:vegasHistory.spreadGames,
        historicalTotalGames:vegasHistory.totalGames,
        vegasHistory
      },
      games
    },{headers:{"Cache-Control":"private, no-store, max-age=0"}});
  }catch(error){
    console.error("bet radar error",error);
    return NextResponse.json({error:"Bet radar unavailable",detail:String(error?.message||error)},{status:500});
  }
}

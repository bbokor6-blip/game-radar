import { NextResponse } from "next/server";
import { fetchScoreboard, fetchSeasonScoreboard, fetchConsensusOdds } from "../../../lib/espn";
import { rankGames } from "../../../lib/interest";
import { buildTrendProfiles, buildVegasHistory, consensusMarket, evaluateOpportunity, marketSummary } from "../../../lib/opportunity";
import { buildRadarIndex } from "../../../lib/radarIndex";
import { buildFeedbackProfile, feedbackForPick } from "../../../lib/radarFeedback";
import { buildTeamForm } from "../../../lib/teamForm";
import { enrichGamesWithSeasonContext, seasonCoverage } from "../../../lib/seasonContext";
import { buildPowerModel, calibrateModel, projectGame } from "../../../lib/radarModel";
import { calibratePickIndex, pickConfidenceBand } from "../../../lib/pickCalibration";
import radarLedger from "../../../data/radar-picks.json";

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

function recordWins(record){
  const wins=Number(String(record||"").split("-")[0]);
  return Number.isFinite(wins)?wins:0;
}

function fullSlateFallback(game,market,radarIndex){
  const homeRank=Number(game.home?.rank)||99;
  const awayRank=Number(game.away?.rank)||99;
  const homeWins=recordWins(game.home?.record);
  const awayWins=recordWins(game.away?.record);
  const homeScore=(awayRank-homeRank)*2+(homeWins-awayWins)*3+2;
  const side=homeScore>=0?"home":"away";
  const team=side==="home"?game.home:game.away;

  if(Number.isFinite(market.homeMargin)){
    const homeSpread=-market.homeMargin;
    const spread=side==="home"?homeSpread:-homeSpread;
    const pick=team.short+" "+(spread>0?"+":"")+Math.round(spread*10)/10;
    return {
      type:"SPREAD",pick,
      americanOdds:side==="home"?market.homeSpreadOdds:market.awaySpreadOdds,
      index:48,label:"LOW CONFIDENCE",
      why:"The full-slate model requires a side in every game. With no stronger trend signal available, this is the lower-confidence lean based on team strength, record and home field at the locked market number.",
      side,fullSlateFallback:true,radarIndex:radarIndex.score
    };
  }

  return {
    type:"MONEYLINE",pick:team.short+" TO WIN",americanOdds:null,index:40,label:"LOW CONFIDENCE",
    why:"No posted spread was available at lock. PickRadar is recording a straight-up winner so the entire slate remains measurable; confidence stays deliberately low.",
    side,fullSlateFallback:true,radarIndex:radarIndex.score
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
    const rawWeekGames=(await fetchScoreboard(league,start,end)).filter(g=>g.sport===league);
    const throughWeek=Math.max(1,...rawWeekGames.map(g=>Number(g.week)||0));

    let seasonGames=[];
    let historyLoadError=null;
    try{
      seasonGames=(await fetchSeasonScoreboard(league,year,throughWeek)).filter(g=>g.sport===league);
    }catch(error){
      historyLoadError=String(error?.message||error);
      console.error("historical scoreboard error",error);
    }

    const contextualWeekGames=enrichGamesWithSeasonContext(rawWeekGames,seasonGames);
    const upcoming=rankGames(contextualWeekGames.filter(g=>g.state==="pre"));
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
    const teamForm=buildTeamForm(hydratedHistory,profiles);
    const powerModel=buildPowerModel(hydratedHistory,league);
    const modelCalibration=calibrateModel(hydratedHistory,league);
    const feedbackProfile=buildFeedbackProfile(radarLedger);

    const games=upcoming.map((game)=>{
      const allOdds=currentMarkets.get(game.id)||[];
      const market=consensusMarket(game,allOdds);
      const projection=projectGame(game,powerModel);
      const rawOpportunities=evaluateOpportunity(game,profiles,market,vegasHistory,league,{projection});
      const opportunities=Object.fromEntries(Object.entries(rawOpportunities).map(([key,value])=>{
        if(!value)return [key,value];
        const index=calibratePickIndex(value.index,{league,type:value.type});
        return [key,{...value,index,label:pickConfidenceBand(index),highConviction:index>=80,noBrainer:index>=85}];
      }));
      const candidates=[opportunities.spread,opportunities.total].filter(Boolean);
      const best=candidates.sort((a,b)=>b.index-a.index)[0]||null;
      const feedback=best?feedbackForPick(feedbackProfile,{league,type:best.type,index:best.index}):{modifier:0,sample:0,note:"Building sample"};
      const adjustedBettingIndex=best?calibratePickIndex(best.index+feedback.modifier,{league,type:best.type}):null;
      const radarIndex=buildRadarIndex(game,adjustedBettingIndex);
      const official=best?{...best,index:adjustedBettingIndex}:fullSlateFallback(game,market,radarIndex);
      const preferredPick=official?{
        gameId:game.id,
        matchup:(game.away?.location||game.away?.short)+" @ "+(game.home?.location||game.home?.short),
        type:official.type,
        side:official.side||null,
        pick:official.pick,
        americanOdds:official.americanOdds??null,
        betRadarIndex:official.index,
        feedbackAdjustedBetIndex:best?adjustedBettingIndex:official.index,
        confidenceBand:pickConfidenceBand(official.index),
        feedback,
        radarIndex:radarIndex.score,
        label:official.label,
        why:official.why,
        line:marketSummary(game,market),
        gameDate:game.date,
        status:"OPEN",
        fullSlateFallback:Boolean(official.fullSlateFallback),
        lockedMarket:{
          homeMargin:market.homeMargin??null,
          total:market.total??null,
          providerCount:market.providerCount||0,
          providers:market.providers||[]
        },
        modelProjection:{
          homeMargin:projection.homeMargin,
          total:projection.total,
          homePoints:projection.homePoints,
          awayPoints:projection.awayPoints,
          historicalGames:powerModel.completedCount,
          calibrationSamples:modelCalibration.samples
        },
        closingMarket:null,
        closingLineValue:null
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
        feedback,
        adjustedBettingIndex,
        teamForm:{
          home:teamForm.get(String(game.home?.id||game.home?.short||""))||null,
          away:teamForm.get(String(game.away?.id||game.away?.short||""))||null
        },
        opportunityIndex:best?.index||0,
        radarIndex
      };
    }).sort((a,b)=>(b.radarIndex?.score||0)-(a.radarIndex?.score||0)||b.opportunityIndex-a.opportunityIndex);

    return NextResponse.json({
      generatedAt:new Date().toISOString(),
      league,year,range:{start,end},
      methodology:{
        name:"Bet Radar",
        description:"Opponent-adjusted team strength and projected margin lead the model; ATS trends, market history and current consensus lines provide supporting evidence and confidence calibration.",
        historyGames:history.length,
        seasonCoverage:seasonCoverage(seasonGames),
        seasonSource:"ESPN week-by-week schedule archive",
        historyLoadError,
        currentGames:upcoming.length,
        currentOddsGamesHydrated:currentMarkets.size,
        historicalOddsGamesHydrated:historicalMarkets.size,
        historicalSpreadGames:vegasHistory.spreadGames,
        historicalTotalGames:vegasHistory.totalGames,
        vegasHistory,
        radarFeedback:feedbackProfile,
        powerModel:{
          historicalGames:powerModel.completedCount,
          calibration:modelCalibration,
          weights:{fundamentals:0.70,trends:0.30},
          confidenceRules:{highConfidence:80,modelLean:70,totalsCap:69}
        }
      },
      games
    },{headers:{"Cache-Control":"private, no-store, max-age=0"}});
  }catch(error){
    console.error("bet radar error",error);
    return NextResponse.json({error:"Bet radar unavailable",detail:String(error?.message||error)},{status:500});
  }
}

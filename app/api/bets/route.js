import { NextResponse } from "next/server";
import { fetchScoreboard, fetchSeasonScoreboard, fetchConsensusOdds } from "../../../lib/espn";
import { rankGames } from "../../../lib/interest";
import { buildTrendProfiles, buildVegasHistory, consensusMarket, evaluateOpportunity, marketSummary } from "../../../lib/opportunity";

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

export async function GET(request){
  const {searchParams}=new URL(request.url);
  const league=searchParams.get("league")==="cfb"?"cfb":"nfl";
  const start=searchParams.get("start");
  const end=searchParams.get("end");
  if(!start||!end)return NextResponse.json({error:"start and end are required"},{status:400});

  const year=Number(start.slice(0,4))||new Date().getFullYear();
  try{
    const [weekGames,seasonGames]=await Promise.all([
      fetchScoreboard(league,start,end),
      fetchSeasonScoreboard(league,year)
    ]);

    const upcoming=rankGames(weekGames.filter(g=>g.state==="pre"));
    const history=seasonGames.filter(g=>g.state==="post"&&new Date(g.date)<new Date(start+"T12:00:00Z"));
    const profiles=buildTrendProfiles(history);
    const vegasHistory=buildVegasHistory(history,league);

    const oddsResults=await mapLimit(upcoming,10,game=>fetchConsensusOdds(league,game.sourceId));

    const games=upcoming.map((game,index)=>{
      const allOdds=oddsResults[index]||[];
      const fanDuel=allOdds.find(o=>String(o.providerId)==="37"||/fanduel/i.test(String(o.provider||"")));
      const market=fanDuel?consensusMarket(game,[fanDuel]):{
        homeMargin:null,total:null,homeSpreadOdds:null,awaySpreadOdds:null,overOdds:null,underOdds:null,
        providerCount:0,providers:[],spreadDispersion:0,totalDispersion:0
      };
      const opportunities=evaluateOpportunity(game,profiles,market,vegasHistory,league);
      const candidates=[opportunities.spread,opportunities.total].filter(Boolean);
      const best=candidates.sort((a,b)=>b.index-a.index)[0]||null;
      return {
        ...game,
        marketConsensus:{...market,line:fanDuel?marketSummary(game,market):null,book:"FanDuel",available:Boolean(fanDuel)},
        opportunities,
        bestOpportunity:best,
        opportunityIndex:best?.index||0
      };
    }).sort((a,b)=>b.opportunityIndex-a.opportunityIndex||b.interest.score-a.interest.score);

    return NextResponse.json({
      generatedAt:new Date().toISOString(),
      league,year,range:{start,end},
      methodology:{
        name:"Bet Radar",
        description:"Transparent opportunity signals from ATS/total trends, historical market outcomes and current FanDuel lines. No independent projected spread.",
        historyGames:history.length,
        historicalSpreadGames:vegasHistory.spreadGames,
        historicalTotalGames:vegasHistory.totalGames,
        vegasHistory
      },
      games
    },{headers:{"Cache-Control":"public, s-maxage=300, stale-while-revalidate=300"}});
  }catch(error){
    console.error("bet radar error",error);
    return NextResponse.json({error:"Bet radar unavailable",detail:String(error?.message||error)},{status:500});
  }
}

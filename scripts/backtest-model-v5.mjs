import fs from "node:fs";
import path from "node:path";
import { conferenceForTeam, conferenceTier } from "../lib/conferences.js";
import { buildPowerModel, projectGame } from "../lib/radarModel.js";
import { evaluateOpportunity } from "../lib/opportunity.js";
import { calibratePickIndex, pickConfidenceBand } from "../lib/pickCalibration.js";

const ROOT=process.cwd();
const LEDGER_PATH=path.resolve(ROOT,"data/radar-picks.json");
const SOURCE_PATH=path.resolve(ROOT,"data/football-source-of-truth.json");
const WRITE=process.argv.includes("--write");
const TARGET_START="2026-09-15";
const MODEL_VERSION="pickradar-v5-market-anchored-retrospective";

function normalizeTeam(team,league){
  const conference=league==="cfb"?conferenceForTeam({displayName:team?.name,abbreviation:team?.short}):null;
  return {
    ...team,
    location:team?.name,
    conference,
    conferenceTier:league==="cfb"?conferenceTier(conference):null,
    subdivision:league==="cfb"?(conference?"FBS":"FCS_OR_OTHER"):"NFL"
  };
}

function normalizeGame(row){
  return {
    id:`${row.league}-${row.eventId}`,
    sourceId:row.eventId,
    sport:row.league,
    date:row.kickoff,
    week:row.week,
    state:row.state,
    completed:row.completed,
    neutralSite:Boolean(row.neutralSite),
    home:normalizeTeam(row.home,row.league),
    away:normalizeTeam(row.away,row.league)
  };
}

function grade(game,opportunity,market){
  const homeScore=Number(game.home.score);
  const awayScore=Number(game.away.score);
  if(opportunity.type==="SPREAD"){
    const homeMargin=homeScore-awayScore;
    const result=opportunity.side==="home"?homeMargin-market.homeMargin:market.homeMargin-homeMargin;
    return result>0?"W":result<0?"L":"PUSH";
  }
  if(opportunity.type==="TOTAL"){
    const result=homeScore+awayScore-market.total;
    return result>0?(opportunity.side==="over"?"W":"L"):result<0?(opportunity.side==="under"?"W":"L"):"PUSH";
  }
  return "PENDING";
}

function record(picks){
  const wins=picks.filter(p=>p.result==="W").length;
  const losses=picks.filter(p=>p.result==="L").length;
  const pushes=picks.filter(p=>p.result==="PUSH").length;
  return {wins,losses,pushes,decisions:wins+losses,winPct:wins+losses?Math.round((wins/(wins+losses))*1000)/10:null};
}

function bands(picks){
  const output={"80+":[],"70-79":[],"60-69":[],"<60":[]};
  for(const pick of picks){
    const key=pick.betRadarIndex>=80?"80+":pick.betRadarIndex>=70?"70-79":pick.betRadarIndex>=60?"60-69":"<60";
    output[key].push(pick);
  }
  return Object.fromEntries(Object.entries(output).map(([key,rows])=>[key,record(rows)]));
}

const ledger=JSON.parse(fs.readFileSync(LEDGER_PATH,"utf8"));
const source=JSON.parse(fs.readFileSync(SOURCE_PATH,"utf8"));
const allGames=source.games.map(normalizeGame);
const backtestedAt=new Date().toISOString();
const summaries=[];

ledger.weeks=ledger.weeks.map(week=>{
  if(week.weekStart!==TARGET_START||week.lockType!=="RETROSPECTIVE_ARCHIVED_LINE_BACKTEST")return week;
  const leagueGames=allGames.filter(game=>game.sport===week.league);
  const cutoff=new Date(`${week.weekStart}T12:00:00Z`);
  const history=leagueGames.filter(game=>game.state==="post"&&new Date(game.date)<cutoff);
  const byId=new Map(leagueGames.map(game=>[game.id,game]));
  const model=buildPowerModel(history,week.league);
  const previousRecord=week.previousBacktest?.modelVersion==="pickradar-v4-retrospective"
    ?{
      wins:week.previousBacktest.wins,
      losses:week.previousBacktest.losses,
      pushes:week.previousBacktest.pushes,
      decisions:week.previousBacktest.decisions,
      winPct:week.previousBacktest.winPct
    }
    :record(week.picks||[]);

  const picks=(week.picks||[]).map(previous=>{
    const game=byId.get(previous.gameId);
    if(!game)throw new Error(`Missing source game ${previous.gameId}`);
    const market={
      ...previous.lockedMarket,
      homeSpreadOdds:null,
      awaySpreadOdds:null,
      overOdds:null,
      underOdds:null,
      spreadDispersion:0,
      totalDispersion:0
    };
    const projection=projectGame(game,model);
    const raw=evaluateOpportunity(game,new Map(),market,null,week.league,{projection});
    // Archived ESPN rows contain only one closing-line source. Keep that data
    // quality penalty in the published retrospective BetIndex, but also record
    // the score the same signal would receive with a normal three-book market.
    // This makes confidence-band analysis useful without overstating the lock.
    const analysisRaw=evaluateOpportunity(game,new Map(),{...market,providerCount:3},null,week.league,{projection});
    const opportunities=[raw.spread,raw.total].filter(Boolean).map(opportunity=>{
      const index=calibratePickIndex(opportunity.index,{league:week.league,type:opportunity.type});
      return {...opportunity,index,label:pickConfidenceBand(index)};
    }).sort((a,b)=>b.index-a.index);
    const selected=opportunities[0];
    if(!selected)throw new Error(`No Model v5 opportunity for ${previous.gameId}`);
    const analysisOpportunity=analysisRaw[selected.type.toLowerCase()];
    const analysisBetIndex=calibratePickIndex(analysisOpportunity?.index??selected.index,{league:week.league,type:selected.type});
    const result=grade(game,selected,market);
    return {
      ...previous,
      type:selected.type,
      pick:selected.pick,
      americanOdds:selected.americanOdds??null,
      betRadarIndex:selected.index,
      analysisBetIndex,
      analysisConfidenceBand:pickConfidenceBand(analysisBetIndex),
      label:selected.label,
      confidenceBand:pickConfidenceBand(selected.index),
      why:selected.why,
      line:selected.pick,
      side:selected.side,
      result,
      finalScore:`${game.away.short} ${game.away.score}, ${game.home.short} ${game.home.score}`,
      modelProjection:{
        homeMargin:projection.homeMargin,
        total:projection.total,
        homePoints:projection.homePoints,
        awayPoints:projection.awayPoints,
        powerMargin:projection.powerMargin,
        scoreMargin:projection.scoreMargin,
        reliability:projection.reliability,
        historicalGames:model.completedCount
      },
      modelVersion:MODEL_VERSION,
      backtestedAt,
      selectionBasis:"Model v5 walk-forward backtest; archived closing-line proxy",
      gradedAt:backtestedAt,
      retrospective:true,
      excludeFromCalibration:true,
      versionHistory:String(previous.modelVersion||"").startsWith("pickradar-v5")
        ?(previous.versionHistory||[])
        :[
          ...(previous.versionHistory||[]),
          {backtestedAt,pick:previous.pick,betRadarIndex:previous.betRadarIndex,modelVersion:previous.modelVersion,reason:"Superseded by requested Model v5 retrospective override"}
        ]
    };
  });

  const currentRecord=record(picks);
  const changedPicks=picks.filter((pick,index)=>pick.pick!==week.picks[index]?.pick||pick.type!==week.picks[index]?.type).length;
  summaries.push({league:week.league,previous:previousRecord,modelV5:currentRecord,changedPicks,bands:bands(picks),types:Object.fromEntries(["SPREAD","TOTAL"].map(type=>[type,record(picks.filter(p=>p.type===type))]))});
  return {
    ...week,
    label:(week.league==="cfb"?"College":"NFL")+" · 2026-09-15–2026-09-21 · Model v5 retrospective",
    backtestedAt,
    methodologyNote:"Model v5 walk-forward backtest using only prior completed games and the same archived ESPN market numbers. Archived lines remain closing-line proxies, not timestamped weekly locks.",
    previousBacktest:week.previousBacktest||{modelVersion:"pickradar-v4-retrospective",...previousRecord,replacedAt:backtestedAt},
    picks
  };
});

ledger.version=6;
ledger.updatedAt=backtestedAt;
if(WRITE)fs.writeFileSync(LEDGER_PATH,JSON.stringify(ledger,null,2)+"\n");
process.stdout.write(JSON.stringify({write:WRITE,modelVersion:MODEL_VERSION,summaries},null,2)+"\n");

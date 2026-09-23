import test from "node:test";
import assert from "node:assert/strict";
import { buildPowerModel, projectGame } from "../lib/radarModel.js";
import { evaluateOpportunity } from "../lib/opportunity.js";

function team(id,subdivision="FBS"){
  return {id,short:id,subdivision};
}

function completed({id,home,away,homeScore,awayScore,neutralSite=false}){
  return {id,date:`2026-09-${id.padStart(2,"0")}T12:00:00Z`,state:"post",home:{...home,score:homeScore},away:{...away,score:awayScore},neutralSite};
}

test("early-season blowouts are regularized rather than treated as stable power",()=>{
  const games=[completed({id:"01",home:team("A"),away:team("B"),homeScore:70,awayScore:0})];
  const model=buildPowerModel(games,"cfb");
  assert.ok(model.teams.get("A").power<15,"one result should remain strongly regressed");
  assert.ok(model.teams.get("A").ratingReliability<.2);
});

test("neutral-site projections do not add home field",()=>{
  const history=[
    completed({id:"01",home:team("A"),away:team("B"),homeScore:24,awayScore:21,neutralSite:true}),
    completed({id:"02",home:team("B"),away:team("A"),homeScore:24,awayScore:21,neutralSite:true})
  ];
  const model=buildPowerModel(history,"cfb");
  const neutral=projectGame({home:team("A"),away:team("B"),neutralSite:true},model);
  const hosted=projectGame({home:team("A"),away:team("B"),neutralSite:false},model);
  assert.equal(Math.round((hosted.homeMargin-neutral.homeMargin)*10)/10,model.homeField);
});

test("ATS streaks and Vegas buckets cannot change Model v5 side",()=>{
  const game={home:team("HOME"),away:team("AWAY"),availabilityUncertainty:0};
  const market={homeMargin:3,total:45,providerCount:3,spreadDispersion:.2,totalDispersion:.3};
  const projection={homeMargin:7,total:47,homeGames:5,awayGames:5,powerMargin:8,scoreMargin:6,reliability:.5};
  const hostileProfiles=new Map([
    ["HOME",{games:5,atsLineGames:5,atsGames:5,atsWins:0,atsPct:0,atsCoverage:1,recentAtsGames:3,recentAtsPct:0}],
    ["AWAY",{games:5,atsLineGames:5,atsGames:5,atsWins:5,atsPct:1,atsCoverage:1,recentAtsGames:3,recentAtsPct:1}]
  ]);
  const hostileBuckets={spreadCoverage:1,totalCoverage:1,spreads:{"0-3.5":{games:100,favoriteCovers:1,underdogCovers:99,favoriteCoverPct:.01,underdogCoverPct:.99}},totals:{mid:{games:100,overs:1,unders:99,overPct:.01,underPct:.99}}};
  const result=evaluateOpportunity(game,hostileProfiles,market,hostileBuckets,"nfl",{projection});
  assert.equal(result.spread.side,"home");
  assert.equal(result.total.side,"over");
  assert.equal(result.spread.evidenceQuality.trendUsable,false);
});

test("thin evidence cannot be labeled STRONG",()=>{
  const game={home:team("HOME"),away:team("AWAY")};
  const market={homeMargin:0,total:45,providerCount:1,spreadDispersion:0,totalDispersion:0};
  const projection={homeMargin:20,total:60,homeGames:2,awayGames:2,powerMargin:22,scoreMargin:18,reliability:.25};
  const result=evaluateOpportunity(game,new Map(),market,null,"nfl",{projection});
  assert.ok(result.spread.index<=69);
  assert.ok(result.total.index<=69);
});

test("cross-subdivision blowouts receive reduced effective weight",()=>{
  const fbs=team("FBS","FBS");
  const fcs=team("FCS","FCS_OR_OTHER");
  const model=buildPowerModel([completed({id:"01",home:fbs,away:fcs,homeScore:70,awayScore:0})],"cfb");
  assert.equal(model.teams.get("FBS").effectiveGames,.35);
  assert.ok(model.teams.get("FBS").ratingReliability<.1);
});

test("market anchoring shrinks the actionable edge",()=>{
  const game={home:team("HOME"),away:team("AWAY")};
  const market={homeMargin:3,total:45,providerCount:3,spreadDispersion:.2,totalDispersion:.3};
  const projection={homeMargin:15,total:55,homeGames:5,awayGames:5,powerMargin:16,scoreMargin:14,reliability:.5};
  const result=evaluateOpportunity(game,new Map(),market,null,"nfl",{projection});
  assert.ok(result.spread.adjustedModelEdge<result.spread.rawModelEdge);
  assert.ok(result.spread.fairMargin>market.homeMargin&&result.spread.fairMargin<projection.homeMargin);
});

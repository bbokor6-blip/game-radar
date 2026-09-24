import test from "node:test";
import assert from "node:assert/strict";
import ledger from "../data/radar-picks.json" with {type:"json"};
import overrides from "../data/pickradar-overrides.json" with {type:"json"};
import { attachOfficialPicks, mergeOfficialWeeks } from "../lib/officialPicks.js";

test("unmatched overrides cannot add fixtures to a locked slate",()=>{
  const weeks=mergeOfficialWeeks(ledger,overrides);
  const week=weeks.find(w=>w.league==="nfl"&&w.weekStart==="2026-09-22");
  assert.equal(week.picks.length,16);
  assert.equal(new Set(week.picks.map(p=>p.gameId)).size,16);
});

test("locked pick wins over a contrary refreshed model and stays the only suggestion",()=>{
  const game={id:"g1",date:"2026-09-27T17:00:00Z",away:{short:"AWAY",location:"Away"},home:{short:"HOME",location:"Home"},
    marketConsensus:{available:true,homeMargin:3,providerCount:1,line:"HOME -3"},
    bestOpportunity:{type:"SPREAD",pick:"HOME -3",index:82,why:"Current model picked home"},
    preferredPick:{type:"SPREAD",pick:"HOME -3",betRadarIndex:82},opportunities:{spread:{pick:"HOME -3"}}};
  const weeks=[{league:"nfl",weekStart:"2026-09-22",lockedAt:"2026-09-22T04:00:00Z",picks:[
    {gameId:"g1",type:"SPREAD",pick:"AWAY +3",betRadarIndex:56,americanOdds:-110,why:"Locked away pick",result:"PENDING"}
  ]}];
  const [resolved]=attachOfficialPicks([game],weeks,{league:"nfl",start:"2026-09-22",now:Date.parse("2026-09-24")});
  assert.equal(resolved.officialPick.pick,"AWAY +3");
  assert.equal(resolved.bestOpportunity.pick,"AWAY +3");
  assert.deepEqual(Object.keys(resolved.opportunities),["spread"]);
  assert.equal(resolved.opportunities.spread.pick,"AWAY +3");
  assert.equal(resolved.officialPick.betRadarIndex,56);
});

test("games beyond seven days stay pending when no lock exists",()=>{
  const game={id:"future",date:"2026-10-04T17:00:00Z",marketConsensus:{available:true},
    bestOpportunity:{pick:"HOME -3"},preferredPick:{type:"SPREAD",pick:"HOME -3"}};
  const [resolved]=attachOfficialPicks([game],[],{league:"nfl",start:"2026-09-29",now:Date.parse("2026-09-24")});
  assert.equal(resolved.officialPick,null);
  assert.equal(resolved.bestOpportunity,null);
});

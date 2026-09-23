import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ledger=JSON.parse(fs.readFileSync(new URL("../data/radar-picks.json",import.meta.url),"utf8"));
const weeks=ledger.weeks.filter(week=>week.weekStart==="2026-09-15"&&week.lockType==="RETROSPECTIVE_ARCHIVED_LINE_BACKTEST");
const picks=weeks.flatMap(week=>week.picks||[]);

test("Model v5 retrospective override preserves the complete 91-game slate",()=>{
  assert.equal(weeks.length,2);
  assert.equal(picks.length,91);
  assert.ok(picks.every(pick=>pick.modelVersion==="pickradar-v5-market-anchored-retrospective"));
});

test("Model v5 retrospective record reconciles",()=>{
  assert.equal(picks.filter(pick=>pick.result==="W").length,46);
  assert.equal(picks.filter(pick=>pick.result==="L").length,44);
  assert.equal(picks.filter(pick=>pick.result==="PUSH").length,1);
});

test("the superseded v4 result remains auditable",()=>{
  const prior=weeks.reduce((totals,week)=>({
    wins:totals.wins+week.previousBacktest.wins,
    losses:totals.losses+week.previousBacktest.losses,
    pushes:totals.pushes+week.previousBacktest.pushes
  }),{wins:0,losses:0,pushes:0});
  assert.deepEqual(prior,{wins:35,losses:55,pushes:1});
  assert.ok(picks.every(pick=>pick.versionHistory.some(version=>version.modelVersion==="pickradar-v4-retrospective")));
});

test("single-source archived lines cannot present as high confidence",()=>{
  assert.ok(picks.every(pick=>pick.betRadarIndex<60));
});

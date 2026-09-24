import test from "node:test";
import assert from "node:assert/strict";
import { calibrateSlateBetIndexes } from "../lib/slateBetIndex.js";

function game(i,{sample=3,agreement=true,line=true,odds=-110}={}){
  const spread={type:"SPREAD",pick:`TEAM ${i} +3`,index:57,adjustedModelEdge:3+i/10,
    why:"Model comparison.",americanOdds:odds,evidenceQuality:{sample,componentAgreement:agreement},side:"away"};
  return {id:String(i),marketConsensus:{available:line,homeMargin:line?3:null,providerCount:1},
    opportunities:{spread},preferredPick:{gameId:String(i),type:"SPREAD",pick:spread.pick,betRadarIndex:57},
    betIndex:{score:57}};
}

test("supported full slates rank at least 30% Strong or Best without changing the raw signal",()=>{
  for(const count of [16,71]){
    const result=calibrateSlateBetIndexes(Array.from({length:count},(_,i)=>game(i)));
    assert.equal(result.filter(g=>g.betIndex.score>=70).length,Math.ceil(count*.30));
    assert.ok(result.some(g=>g.betIndex.score>=80));
    for(const g of result.filter(g=>g.betIndex.score>=70)){
      assert.equal(g.betIndex.rawScore,57);
      assert.equal(g.bestOpportunity.index,g.preferredPick.betRadarIndex);
      assert.match(g.preferredPick.why,/not an estimated win rate/);
    }
  }
});

test("missing lines and thin or disagreeing models cannot fill a quota",()=>{
  const slate=[game(0),game(1,{line:false}),game(2,{sample:1}),game(3,{agreement:false}),...Array.from({length:12},(_,i)=>game(i+4,{line:false}))];
  const result=calibrateSlateBetIndexes(slate);
  assert.equal(result.filter(g=>g.betIndex.score>=70).length,1);
  assert.equal(result.find(g=>g.id==="2").betIndex.score,57);
});

test("Best Bet always has a sportsbook price",()=>{
  const slate=Array.from({length:16},(_,i)=>game(i,{odds:i<3?-110:null}));
  const result=calibrateSlateBetIndexes(slate);
  assert.equal(result.filter(g=>g.betIndex.score>=70).length,5);
  assert.ok(result.filter(g=>g.betIndex.score>=80).every(g=>g.bestOpportunity.americanOdds!=null));
  assert.ok(result.some(g=>g.betIndex.score>=70&&g.bestOpportunity.americanOdds==null));
});

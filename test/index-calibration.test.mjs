import test from "node:test";
import assert from "node:assert/strict";
import { calibrateSlateGameIndexes } from "../lib/gameIndexCalibration.js";
import { buildFeedbackProfile, feedbackForPick } from "../lib/radarFeedback.js";

test("GameIndex distributes a full slate evenly across four tiers",()=>{
  const raw=Array.from({length:16},(_,i)=>({id:String(i),interest:{score:100-i}}));
  const ranked=calibrateSlateGameIndexes(raw,score=>score>=80?"Must Watch":score>=65?"Worth Watching":score>=50?"On the Radar":"Low Interest");
  const counts={green:0,yellow:0,orange:0,red:0};
  for(const item of ranked){
    const score=item.interest.score;
    counts[score>=80?"green":score>=65?"yellow":score>=50?"orange":"red"]++;
    assert.equal(item.interest.calibration,"slate-quartile");
    assert.ok(Number.isFinite(item.interest.rawScore));
  }
  assert.deepEqual(counts,{green:4,yellow:4,orange:4,red:4});
});

test("GameIndex preserves honest raw scores for small slates",()=>{
  const raw=Array.from({length:4},(_,i)=>({id:String(i),interest:{score:44-i}}));
  assert.equal(calibrateSlateGameIndexes(raw),raw);
});

test("retrospective outcomes feed BetIndex cautiously at partial weight",()=>{
  const picks=Array.from({length:30},(_,i)=>({
    league:"nfl",type:"SPREAD",betRadarIndex:72,result:i<21?"W":"L",
    retrospective:true,excludeFromCalibration:true
  }));
  const ledger={weeks:[{league:"nfl",picks}]};
  const ignored=buildFeedbackProfile(ledger);
  const learning=buildFeedbackProfile(ledger,{retrospectiveWeight:.35});
  assert.equal(ignored.overall.decisions,0);
  assert.equal(learning.overall.decisions,30);
  assert.ok(Math.abs(learning.overall.effectiveDecisions-10.5)<1e-9);
  const feedback=feedbackForPick(learning,{league:"nfl",type:"SPREAD",index:72});
  assert.ok(feedback.modifier>0);
  assert.equal(feedback.effectiveSample,10.5);
});

test("retrospective analysis groups results by production-quality signal band",()=>{
  const picks=[
    {league:"nfl",type:"SPREAD",betRadarIndex:55,analysisBetIndex:82,result:"W",retrospective:true,excludeFromCalibration:true},
    {league:"nfl",type:"SPREAD",betRadarIndex:54,analysisBetIndex:72,result:"L",retrospective:true,excludeFromCalibration:true}
  ];
  const profile=buildFeedbackProfile({weeks:[{league:"nfl",picks}]},{includeExcluded:true,useAnalysisIndex:true});
  assert.equal(profile.byBand["80+"].wins,1);
  assert.equal(profile.byBand["70-79"].losses,1);
  assert.equal(profile.byBand["<55"].decisions,0);
});

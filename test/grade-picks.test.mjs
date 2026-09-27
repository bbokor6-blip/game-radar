import test from "node:test";
import assert from "node:assert/strict";
import { grade, lockedLine } from "../scripts/grade-picks.mjs";

const game={
  home:{name:"Tennessee Volunteers",short:"TENN",score:17},
  away:{name:"Texas Longhorns",short:"TEX",score:20}
};

test("spread grading uses the recorded pick line, including a loss despite a straight-up win",()=>{
  const pick={type:"SPREAD",pick:"Texas -3.5"};
  assert.deepEqual(lockedLine(pick,game),{side:"away",homeMargin:-3.5});
  assert.equal(grade(pick,game,lockedLine(pick,game)),"L");
});

test("a total push uses the posted pick number",()=>{
  const pick={type:"TOTAL",pick:"UNDER 37"};
  assert.equal(grade(pick,game,lockedLine(pick,game)),"PUSH");
});

test("unrecognized selections are not graded",()=>{
  assert.equal(lockedLine({type:"SPREAD",pick:"Unknown +3"},game),null);
});

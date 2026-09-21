function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function ranked(game) {
  return Boolean(game.home.rank || game.away.rank);
}

function rankedMatchup(game) {
  return Boolean(game.home.rank && game.away.rank);
}

function upset(game) {
  if (game.sport !== "cfb" || game.state !== "in") return false;
  if (!game.home.rank && game.away.rank && game.home.score > game.away.score) return true;
  if (!game.away.rank && game.home.rank && game.away.score > game.home.score) return true;
  return false;
}

function recordPct(record) {
  const match = String(record || "").match(/(\d+)-(\d+)/);
  if (!match) return .5;
  const wins = Number(match[1]), losses = Number(match[2]), total = wins + losses;
  return total ? wins / total : .5;
}

function marketSpread(game) {
  const spread = Number(game.market?.spread);
  return Number.isFinite(spread) ? Math.abs(spread) : null;
}

function marketTotal(game) {
  const total = Number(game.market?.overUnder);
  return Number.isFinite(total) ? total : null;
}

export function previewGame(game) {
  const reasons = [];
  let score = 24;
  const spread = marketSpread(game);
  const h = recordPct(game.home.record), a = recordPct(game.away.record);
  const gap = Math.abs(h-a);

  if (spread != null) {
    if (spread <= 2.5) { score += 45; reasons.push("market expects a toss-up"); }
    else if (spread <= 4.5) { score += 38; reasons.push("very tight betting line"); }
    else if (spread <= 7.5) { score += 30; reasons.push("one-score projection"); }
    else if (spread < 10) { score += 22; reasons.push("projected under-10 margin"); }
    else if (spread <= 13.5) { score += 8; reasons.push("within striking range"); }
    else if (spread >= 17) { score -= 15; reasons.push("market expects a mismatch"); }
  } else {
    if (gap <= .15) { score += 18; reasons.push("evenly matched records"); }
    else if (gap <= .3) { score += 9; reasons.push("competitive records"); }
    else { score -= 6; }
  }

  if (gap <= .15) score += 7;

  if (game.sport === "cfb") {
    if (rankedMatchup(game)) { score += 24; reasons.push("Top 25 showdown"); }
    else if (ranked(game)) { score += 11; reasons.push("Top 25 team"); }
    const ranks=[game.home.rank,game.away.rank].filter(Boolean);
    if (ranks.length && Math.min(...ranks)<=10) { score += 7; reasons.push("top-10 team"); }
  } else {
    const quality=(h+a)/2;
    if (quality >= .66) { score += 11; reasons.push("strong teams"); }
  }

  const total = marketTotal(game);
  if (total != null && ((game.sport === "nfl" && total >= 49) || (game.sport === "cfb" && total >= 58))) {
    score += 5;
    reasons.push("high-scoring market");
  }

  score=clamp(Math.round(score));
  const tier=score>=82?"Circle this game":score>=62?"Worth watching":"Keep on radar";
  return {score,tier,reason:reasons.slice(0,3).join(" · ")||"Matchup quality preview"};
}

export function recapGame(game) {
  const diff=Math.abs(game.home.score-game.away.score);
  let score=25; const reasons=[];
  if(diff<=3){score+=45;reasons.push("decided by 3 or fewer");}
  else if(diff<=7){score+=36;reasons.push("one-score finish");}
  else if(diff<10){score+=27;reasons.push("under-10 finish");}
  else if(diff<=14){score+=10;reasons.push("competitive finish");}
  else if(diff>=24){score-=12;}
  if(game.period>=5){score+=25;reasons.push("went to overtime");}
  if(game.sport==="cfb"){
    if(rankedMatchup(game)){score+=18;reasons.push("Top 25 matchup");}
    else if(ranked(game)){score+=8;reasons.push("ranked team involved");}
    const rankedTeam=game.home.rank?game.home:game.away.rank?game.away:null;
    const unrankedTeam=game.home.rank?game.away:game.home;
    if(rankedTeam && !unrankedTeam.rank && unrankedTeam.score>rankedTeam.score){score+=22;reasons.push("ranked upset");}
  }
  score=clamp(Math.round(score));
  return {score,tier:score>=80?"Game of the week":score>=60?"Great game":"Notable",reason:reasons.slice(0,3).join(" · ")||"Final score recap"};
}

export function scoreMarket(game, preview = null) {
  if (game.state !== "pre") return null;
  const spread = marketSpread(game);
  if (spread == null) return {score:0,tier:"Line pending",reason:"Market line has not posted yet."};

  let score=26; const reasons=[];
  if(spread<=2.5){score+=40;reasons.push("near pick'em");}
  else if(spread<=4.5){score+=33;reasons.push("very tight spread");}
  else if(spread<=7.5){score+=23;reasons.push("one-score market");}
  else if(spread<=10.5){score+=12;reasons.push("manageable spread");}
  else if(spread>=17){score-=12;reasons.push("large spread");}

  const total=marketTotal(game);
  if(total!=null){
    if((game.sport==="nfl"&&total>=50)||(game.sport==="cfb"&&total>=60)){score+=10;reasons.push("high total");}
    else if((game.sport==="nfl"&&total<=40)||(game.sport==="cfb"&&total<=44)){score+=4;reasons.push("low-total grinder");}
  }
  if(rankedMatchup(game)){score+=14;reasons.push("ranked spotlight");}
  else if(ranked(game)){score+=6;}
  if(preview?.score>=80) score+=7;
  score=clamp(Math.round(score));
  return {score,tier:score>=80?"Premium betting game":score>=60?"Strong market":"On the board",reason:reasons.slice(0,3).join(" · ")};
}

export function scoreGame(game) {
  if (game.state === "pre") return previewGame(game);
  if (game.state === "post") return recapGame(game);

  const diff = Math.abs(game.home.score - game.away.score);
  const period = game.period || 1;
  let score = 18;
  const reasons = [];

  if (diff <= 3) { score += 36; reasons.push("within a field goal"); }
  else if (diff <= 7) { score += 30; reasons.push("one-score game"); }
  else if (diff < 10) { score += 23; reasons.push("under-10 margin"); }
  else if (diff <= 14) { score += 9; reasons.push("still within striking distance"); }
  else if (diff >= 24) { score -= 25; reasons.push("score is getting out of hand"); }
  else if (diff >= 17) { score -= 13; }

  if (period >= 5) { score += 35; reasons.push("overtime"); }
  else if (period === 4) { score += 24; reasons.push("fourth quarter"); }
  else if (period === 3) { score += 10; reasons.push("second half"); }
  else if (period === 2) { score += 4; }

  if (period >= 4 && diff < 10) score += 16;
  if (period >= 3 && diff <= 3) score += 7;

  if (game.sport === "cfb") {
    if (rankedMatchup(game)) { score += 13; reasons.push("ranked matchup"); }
    else if (ranked(game)) { score += 7; reasons.push("ranked team involved"); }
    if (upset(game)) { score += 17; reasons.push("ranked upset brewing"); }
  }

  if (game.possessionId && period >= 4 && diff <= 8) {
    score += 5;
    reasons.push("late possession matters");
  }

  score = clamp(Math.round(score));

  let tier = "Skip for now";
  if (score >= 82) tier = "Turn it on now";
  else if (score >= 58) tier = "Keep an eye on it";

  const reason = reasons.length
    ? reasons.slice(0, 3).join(" · ")
    : "Live game, but no major urgency signal yet.";

  return { score, tier, reason };
}

export function rankGames(games) {
  return games
    .map((game) => {
      const interest = scoreGame(game);
      return { ...game, interest, marketInterest: scoreMarket(game, interest) };
    })
    .sort((a, b) => b.interest.score - a.interest.score);
}

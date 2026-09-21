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

export function previewGame(game) {
  const reasons = [];
  let score = 35;
  const h = recordPct(game.home.record), a = recordPct(game.away.record);
  const gap = Math.abs(h-a);
  if (gap <= .15) { score += 20; reasons.push("evenly matched records"); }
  else if (gap <= .3) { score += 10; reasons.push("competitive matchup"); }
  else { score -= 8; }
  if (game.sport === "cfb") {
    if (rankedMatchup(game)) { score += 30; reasons.push("Top 25 showdown"); }
    else if (ranked(game)) { score += 14; reasons.push("Top 25 team"); }
    const ranks=[game.home.rank,game.away.rank].filter(Boolean);
    if (ranks.length && Math.min(...ranks)<=10) { score += 8; reasons.push("top-10 team"); }
  } else {
    const quality=((h+a)/2);
    if (quality >= .66) { score += 15; reasons.push("strong teams"); }
  }
  score=clamp(Math.round(score));
  const tier=score>=80?"Circle this game":score>=60?"Worth watching":"Keep on radar";
  return {score,tier,reason:reasons.slice(0,3).join(" · ")||"Matchup quality preview"};
}

export function recapGame(game) {
  const diff=Math.abs(game.home.score-game.away.score);
  let score=25; const reasons=[];
  if(diff<=3){score+=38;reasons.push("decided by 3 or fewer");}
  else if(diff<=7){score+=28;reasons.push("one-score finish");}
  else if(diff<=10){score+=18;reasons.push("competitive finish");}
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

export function scoreGame(game) {
  if (game.state === "pre") return previewGame(game);
  if (game.state === "post") return recapGame(game);

  const diff = Math.abs(game.home.score - game.away.score);
  const period = game.period || 1;
  let score = 18;
  const reasons = [];

  if (diff <= 3) { score += 26; reasons.push("one-score game"); }
  else if (diff <= 7) { score += 21; reasons.push("one possession"); }
  else if (diff <= 10) { score += 12; reasons.push("still within striking distance"); }
  else if (diff >= 24) { score -= 25; reasons.push("score is getting out of hand"); }
  else if (diff >= 17) { score -= 13; }

  if (period >= 5) { score += 35; reasons.push("overtime"); }
  else if (period === 4) { score += 24; reasons.push("fourth quarter"); }
  else if (period === 3) { score += 10; reasons.push("second half"); }
  else if (period === 2) { score += 4; }

  if (period >= 4 && diff <= 8) score += 13;
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
    .map((game) => ({ ...game, interest: scoreGame(game) }))
    .sort((a, b) => b.interest.score - a.interest.score);
}

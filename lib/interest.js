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

export function scoreGame(game) {
  if (game.state !== "in") {
    return {
      score: 0,
      tier: game.state === "post" ? "Final" : "Upcoming",
      reason: game.state === "post" ? "Game is final." : "Game has not started."
    };
  }

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

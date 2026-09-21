function key(team){return String(team?.id||team?.short||team?.name||"");}
function round1(n){return Math.round(n*10)/10;}
export function buildTeamForm(history,profiles=new Map()){
  const rows=new Map();
  function get(team){
    const id=key(team);
    if(!rows.has(id))rows.set(id,{id,short:team?.short||"",games:[]});
    return rows.get(id);
  }
  const sorted=(history||[]).filter(g=>g.state==="post").slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
  for(const game of sorted){
    for(const side of ["home","away"]){
      const team=game[side],opp=game[side==="home"?"away":"home"];
      const pf=Number(team?.score||0),pa=Number(opp?.score||0);
      get(team).games.push({
        date:game.date,pf,pa,margin:pf-pa,win:pf>pa,loss:pf<pa,
        opponent:opp?.short||opp?.location||"",opponentRank:opp?.rank||null
      });
    }
  }
  const out=new Map();
  for(const [id,row] of rows){
    const games=row.games, recent=games.slice(-3);
    const wins=games.filter(g=>g.win).length, losses=games.filter(g=>g.loss).length;
    let streak=0;
    if(games.length){
      const lastWin=games[games.length-1].win;
      for(let i=games.length-1;i>=0;i--){
        if(games[i].win===lastWin)streak++; else break;
      }
      if(!lastWin)streak=-streak;
    }
    const ats=profiles.get(id)||{};
    out.set(id,{
      games:games.length,wins,losses,
      last3Wins:recent.filter(g=>g.win).length,
      last3Losses:recent.filter(g=>g.loss).length,
      avgMargin:games.length?round1(games.reduce((s,g)=>s+g.margin,0)/games.length):0,
      last3Margin:recent.length?round1(recent.reduce((s,g)=>s+g.margin,0)/recent.length):0,
      avgPF:games.length?round1(games.reduce((s,g)=>s+g.pf,0)/games.length):0,
      avgPA:games.length?round1(games.reduce((s,g)=>s+g.pa,0)/games.length):0,
      streak,
      rankedWins:games.filter(g=>g.win&&g.opponentRank).length,
      atsWins:ats.atsWins||0,
      atsGames:ats.atsGames||0,
      atsPct:ats.atsPct??null,
      recentAtsWins:ats.recentAtsWins||0,
      recentAtsGames:ats.recentAtsGames||0,
      recentAtsPct:ats.recentAtsPct??null
    });
  }
  return out;
}

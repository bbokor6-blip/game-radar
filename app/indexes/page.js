import RadarMenu from "../components/RadarMenu";

const GAME_TIERS=[
  ["green","80–100","Must Watch","The game deserves priority."],
  ["yellow","65–79","Worth Watching","A strong matchup or live situation."],
  ["orange","50–64","On the Radar","Interesting, but not essential."],
  ["red","0–49","Low Interest","Safe to skip unless you care about a team."]
];

const BET_TIERS=[
  ["green","80–100","Best Bet","The model's strongest supported signals."],
  ["yellow","70–79","Strong","A meaningful edge with solid evidence."],
  ["orange","60–69","Lean","A real signal with more uncertainty."],
  ["red","0–59","Pass","Tracked for the full slate, not recommended."]
];

function TierGrid({tiers}){
  return <div className="ixTierGrid">{tiers.map(([color,range,label,copy])=><div className={"ixTier indexTier-"+color} key={color}>
    <strong>{range}</strong><span>{label}</span><p>{copy}</p>
  </div>)}</div>;
}

export const metadata={
  title:"GameIndex + BetIndex | Game Radar",
  description:"How Game Radar measures watchability and betting signal strength."
};

export default function IndexGuide(){
  return <main className="ixPage">
    <header className="ixHeader">
      <RadarMenu current="/indexes"/>
      <a href="/" className="ixBrand">GAME<span>RADAR</span></a>
      <span>INDEX GUIDE</span>
    </header>

    <section className="ixHero">
      <span>TWO SCORES · TWO QUESTIONS</span>
      <h1>Interesting game.<br/><em>Strong bet.</em><br/>Not the same thing.</h1>
      <p>GameIndex measures how much a game deserves your attention. BetIndex measures the strength of a specific betting signal. Neither score influences the other.</p>
    </section>

    <section className="ixMetric gameMetric">
      <div className="ixMetricIntro">
        <span>01 · WATCHABILITY</span>
        <h2>GameIndex</h2>
        <p>Answers one question: <strong>How interesting is this game?</strong></p>
      </div>
      <div className="ixMetricBody">
        <h3>What moves it</h3>
        <ul>
          <li><strong>Before kickoff:</strong> expected closeness, rankings, team quality, rivalry and conference stakes, kickoff window and scoring environment.</li>
          <li><strong>During the game:</strong> score margin, time remaining, overtime, possession leverage and upset potential.</li>
          <li><strong>After the game:</strong> finish margin, overtime, ranked upsets and matchup quality.</li>
        </ul>
        <p className="ixNote">GameIndex changes as the game changes. A quiet matchup can become must-watch when an upset or close finish develops.</p>
      </div>
      <TierGrid tiers={GAME_TIERS}/>
    </section>

    <section className="ixMetric betMetric">
      <div className="ixMetricIntro">
        <span>02 · SIGNAL STRENGTH</span>
        <h2>BetIndex</h2>
        <p>Answers a different question: <strong>How much confidence does the model have in this betting signal?</strong></p>
      </div>
      <div className="ixMetricBody">
        <h3>What moves it</h3>
        <ul>
          <li><strong>Model edge:</strong> the gap between Game Radar's projected margin or total and the market line.</li>
          <li><strong>Evidence quality:</strong> team sample size, recent and season-long ATS form, and opponent-adjusted strength.</li>
          <li><strong>Market quality:</strong> sportsbook consensus, number of available books and disagreement between lines.</li>
          <li><strong>Calibration:</strong> past PickRadar results can make a proven profile slightly stronger or weaker.</li>
        </ul>
        <p className="ixNote">BetIndex is a signal-strength score—not a predicted win percentage. It can move when the line or available evidence changes; PickRadar preserves the score and market at lock.</p>
      </div>
      <TierGrid tiers={BET_TIERS}/>
    </section>

    <section className="ixExample">
      <div><span className="indexTier-green">88</span><strong>High GameIndex</strong><p>A ranked rivalry projected to be close. Great television, even if the market looks efficient.</p></div>
      <div><span className="indexTier-red">54</span><strong>Low BetIndex</strong><p>No trustworthy edge against the current line. Interesting game; weak betting case.</p></div>
      <div><span className="indexTier-red">43</span><strong>Low GameIndex</strong><p>A likely mismatch with little broad interest.</p></div>
      <div><span className="indexTier-yellow">76</span><strong>Strong BetIndex</strong><p>The model sees value in the line. Unremarkable game; meaningful betting signal.</p></div>
    </section>

    <footer className="ixFooter"><a href="/scores">Open GameRadar →</a><a href="/bets">Open BetRadar →</a></footer>
  </main>;
}

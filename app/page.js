export default function Home(){
  return <main className="landingShell">
    <section className="landingHero">
      <div className="landingBrand">GAME<span>RADAR</span></div>
      <div className="landingKicker">FOOTBALL INTELLIGENCE · NFL + COLLEGE FBS</div>
      <h1>BET SMARTER.<br/>MISS NOTHING.</h1>
      <p>One football command center. Two ways to use it. BetRadar helps you focus on the strongest betting opportunities. GameRadar keeps the entire week of football organized so the action that matters is always at the top.</p>
    </section>

    <section className="landingChoiceGrid" aria-label="Choose your Game Radar experience">
      <a className="landingChoice betChoice" href="/bets">
        <div className="choiceTop">
          <span>01</span>
          <b>BETTING INTELLIGENCE</b>
        </div>
        <h2>BETRADAR</h2>
        <h3>Find the bets worth your attention.</h3>
        <p>BetRadar is built to give you an edge in where you focus. It narrows the board to the most interesting, highest-conviction opportunities using current lines, team betting trends and historical market results.</p>
        <div className="choiceFeatures">
          <span>TOP BETS</span>
          <span>BETRADAR INDEX</span>
          <span>HIGH-CONVICTION CALLOUTS</span>
          <span>TEASERS</span>
        </div>
        <strong className="choiceCta">ENTER BETRADAR →</strong>
      </a>

      <a className="landingChoice gameChoice" href="/scores">
        <div className="choiceTop">
          <span>02</span>
          <b>LIVE FOOTBALL COMMAND CENTER</b>
        </div>
        <h2>GAMERADAR</h2>
        <h3>Never miss the action that matters.</h3>
        <p>GameRadar organizes every NFL and college game around what is happening now. Live games jump to the top, close games get prioritized, and the full weekly scoreboard stays in one place.</p>
        <div className="choiceFeatures">
          <span>LIVE SCORES</span>
          <span>THIS WEEK</span>
          <span>INTEREST RANKING</span>
          <span>FULL FBS + NFL</span>
        </div>
        <strong className="choiceCta">ENTER GAMERADAR →</strong>
      </a>
    </section>

    <section className="landingValue">
      <span className="landingValueLabel">THE IDEA</span>
      <h2>Less searching. Better decisions. More football.</h2>
      <p>BetRadar tells you where the betting signal is strongest. GameRadar tells you where the action is strongest. Use either one on its own, or move between them all weekend with the persistent toggle inside both interfaces.</p>
      <div className="landingTrust">DATA-DRIVEN SIGNALS · LIVE SCORE TRACKING · NFL + COLLEGE FBS · BUILT FOR THE FULL FOOTBALL WEEK</div>
    </section>

    <footer className="landingFooter">GAME RADAR · FOOTBALL INTELLIGENCE IN ONE PLACE</footer>
  </main>;
}

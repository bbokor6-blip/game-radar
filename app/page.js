import RadarMenu from "./components/RadarMenu";

export default function Home(){
  const areas=[
    {
      n:"01",name:"WEEKLYRADAR",eyebrow:"THE BRIEFING",href:"/weekly",
      title:"Know the week before it starts.",
      copy:"The storylines, numbers and matchups worth knowing — distilled into a fast weekly read.",
      chips:["WHAT MATTERS","NUMBERS THAT MATTER","WEEK-AHEAD"]
    },
    {
      n:"02",name:"GAMERADAR",eyebrow:"THE BOARD",href:"/scores",
      title:"Know what deserves your attention.",
      copy:"Live scores, GameIndex and a simple explanation of why each game is interesting.",
      chips:["LIVE","GAMEINDEX","WHY IT MATTERS"]
    },
    {
      n:"03",name:"BETRADAR",eyebrow:"THE PICKS + THE RECEIPTS",href:"/bets",
      title:"Know exactly what we're picking.",
      copy:"One official pick for each game, its BetIndex and market line, plus the track record in the same place.",
      chips:["OFFICIAL PICKS","FULL SLATE","TRACK RECORD"]
    }
  ];
  return <main className="homeRadar">
    <header className="homeTopbar">
      <RadarMenu current="/" className="homeMenu"/>
      <a className="homeWordmark" href="/">GAME<span>RADAR</span></a>
      <div className="homeStatus"><i/> NFL + COLLEGE</div>
    </header>

    <section className="homeHero">
      <div className="homeEyebrow">FOOTBALL, FILTERED</div>
      <h1>Know what matters.<br/><span>Then know what to do with it.</span></h1>
      <p>One place for the week ahead, the games worth watching, and the picks we're willing to put on the record.</p>
      <div className="homeFlow">
        <span>READ</span><b>→</b><span>WATCH</span><b>→</b><span>PICK</span>
      </div>
    </section>

    <section className="homeAreaGrid" aria-label="GameRadar products">
      {areas.map((area,i)=><a className={"homeArea homeArea"+(i+1)} href={area.href} key={area.name}>
        <div className="homeAreaTop">
          <span>{area.n}</span>
          <b>{area.eyebrow}</b>
        </div>
        <h2>{area.name}</h2>
        <h3>{area.title}</h3>
        <p>{area.copy}</p>
        <div className="homeAreaChips">{area.chips.map(x=><span key={x}>{x}</span>)}</div>
        <strong className="homeEnter">OPEN {area.name} <b>→</b></strong>
      </a>)}
    </section>

    <a className="homeIndexStrip" href="/indexes">
      <div className="homeIndexPair"><span className="homeIndexBox indexTier-green">84</span><span className="homeIndexBox indexTier-yellow">74</span></div>
      <div>
        <span>GAMEINDEX + BETINDEX</span>
        <h2>Two numbers. Two different questions.</h2>
        <p>GameIndex measures how interesting a game is. BetIndex ranks the official pick's signal. See exactly how both work →</p>
      </div>
    </a>

    <footer className="homeFooter">
      <span>GAME RADAR</span>
      <span>WEEKLYRADAR · GAMERADAR · BETRADAR</span>
    </footer>
  </main>;
}

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
      copy:"Live scores, RadarIndex and a simple explanation of why each game is interesting.",
      chips:["LIVE","RADARINDEX","WHY IT MATTERS"]
    },
    {
      n:"03",name:"BETRADAR",eyebrow:"THE SIGNALS",href:"/bets",
      title:"See where the model sees something.",
      copy:"Search and filter the betting board, compare signals and understand what is driving the model.",
      chips:["SPREADS + TOTALS","SIGNAL STRENGTH","SEARCH"]
    },
    {
      n:"04",name:"PICKRADAR",eyebrow:"THE RECEIPTS",href:"/pickradar",
      title:"The picks we actually stand behind.",
      copy:"A locked pick on every NFL and college game, with confidence filters and a record that carries forward.",
      chips:["FULL SLATE","HIGH CONFIDENCE","TRACK RECORD"]
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
      <p>One place for the week ahead, the games worth watching, the betting signals worth exploring, and the picks we're willing to put on the record.</p>
      <div className="homeFlow">
        <span>READ</span><b>→</b><span>WATCH</span><b>→</b><span>EXPLORE</span><b>→</b><span>COMMIT</span>
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

    <section className="homeIndexStrip">
      <div className="homeIndexBox">84</div>
      <div>
        <span>RADARINDEX</span>
        <h2>One number for how much a game deserves your attention.</h2>
        <p>Betting signal + matchup excitement. The model learns from what PickRadar gets right and wrong each week.</p>
      </div>
    </section>

    <footer className="homeFooter">
      <span>GAME RADAR</span>
      <span>WEEKLYRADAR · GAMERADAR · BETRADAR · PICKRADAR</span>
    </footer>
  </main>;
}

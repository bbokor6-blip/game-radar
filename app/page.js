"use client";

import { useEffect, useMemo, useState } from "react";

const TABS = [
  ["best", "Best Games"],
  ["cfb", "College"],
  ["nfl", "NFL"]
];

function Team({ team, possession }) {
  return (
    <div className="team">
      <div className="teamIdentity">
        {team.logo ? <img src={team.logo} alt="" className="logo" /> : <div className="logoFallback" />}
        <div className="teamName">
          {team.rank ? <span className="rank">#{team.rank}</span> : null}
          <span>{team.short}</span>
          {possession ? <span className="ball" title="Possession">●</span> : null}
        </div>
      </div>
      <div className="teamScore">{team.score}</div>
    </div>
  );
}

function GameCard({ game, featured = false }) {
  const now = game.interest.tier === "Turn it on now";
  const watch = game.interest.tier === "Keep an eye on it";
  const possessionHome = game.possessionId && game.possessionId === game.home.id;
  const possessionAway = game.possessionId && game.possessionId === game.away.id;

  return (
    <article className={`gameCard ${featured ? "featured" : ""}`}>
      <div className="cardTop">
        <div className={`tier ${now ? "hot" : watch ? "watch" : ""}`}>
          {now ? "🔥 " : watch ? "👀 " : ""}
          {game.interest.tier}
        </div>
        <div className="interest">{game.interest.score}</div>
      </div>

      <Team team={game.away} possession={possessionAway} />
      <Team team={game.home} possession={possessionHome} />

      <div className="gameMeta">
        <div>
          <strong>{game.status || "Live"}</strong>
          {game.downDistance ? <span> · {game.downDistance}</span> : null}
        </div>
        <span className="league">{game.sport === "cfb" ? "CFB" : "NFL"}</span>
      </div>

      <div className="why">
        <strong>Why:</strong> {game.interest.reason}
      </div>
      {game.market ? (
        <div className="why">
          <strong>Market:</strong> {game.market.spread == null ? "Spread —" : `${game.home.short} ${game.market.spread > 0 ? "+" : ""}${game.market.spread}`}
          {game.market.total == null ? "" : ` · O/U ${game.market.total}`}
        </div>
      ) : null}

      <div className="meter" aria-label={`Interest score ${game.interest.score} out of 100`}>
        <div className="meterFill" style={{ width: `${game.interest.score}%` }} />
      </div>
    </article>
  );
}

export default function Home() {
  const [tab, setTab] = useState("best");
  const [data, setData] = useState({ games: [], generatedAt: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  async function load(manual = false) {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch("/api/games", { cache: "no-store" });
      if (!res.ok) throw new Error("Feed unavailable");
      const json = await res.json();
      setData(json);
      setError("");
    } catch {
      setError("Live scores are temporarily unavailable. Try again in a moment.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(() => load(), 30000);
    return () => clearInterval(timer);
  }, []);

  const visible = useMemo(() => {
    const live = data.games.filter((g) => g.state === "in");
    if (tab === "cfb") return live.filter((g) => g.sport === "cfb");
    if (tab === "nfl") return live.filter((g) => g.sport === "nfl");
    return live;
  }, [data.games, tab]);

  const featured = visible[0];
  const rest = visible.slice(1, 12);

  return (
    <main className="shell">
      <header>
        <div>
          <div className="eyebrow"><span className="liveDot" /> GAME RADAR</div>
          <h1>What should I watch?</h1>
          <p>Live football ranked by how much it deserves your attention.</p>
        </div>
        <button className="refresh" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? "Checking…" : "↻ Refresh"}
        </button>
      </header>

      <nav className="tabs" aria-label="Sports">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {error ? <div className="notice error">{error}</div> : null}

      {loading ? (
        <div className="notice">Scanning the live football slate…</div>
      ) : featured ? (
        <>
          <GameCard game={featured} featured />
          <section className="list">
            {rest.map((game) => <GameCard key={game.id} game={game} />)}
          </section>
        </>
      ) : (
        <div className="empty">
          <div className="emptyIcon">🏈</div>
          <h2>No live {tab === "best" ? "football" : tab === "cfb" ? "college football" : "NFL"} games right now.</h2>
          <p>Game Radar will automatically rank them here once games are underway.</p>
        </div>
      )}

      <footer>
        <span>Auto-refreshes every 30 seconds</span>
        {data.generatedAt ? <span> · Last scan {new Date(data.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span> : null}
        <div className="sourceNote">Score and odds feeds use configurable server-side adapters. Interest scoring is calculated by Game Radar.</div>
      </footer>
    </main>
  );
}

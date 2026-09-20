# Game Radar

A mobile-first football dashboard that answers one question:

**What game should I be watching right now?**

V1 follows:
- College Football
- NFL

It pulls live scoreboard data through a server-side ESPN adapter, normalizes the games, calculates a transparent 0–100 Interest Score, and sorts the board by urgency.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

1. Put this project in your `game-radar` GitHub repository.
2. In Vercel, choose **Add New → Project**.
3. Import the `game-radar` repository.
4. Vercel should detect Next.js automatically.
5. Click **Deploy**.

No environment variables are required for the prototype.

## Important data note

The ESPN endpoints used by `lib/espn.js` are undocumented public-facing endpoints, not a contracted API. They are useful for prototyping but can change or be rate-limited. The adapter is deliberately isolated so it can later be replaced with a licensed feed without changing the UI or scoring engine.

## Interest scoring

The engine currently rewards:
- close games
- fourth-quarter / overtime games
- late one-score possessions
- ranked CFB teams and ranked matchups
- unranked teams leading ranked opponents
- close halftime / third-quarter games

It penalizes blowouts.

Tune the weights in `lib/interest.js`.

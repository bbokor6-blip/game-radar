# GameRadar / BetRadar Visual System

## Direction
Premium dark sports-command-center UI. Use deep navy/charcoal rather than pure black. Keep the interface energetic through selective yellow, green, red, and blue accents — not through excessive borders or glow.

## Color roles
- Canvas: `#071018`
- Primary panel: `#0C1722`
- Raised panel: `#101E2B`
- Primary text: `#F5F7F9`
- Secondary text: `#A8B4C0`
- BetRadar / featured: amber `#FFC62F`
- Strong signal / active intelligence: green `#4BE36B`
- Live / urgent: red `#FF5A4F`
- Search / information: blue `#46A8FF`

## Typography
Use the system sans stack for nearly all readable copy. Reserve monospace for scores, indexes, odds, compact status labels, and utility metadata.

Desktop:
- Hero: 48–82 px
- Section title: 27–40 px
- Primary pick: 26 px
- Matchup / team: 14–19 px depending surface
- Body: 13–16 px
- Utility metadata: 8–10 px

Mobile:
- Hero: ~48 px
- Section title: ~27 px
- Primary pick: ~21 px
- Team / matchup: 11.5–16 px
- Body: 12–14 px
- Utility metadata: never below ~7 px

## Logos
Logos add recognition but never dominate.
- Featured BetRadar desktop: 30 px
- Standard BetRadar desktop: 26 px
- Mobile: 22–24 px
- GameRadar rows desktop: 30 px
- GameRadar rows mobile: 24 px

## Information hierarchy
Every betting card should read in this order:
1. Pick
2. BetRadar Index / conviction tier
3. Matchup
4. Date and time
5. Why it matters
6. Market / evidence detail
7. Save / share action

Every live-score card should read:
1. Teams + score
2. Game status
3. GameRadar Interest
4. Why the game matters
5. Market context if relevant

## Conviction language
- Index 81+: NO BRAINER
- Index 71–80: HIGH CONVICTION
- Index 60–70: WATCH
- Below 60: LOW CONFIDENCE

These are signal-strength labels, not win probabilities or guarantees.

## Ask GameRadar
Ask GameRadar is a primary product surface, not a utility search box.
- Strong blue/green intelligence treatment
- Large natural-language input
- Amber primary action
- Suggested-query chips
- Always show interpreted filters after search
- Results use the same team / game visual language as the rest of the product

## Mobile rules
- Never solve hierarchy by enlarging logos.
- Prefer vertical stacking over compressed columns.
- Keep primary navigation sticky.
- Keep tap targets around 44–54 px where practical.
- Collapse low-priority metadata before shrinking important text.
- Make My Bets easy to reach from anywhere.


## Current release principle
The production app uses one shared visual and metadata system across GameRadar and BetRadar. Search, team metadata, conference metadata, score presentation, betting context, and mobile layout should evolve in this single project rather than in separate forks.


## Game-day production architecture
GameRadar and BetRadar ship from the same production project and repository. Both products use the shared sticky league/week/search navigation, shared football metadata, and the same underlying game data. GameRadar prioritizes what to watch; BetRadar prioritizes betting signals and saved picks.

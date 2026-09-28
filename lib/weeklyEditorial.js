export function getWeeklyEditorial(league,start){
  const key=league+"|"+start;
  const editions={
    "cfb|2026-09-29":{
      kicker:"COLLEGE · WEEK 5 · OCT 3",
      headline:"Three ranked collisions. No easy road trips.",
      dek:"The games and numbers shaping Saturday. Weekly Radar is editorial; official selections live only in PickRadar.",
      quickHits:[
        {eyebrow:"STARKVILLE",title:"Mississippi State is 4–0",body:"No. 16 Mississippi State is 4–0 straight up and against the spread. No. 7 Alabama is 4–0, 3–1 ATS. The Bulldogs beat Missouri 31–24; Alabama beat South Carolina 49–18."},
        {eyebrow:"IOWA CITY",title:"The Hawkeyes' walk-off",body:"No. 14 Iowa improved to 4–0 by beating Michigan 20–19 on a last-play touchdown. No. 5 Ohio State is 3–1 after a 42–19 win over Illinois."},
        {eyebrow:"COLUMBIA",title:"Florida's sudden climb",body:"No. 8 Florida is 4–0 after beating then-No. 4 Ole Miss 52–28. No. 25 Missouri is 3–1 after its loss at Mississippi State."}
      ],
      takes:[
        {away:"Alabama",home:"Mississippi State",take:"Two unbeaten SEC teams meet in Starkville. Mississippi State's fourth-quarter comeback against Missouri and Alabama's 49-point performance against South Carolina offer very different Week 4 reference points."},
        {away:"Ohio State",home:"Iowa",take:"Ohio State heads to Iowa City after scoring 42 against Illinois. Iowa's last-play 20–19 win at Michigan preserved its unbeaten record. Watch pace and field position."},
        {away:"Florida",home:"Missouri",take:"Florida scored 52 against Ole Miss and climbed to No. 8; Missouri must respond after allowing Mississippi State to rally late. Both sides enter a ranked SEC matchup."}
      ]
    },
    "cfb|2026-09-22":{
      kicker:"SATURDAY, DISTILLED",
      headline:"Five games. Three bets. Zero filler.",
      dek:"The ranked collisions, pressure spots and betting angles worth knowing before the first kick.",
      quickHits:[
        {eyebrow:"THE HEADLINER",title:"Texas gets Neyland",body:"No. 1 Texas is unbeaten. Tennessee is unbeaten. Noon in Knoxville is not easing into anything."},
        {eyebrow:"PRESSURE GAME",title:"A&M–LSU gets uncomfortable",body:"Both teams are coming off ranked losses. One of them is about to spend a week answering very different questions."},
        {eyebrow:"LATE WINDOW",title:"USC finally gets a real exam",body:"The Trojans are 4–0. Oregon arrives ranked and dangerous. This is where the résumé starts to mean something."}
      ],
      takes:[
        {away:"Texas",home:"Tennessee",take:"Texas has looked like the team to beat. Neyland is the first place where that confidence can get punched in the mouth. If this is close entering the fourth, the pressure flips completely."},
        {away:"Oklahoma",home:"Georgia",take:"Georgia gets a ranked SEC measuring stick at home. Oklahoma does not need to be prettier — it needs to make this game annoying deep into the second half."},
        {away:"Texas A&M",home:"LSU",take:"Two ranked teams coming off losses is exactly the kind of spot that gets weird. The loser leaves September with a very different season than it expected."},
        {away:"Oregon",home:"USC",take:"USC's 4–0 start is clean. Oregon gives us the first real chance to decide how much of it is substance. This one could swing the entire Big Ten conversation."},
        {away:"Iowa",home:"Michigan",take:"Top-20 teams, Big Ten football, and a matchup that could turn into a rock fight fast. If you like tension more than fireworks, circle it."}
      ]
    },
    "nfl|2026-09-22":{
      kicker:"WEEK 3, WITHOUT THE NOISE",
      headline:"The games that can change what we think.",
      dek:"Five matchups, the betting board, and the fastest way to sound informed before Sunday.",
      quickHits:[
        {eyebrow:"TRENDING UP",title:"Buffalo is already humming",body:"The Bills are 2–0 and just scored 41 on Detroit. The Chargers are a much better measuring stick than the record alone suggests."},
        {eyebrow:"PROVE IT",title:"Dallas gets Baltimore",body:"The Cowboys just put up 37. The Ravens just lost at home. One team gets validation; the other gets a week of noise."},
        {eyebrow:"MONDAY NIGHT",title:"Philly can make this boring",body:"The Eagles are 2–0. Chicago just lost 9–3. Great teams turn this kind of spot into a routine win — which is exactly why it is revealing."}
      ],
      takes:[
        {away:"Atlanta",home:"Green Bay",take:"Atlanta is coming off a 34–3 faceplant. Green Bay survived an overtime grinder. Thursday tells us whether the Falcons had a bad day or have a real problem."},
        {away:"Los Angeles",home:"Buffalo",take:"Buffalo is 2–0 and the offense already looks dangerous. The Chargers need a response after a double-digit loss to Vegas. Early AFC credibility test."},
        {away:"Baltimore",home:"Dallas",take:"Baltimore enters off a loss; Dallas enters off 37 points. If the Cowboys' offense is real, this is the defense it has to prove it against."},
        {away:"Carolina",home:"Cleveland",take:"Carolina just won 34–3. Cleveland just took down Tampa Bay. One of the sneaky fun stories of Week 3 is that one of these teams is about to own real early-season momentum."},
        {away:"Philadelphia",home:"Chicago",take:"Philadelphia is 2–0 and Chicago just scored three points. The interesting question is not whether Philly is better — it is whether the market has already priced the gap correctly."}
      ]
    }
  };
  return editions[key]||{
    kicker:"WEEKLY RADAR",
    headline:"The week, distilled.",
    dek:"The games, betting signals and storylines worth your attention.",
    quickHits:[],
    takes:[]
  };
}

export function editorialTake(game,edition){
  const away=String(game?.away?.location||game?.away?.name||"").toLowerCase();
  const home=String(game?.home?.location||game?.home?.name||"").toLowerCase();
  const hit=(edition?.takes||[]).find(x=>away.includes(x.away.toLowerCase())&&home.includes(x.home.toLowerCase()));
  return hit?.take||null;
}

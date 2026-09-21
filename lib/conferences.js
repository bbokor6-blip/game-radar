const CONFERENCE_MEMBERS = {
  "ACC": [
    "Boston College Eagles","California Golden Bears","Clemson Tigers","Duke Blue Devils","Florida State Seminoles",
    "Georgia Tech Yellow Jackets","Louisville Cardinals","Miami Hurricanes","NC State Wolfpack","North Carolina Tar Heels",
    "Pittsburgh Panthers","SMU Mustangs","Stanford Cardinal","Syracuse Orange","Virginia Cavaliers","Virginia Tech Hokies",
    "Wake Forest Demon Deacons"
  ],
  "Big Ten": [
    "Illinois Fighting Illini","Indiana Hoosiers","Iowa Hawkeyes","Maryland Terrapins","Michigan Wolverines",
    "Michigan State Spartans","Minnesota Golden Gophers","Nebraska Cornhuskers","Northwestern Wildcats","Ohio State Buckeyes",
    "Oregon Ducks","Penn State Nittany Lions","Purdue Boilermakers","Rutgers Scarlet Knights","UCLA Bruins","USC Trojans",
    "Washington Huskies","Wisconsin Badgers"
  ],
  "Big 12": [
    "Arizona Wildcats","Arizona State Sun Devils","Baylor Bears","BYU Cougars","Cincinnati Bearcats","Colorado Buffaloes",
    "Houston Cougars","Iowa State Cyclones","Kansas Jayhawks","Kansas State Wildcats","Oklahoma State Cowboys",
    "TCU Horned Frogs","Texas Tech Red Raiders","UCF Knights","Utah Utes","West Virginia Mountaineers"
  ],
  "SEC": [
    "Alabama Crimson Tide","Arkansas Razorbacks","Auburn Tigers","Florida Gators","Georgia Bulldogs","Kentucky Wildcats",
    "LSU Tigers","Mississippi State Bulldogs","Missouri Tigers","Oklahoma Sooners","Ole Miss Rebels",
    "South Carolina Gamecocks","Tennessee Volunteers","Texas Longhorns","Texas A&M Aggies","Vanderbilt Commodores"
  ],
  "American": [
    "Army Black Knights","Charlotte 49ers","East Carolina Pirates","Florida Atlantic Owls","Memphis Tigers","Navy Midshipmen",
    "North Texas Mean Green","Rice Owls","South Florida Bulls","Temple Owls","Tulane Green Wave","Tulsa Golden Hurricane",
    "UAB Blazers","UTSA Roadrunners"
  ],
  "C-USA": [
    "Delaware Blue Hens","FIU Panthers","Jacksonville State Gamecocks","Kennesaw State Owls","Liberty Flames",
    "Louisiana Tech Bulldogs","Middle Tennessee Blue Raiders","Missouri State Bears","New Mexico State Aggies",
    "Sam Houston Bearkats","Western Kentucky Hilltoppers"
  ],
  "MAC": [
    "Akron Zips","Ball State Cardinals","Bowling Green Falcons","Buffalo Bulls","Central Michigan Chippewas",
    "Eastern Michigan Eagles","Kent State Golden Flashes","Miami (OH) RedHawks","Ohio Bobcats","Toledo Rockets",
    "UMass Minutemen","Western Michigan Broncos"
  ],
  "Mountain West": [
    "Air Force Falcons","Hawai'i Rainbow Warriors","Hawaii Rainbow Warriors","Nevada Wolf Pack","New Mexico Lobos",
    "Northern Illinois Huskies","San José State Spartans","San Jose State Spartans","UNLV Rebels","UTEP Miners","Wyoming Cowboys"
  ],
  "Pac-12": [
    "Boise State Broncos","Colorado State Rams","Fresno State Bulldogs","Oregon State Beavers","San Diego State Aztecs",
    "Texas State Bobcats","Utah State Aggies","Washington State Cougars"
  ],
  "Sun Belt": [
    "Appalachian State Mountaineers","Arkansas State Red Wolves","Coastal Carolina Chanticleers","Georgia Southern Eagles",
    "Georgia State Panthers","James Madison Dukes","Louisiana Ragin' Cajuns","Marshall Thundering Herd",
    "Old Dominion Monarchs","South Alabama Jaguars","Southern Miss Golden Eagles","Troy Trojans","UL Monroe Warhawks",
    "ULM Warhawks"
  ],
  "Independent": ["Notre Dame Fighting Irish","UConn Huskies","Connecticut Huskies"]
};

const TEAM_CONFERENCES = new Map();
for(const [conference,teams] of Object.entries(CONFERENCE_MEMBERS)){
  for(const team of teams)TEAM_CONFERENCES.set(team.toLowerCase(),conference);
}

const ABBR_CONFERENCES = new Map([
  ["BC","ACC"],["CAL","ACC"],["CLEM","ACC"],["DUKE","ACC"],["FSU","ACC"],["GT","ACC"],["LOU","ACC"],["MIA","ACC"],
  ["NCSU","ACC"],["UNC","ACC"],["PITT","ACC"],["SMU","ACC"],["STAN","ACC"],["SYR","ACC"],["UVA","ACC"],["VT","ACC"],["WAKE","ACC"],
  ["ILL","Big Ten"],["IU","Big Ten"],["IOWA","Big Ten"],["MD","Big Ten"],["MICH","Big Ten"],["MSU","Big Ten"],
  ["MINN","Big Ten"],["NEB","Big Ten"],["NU","Big Ten"],["OSU","Big Ten"],["ORE","Big Ten"],["PSU","Big Ten"],
  ["PUR","Big Ten"],["RUTG","Big Ten"],["UCLA","Big Ten"],["USC","Big Ten"],["WASH","Big Ten"],["WIS","Big Ten"],
  ["ARIZ","Big 12"],["ASU","Big 12"],["BAY","Big 12"],["BYU","Big 12"],["CIN","Big 12"],["COLO","Big 12"],
  ["HOU","Big 12"],["ISU","Big 12"],["KU","Big 12"],["KSU","Big 12"],["OKST","Big 12"],["TCU","Big 12"],
  ["TTU","Big 12"],["UCF","Big 12"],["UTAH","Big 12"],["WVU","Big 12"],
  ["ALA","SEC"],["ARK","SEC"],["AUB","SEC"],["FLA","SEC"],["UGA","SEC"],["UK","SEC"],["LSU","SEC"],
  ["MSST","SEC"],["MIZ","SEC"],["OU","SEC"],["MISS","SEC"],["SC","SEC"],["TENN","SEC"],["TEX","SEC"],["TAMU","SEC"],["VAN","SEC"],
  ["ARMY","American"],["CHAR","American"],["ECU","American"],["FAU","American"],["MEM","American"],["NAVY","American"],
  ["UNT","American"],["RICE","American"],["USF","American"],["TEM","American"],["TULN","American"],["TLSA","American"],["UAB","American"],["UTSA","American"],
  ["LIB","C-USA"],["LT","C-USA"],["MTSU","C-USA"],["NMSU","C-USA"],["WKU","C-USA"],["SHSU","C-USA"],["JVST","C-USA"],
  ["AKR","MAC"],["BALL","MAC"],["BGSU","MAC"],["BUFF","MAC"],["CMU","MAC"],["EMU","MAC"],["KENT","MAC"],["M-OH","MAC"],["OHIO","MAC"],["TOL","MAC"],["UMASS","MAC"],["WMU","MAC"],
  ["AFA","Mountain West"],["HAW","Mountain West"],["NEV","Mountain West"],["UNM","Mountain West"],["NIU","Mountain West"],["SJSU","Mountain West"],["UNLV","Mountain West"],["UTEP","Mountain West"],["WYO","Mountain West"],
  ["BOIS","Pac-12"],["CSU","Pac-12"],["FRES","Pac-12"],["ORST","Pac-12"],["SDSU","Pac-12"],["TXST","Pac-12"],["USU","Pac-12"],["WSU","Pac-12"],
  ["APP","Sun Belt"],["ARST","Sun Belt"],["CCU","Sun Belt"],["GASO","Sun Belt"],["GAST","Sun Belt"],["JMU","Sun Belt"],
  ["UL","Sun Belt"],["MRSH","Sun Belt"],["ODU","Sun Belt"],["USA","Sun Belt"],["USM","Sun Belt"],["TROY","Sun Belt"],["ULM","Sun Belt"],
  ["ND","Independent"],["CONN","Independent"]
]);

export const CONFERENCE_ALIASES = [
  {name:"Big Ten",aliases:["big ten","big 10","b1g"]},
  {name:"SEC",aliases:["sec","southeastern"]},
  {name:"ACC",aliases:["acc","atlantic coast"]},
  {name:"Big 12",aliases:["big 12","big twelve"]},
  {name:"American",aliases:["aac","american athletic","the american"]},
  {name:"C-USA",aliases:["c-usa","cusa","conference usa"]},
  {name:"MAC",aliases:["mac","mid-american"]},
  {name:"Mountain West",aliases:["mountain west","mwc"]},
  {name:"Pac-12",aliases:["pac-12","pac 12","pac12"]},
  {name:"Sun Belt",aliases:["sun belt"]},
  {name:"Independent",aliases:["independent","independents"]}
];

export const POWER_CONFERENCES = new Set(["ACC","Big Ten","Big 12","SEC"]);

export function conferenceForTeam(team){
  const name=String(team?.displayName||team?.name||"").trim().toLowerCase();
  if(TEAM_CONFERENCES.has(name))return TEAM_CONFERENCES.get(name);
  const abbr=String(team?.abbreviation||team?.shortDisplayName||"").trim().toUpperCase();
  return ABBR_CONFERENCES.get(abbr)||null;
}

export function conferenceLabel(value){
  if(value==="Big Ten")return "BIG TEN";
  if(value==="Big 12")return "BIG 12";
  if(value==="Mountain West")return "MOUNTAIN WEST";
  if(value==="Sun Belt")return "SUN BELT";
  if(value==="American")return "AMERICAN";
  return value?String(value).toUpperCase():"";
}

export function conferenceTier(conference){
  if(POWER_CONFERENCES.has(conference))return "P4";
  if(conference==="Independent")return "IND";
  return conference?"G5":null;
}

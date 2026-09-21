const TEAM_CONFERENCES = new Map([
  // Big Ten
  ["illinois fighting illini","Big Ten"],["indiana hoosiers","Big Ten"],["iowa hawkeyes","Big Ten"],
  ["maryland terrapins","Big Ten"],["michigan wolverines","Big Ten"],["michigan state spartans","Big Ten"],
  ["minnesota golden gophers","Big Ten"],["nebraska cornhuskers","Big Ten"],["northwestern wildcats","Big Ten"],
  ["ohio state buckeyes","Big Ten"],["oregon ducks","Big Ten"],["penn state nittany lions","Big Ten"],
  ["purdue boilermakers","Big Ten"],["rutgers scarlet knights","Big Ten"],["ucla bruins","Big Ten"],
  ["usc trojans","Big Ten"],["washington huskies","Big Ten"],["wisconsin badgers","Big Ten"],

  // SEC
  ["alabama crimson tide","SEC"],["arkansas razorbacks","SEC"],["auburn tigers","SEC"],
  ["florida gators","SEC"],["georgia bulldogs","SEC"],["kentucky wildcats","SEC"],
  ["lsu tigers","SEC"],["mississippi state bulldogs","SEC"],["missouri tigers","SEC"],
  ["oklahoma sooners","SEC"],["ole miss rebels","SEC"],["south carolina gamecocks","SEC"],
  ["tennessee volunteers","SEC"],["texas longhorns","SEC"],["texas a&m aggies","SEC"],
  ["vanderbilt commodores","SEC"]
]);

const ABBR_CONFERENCES = new Map([
  ["ILL","Big Ten"],["IU","Big Ten"],["IOWA","Big Ten"],["MD","Big Ten"],["MICH","Big Ten"],
  ["MSU","Big Ten"],["MINN","Big Ten"],["NEB","Big Ten"],["NU","Big Ten"],["OSU","Big Ten"],
  ["ORE","Big Ten"],["PSU","Big Ten"],["PUR","Big Ten"],["RUTG","Big Ten"],["UCLA","Big Ten"],
  ["USC","Big Ten"],["WASH","Big Ten"],["WIS","Big Ten"],
  ["ALA","SEC"],["ARK","SEC"],["AUB","SEC"],["FLA","SEC"],["UGA","SEC"],["UK","SEC"],
  ["LSU","SEC"],["MSST","SEC"],["MIZ","SEC"],["OU","SEC"],["MISS","SEC"],["SC","SEC"],
  ["TENN","SEC"],["TEX","SEC"],["TAMU","SEC"],["TA&M","SEC"],["VAN","SEC"]
]);

export function conferenceForTeam(team){
  const name=String(team?.displayName||team?.name||"").trim().toLowerCase();
  if(TEAM_CONFERENCES.has(name))return TEAM_CONFERENCES.get(name);
  const abbr=String(team?.abbreviation||team?.shortDisplayName||"").trim().toUpperCase();
  return ABBR_CONFERENCES.get(abbr)||null;
}

export function conferenceLabel(value){
  if(value==="Big Ten")return "BIG TEN";
  if(value==="SEC")return "SEC";
  return value?String(value).toUpperCase():"";
}

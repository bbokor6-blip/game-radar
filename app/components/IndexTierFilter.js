export default function IndexTierFilter({items,scoreOf,value,onChange,indexName="INDEX",tiers=[]}){
  const options=[{key:"all",label:"ALL",className:""},...tiers];
  const countFor=option=>option.key==="all"?items.length:items.filter(item=>{
    const score=Number(scoreOf(item))||0;
    return score>=option.min&&(option.max==null||score<=option.max);
  }).length;
  const active=options.find(option=>option.key===value)||options[0];

  return <section className="rpFilters indexFilterBar" aria-label={"Filter by "+indexName+" tier"}>
    <div><strong>FILTER BY {indexName}</strong><span>{countFor(active)} of {items.length} shown</span></div>
    <div>{options.map(option=><button type="button" key={option.key}
      className={(option.className?"tierFilter "+option.className+" ":"")+(value===option.key?"active":"")}
      onClick={()=>onChange(option.key)}>{option.label} <b>{countFor(option)}</b></button>)}</div>
  </section>;
}

export function filterByTier(items,scoreOf,value,tiers=[]){
  if(value==="all")return items;
  const tier=tiers.find(option=>option.key===value);
  if(!tier)return items;
  return items.filter(item=>{
    const score=Number(scoreOf(item))||0;
    return score>=tier.min&&(tier.max==null||score<=tier.max);
  });
}

export const GAME_INDEX_FILTERS=[
  {key:"green",label:"MUST WATCH · 80+",className:"indexTier-green",min:80},
  {key:"yellow",label:"WORTH WATCHING · 65–79",className:"indexTier-yellow",min:65,max:79},
  {key:"orange",label:"ON THE RADAR · 50–64",className:"indexTier-orange",min:50,max:64},
  {key:"red",label:"LOW INTEREST · <50",className:"indexTier-red",min:0,max:49}
];

export const BET_INDEX_FILTERS=[
  {key:"green",label:"BEST BET · 80+",className:"indexTier-green",min:80},
  {key:"yellow",label:"STRONG · 70–79",className:"indexTier-yellow",min:70,max:79},
  {key:"orange",label:"LEAN · 55–69",className:"indexTier-orange",min:55,max:69},
  {key:"red",label:"LOW CONFIDENCE · <55",className:"indexTier-red",min:0,max:54}
];

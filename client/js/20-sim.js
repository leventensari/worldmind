// ============================================================
// Simülasyon: zaman, ülkeler, vatandaşlar, olaylar, ekonomi, büyüme, savaş, ulaşım
// ============================================================
const START=Date.UTC(2026,9,26,0,0);
let now=360,speedIdx=1;
const SPEEDS=[0,1,4,15,60,180];
const hourOf=()=>(now/60)%24, dayIdx=()=>Math.floor(now/1440);
const dateOf=t=>new Date(START+t*60000);
const AYLAR=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const GUNLER=['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'];
function fmtDate(t,withTime=true){const d=dateOf(t);const s=`${d.getUTCDate()} ${AYLAR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;return withTime?s+' '+String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0'):s}
const fmtTime=t=>{const d=dateOf(t);return `${d.getUTCDate()}.${d.getUTCMonth()+1} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`};
const MAX_AGENTS_PER_NATION=420;

// ---------- Ülkeler ----------
let wars=[];
function makePresident(name,ideo){const I=IDEO[ideo];return{name,ideo,traits:{aggr:clamp(I.aggr+rnd(-.15,.15),0,1),caution:rnd(.3,.8),empathy:rnd(.3,.9),charisma:rnd(.35,.9)},mood:'kararlı',speech:'',memory:[],brain:'Yerel ajan',since:now}}
function makeNation(def,k,seed){
  const I=IDEO[def.ideo];
  return{id:k,def,name:def.name,color:def.color,seed,pres:makePresident(def.pres,def.ideo),
    tax:I.tax,budget:{...I.pref},treasury:rnd(10,32),gdp:def.pop*rnd(30,48),basePop:def.pop,popF:1,growth:.02,
    lvl:{health:.6,police:.6,fire:.6,military:.5,education:.6,infra:.6,welfare:.5},
    happiness:60,approval:rnd(50,62),unemployment:rnd(.05,.09),mil:25+I.aggr*45,
    quarantine:false,curfew:false,mobilized:false,weather:'açık',
    stats:{crimes:0,arrests:0,fires:0,deaths:0,births:0,infected:0,crimeDays:[0],cases:0,built:0,claimed:0},
    rel:Array(10).fill(0),trade:new Set(),ally:new Set(),sanction:new Set(),contact:new Set(),
    inbox:[],decisions:[],lowDays:0,disasterPenalty:0,weariness:0,nextThink:1440+k*300,roles:{},resCap0:1,demand:0,expandFocus:0,
    epiBoost:0,rally:0,chat:[],leisure:[],res:[],landlocked:false,lastTown:0}
}
function initRelations(){
  for(let a=0;a<10;a++)for(let b=a+1;b<10;b++){
    const A=nations[a],B=nations[b];let r=rnd(-10,18);
    if(A.pres.ideo===B.pres.ideo)r+=28;r-=Math.abs(A.pres.traits.aggr-B.pres.traits.aggr)*20;
    A.rel[b]=B.rel[a]=Math.round(clamp(r,-50,70));
  }
  for(let a=0;a<10;a++)for(let b=a+1;b<10;b++)if(nations[a].rel[b]>20&&R()<.5){nations[a].trade.add(b);nations[b].trade.add(a)}
  for(const nt of nations)nt.resCap0=resCapacity(nt.id)||1;
}
const atWar=(a,b)=>wars.some(w=>(w.a===a&&w.b===b)||(w.a===b&&w.b===a));
const warsOf=c=>wars.filter(w=>w.a===c||w.b===c);
function setRel(a,b,v){v=Math.round(clamp(v,-100,100));nations[a].rel[b]=v;nations[b].rel[a]=v}
function addRel(a,b,d){setRel(a,b,nations[a].rel[b]+d)}
function resCapacity(c){let s=0;for(const b of buildings)if(b.c===c&&BT[b.type].cat==='res')s+=BT[b.type].res;return s}
function popOf(nt){return nt.basePop*nt.popF*(resCapacity(nt.id)/nt.resCap0)}
function isNeighbor(a,b){return nations[a].contact.has(b)}

// ---------- Haber akışı ----------
const feed=[];let feedDirty=true;
function news(c,text,kind='info',tile=-1){feed.unshift({t:now,c,text,kind,tile});if(feed.length>600){let k=feed.length-1;while(k>0&&(feed[k].kind==='big'||feed[k].kind==='ai'))k--;feed.splice(k,1);if(feed.length>900)feed.pop()}feedDirty=true;if((kind==='hi'||kind==='big')&&typeof toast==='function')toast(text,kind==='big')}

// ---------- Yol bulma (yol karoları üzerinde BFS, önbellekli) ----------
const pfStamp=new Int32Array(N),pfPrev=new Int32Array(N),pfQ=new Int32Array(N);let pfGen=0;
const pathCache=new Map();
function findPath(from,to,passable){
  if(from<0||to<0)return null;if(from===to)return[from];
  const roadMode=!passable;const key=from*N+to;if(roadMode){const c=pathCache.get(key);if(c!==undefined)return c}
  pfGen++;let h=0,t=0;pfQ[t++]=from;pfStamp[from]=pfGen;pfPrev[from]=-1;let found=false;const dirs=roadMode?D4:D8;
  while(h<t){const i=pfQ[h++];if(i===to){found=true;break}const x=i%W,y=(i/W)|0;
    for(let d=0;d<dirs.length;d++){const nx=x+dirs[d][0],ny=y+dirs[d][1];if(nx<0||ny<0||nx>=W||ny>=H)continue;const j=ny*W+nx;
      if(pfStamp[j]===pfGen)continue;if(roadMode?!isRoad(terr[j]):!passable(j))continue;
      if(!roadMode&&d>=4&&(!passable(i+dirs[d][0])||!passable(i+dirs[d][1]*W)))continue; // köşe kesme yok
      pfStamp[j]=pfGen;pfPrev[j]=i;pfQ[t++]=j}}
  let p=null;if(found){p=[];for(let i=to;i!==-1;i=pfPrev[i])p.push(i);p.reverse()}
  if(roadMode){if(pathCache.size>12000)pathCache.clear();pathCache.set(key,p)}
  return p;
}
const seaPass=j=>seaMask[j]===1&&wdist[j]>=1;

// ---------- Vatandaşlar ----------
const ROLE_TR={worker:'Çalışan',merchant:'Esnaf',student:'Öğrenci',doctor:'Doktor',police:'Polis',fire:'İtfaiyeci',soldier:'Asker',farmer:'Çiftçi',thief:'Hırsız',retiree:'Emekli'};
const STATE_TR={HOME:'Evde',WORK:'İş başında',LEISURE:'Boş zamanında dışarıda',MOVE:'Yolda',WAIT:'Yola çıkıyor',PATROL:'Devriyede',ONSITE:'Olay yerinde',HOSP:'Hastanede tedavi görüyor',JAIL:'Gözaltında',FRONT:'Cephede',IDLE:'Bekliyor'};
function makeAgent(c,role,home,work){
  const hb=buildings[home];if(!hb||hb.ent<0)return null;
  const a={id:agents.length,c,role,name:pick(FIRST)+' '+pick(LAST),age:role==='student'?ri(8,22):role==='retiree'?ri(66,88):ri(23,62),
    home,work,at:home,tile:hb.ent,gx:tx(hb.ent)+.5,gy:ty(hb.ent)+.5,path:null,pi:0,t:0,len:1,purpose:null,state:'HOME',vis:false,next:now+rnd(0,90),
    energy:rnd(.5,1),fun:rnd(.3,1),money:rnd(.2,.9),hs:0,hsT:0,mode:'walk',veh:null,dest:-1,destB:-1,alive:true,busy:false,jailUntil:0,inc:null,hdg:0,spd:0,
    col:pick(['#C0392B','#ECF0F1','#2C3E50','#2980B9','#7F8C8D','#F1C40F','#16A085','#8E44AD','#D35400','#BDC3C7','#34495E','#E8E2D0'])};
  agents.push(a);(nations[c].roles[role]||(nations[c].roles[role]=[])).push(a);return a;
}
function rebuildRoles(){for(const nt of nations)nt.roles={};for(const a of agents)if(a.alive)(nations[a.c].roles[a.role]||(nations[a.c].roles[a.role]=[])).push(a)}
function nationAgents(c){let n=0;for(const a of agents)if(a.alive&&a.c===c)n++;return n}
function populate(){
  for(const nt of nations){
    const B=buildings.filter(b=>b.c===nt.id&&b.ent>=0);const by=(...ts)=>B.filter(b=>ts.includes(b.type));
    nt.res=by('house','apartment','highrise');nt.leisure=by('shop','mall','stadium');if(!nt.res.length)continue;
    const homeFor=wb=>{const comp=roadComp[wb.ent];const same=nt.res.filter(r=>roadComp[r.ent]===comp);const pool=same.length?same:nt.res;const near=pool.filter(r=>r.city===wb.city);return pick(near.length&&R()<.75?near:pool)};
    const add=(role,wb,n,live)=>{for(let k=0;k<n;k++)makeAgent(nt.id,role,live?wb.id:homeFor(wb).id,wb.id)};
    by('police').forEach(b=>add('police',b,4));by('fire').forEach(b=>add('fire',b,3,true));by('hospital').forEach(b=>add('doctor',b,3));
    by('barracks').forEach(b=>add('soldier',b,7,true));by('barn').slice(0,12).forEach(b=>add('farmer',b,1));
    by('school').forEach(b=>add('student',b,4));by('university').forEach(b=>add('student',b,6));
    by('shop','mall','stadium').slice(0,30).forEach(b=>add('merchant',b,1));
    const works=by('office','tower','factory','warehouse','power','terminal','portwh','crane','parliament');
    for(let k=0;k<Math.min(80,works.length*2);k++)add('worker',works[k%works.length],1);
    for(let k=0;k<16;k++){const h=pick(nt.res);makeAgent(nt.id,'retiree',h.id,h.id)}
    for(let k=0;k<ri(4,6);k++){const h=pick(nt.res);makeAgent(nt.id,'thief',h.id,h.id)}
  }
}
const aliveOf=c=>agents.filter(a=>a.alive&&a.c===c);
const tripQ=[];
function goTo(a,tile,purpose,destB=-1){if(tile<0){a.state='IDLE';a.next=now+60;return}a.purpose=purpose;a.dest=tile;a.destB=destB;a.state='WAIT';tripQ.push(a)}
function goB(a,bid,purpose){const b=buildings[bid];if(!b||b.ent<0){a.next=now+60;return}if(a.at===bid&&a.state!=='MOVE'){a.purpose=purpose;arrive(a);return}goTo(a,b.ent,purpose,bid)}
function processTrips(){let n=0;
  while(tripQ.length&&n<140){const a=tripQ.shift();if(!a.alive||a.state!=='WAIT')continue;n++;
    const p=findPath(a.tile,a.dest);
    if(!p||p.length<2){a.tile=a.dest>=0?a.dest:a.tile;a.gx=tx(a.tile)+.5;a.gy=ty(a.tile)+.5;arrive(a);continue}
    a.mode=a.veh?'car':(p.length>8?'car':'walk');startMove(a,p);a.state='MOVE';a.vis=true;a.at=-1}
}
function arrive(a){
  a.path=null;a.vis=false;a.at=a.destB>=0?a.destB:-1;
  const p=a.purpose;if(!['respond','chase','front','patrol'].includes(p))a.veh=null;
  switch(p){
    case'home':a.state='HOME';a.next=now+rnd(30,90);break;
    case'work':a.state='WORK';a.next=now+rnd(30,90);break;
    case'leisure':a.state='LEISURE';a.fun=1;a.money=Math.max(0,a.money-.1);a.next=now+rnd(60,170);break;
    case'patrol':a.state='PATROL';a.vis=true;a.next=now+rnd(8,30);break;
    case'crime':commitCrime(a);break;
    case'respond':onRespond(a);break;
    case'chase':onChase(a);break;
    case'hospital':a.state='HOSP';a.next=now+60;break;
    case'front':a.state='FRONT';a.vis=true;a.next=now+60;{const nt=nations[a.c];nt.fslot=(nt.fslot||0)+1;a.slot=nt.fslot}break;
    case'return':a.state='WORK';a.busy=false;a.inc=null;a.next=now+rnd(20,60);break;
    default:a.state='IDLE';a.next=now+30;
  }
}
const isWeekend=()=>{const d=dateOf(now).getUTCDay();return d===0||d===6};
function goHome(a){goB(a,a.home,'home')}
function goWork(a){goB(a,a.work,'work')}
function goLeisure(a){const nt=nations[a.c];if(!nt.leisure.length){goHome(a);return}
  const hb=buildings[a.home];let best=null,bd=1e9;for(let k=0;k<5;k++){const b=pick(nt.leisure);if(!b||b.ent<0||roadComp[b.ent]!==roadComp[hb.ent])continue;const d=Math.abs(b.x-hb.x)+Math.abs(b.y-hb.y);if(d<bd){bd=d;best=b}}
  if(!best){goHome(a);return}goB(a,best.id,'leisure')}
function policeOnDuty(a){const h=hourOf();return(h>=8&&h<20)?a.id%3!==0:a.id%3===0}
function patrol(a){const ct=cities[buildings[a.work].city]||capOf(a.c);for(let k=0;k<8;k++){const x=ct.x+ri(-ct.R,ct.R),y=ct.y+ri(-ct.R,ct.R);if(!inb(x,y))continue;const i=idx(x,y);if(isRoad(terr[i])&&roadComp[i]===roadComp[a.tile]){a.veh='police';goTo(a,i,'patrol');return}}a.next=now+20}
function think(a){
  const nt=nations[a.c],h=hourOf(),we=isWeekend();
  if(a.state==='JAIL'){if(now>=a.jailUntil){a.state='IDLE';news(a.c,`${a.name} cezasını tamamlayıp serbest bırakıldı.`,'crime');goHome(a)}else a.next=now+180;return}
  if(a.state==='HOSP'||a.busy||a.state==='FRONT'){a.next=now+60;return}
  const curfew=nt.curfew&&(h>=21||h<6),night=h>=22||h<6;
  const stay=()=>{a.next=now+rnd(40,100)};
  const atHome=a.at===a.home&&a.state==='HOME',atWork=a.at===a.work&&a.state==='WORK';
  const evening=()=>{if(night||curfew){atHome?stay():goHome(a);return}
    if(!atHome&&a.state!=='LEISURE'&&a.fun<.55&&a.money>.15&&R()<.55&&!(nt.curfew&&h>=19)){goLeisure(a);return}
    if(a.state==='LEISURE'&&R()<.5){stay();return}atHome?stay():goHome(a)};
  switch(a.role){
    case'worker':if(!we&&h>=7.5&&h<17){atWork?stay():goWork(a)}else evening();break;
    case'merchant':if(dateOf(now).getUTCDay()!==0&&h>=9&&h<20){atWork?stay():goWork(a)}else evening();break;
    case'student':if(!we&&h>=8&&h<15){atWork?stay():goWork(a)}else evening();break;
    case'doctor':if(h>=8&&h<20||a.id%4===0&&(h>=20||h<8)){atWork?stay():goWork(a)}else evening();break;
    case'farmer':if(h>=6&&h<18&&nt.weather!=='fırtına'){atWork?stay():goWork(a)}else evening();break;
    case'police':if(policeOnDuty(a)){if(a.state==='PATROL'&&R()<.25){goWork(a);return}if(a.state==='WORK'&&R()<.6||a.state==='PATROL')patrol(a);else if(!atWork)goWork(a);else stay()}else evening();break;
    case'fire':if(!atWork)goWork(a);else stay();break;
    case'soldier':if(nt.mobilized&&!warsOf(a.c).length){mobilizeSoldier(a);return}if(!atWork)goWork(a);else stay();break;
    case'thief':{const act=.22+(1-nt.lvl.police)*.35+nt.unemployment*2+(nt.crimeWave||0);
      if((h>=22||h<4)&&R()<act*(curfew?.4:1)){planCrime(a);return}
      if(!night&&!curfew&&R()<.25){goLeisure(a);if(R()<.15*act)deferred.push(()=>streetCrime(a));return}
      atHome?stay():goHome(a);break}
    case'retiree':if(h>=9&&h<18&&!curfew&&nt.weather!=='fırtına'){if(a.state==='LEISURE'&&R()<.6)stay();else if(R()<.45)goLeisure(a);else atHome?stay():goHome(a)}else evening();break;
    default:stay();
  }
}
const deferred=[];

// ---------- Olaylar: suç, yangın ----------
let incidents=[],incSeq=0,burning=[];
function newInc(type,c,tile,extra){const inc={id:incSeq++,type,c,tile,t:now,resp:[],done:false,...extra};incidents.push(inc);if(incidents.length>300)incidents=incidents.filter(i=>!i.done||now-i.t<1440);return inc}
function dispatch(nt,role,tile,n,inc,veh){
  let pool=(nt.roles[role]||[]).filter(a=>a.alive&&!a.busy&&a.state!=='HOSP'&&a.state!=='JAIL'&&a.state!=='FRONT');
  if(role==='police'){const on=pool.filter(policeOnDuty);if(on.length)pool=on}
  const X=tx(tile),Y=ty(tile);pool.sort((p,q)=>(Math.abs(p.gx-X)+Math.abs(p.gy-Y))-(Math.abs(q.gx-X)+Math.abs(q.gy-Y)));
  const sel=pool.filter(a=>roadComp[a.tile]===roadComp[tile]).slice(0,n);
  for(const a of sel){a.busy=true;a.inc=inc;a.veh=veh;inc.resp.push(a.id);goTo(a,tile,'respond')}
  return sel.length;
}
function release(inc){inc.done=true;for(const id of inc.resp){const a=agents[id];if(!a||!a.alive)continue;if(a.inc===inc)goB(a,a.work,'return')}}
const CRIME_KINDS={shop:'dükkân soygunu',mall:'AVM’de gasp',house:'ev hırsızlığı',apartment:'apartman hırsızlığı',highrise:'rezidans hırsızlığı',office:'ofis hırsızlığı',tower:'ofis hırsızlığı'};
function planCrime(a){const hb=buildings[a.home];
  const cands=[];for(let k=0;k<40;k++){const b=buildings[ri(0,buildings.length-1)];if(b.c===a.c&&b.ent>=0&&CRIME_KINDS[b.type]&&Math.abs(b.x-hb.x)+Math.abs(b.y-hb.y)<20&&roadComp[b.ent]===roadComp[hb.ent])cands.push(b)}
  if(!cands.length){a.next=now+120;return}goB(a,pick(cands).id,'crime')}
function commitCrime(a){
  const nt=nations[a.c],b=buildings[a.at];a.state='IDLE';if(!b){goHome(a);return}
  nt.stats.crimes++;nt.stats.crimeDays[0]++;const kind=CRIME_KINDS[b.type]||'hırsızlık';const ct=cities[b.city];
  if(R()<.5+nt.lvl.police*.4){const inc=newInc('crime',a.c,b.ent,{thief:a.id,kind});const n=dispatch(nt,'police',b.ent,R()<.5?2:1,inc,'police');
    if(R()<.4)news(a.c,`${ct?ct.name:nt.name}: ${kind} ihbarı, ${n?n+' ekip yönlendirildi':'müsait ekip yok'}.`,'crime',b.ent)}
  else if(R()<.2)news(a.c,`${ct?ct.name:nt.name}: bildirilmemiş bir ${kind} yaşandı.`,'crime',b.ent);
  a.wanted=true;goHome(a);
}
function streetCrime(a){if(!a.alive)return;const nt=nations[a.c];nt.stats.crimes++;nt.stats.crimeDays[0]++;if(R()<.25)news(a.c,`${nt.name}: çarşıda kapkaç vakası bildirildi.`,'crime',a.tile)}
function onRespond(a){const inc=a.inc;if(!inc||inc.done){goB(a,a.work,'return');return}
  if(inc.type==='crime'){const th=agents[inc.thief];a.state='ONSITE';a.vis=true;
    if(th&&th.alive&&th.state!=='JAIL'){const d=Math.abs(th.gx-a.gx)+Math.abs(th.gy-a.gy);
      if(d<=4&&R()<.5+nations[a.c].lvl.police*.3){arrest(th,a,inc);return}goTo(a,buildings[th.home].ent,'chase');return}
    release(inc);return}
  if(inc.type==='fire'||inc.type==='wild'){a.state='ONSITE';a.vis=true;a.next=now+9999;return}
  release(inc);
}
function onChase(a){const inc=a.inc;const th=inc&&agents[inc.thief];
  if(th&&th.alive&&th.state!=='JAIL'&&(Math.abs(th.gx-a.gx)+Math.abs(th.gy-a.gy)<=3||th.at===th.home)&&R()<.22+nations[a.c].lvl.police*.35)arrest(th,a,inc);
  else{if(inc&&R()<.5)news(a.c,`${nations[a.c].name}: şüpheli izini kaybettirdi, soruşturma sürüyor.`,'crime',a.tile);if(inc)release(inc);else goB(a,a.work,'return')}}
function arrest(th,cop,inc){const nt=nations[th.c];th.state='JAIL';th.path=null;th.vis=false;th.at=cop.work;th.jailUntil=now+rnd(2,6)*1440;th.wanted=false;nt.stats.arrests++;
  news(th.c,`${nt.name} polisi ${inc.kind||'suç'} zanlısı ${th.name}’i gözaltına aldı.`,'crime',cop.tile);release(inc)}
function ignite(b,cause){if(!b||b.fire>0||b.type==='rubble'||b.type==='construction')return;const nt=nations[b.c];
  b.fire=1;b.burn=0;nt.stats.fires++;const inc=newInc('fire',b.c,b.ent,{b:b.id});b.inc=inc;burning.push(b);
  const n=b.ent>=0?dispatch(nt,'fire',b.ent,3,inc,'fire'):0;const ct=cities[b.city];
  news(b.c,`${ct?ct.name:nt.name}: ${BT[b.type].lbl.toLocaleLowerCase('tr-TR')} alev aldı${cause?' ('+cause+')':''}. ${n} itfaiye ekibi yolda.`,'hi',b.i)}
function updateFires(dm){
  for(const b of burning){if(b.fire<=0)continue;const inc=b.inc;
    const crew=inc.resp.filter(id=>{const a=agents[id];return a&&a.alive&&a.state==='ONSITE'&&a.inc===inc}).length;
    b.fire=Math.min(3,b.fire+(.004-crew*.013)*dm);b.burn+=Math.max(0,b.fire)*.035*dm;
    if(b.fire>2.2&&R()<.0006*dm){const nb=buildings.find(o=>o!==b&&Math.abs(o.x-b.x)<=1&&Math.abs(o.y-b.y)<=1&&o.fire<=0&&o.type!=='rubble');if(nb)ignite(nb,'sıçrama')}
    if(b.fire<=0){b.fire=0;release(inc);news(b.c,`${nations[b.c].name}: yangın kontrol altına alındı, ${BT[b.type].lbl.toLocaleLowerCase('tr-TR')} kurtarıldı.`,'info',b.i)}
    else if(b.burn>=100){b.fire=0;release(inc);destroy(b,'yangın')}}
  burning=burning.filter(b=>b.fire>0);
}
function destroy(b,cause){
  const nt=nations[b.c];if(b.type==='rubble')return;b.orig=b.type==='construction'?b.target:b.type;setType(b,'rubble');b.fire=0;
  let dead=0;for(const a of agents){if(!a.alive||a.at!==b.id||a.vis)continue;if(R()<(cause==='deprem'?.3:cause==='hava saldırısı'?.35:.12)){kill(a,cause);dead++}else{a.at=-1;a.state='IDLE';a.next=now+10}}
  for(const a of agents){if(!a.alive||a.c!==b.c)continue;if(a.home===b.id&&nt.res.length){const nh=pick(nt.res.filter(r=>r.type!=='rubble'));if(nh)a.home=nh.id}if(a.work===b.id)a.work=a.home}
  nt.res=nt.res.filter(r=>r!==b);nt.leisure=nt.leisure.filter(r=>r!==b);nt.disasterPenalty+=.002;
  news(b.c,`${nt.name}: ${BT[b.orig]?BT[b.orig].lbl.toLocaleLowerCase('tr-TR'):'bina'} ${cause} nedeniyle yıkıldı${dead?', '+dead+' kişi hayatını kaybetti':''}.`,'hi',b.i);
}
function kill(a,cause){if(!a.alive)return;a.alive=false;a.vis=false;a.state='DEAD';a.cause=cause;nations[a.c].stats.deaths++}

// ---------- Salgın ----------
function infect(a){if(a.hs!==0||!a.alive)return;a.hs=1;a.hsT=now+rnd(12,60)*60;nations[a.c].stats.cases++}
function nearestHospital(a){let best=null,bd=1e9;for(const b of buildings){if(b.c!==a.c||b.type!=='hospital'||b.ent<0||roadComp[b.ent]!==roadComp[a.tile])continue;const d=Math.abs(b.x-a.gx)+Math.abs(b.y-a.gy);if(d<bd){bd=d;best=b}}return best}
function diseaseHour(){
  const occ=new Map();for(const a of agents){if(!a.alive||a.vis||a.at<0)continue;let l=occ.get(a.at);if(!l)occ.set(a.at,l=[]);l.push(a)}
  const month=dateOf(now).getUTCMonth();const season=(month>=10||month<=2)?1.35:month>=5&&month<=8?.7:1;
  for(const[bid,l]of occ){let k=0;for(const a of l)if(a.hs===1||a.hs===2)k++;if(!k)continue;
    const nt=nations[buildings[bid].c];const beta=.022*season*(1+nt.epiBoost)*(nt.quarantine?.35:1)*(buildings[bid].type==='hospital'?.4:1);
    const p=1-Math.pow(1-beta,k);for(const a of l)if(a.hs===0&&R()<p)infect(a)}
  const hosp=Array(10).fill(0);for(const b of buildings)if(b.type==='hospital')hosp[b.c]++;
  for(const nt of nations){let sick=0,inf=0;for(const a of agents){if(!a.alive||a.c!==nt.id)continue;if(a.hs===1||a.hs===2)inf++;if(a.hs===2)sick++}nt.stats.infected=inf;nt.overload=sick>Math.max(1,hosp[nt.id]*10)}
  for(const a of agents){if(!a.alive)continue;const nt=nations[a.c];
    if(a.hs===1&&now>=a.hsT){if(R()<.55){a.hs=2;if(a.state!=='JAIL'&&a.state!=='FRONT'){const hb=nearestHospital(a);if(hb){a.busy=false;a.inc=null;a.veh=R()<.5?'amb':null;goB(a,hb.id,'hospital')}}}else{a.hs=3;a.hsT=now+30*1440}}
    else if(a.hs===2){const rec=(.02+nt.lvl.health*.05)/(nt.overload?1.8:1);const die=.0012*(a.role==='retiree'?4:1)*(nt.overload?3:1)*(1+nt.epiBoost*.5)*(1.4-nt.lvl.health);
      if(R()<die){kill(a,'hastalık');if(R()<.4)news(a.c,`${nt.name}: ${a.name} (${a.age}) salgın nedeniyle hayatını kaybetti.`,'hi')}
      else if(R()<rec){a.hs=3;a.hsT=now+30*1440;if(a.state==='HOSP'){a.state='IDLE';a.veh=null;if(a.role==='fire'||a.role==='soldier')goWork(a);else goHome(a)}}}
    else if(a.hs===3&&now>=a.hsT)a.hs=0}
}

// ---------- Hava ve doğal olaylar ----------
function weatherDay(nt){const m=dateOf(now).getUTCMonth(),north=nt.seed.y<H/2;const r=R();
  const winter=m===11||m<=1,autumn=m>=8&&m<=10,spring=m>=2&&m<=4;
  let w='açık';if(winter&&north&&r<.3)w='karlı';else if(r<(autumn||spring?.34:winter?.3:.14))w='yağmurlu';else if(r<.5)w='bulutlu';
  if(R()<(autumn||spring?.045:.022))w='fırtına';if(nt.forceStorm>0){w='fırtına';nt.forceStorm--}
  if(w==='fırtına'&&nt.weather!=='fırtına')news(nt.id,`${nt.name}: şiddetli fırtına uyarısı, uçuş ve gemi seferleri iptal.`,'hi');nt.weather=w}
const cityList=c=>cities.filter(x=>x.c===c);
function quake(nt,x,y,mag){
  if(x===undefined){const ct=pick(cityList(nt.id));x=ct.x+ri(-4,4);y=ct.y+ri(-4,4)}
  mag=mag||+(rnd(5.2,7.4)).toFixed(1);const Rr=Math.round((mag-4)*3);
  news(nt.id,`${nt.name}’da ${mag} büyüklüğünde deprem! Arama kurtarma ekipleri sahada.`,'big',idx(x,y));shake=Math.min(28,(mag-4)*6);
  for(const b of buildings){if(b.type==='rubble'||b.type==='construction')continue;const d=Math.hypot(b.x-x,b.y-y);if(d>Rr)continue;
    const p=(mag-5)*.22*(1-d/Rr)*(1.2-nations[b.c].lvl.infra*.5);if(R()<p){if(R()<.3)ignite(b,'deprem');else destroy(b,'deprem')}}
  for(let k=0;k<30;k++)boom(x+rnd(-Rr,Rr)/2,y+rnd(-Rr,Rr)/2,'dust');
  nt.disasterPenalty+=.01*(mag-5);nt.rally+=4;
  for(const o of nations)if(o.id!==nt.id&&o.rel[nt.id]>-10&&o.pres.traits.empathy>.55&&R()<.6){o.treasury-=1;nt.treasury+=1;addRel(o.id,nt.id,8);news(o.id,`${o.name}, depremden etkilenen ${nt.name}’ya insani yardım gönderdi.`,'ai')}
}
let floodList=[];
function floodEv(nt){const riv=[];for(let i=0;i<N;i++)if(owner[i]===nt.id&&terr[i]===T.WATER&&!seaMask[i])riv.push(i);
  const cityT=[];for(let i=0;i<N;i++)if(owner[i]===nt.id&&cityAt[i]>=0)cityT.push(i);if(!riv.length&&!cityT.length)return;
  const c0=riv.length?pick(riv):pick(cityT);const x0=tx(c0),y0=ty(c0);let n=0;
  for(let dy=-8;dy<=8;dy++)for(let dx=-8;dx<=8;dx++){const x=x0+dx,y=y0+dy;if(!inb(x,y))continue;const i=idx(x,y);if(isWater(terr[i]))continue;if(Math.hypot(dx,dy)<8&&elev[i]<elev[c0]+.18+rnd(0,.08)){flood[i]=rnd(1,3)*1440;floodList.push(i);n++}}
  nt.disasterPenalty+=.008;news(nt.id,`${nt.name}: şiddetli yağışlar sonrası sel, ${n} bölgede su baskını.`,'hi',c0)}
let anyWild=false;
function wildfire(nt){const f=[];for(let i=0;i<N;i++)if(owner[i]===nt.id&&terr[i]===T.FOREST)f.push(i);if(!f.length)return;const i=pick(f);forestFire[i]=1;anyWild=true;
  let near=-1;for(let r=1;r<10&&near<0;r++)for(let dy=-r;dy<=r&&near<0;dy++)for(let dx=-r;dx<=r;dx++){const x=tx(i)+dx,y=ty(i)+dy;if(inb(x,y)&&isRoad(terr[idx(x,y)])){near=idx(x,y);break}}
  const inc=newInc('wild',nt.id,near,{tile0:i});if(near>=0)dispatch(nt,'fire',near,3,inc,'fire');nt.wild=inc;
  news(nt.id,`${nt.name}: orman yangını başladı, rüzgârla yayılıyor.`,'hi',i)}
function updateWildfires(dm){
  const any=new Set();
  for(let i=0;i<N;i++){if(forestFire[i]<=0)continue;const c=owner[i];any.add(c);
    const nt=c>=0?nations[c]:null;const inc=nt&&nt.wild;const crew=inc?inc.resp.filter(id=>agents[id]&&agents[id].state==='ONSITE').length:0;
    forestFire[i]+=dm*(.004-crew*.0016-(nt&&nt.weather==='yağmurlu'?.004:0));
    if(R()<.004*dm){const[dx,dy]=pick(D8);const x=tx(i)+dx,y=ty(i)+dy;if(inb(x,y)){const j=idx(x,y);if(terr[j]===T.FOREST&&forestFire[j]<=0)forestFire[j]=.5;else if(bldAt[j]>=0&&R()<.1)ignite(buildings[bldAt[j]],'orman yangını')}}
    if(forestFire[i]>2.5||forestFire[i]<=0){if(forestFire[i]>2.5){terr[i]=T.GRASS;treeKind[i]=0;markDirty(tx(i),ty(i))}forestFire[i]=0}}
  for(const nt of nations)if(nt.wild&&!any.has(nt.id)){release(nt.wild);news(nt.id,`${nt.name}: orman yangını söndürüldü.`,'info');nt.wild=null}
  anyWild=any.size>0;
}
function epidemic(nt){const cs=aliveOf(nt.id).filter(a=>a.hs===0);for(let k=0;k<8&&cs.length;k++)infect(cs.splice(ri(0,cs.length-1),1)[0]);nt.epiBoost=Math.max(nt.epiBoost,1.6);
  news(nt.id,`${nt.name}: yeni bir solunum yolu virüsü tespit edildi, vaka sayısı artıyor.`,'hi')}
function crisis(nt){nt.gdp*=.96;nt.treasury-=nt.gdp*.02;nt.disasterPenalty+=.03;news(nt.id,`${nt.name}: bankacılık krizi, borsa sert düştü ve işsizlik yükseliyor.`,'hi')}
function borderIncident(nt){const nb=nations.filter(o=>isNeighbor(nt.id,o.id));if(!nb.length){news(nt.id,`${nt.name}’nın henüz kara komşusu yok; sınır olayı yaşanmadı.`,'info');return}const o=pick(nb);addRel(nt.id,o.id,-ri(8,16));
  news(nt.id,`${nt.name}–${o.name} sınırında gerginlik: devriyeler arasında silah sesleri duyuldu.`,'hi')}
function crimeWave(nt){nt.crimeWave=.5;for(let k=0;k<3;k++){const h=pick(nt.res);if(h)makeAgent(nt.id,'thief',h.id,h.id)}news(nt.id,`${nt.name}: organize suç çeteleri büyük şehirlerde etkinlik gösteriyor.`,'hi')}

// ---------- İnşaat ----------
const COST={hospital:2.5,police:1.2,fire:1.1,school:1.2,university:3,apartment:1.6,highrise:3.2,house:.5,factory:2.6,office:2,power:3.2,shop:.6,mall:2.2,stadium:3,tower:3.5,warehouse:1};
function findSite(nt,near){
  const cs=near?[near]:cityList(nt.id).sort(()=>R()-.5);
  for(const ct of cs){const c=[];for(let dy=-ct.R-2;dy<=ct.R+2;dy++)for(let dx=-ct.R-2;dx<=ct.R+2;dx++){const x=ct.x+dx,y=ct.y+dy;if(!inb(x,y))continue;const i=idx(x,y);
      if(owner[i]!==nt.id||!(terr[i]===T.GRASS||terr[i]===T.FARM||terr[i]===T.PARK)||bldAt[i]>=0)continue;
      if(D4.some(([a,b])=>inb(x+a,y+b)&&isRoad(terr[idx(x+a,y+b)])))c.push({x,y,ct})}
    if(c.length)return pick(c)}
  return null}
function startConstruction(nt,type,days,silent){
  const s=findSite(nt);if(!s){// yer yoksa dönüştür: eski bir evi yık ve yerine yap
    const h=buildings.filter(b=>b.c===nt.id&&b.type==='house'&&b.ent>=0);if(!h.length)return null;const b=pick(h);b.orig=type;setType(b,'construction');b.target=type;b.doneAt=now+days*1440;markDirty(b.x,b.y);return b}
  const i=idx(s.x,s.y);terr[i]=T.GRASS;treeKind[i]=0;cityAt[i]=s.ct.id;
  const b=addBuilding(s.x,s.y,'construction',nt.id,s.ct.id);b.target=type;b.doneAt=now+days*1440;computeEnt(b);markDirty(s.x,s.y);
  if(!silent)news(nt.id,`${nt.name}: ${s.ct.name}’da yeni ${BT[type].lbl.toLocaleLowerCase('tr-TR')} inşaatı başladı.`,'info',i);return b}
function finishBuilding(b){const nt=nations[b.c];setType(b,b.target||'house');computeEnt(b);markDirty(b.x,b.y);nt.stats.built++;
  const d=BT[b.type];if(d.cat==='res'&&!nt.res.includes(b))nt.res.push(b);if(d.leisure&&!nt.leisure.includes(b))nt.leisure.push(b);
  const n=nationAgents(nt.id);if(b.ent<0||n>=MAX_AGENTS_PER_NATION)return;
  const staff={hospital:['doctor',3],police:['police',3],fire:['fire',3],school:['student',3],university:['student',5],factory:['worker',3],office:['worker',3],tower:['worker',4],power:['worker',2],mall:['merchant',2],shop:['merchant',1],warehouse:['worker',1]}[b.type];
  if(staff&&nt.res.length)for(let k=0;k<staff[1];k++){const h=staff[0]==='fire'?b:pick(nt.res);makeAgent(nt.id,staff[0],h.id,b.id)}
  if(d.cat==='res'){const k=b.type==='house'?1:b.type==='apartment'?2:3;const jobs=buildings.filter(o=>o.c===nt.id&&BT[o.type].cat==='work'&&o.ent>=0&&roadComp[o.ent]===roadComp[b.ent]);
    for(let j=0;j<k;j++){const r=R();if(r<.15)makeAgent(nt.id,'retiree',b.id,b.id);else if(r<.3){const s=buildings.filter(o=>o.c===nt.id&&o.type==='school');makeAgent(nt.id,'student',b.id,s.length?pick(s).id:b.id)}else if(jobs.length)makeAgent(nt.id,'worker',b.id,pick(jobs).id)}}
  if(b.type==='factory'||b.type==='office'||b.type==='tower')nt.gdp*=1.003;
}
let lastGrowNews=0;
function constructionDay(){
  let opened=new Map();
  for(const b of buildings){
    if(b.type==='construction'&&now>=b.doneAt){finishBuilding(b);const k=b.c+':'+b.city;opened.set(k,(opened.get(k)||0)+1)}
    else if(b.type==='rubble'){const nt=nations[b.c];if(R()<nt.lvl.infra*.12&&nt.treasury>-nt.gdp*.2){nt.treasury-=(COST[b.orig]||1)*.5;setType(b,'construction');b.target=b.orig||'house';b.doneAt=now+rnd(3,8)*1440;markDirty(b.x,b.y)}}}
  for(const[k,n]of opened){const[c,ci]=k.split(':').map(Number);const ct=cities[ci];if(n>=2)news(c,`${ct?ct.name:nations[c].name}: ${n} yeni yapı hizmete açıldı.`,'info',ct?idx(ct.x,ct.y):-1)}
}

// ---------- Büyüme: toprak, şehir, kasaba, koloni, dikey yapılaşma ----------
function claimFrontier(nt,k){
  const ownCities=cityList(nt.id);const cand=[];
  for(let i=0;i<N;i++){if(owner[i]>=0||isWater(terr[i]))continue;const x=tx(i),y=ty(i);let mine=false;
    for(const[dx,dy]of D4){const nx=x+dx,ny=y+dy;if(inb(nx,ny)&&owner[idx(nx,ny)]===nt.id){mine=true;break}}if(!mine)continue;
    let dmin=1e9;for(const c of ownCities){const d=Math.hypot(c.x-x,c.y-y);if(d<dmin)dmin=d}
    cand.push([dmin+(terr[i]===T.MOUNT?6:0)+hash(x,y)*3,i])}
  if(!cand.length){nt.landlocked=true;return 0}nt.landlocked=false;
  cand.sort((a,b)=>a[0]-b[0]);let got=0;
  for(const[,i]of cand.slice(0,k)){owner[i]=nt.id;got++;markDirty(tx(i),ty(i));const x=tx(i),y=ty(i);
    for(const[dx,dy]of D4){const nx=x+dx,ny=y+dy;if(!inb(nx,ny))continue;const o=owner[idx(nx,ny)];if(o>=0&&o!==nt.id&&!nt.contact.has(o)){nt.contact.add(o);nations[o].contact.add(nt.id);
      addRel(nt.id,o,-6);news(nt.id,`${nt.name} ile ${nations[o].name} sınırları birleşti; artık kara komşusular.`,'big',i)}}}
  nt.stats.claimed+=got;return got;
}
function growCity(ct){
  const nt=nations[ct.c];if(ct.R>=ct.maxR)return densify(ct);
  const r1=ct.R+2;let owned=0,total=0,foreign=0;
  for(let dy=-r1;dy<=r1;dy++)for(let dx=-r1;dx<=r1;dx++){const d=Math.hypot(dx,dy);if(d>r1||d<=ct.R)continue;const x=ct.x+dx,y=ct.y+dy;if(!inb(x,y))continue;const i=idx(x,y);if(isWater(terr[i]))continue;total++;
    if(owner[i]===ct.c)owned++;else if(owner[i]>=0)foreign++;else{owner[i]=ct.c;owned++}}
  if(total&&foreign/total>.35){ct.blocked=true;return densify(ct)}
  const made=layoutRing(ct,ct.R,r1,true);ct.R=r1;computeRoadComp();
  for(const b of made)computeEnt(b);
  for(let dy=-r1-1;dy<=r1+1;dy+=4)for(let dx=-r1-1;dx<=r1+1;dx+=4)markDirty(ct.x+dx,ct.y+dy);
  nt.treasury-=made.length*.03;
  // yeni mahalle için hizmet binaları
  if(R()<.6){const c=made.filter(b=>b.type==='construction');if(c.length)pick(c).target=pick(['school','police','hospital','fire','school','mall'])}
  news(ct.c,`${ct.name} büyüyor: ${made.length} parsellik yeni mahalle imara açıldı.`,'info',idx(ct.x,ct.y));
  return made.length;
}
function densify(ct){const nt=nations[ct.c];
  const cand=buildings.filter(b=>b.city===ct.id&&(b.type==='house'||b.type==='apartment')&&Math.hypot(b.x-ct.x,b.y-ct.y)<ct.R*.75);if(!cand.length)return 0;
  const TALL=new Set(['highrise','office','apartment']);const tallNear=b=>{for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const x=b.x+dx,y=b.y+dy;if(!inb(x,y))continue;const j=bldAt[idx(x,y)];if(j>=0&&TALL.has(buildings[j].type))return true}return false};
  for(let k=cand.length-1;k>=0;k--){const b=cand[k];const core=Math.hypot(b.x-ct.x,b.y-ct.y)<ct.R*.4;if(b.type==='apartment'&&(!core||tallNear(b)))cand.splice(k,1);else if(b.type==='house'&&tallNear(b)&&!core)cand.splice(k,1)}if(!cand.length)return 0;
  const n=Math.min(3,cand.length);for(let k=0;k<n;k++){const b=cand.splice(ri(0,cand.length-1),1)[0];b.target=b.type==='house'?'apartment':'highrise';setType(b,'construction');b.doneAt=now+rnd(4,10)*1440;markDirty(b.x,b.y)}
  nt.treasury-=n*.4;news(ct.c,`${ct.name}: arazi kalmadı, şehir dikeyleşiyor; ${n} bina daha yüksek yapılarla yenileniyor.`,'info',idx(ct.x,ct.y));return n}
function foundTown(nt,colony){
  if(cityList(nt.id).length>=6)return null;const k=cityList(nt.id).length;const name=nt.def.cities[k]||nt.name+' '+(k+1);
  let site=colony?null:findTownSite(nt,14,42);
  if(!site&&(colony||nt.landlocked)&&nt.port){site=findColonySite(nt);if(site){claimDisk(nt,site.x,site.y,8);colony=true}}
  if(!site)return null;
  const ct=newCity(nt.id,site.x,site.y,4,false,name);ct.maxR=14;ct.colony=!!colony;
  layoutRing(ct,-1,4,true);
  const near=cityList(nt.id).filter(c=>c!==ct).sort((a,b)=>Math.hypot(a.x-ct.x,a.y-ct.y)-Math.hypot(b.x-ct.x,b.y-ct.y))[0];
  if(near&&(!colony||Math.hypot(near.x-ct.x,near.y-ct.y)<20)){window.__allowSea=colony;const ok=roadAStar(ct.x,ct.y,near.x,near.y,colony);window.__allowSea=false;if(ok&&colony)news(nt.id,`${name} kolonisi ana karaya köprüyle bağlandı.`,'big',idx(ct.x,ct.y))}
  if(colony){const p=placePort(nt,ct);if(p)news(nt.id,`${nt.name} denizaşırı bir liman kurdu.`,'info')}
  placeServices(ct,false);computeRoadComp();for(const b of buildings)if(b.city===ct.id||b.ent<0)computeEnt(b);
  for(let dy=-12;dy<=12;dy+=4)for(let dx=-12;dx<=12;dx+=4)markDirty(ct.x+dx,ct.y+dy);
  nt.treasury-=4;nt.lastTown=now;miniDirty=true;
  news(nt.id,colony?`${nt.name}, ${name} adıyla denizaşırı bir koloni kurdu.`:`${nt.name} yeni bir kasaba kurdu: ${name}.`,'big',idx(ct.x,ct.y));
  return ct;
}
function claimDisk(nt,cx,cy,r){for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.hypot(dx,dy)>r)continue;const x=cx+dx,y=cy+dy;if(!inb(x,y))continue;const i=idx(x,y);if(owner[i]<0&&!isWater(terr[i])){owner[i]=nt.id;markDirty(x,y)}}}
function findColonySite(nt){const cand=[];
  for(let k=0;k<4000;k++){const x=ri(10,W-11),y=ri(10,H-11),i=idx(x,y);if(owner[i]>=0||terr[i]!==T.GRASS)continue;
    let ok=0,coast=false;for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const j=idx(x+dx,y+dy);if(owner[j]>=0){ok=-999}if(freeLand(terr[j]))ok++;if(seaMask[j])coast=true}
    if(ok>50&&coast)cand.push({x,y})}
  if(!cand.length)return null;const cap=capOf(nt.id);cand.sort((a,b)=>Math.hypot(a.x-cap.x,a.y-cap.y)-Math.hypot(b.x-cap.x,b.y-cap.y));return cand[0]}
function growthDay(nt){
  const I=IDEO[nt.pres.ideo];
  const want=Math.round((2+Math.max(0,nt.growth)*80+(nt.happiness-40)/15)*(.5+I.expand)+(nt.expandFocus>0?8:0));
  if(nt.expandFocus>0)nt.expandFocus--;
  if(nt.treasury>-nt.gdp*.2)claimFrontier(nt,clamp(want,1,30));
  nt.demand+=.5+Math.max(0,nt.growth)*25+(nt.happiness-50)/60+(nt.lvl.infra-.5);
  if(nt.demand>=9&&nt.treasury>-nt.gdp*.15){nt.demand-=9;
    const cs=cityList(nt.id).filter(c=>!c.blocked&&c.R<c.maxR).sort((a,b)=>a.R/a.maxR-b.R/b.maxR);
    if(cs.length)growCity(cs[0]);else if(now-nt.lastTown>20*1440&&!foundTown(nt))densify(pick(cityList(nt.id)))}
}

// ---------- Ekonomi ----------
function economyDay(nt){
  const rev=nt.gdp*nt.tax/365;const debtStress=nt.treasury<-nt.gdp*.25;const spend=rev*(debtStress?.85:1.03);
  for(const s of SECTORS){const target=clamp(nt.budget[s]*nt.tax*(spend/rev)/SECTOR_REF[s],0,1);nt.lvl[s]+=(target-nt.lvl[s])*.06}
  const W_=warsOf(nt.id).length;nt.treasury+=rev-spend-W_*nt.gdp*.0004-(nt.quarantine?nt.gdp*.0002:0)+nt.trade.size*nt.gdp*.00002;
  const sanc=nations.filter(o=>o.sanction.has(nt.id)).length;
  const g=.012+nt.lvl.education*.012+nt.lvl.infra*.018+nt.trade.size*.005-Math.max(0,nt.tax-.26)*.15-W_*.05-nt.disasterPenalty-(nt.quarantine?.025:0)-sanc*.012-(nt.treasury<0?.008:0)-(nt.curfew?.005:0)+(nt.landlocked?-.004:0);
  nt.growth=lerp(nt.growth,g,.08);nt.gdp*=1+nt.growth/365;nt.disasterPenalty*=.97;
  nt.unemployment=clamp(lerp(nt.unemployment,.075-nt.growth*.9+sanc*.01,.05),.02,.35);
  const alive=nationAgents(nt.id);const infR=nt.stats.infected/Math.max(1,alive);
  nt.stats.crimeDays.unshift(0);if(nt.stats.crimeDays.length>8)nt.stats.crimeDays.pop();const crime7=nt.stats.crimeDays.slice(1).reduce((a,b)=>a+b,0);
  const hap=52+(nt.lvl.health-.6)*28+(nt.lvl.welfare-.5)*22+(nt.lvl.education-.6)*10+(nt.lvl.police-.6)*12-(nt.tax-.25)*110-nt.unemployment*110+nt.growth*350-W_*14-infR*160-crime7*.3-(nt.curfew?6:0)-(nt.quarantine?4:0)+nt.rally-(nt.weather==='fırtına'?2:0);
  nt.happiness=lerp(nt.happiness,clamp(hap,0,100),.15);nt.approval=lerp(nt.approval,clamp(nt.happiness+(nt.pres.traits.charisma-.5)*16,0,100),.09);
  nt.mil=clamp(nt.mil+(nt.lvl.military-.5)*.7+(nt.mobilized?.2:0),3,100);nt.rally*=.9;nt.epiBoost*=.94;nt.crimeWave=(nt.crimeWave||0)*.9;
  nt.popF*=1+(.004+(nt.happiness-50)*.0001)/365;
  if(R()<alive*.0009*(nt.happiness/55)&&nt.res.length&&alive<MAX_AGENTS_PER_NATION){const h=pick(nt.res);const sch=buildings.filter(b=>b.c===nt.id&&b.type==='school');makeAgent(nt.id,'student',h.id,sch.length?pick(sch).id:h.id);nt.stats.births++}
  for(const a of agents)if(a.alive&&a.c===nt.id&&a.role==='retiree'&&R()<.0004)kill(a,'yaşlılık');
  if(nt.approval<24)nt.lowDays++;else nt.lowDays=Math.max(0,nt.lowDays-1);if(nt.lowDays>25)replacePresident(nt,'güvensizlik oyuyla');
}
function replacePresident(nt,how){const old=nt.pres;const ideo=pick(IDEO_KEYS.filter(k=>k!==old.ideo));nt.pres=makePresident(pick(PRES_POOL),ideo);nt.lowDays=0;nt.approval=55;nt.rally=8;nt.budget={...IDEO[ideo].pref};
  nt.pres.memory.push(`Göreve ${how} geldim; selefim ${old.name} halkın desteğini kaybetmişti.`);news(nt.id,`${nt.name}: ${old.name} ${how} görevden ayrıldı. Yeni devlet başkanı ${nt.pres.name} (${ideo}).`,'big')}
function relationsDay(){
  for(let a=0;a<10;a++)for(let b=a+1;b<10;b++){const A=nations[a],B=nations[b];let d=0;
    d+=A.pres.ideo===B.pres.ideo?.12:-.02;if(A.trade.has(b))d+=.1;if(A.ally.has(b))d+=.12;if(atWar(a,b))d-=.25;if(A.sanction.has(b)||B.sanction.has(a))d-=.12;
    if(isNeighbor(a,b)){d-=(A.pres.traits.aggr+B.pres.traits.aggr)*.08;if(A.landlocked||B.landlocked)d-=.15}
    d-=A.rel[b]*.003;addRel(a,b,d+rnd(-.4,.4));
    if(isNeighbor(a,b)&&R()<.003*(1+A.pres.traits.aggr+B.pres.traits.aggr)){addRel(a,b,-ri(6,14));news(a,`${A.name}–${B.name} sınırında ihlal iddiası; diplomatik nota verildi.`,'hi')}}
}

// ---------- Savaş ve ilhak ----------
function frontTile(a,b){
  const bt=[];for(let i=0;i<N;i++){if(owner[i]!==a)continue;const x=tx(i),y=ty(i);for(const[dx,dy]of D4)if(inb(x+dx,y+dy)&&owner[idx(x+dx,y+dy)]===b){bt.push(i);break}}
  const B=capOf(b),A=capOf(a);if(!bt.length)bt.push(idx(Math.round((A.x+B.x)/2),Math.round((A.y+B.y)/2)));
  const cx=bt.reduce((s,i)=>s+tx(i),0)/bt.length,cy=bt.reduce((s,i)=>s+ty(i),0)/bt.length;
  const nt=nations[a];const bar=nt.base?buildings[bldAt[idx(nt.base.x,nt.base.y)]]:null;const comp=bar&&bar.ent>=0?roadComp[bar.ent]:-1;
  let best=-1,bd=1e9;for(let i=0;i<N;i++){if(!isRoad(terr[i])||owner[i]!==a)continue;if(comp>=0&&roadComp[i]!==comp)continue;const d=Math.hypot(tx(i)-cx,ty(i)-cy);if(d<bd){bd=d;best=i}}
  return{tile:best,cx,cy,border:bt.length>1};
}
function mobilizeSoldier(a,target){const nt=nations[a.c];let f=target;
  if(f===undefined){const enemies=nations.filter(o=>o.id!==a.c&&isNeighbor(a.c,o.id)).sort((p,q)=>nt.rel[p.id]-nt.rel[q.id]);if(!enemies.length){a.next=now+600;return}f=enemies[0].id}
  nt.fronts=nt.fronts||{};if(!nt.fronts[f])nt.fronts[f]=frontTile(a.c,f);const ft=nt.fronts[f];if(ft.tile<0){a.next=now+600;return}a.aimTo=[ft.cx,ft.cy];
  a.veh='army';a.frontOf=f;goTo(a,ft.tile,'front')}
function declareWar(a,b,reason){
  if(atWar(a,b)||a===b)return false;const A=nations[a],B=nations[b];
  wars.push({a,b,start:now,cas:[0,0],front:null,score:0});setRel(a,b,Math.min(A.rel[b],-80));A.trade.delete(b);B.trade.delete(a);A.ally.delete(b);B.ally.delete(a);A.rally+=10;B.rally+=14;
  A.fronts={};B.fronts={};
  news(a,`SAVAŞ: ${A.name}, ${B.name}’ya savaş ilan etti. Gerekçe: ${reason||'ulusal güvenlik'}.`,'big');news(a,`${A.name} ${stratOf(A)} stratejisiyle (teknoloji ${Math.round(techOf(A)*100)}), ${B.name} ${stratOf(B)} stratejisiyle (teknoloji ${Math.round(techOf(B)*100)}) cepheye çıkıyor.`,'hi');deferred.push(()=>{launchNavy(A,B);launchNavy(B,A);const W_=wars[wars.length-1];if(W_){if(!W_.front){const f=frontTile(a,b);W_.front={x:f.cx,y:f.cy}}launchJet(A,B,W_);launchJet(B,A,W_);launchCap(A,W_);launchCap(B,W_);launchCap(A,W_);launchCap(B,W_);launchHeli(A,W_);launchHeli(B,W_)}news(b,B.name+' karşı saldırıya geçti; hava kuvvetleri ve donanma harekete geçti.','hi')});
  for(const s of(A.roles.soldier||[]))if(s.alive){s.busy=false;mobilizeSoldier(s,b)}for(const s of(B.roles.soldier||[]))if(s.alive){s.busy=false;mobilizeSoldier(s,a)}
  for(const o of nations)if(o.ally.has(b)&&o.id!==a&&!atWar(o.id,a)&&R()<.35+o.pres.traits.aggr*.5)deferred.push(()=>declareWar(o.id,a,`müttefiki ${B.name}’yı savunmak`));
  return true;
}
function annex(winner,loser,w){ // cephe çevresindeki toprakları kazanana devret
  if(!w.front)return 0;const W_=nations[winner];let n=0;const capL=capOf(loser);const moved=new Set();
  for(let i=0;i<N;i++){if(owner[i]!==loser)continue;const x=tx(i),y=ty(i);const d=Math.hypot(x-w.front.x,y-w.front.y);if(d>13)continue;if(Math.hypot(x-capL.x,y-capL.y)<capL.R+3)continue;
    owner[i]=winner;n++;markDirty(x,y);if(bldAt[i]>=0){const b=buildings[bldAt[i]];b.c=winner;moved.add(b.id)}}
  for(const ct of cities)if(ct.c===loser&&!ct.capital&&owner[idx(ct.x,ct.y)]===winner){ct.c=winner;news(winner,`${ct.name} artık ${W_.name} yönetiminde.`,'big',idx(ct.x,ct.y))}
  for(const a of agents)if(a.alive&&moved.has(a.home)){a.c=winner;if(a.role==='soldier'){kill(a,'esir')}}
  rebuildRoles();for(const nt of[nations[winner],nations[loser]]){nt.res=buildings.filter(b=>b.c===nt.id&&BT[b.type].cat==='res'&&b.ent>=0);nt.leisure=buildings.filter(b=>b.c===nt.id&&BT[b.type].leisure&&b.ent>=0)}
  miniDirty=true;return n;
}
function endWar(w,how,winner){wars=wars.filter(x=>x!==w);const A=nations[w.a],B=nations[w.b];setRel(w.a,w.b,-35);
  for(const n of[A,B])for(const s of(n.roles.soldier||[]))if(s.alive&&(s.state==='FRONT'||s.purpose==='front')){s.veh='army';goB(s,s.work,'return')}
  let txt=`${A.name} ile ${B.name} arasındaki savaş sona erdi (${how}). Kayıplar: ${w.cas[0]} / ${w.cas[1]} asker.`;
  if(winner!==undefined){const loser=winner===w.a?w.b:w.a;const n=annex(winner,loser,w);if(n)txt+=` ${nations[winner].name} ${n} karo toprak ilhak etti.`}
  news(w.a,txt,'big')}
function techOf(nt){return clamp(.35+nt.lvl.education*.35+Math.min(.3,nt.gdp/Math.max(1,popOf(nt))/250),.2,1.2)}
function stratOf(nt){const t=nt.pres.traits;return t.aggr>.6?'saldırı':t.caution>.62?'savunma':'kuşatma'}
function powerOf(nt,defending){const st=stratOf(nt);const m=st==='saldırı'?(defending?.9:1.25):st==='savunma'?(defending?1.35:.85):1.05;return Math.max(1,nt.mil)*(.6+techOf(nt)*.6)*m}
function warTick(dm){
  for(const w of wars){const A=nations[w.a],B=nations[w.b];if(!w.front){const fa=frontTile(w.a,w.b);w.front={x:fa.cx,y:fa.cy}}
    if(R()<.08*dm)boom(w.front.x+rnd(-3,3),w.front.y+rnd(-3,3),'shell');
    if(R()<.03*dm){const att=R()<A.mil/(A.mil+B.mil)?A:B;launchJet(att,att===A?B:A,w)}if(R()<.02*dm){const h=R()<.5?A:B;launchHeli(h,w)}if(R()<.012*dm){const s=R()<.5?A:B;if(planes.filter(p=>p.kind==='cap'&&p.from===s.id).length<3)launchCap(s,w)}if(R()<.0006*dm){launchNavy(A,B);launchNavy(B,A)}
    for(const[s_,mine,enemy,k]of[[A.roles.soldier,A,B,0],[B.roles.soldier,B,A,1]])for(const s of(s_||[])){if(!s.alive||s.state!=='FRONT')continue;
      const pe=powerOf(enemy,enemy.id===w.b),pm=powerOf(mine,mine.id===w.b);if(R()<.00012*dm*(pe/(pm+5))*2){kill(s,'çatışma');w.cas[k]++;mine.mil=Math.max(3,mine.mil-.8)}}}
}
function warDay(){
  for(const w of[...wars]){warAdvance(w);if(!wars.includes(w))continue;const A=nations[w.a],B=nations[w.b];A.weariness+=.03;B.weariness+=.03;
    const pA=powerOf(A,false),pB=powerOf(B,true);A.mil=Math.max(3,A.mil-pB*.0035*rnd(.5,1.5));B.mil=Math.max(3,B.mil-pA*.0035*rnd(.5,1.5));w.score+=(A.mil-B.mil)/50;
    const la=(A.roles.soldier||[]).filter(s=>s.alive).length,lb=(B.roles.soldier||[]).filter(s=>s.alive).length;
    if(A.mil<6||la===0){B.treasury+=Math.max(2,A.treasury*.3);A.treasury-=Math.abs(A.treasury)*.3+2;A.approval-=15;endWar(w,`${A.name} teslim oldu`,w.b)}
    else if(B.mil<6||lb===0){A.treasury+=Math.max(2,B.treasury*.3);B.treasury-=Math.abs(B.treasury)*.3+2;B.approval-=15;endWar(w,`${B.name} teslim oldu`,w.a)}}
  for(const w of wars)for(const[n,e]of[[nations[w.a],w.b],[nations[w.b],w.a]]){const sol=(n.roles.soldier||[]).filter(s=>s.alive).length;const bar=buildings.find(b=>b.c===n.id&&b.type==='barracks'&&b.ent>=0);
    if(bar&&sol<14){const k=ri(1,3);for(let j=0;j<k;j++){const s=makeAgent(n.id,'soldier',bar.id,bar.id);if(s){s.next=now+30;mobilizeSoldier(s,e)}}n.approval-=.6;if(R()<.3)news(n.id,`${n.name}: ${k} yeni asker cepheye sevk edildi.`,'info')}}
  for(const n of nations)if(!warsOf(n.id).length)n.weariness*=.9;
}

// ---------- Hava ve deniz ulaşımı ----------
let planes=[],ships=[],particles=[],shake=0;
const gwx=(gx,gy)=>(gx-gy)*HW, gwy=(gx,gy)=>(gx+gy)*HH;
function scheduleFlights(){const day=dayIdx()*1440;
  for(let a=0;a<10;a++)for(let b=0;b<10;b++){if(a===b)continue;const A=nations[a],B=nations[b];if(!A.airport||!B.airport)continue;
    if(A.rel[b]<-25||atWar(a,b)||A.quarantine||B.quarantine)continue;const n=(A.trade.has(b)?1:0)+(A.rel[b]>40?1:0)+(R()<.6?1:0);
    for(let k=0;k<n;k++)(A.flights||(A.flights=[])).push({t:day+rnd(300,1380),to:b})}}
function flightsTick(){dogfights();navalBattles();
  for(const A of nations){if(!A.flights)continue;const due=A.flights.filter(f=>f.t<=now);if(!due.length)continue;A.flights=A.flights.filter(f=>f.t>now);
    for(const f of due){const B=nations[f.to];if(A.weather==='fırtına'||B.weather==='fırtına'||atWar(A.id,B.id)||A.quarantine||B.quarantine)continue;
      const a=A.airport,b=B.airport;const x0=gwx(a.rx0+.5,a.ry+.5),y0=gwy(a.rx0+.5,a.ry+.5),xr=gwx(a.rx1+.5,a.ry+.5),yr=gwy(a.rx1+.5,a.ry+.5),x1=gwx(b.rx0+.5,b.ry+.5),y1=gwy(b.rx0+.5,b.ry+.5),x1r=gwx(b.rx1+.5,b.ry+.5),y1r=gwy(b.rx1+.5,b.ry+.5);
      const d=Math.hypot(x1-xr,y1-yr);planes.push({kind:'liner',from:A.id,to:B.id,pts:[[x0,y0],[xr,yr],[x1,y1],[x1r,y1r]],t0:now,dur:Math.max(50,d/22)+16,col:A.color})}}
  for(const p of planes){if(now>=p.t0+p.dur){p.done=true;
    if(p.kind==='liner'){const A=nations[p.from],B=nations[p.to];B.gdp+=.002;const ar=A.stats.infected/Math.max(1,nationAgents(A.id));
      if(R()<ar*3){const c=aliveOf(B.id).filter(x=>x.hs===0);if(c.length){infect(pick(c));if(R()<.5)news(B.id,`${B.name}: ${A.name} uçuşuyla gelen bir yolcuda virüs tespit edildi.`,'hi')}}}
    else if(p.kind==='strike')strikeHit(p)}}
  planes=planes.filter(p=>!p.done);
}
// Uçak konumu: kalkış koşusu → tırmanış → seyir → alçalma → iniş koşusu
function planePos(p){if(p.kind==='cap'){const a=p.a0+(now-p.t0)/p.dur*Math.PI*6;const dx=-Math.sin(a)*p.r*1.6,dy=Math.cos(a)*p.r*.8;return{x:p.cx+Math.cos(a)*p.r*1.6,y:p.cy+Math.sin(a)*p.r*.8,alt:60,ang:Math.atan2(dy,dx)}}const k=clamp((now-p.t0)/p.dur,0,1);
  if(p.kind==='strike'||p.kind==='heli'){const[x0,y0]=p.pts[0],[x1,y1]=p.pts[1];const kk=p.kind==='heli'?(k<.5?k*2:2-k*2):k;const back=p.kind==='heli'&&k>=.5;return{x:lerp(x0,x1,kk),y:lerp(y0,y1,kk),alt:Math.min(1,Math.sin(k*Math.PI)*3)*(p.kind==='heli'?28:45),ang:back?Math.atan2(y0-y1,x0-x1):Math.atan2(y1-y0,x1-x0)}}
  const[A,B,C,D]=p.pts;const roll=8/p.dur;
  if(k<roll){const u=(k/roll);const e=u*u;return{x:lerp(A[0],B[0],e),y:lerp(A[1],B[1],e),alt:0,ang:Math.atan2(B[1]-A[1],B[0]-A[0])}}
  if(k>1-roll){const u=(k-(1-roll))/roll;const e=1-(1-u)*(1-u);return{x:lerp(C[0],D[0],e),y:lerp(C[1],D[1],e),alt:0,ang:Math.atan2(D[1]-C[1],D[0]-C[0])}}
  const u=(k-roll)/(1-2*roll);const alt=Math.min(1,u*5,(1-u)*5)*80;return{x:lerp(B[0],C[0],u),y:lerp(B[1],C[1],u),alt,ang:Math.atan2(C[1]-B[1],C[0]-B[0])}}
function launchHeli(nt,w){if(!nt.base||!w.front)return;const x0=gwx(nt.base.x+.5,nt.base.y+.5),y0=gwy(nt.base.x+.5,nt.base.y+.5);const fx=w.front.x+rnd(-4,4),fy=w.front.y+rnd(-4,4);const x1=gwx(fx,fy),y1=gwy(fx,fy);
  planes.push({kind:'heli',from:nt.id,pts:[[x0,y0],[x1,y1]],t0:now,dur:Math.max(20,Math.hypot(x1-x0,y1-y0)/25),col:'#4B5A2A'})}
function launchNavy(nt,enemy){if(!nt.port||ships.filter(x=>x.kind==='navy'&&x.c===nt.id).length>=(nt.mil>60?3:2))return;const cap=capOf(enemy.id);const t=randomSeaTile(cap.x,cap.y,22,2);if(t<0)return;
  const cls=nt.mil>40&&!ships.some(x=>x.cls==='carrier'&&x.c===nt.id)?'carrier':R()<.25?'sub':R()<.45?'cruiser':'destroyer';
  spawnShip('navy',shipRoute(nt.port.berth,t),nt.id,enemy.id,{cls,spd:cls==='sub'?.5:.7,enemy:enemy.id});news(nt.id,`${nt.name} donanması harekete geçti: ${cls==='carrier'?'uçak gemisi':cls==='sub'?'denizaltı':cls==='cruiser'?'kruvazör':'muhrip'} ${enemy.name} kıyılarına ilerliyor.`,'hi')}
function launchCap(nt,w){if(!nt.base||!w.front)return;const fx=gwx(w.front.x,w.front.y),fy=gwy(w.front.x,w.front.y),bx=gwx(nt.base.x,nt.base.y),by=gwy(nt.base.x,nt.base.y);
  planes.push({kind:'cap',from:nt.id,cx:lerp(fx,bx,.18),cy:lerp(fy,by,.18),r:rnd(60,110),a0:rnd(0,6.28),t0:now,dur:rnd(60,130),col:'#8E979E'})}
function launchJet(att,def,w){if(!att.base)return;
  const tgt=[];for(let k=0;k<200;k++){const b=buildings[ri(0,buildings.length-1)];if(b.c===def.id&&b.type!=='rubble'&&b.type!=='construction'&&Math.hypot(b.x-w.front.x,b.y-w.front.y)<16)tgt.push(b)}
  if(!tgt.length)return;const t=pick(tgt);const x0=gwx(att.base.x+.5,att.base.y+.5),y0=gwy(att.base.x+.5,att.base.y+.5),x1=gwx(t.x+.5,t.y+.5),y1=gwy(t.x+.5,t.y+.5);
  planes.push({kind:'strike',from:att.id,to:def.id,pts:[[x0,y0],[x1,y1]],t0:now,dur:Math.max(25,Math.hypot(x1-x0,y1-y0)/28),col:'#8E979E',tb:t.id});if(R()<.6)scramble(def,att,(x0+x1)/2,(y0+y1)/2)}
function strikeHit(p){const b=buildings[p.tb];if(!b)return;boom(b.x+.5,b.y+.5,'big');const def=nations[p.to];
  if(R()<.25+nations[p.from].mil/300-def.mil/400){if(R()<.5)destroy(b,'hava saldırısı');else ignite(b,'hava saldırısı')}else if(R()<.3)news(def.id,`${def.name} hava savunması bir saldırıyı önledi.`,'info')}
// Gemiler: ızgara yolunu görüş hattıyla düzleştirilmiş rota noktalarına çevir
function smoothSea(p){if(!p||p.length<3)return p&&p.map(i=>[tx(i)+.5,ty(i)+.5]);const out=[p[0]];let a=0;
  const los=(i,j)=>{const x0=tx(i)+.5,y0=ty(i)+.5,x1=tx(j)+.5,y1=ty(j)+.5;const n=Math.ceil(Math.hypot(x1-x0,y1-y0)*2);for(let k=1;k<n;k++){const x=Math.floor(lerp(x0,x1,k/n)),y=Math.floor(lerp(y0,y1,k/n));if(!seaPass(idx(x,y)))return false}return true};
  while(a<p.length-1){let b=Math.min(p.length-1,a+40);while(b>a+1&&!los(p[a],p[b]))b--;out.push(p[b]);a=b}
  return out.map(i=>[tx(i)+.5,ty(i)+.5])}
const shipPaths=new Map();
function shipRoute(a,b){const k=a*N+b;if(!shipPaths.has(k))shipPaths.set(k,smoothSea(findPath(a,b,seaPass)));return shipPaths.get(k)}
function spawnShip(kind,route,c,to,extra){if(!route||route.length<2)return;ships.push({kind,route,seg:0,u:0,gx:route[0][0],gy:route[0][1],hdg:0,c,to,spd:kind==='fishing'?.35:kind==='ferry'?.55:.45,cargo:pick(['#C0392B','#2E86C1','#E67E22','#27AE60','#8E44AD','#D4AC0D']),wake:[],...extra})}
function randomSeaTile(nearX,nearY,r,minD=3){for(let k=0;k<200;k++){const x=clamp(nearX+ri(-r,r),1,W-2),y=clamp(nearY+ri(-r,r),1,H-2);const i=idx(x,y);if(seaPass(i)&&wdist[i]>=minD)return i}return -1}
function edgeSeaTile(){for(let k=0;k<200;k++){const s=ri(0,3);const t=ri(2,W-3);const x=s===0?2:s===1?W-3:t,y=s===2?2:s===3?H-3:(s<2?t:t);const i=idx(x,y);if(seaPass(i))return i}return -1}
function scheduleShips(){
  // ticaret gemileri: liman çiftleri
  for(const A of ports)for(const B of ports){if(A===B)continue;const a=nations[A.c],b=nations[B.c];if(atWar(a.id,b.id)||(A.c!==B.c&&a.rel[b.id]<-15)||a.sanction.has(b.id))continue;
    if(a.weather==='fırtına'||b.weather==='fırtına')continue;if(R()>(a.trade.has(b.id)?.7:A.c===B.c?.6:.3))continue;
    spawnShip(A.c===B.c?'ferry':'cargo',shipRoute(A.berth,B.berth),A.c,B.c,{depart:now+rnd(0,1200)})}
  // dünya ticareti: harita dışından gelen ve giden gemiler
  for(const P of ports){if(nations[P.c].weather==='fırtına'||R()>.5)continue;const e=edgeSeaTile();if(e<0)continue;const inb_=R()<.5;
    spawnShip(R()<.3?'tanker':'cargo',inb_?shipRoute(e,P.berth):shipRoute(P.berth,e),P.c,P.c,{depart:now+rnd(0,1300),intl:true})}
}
function ensureFishing(){for(const P of ports){const have=ships.filter(s=>s.kind==='fishing'&&s.home===P).length;for(let k=have;k<3;k++){const t=randomSeaTile(tx(P.berth),ty(P.berth),10,2);if(t<0)continue;spawnShip('fishing',shipRoute(P.berth,t),P.c,P.c,{home:P,depart:now+rnd(0,300)})}}}
function shipsTick(dm){
  for(const s of ships){if(s.depart&&now<s.depart){s.hidden=true;continue}s.hidden=false;const nt=nations[s.c];if(nt&&nt.weather==='fırtına'&&s.kind==='fishing')continue;
    let d=s.spd*dm;
    while(d>0&&s.seg<s.route.length-1){const[a0,b0]=s.route[s.seg],[a1,b1]=s.route[s.seg+1];const L=Math.hypot(a1-a0,b1-b0)||.001;const rem=(1-s.u)*L;
      if(d>=rem){d-=rem;s.seg++;s.u=0}else{s.u+=d/L;d=0}}
    if(s.seg>=s.route.length-1){
      if(s.kind==='fishing'){const back=s.route[0];const home=s.home;const t=randomSeaTile(tx(home.berth),ty(home.berth),12,2);if(t>=0){const cur=idx(Math.floor(s.gx),Math.floor(s.gy));s.route=shipRoute(cur,R()<.4?home.berth:t)||[[s.gx,s.gy],[s.gx,s.gy]];s.seg=0;s.u=0;continue}}
      if(s.kind==='navy'){const W_=wars.find(w=>(w.a===s.c&&w.b===s.enemy)||(w.b===s.c&&w.a===s.enemy));if(W_){const tg=buildings.filter(b=>b.c===s.enemy&&b.type!=='rubble'&&Math.hypot(b.x-s.gx,b.y-s.gy)<9);for(let k=0;k<3&&tg.length;k++){const b=pick(tg);boom(b.x+.5,b.y+.5,'big');if(R()<.25+nations[s.c].mil/300-nations[s.enemy].mil/400)(R()<.5?destroy(b,'deniz bombardımanı'):ignite(b,'deniz bombardımanı'))}if(s.cls==='carrier')launchJet(nations[s.c],nations[s.enemy],W_);const nt2=nations[s.c];if(nt2.port){const back=shipRoute(idx(Math.floor(s.gx),Math.floor(s.gy)),nt2.port.berth);if(back&&back.length>1&&R()<.6){s.route=back;s.seg=0;s.u=0;continue}}}}
      s.done=true;if(!s.intl&&s.to!==undefined){nations[s.to].gdp+=.003;nations[s.c].gdp+=.003}continue}
    const[a0,b0]=s.route[s.seg],[a1,b1]=s.route[s.seg+1];const ngx=lerp(a0,a1,s.u),ngy=lerp(b0,b1,s.u);
    const th=Math.atan2(gwy(a1,b1)-gwy(a0,b0),gwx(a1,b1)-gwx(a0,b0));s.hdg=s.hdg+Math.atan2(Math.sin(th-s.hdg),Math.cos(th-s.hdg))*Math.min(1,dm*.6);
    if(frameCountForWake++%3===0){s.wake.unshift([gwx(s.gx,s.gy),gwy(s.gx,s.gy)]);if(s.wake.length>14)s.wake.pop()}
    s.gx=ngx;s.gy=ngy}
  ships=ships.filter(s=>!s.done);
}
let frameCountForWake=0;
function boomOld(x,y,kind){const wx=gwx(x,y),wy=gwy(x,y);const n=kind==='big'?22:kind==='dust'?6:10;
  for(let k=0;k<n;k++)particles.push({x:wx+rnd(-6,6),y:wy+rnd(-6,4),vx:rnd(-1,1)*(kind==='big'?1.4:.8),vy:rnd(-1.6,-.2),life:1,dec:rnd(.012,.03),kind:kind==='dust'?'dust':(k<n/2?'flash':'smoke'),s:rnd(2,kind==='big'?7:4)})}

// ---------- hareketli cephe ----------
function warAdvance(w){const A=nations[w.a],B=nations[w.b];if(!w.front)return;w.occ=w.occ||new Map();w.days=(w.days||0)+1;
  const pa=powerOf(A,false)*rnd(.75,1.25),pb=powerOf(B,true)*rnd(.75,1.25);const att=pa>=pb?A:B,def=att===A?B:A;const ratio=Math.max(pa,pb)/Math.max(1,Math.min(pa,pb));
  const step=clamp((ratio-1)*3.2,0,3.2);
  if(step>=.3){const tc=capOf(def.id);const dx=tc.x-w.front.x,dy=tc.y-w.front.y,l=Math.hypot(dx,dy)||1;w.front.x+=dx/l*step;w.front.y+=dy/l*step;
    let took=0,back=0;const r=4;
    for(let yy=-r;yy<=r;yy++)for(let xx=-r;xx<=r;xx++){if(xx*xx+yy*yy>r*r)continue;const x=Math.round(w.front.x)+xx,y=Math.round(w.front.y)+yy;if(!inb(x,y))continue;const i=idx(x,y);
      if(owner[i]!==def.id||isWater(terr[i])||Math.hypot(x-tc.x,y-tc.y)<2)continue;
      if(w.occ.get(i)===att.id){w.occ.delete(i);back++}else{if(!w.occ.has(i))w.occ.set(i,def.id);took++}
      owner[i]=att.id;markDirty(x,y);if(bldAt[i]>=0)buildings[bldAt[i]].c=att.id}
    if(took||back){news(att.id,att.name+' ilerliyor; '+def.name+' birlikleri geri çekildi'+(took?', '+took+' karo işgal edildi':'')+(back?', '+back+' karo geri alındı':'')+'.','hi',idx(Math.round(w.front.x),Math.round(w.front.y)));
      for(const ct of cities)if(ct.c===def.id&&!ct.capital&&owner[idx(ct.x,ct.y)]===att.id){ct.c=att.id;news(att.id,ct.name+' düştü; şehir artık '+att.name+' kontrolünde.','big',idx(ct.x,ct.y))}
      for(const n of[A,B]){n.fronts={};for(const so of(n.roles.soldier||[]))if(so.alive&&(so.state==='FRONT'||so.purpose==='front')){so.busy=false;mobilizeSoldier(so,n===A?B.id:A.id)}}
      rebuildRoles();for(const n of[A,B]){n.res=buildings.filter(b=>b.c===n.id&&BT[b.type].cat==='res'&&b.ent>=0);n.leisure=buildings.filter(b=>b.c===n.id&&BT[b.type].leisure&&b.ent>=0)}miniDirty=true}
    // bitiş senaryoları
    if(Math.hypot(w.front.x-tc.x,w.front.y-tc.y)<5){endWar(w,def.name+' başkenti kuşatıldı ve '+def.name+' teslim oldu',att.id);return}
    const lost=[...w.occ.values()].filter(o=>o===def.id).length;if(lost>territoryOf(def.id)*.8){endWar(w,def.name+' topraklarının büyük kısmını kaybetti ve teslim oldu',att.id);return}}
  else if(R()<.35)news(w.a,A.name+'–'+B.name+' cephesinde siper savaşı; hat değişmedi.','info');
  if(w.days>=20){endWar(w,'20 gün süren savaş uluslararası baskıyla ateşkesle bitti; cephe hattı yeni sınır oldu');return}
  if(w.days>12&&ratio<1.2&&R()<.35){endWar(w,'cephe kilitlendi ve ateşkes imzalandı; mevcut hat yeni sınır oldu');return}
  if(A.weariness+B.weariness>2.2&&R()<.3){endWar(w,'savaş yorgunluğuyla barış masasına oturuldu; işgal edilen bölgeler işgalcide kaldı')}}

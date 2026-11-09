// ============================================================
// Dünya üretimi: kıtalar, geniş aralıklı ülkeler, karayolları, şehirler
// ============================================================
const PROTECT=new Set(['hospital','police','fire','school','university','parliament','stadium','power','barracks','hangar','depot','terminal','atc','portwh','crane']);
const freeLand=t=>t===T.GRASS||t===T.FOREST||t===T.SAND||t===T.FARM;
function capOf(c){return cities.find(x=>x.c===c&&x.capital)}

function genWorld(progress){
  R=mulberry32(SEED);
  terr.fill(0);owner.fill(-1);bldAt.fill(-1);cityAt.fill(-1);flood.fill(0);forestFire.fill(0);decor.fill(0);treeKind.fill(0);
  buildings=[];cities=[];agents=[];airports=[];ports=[];bases=[];
  const n1=makeNoise(SEED+11),n2=makeNoise(SEED+23),n3=makeNoise(SEED+37),n4=makeNoise(SEED+41);
  // 1) kara/deniz
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const dc=Math.hypot((x-W/2)/(W/2),(y-H/2)/(H/2));
    let land=(n1(x*.011,y*.011,5)-.5)*1.7+.6-dc*.95;
    const isl=n4(x*.035,y*.035,3);if(dc>.42&&isl>.6)land=Math.max(land,(isl-.6)*2.6);
    const i=idx(x,y);elev[i]=land;
    const ridge=1-Math.abs(n2(x*.022,y*.022,4)*2-1),f=n3(x*.05,y*.05);
    if(land<.02)terr[i]=land<-.16?T.DEEP:T.WATER;
    else if(land<.06)terr[i]=T.SAND;
    else if(ridge>.9&&land>.22)terr[i]=T.MOUNT;
    else if(f>.6||ridge>.84)terr[i]=T.FOREST;
    else terr[i]=T.GRASS;
  }
  // okyanus: harita kenarından ulaşılabilen su
  oceanFill();
  progress(.12,'Nehirler akıyor…');
  for(let r=0;r<9;r++){
    const cand=[];for(let i=0;i<N;i+=7)if(terr[i]===T.MOUNT)cand.push(i);if(!cand.length)break;
    let cur=pick(cand),px=tx(cur),py=ty(cur),steps=0;
    while(steps++<160){let best=null,be=1e9;
      for(const[dx,dy]of D4){const nx=px+dx,ny=py+dy;if(!inb(nx,ny))continue;const e=elev[idx(nx,ny)]+rnd(-.04,.04);if(e<be){be=e;best=[nx,ny]}}
      if(!best)break;px=best[0];py=best[1];const i=idx(px,py);if(isWater(terr[i])&&steps>3)break;terr[i]=T.WATER;}
  }
  oceanFill();computeWaterDist();
  progress(.22,'Başkentler seçiliyor…');
  // 2) başkentler: geniş aralıklı, kıyıya yakın, düz arazi
  const seaD=distToSea();
  const caps=[];let minSep=62;
  for(let tries=0;caps.length<10&&tries<40000;tries++){
    if(tries%4000===3999)minSep-=4;
    const x=ri(18,W-19),y=ri(18,H-19),i=idx(x,y);
    if(terr[i]!==T.GRASS&&terr[i]!==T.FOREST)continue;if(seaD[i]>16||seaD[i]<4)continue;
    let flat=0;for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const t=terr[idx(x+dx,y+dy)];if(t===T.GRASS||t===T.FOREST||t===T.FARM)flat++}if(flat<95)continue;
    if(caps.every(c=>Math.hypot(c.x-x,c.y-y)>=minSep))caps.push({x,y});
  }
  progress(.3,'Ülkeler kuruluyor…');
  nations=NATIONS.map((n,k)=>makeNation(n,k,caps[k]||{x:W/2,y:H/2}));
  // başlangıç toprakları (sırayla genişleyerek, adil paylaşım)
  for(let ring=1;ring<=23;ring++)for(const nt of nations)claimRing(nt,nt.seed.x,nt.seed.y,ring);
  // 3) şehirler
  for(const nt of nations){
    const s=nt.seed;newCity(nt.id,s.x,s.y,10,true,nt.def.cities[0]);
    let site=findTownSite(nt,13,19);if(!site)site=findTownSite(nt,9,24,true);if(site){claimDisk(nt,site.x,site.y,9);newCity(nt.id,site.x,site.y,6,false,nt.def.cities[1])}
  }
  for(const ct of cities)layoutRing(ct,-1,ct.R,false);
  for(const ct of cities)placeServices(ct,true);
  progress(.45,'Otoyollar ve köprüler…');
  for(const ct of cities)if(!ct.capital){const cap=capOf(ct.c);roadAStar(ct.x,ct.y,cap.x,cap.y)}
  // başkentleri en yakın 2-3 başkente bağla (kıtalararası değilse)
  const links=new Set();
  for(const a of nations){const ca=capOf(a.id);const near=nations.filter(b=>b!==a).map(b=>({b,d:Math.hypot(capOf(b.id).x-ca.x,capOf(b.id).y-ca.y)})).sort((p,q)=>p.d-q.d).slice(0,3);
    for(const{b,d}of near){const k=Math.min(a.id,b.id)+'-'+Math.max(a.id,b.id);if(links.has(k)||d>120)continue;links.add(k);const cb=capOf(b.id);roadAStar(ca.x,ca.y,cb.x,cb.y,true)}}
  progress(.56,'Havalimanları, limanlar ve üsler…');
  for(const nt of nations){placeAirport(nt);placeBase(nt);placePort(nt)}
  for(const ct of cities)placeFarms(ct);
  plantTrees();buildStraitBridges();
  progress(.7,'Bağlantılar hesaplanıyor…');
  computeEntrances();computeRoadComp();
}
function oceanFill(){
  seaMask.fill(0);const q=[];for(let x=0;x<W;x++){q.push(idx(x,0),idx(x,H-1))}for(let y=0;y<H;y++){q.push(idx(0,y),idx(W-1,y))}
  for(const i of q)if(isWater(terr[i]))seaMask[i]=1;
  for(let h=0;h<q.length;h++){const i=q[h];if(!seaMask[i])continue;const x=tx(i),y=ty(i);for(const[dx,dy]of D4){const nx=x+dx,ny=y+dy;if(!inb(nx,ny))continue;const j=idx(nx,ny);if(!seaMask[j]&&isWater(terr[j])&&terr[j]!==T.LAKE&&elev[j]<.05){seaMask[j]=1;q.push(j)}}}
  for(let i=0;i<N;i++)if(isWater(terr[i])&&!seaMask[i]&&elev[i]<0&&terr[i]!==T.LAKE)terr[i]=T.LAKE;
}
function computeWaterDist(){ // su karolarının kıyıya uzaklığı (renk geçişi için)
  wdist.fill(0);const q=[];for(let i=0;i<N;i++){if(!isWater(terr[i]))continue;const x=tx(i),y=ty(i);let shore=false;for(const[dx,dy]of D8){const nx=x+dx,ny=y+dy;if(inb(nx,ny)&&!isWater(terr[idx(nx,ny)])){shore=true;break}}if(shore){wdist[i]=1;q.push(i)}}
  for(let h=0;h<q.length;h++){const i=q[h],x=tx(i),y=ty(i);for(const[dx,dy]of D4){const nx=x+dx,ny=y+dy;if(!inb(nx,ny))continue;const j=idx(nx,ny);if(isWater(terr[j])&&!wdist[j]){wdist[j]=Math.min(12,wdist[i]+1);q.push(j)}}}
}
function distToSea(){const d=new Uint16Array(N).fill(999);const q=[];for(let i=0;i<N;i++)if(seaMask[i]){d[i]=0;q.push(i)}
  for(let h=0;h<q.length;h++){const i=q[h],x=tx(i),y=ty(i);for(const[dx,dy]of D4){const nx=x+dx,ny=y+dy;if(!inb(nx,ny))continue;const j=idx(nx,ny);if(d[j]>d[i]+1){d[j]=d[i]+1;q.push(j)}}}return d}
function claimRing(nt,cx,cy,r){ // merkezden r uzaklıktaki sahipsiz karaları al (bağlantılı olanları)
  let got=0;for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const d=Math.hypot(dx,dy);if(d>r||d<=r-1.01)continue;const x=cx+dx,y=cy+dy;if(!inb(x,y))continue;const i=idx(x,y);
    if(owner[i]>=0||isWater(terr[i]))continue;
    let adj=r<=1;if(!adj)for(const[a,b]of D8){const nx=x+a,ny=y+b;if(inb(nx,ny)&&owner[idx(nx,ny)]===nt.id){adj=true;break}}
    if(adj){owner[i]=nt.id;got++}}return got}
function findTownSite(nt,minD,maxD,allowUnowned){
  const cs=cities.filter(c=>c.c===nt.id);const cand=[];
  for(let i=0;i<N;i+=1){if((owner[i]!==nt.id&&!(allowUnowned&&owner[i]<0))||cityAt[i]>=0)continue;const t=terr[i];if(t!==T.GRASS&&t!==T.FOREST&&t!==T.FARM)continue;const x=tx(i),y=ty(i);
    if(x<8||y<8||x>W-9||y>H-9)continue;const dmin=Math.min(...cs.map(c=>Math.hypot(c.x-x,c.y-y)));if(dmin<minD||dmin>maxD)continue;
    let ok=0;for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const j=idx(x+dx,y+dy);if((owner[j]===nt.id||owner[j]<0)&&!isWater(terr[j])&&terr[j]!==T.MOUNT&&cityAt[j]<0)ok++}
    if(ok>60)cand.push({x,y,s:ok-dmin*.5})}
  if(!cand.length)return null;cand.sort((a,b)=>b.s-a.s);return cand[Math.min(cand.length-1,ri(0,6))];
}
function newCity(c,x,y,Rr,capital,name){const ct={id:cities.length,c,x,y,R:Rr,capital,name,indA:rnd(0,6.28),founded:typeof now!=='undefined'?now:0,growth:0,maxR:capital?24:16};cities.push(ct);return ct}
// Halka düzeni: r0 < d <= r1 aralığındaki karoları imar et. asSite=true ise binalar inşaat alanı olarak başlar.
function zoneFor(ct,r,ang){
  let da=Math.abs(((ang-ct.indA+Math.PI*3)%(Math.PI*2))-Math.PI);const ind=da<.55&&r>.45;const q=R();
  if(r<.3)return q<.1?'park':(q<.55?(ct.capital?'tower':'office'):q<.8?'office':q<.9?'mall':'apartment');
  if(ind)return q<.55?'factory':q<.9?'warehouse':null;
  if(r<.62)return q<.55?'apartment':q<.78?'shop':q<.9?'house':'park';
  return q<.68?'house':q<.78?'apartment':q<.85?'shop':q<.92?'park':null;
}
function layoutRing(ct,r0,r1,asSite){
  const made=[];
  for(let dy=-r1-1;dy<=r1+1;dy++)for(let dx=-r1-1;dx<=r1+1;dx++){
    const x=ct.x+dx,y=ct.y+dy;if(!inb(x,y))continue;const d=Math.hypot(dx,dy);if(d>r1+.5||d<=r0+.5)continue;
    const i=idx(x,y);if(owner[i]!==ct.c)continue;const t=terr[i];if(t===T.DEEP||t===T.LAKE&&!(dx%5===0||dy%5===0))continue;
    if(cityAt[i]>=0&&cityAt[i]!==ct.id)continue;
    if(bldAt[i]>=0&&PROTECT.has(buildings[bldAt[i]].type))continue;
    if(t===T.RUNWAY||t===T.CONC)continue;
    cityAt[i]=ct.id;
    if(dx%5===0||dy%5===0){if(bldAt[i]>=0){if(worldReady)continue;buildings[bldAt[i]].type='gone';bldAt[i]=-1}terr[i]=isWater(t)?T.BRIDGE:T.ROAD;treeKind[i]=0;continue}
    if(isWater(t)||isRoad(t)||bldAt[i]>=0)continue;
    terr[i]=T.GRASS;treeKind[i]=0;const z=zoneFor(ct,d/Math.max(ct.R,r1),Math.atan2(dy,dx));
    if(z==='park'){terr[i]=T.PARK;continue}if(!z)continue;
    if(asSite){const b=addBuilding(x,y,'construction',ct.c,ct.id);b.target=z;b.doneAt=(typeof now!=='undefined'?now:0)+rnd(1,9)*1440;made.push(b)}
    else made.push(addBuilding(x,y,z,ct.c,ct.id));
  }
  return made;
}
function placeServices(ct,initial){
  const list=buildings.filter(b=>b.city===ct.id&&b.type!=='gone').map(b=>({b,d:Math.hypot(b.x-ct.x,b.y-ct.y)})).sort((a,b)=>a.d-b.d);
  const used=new Set();
  const take=(type,minR,maxR)=>{const c=list.filter(o=>!used.has(o.b.id)&&o.d>=minR*ct.R&&o.d<=maxR*ct.R&&['house','apartment','shop','office','construction'].includes(o.b.type));if(!c.length)return;
    const o=pick(c.slice(0,Math.max(3,(c.length/2)|0)));used.add(o.b.id);if(o.b.type==='construction')o.b.target=type;else setType(o.b,type)};
  if(ct.capital){take('parliament',0,.35);take('hospital',.2,.7);take('police',.1,.6);take('fire',.2,.7);take('school',.3,.8);take('school',.4,1);take('university',.3,.85);take('stadium',.5,1);take('police',.5,1);
    const f=list.find(o=>o.b.type==='factory');if(f)setType(f.b,'power')}
  else{take('hospital',.1,.8);take('police',.1,.8);take('fire',.2,.9);take('school',.2,1)}
}
function placeFarms(ct){
  const Rr=ct.R;for(let dy=-Rr-6;dy<=Rr+6;dy++)for(let dx=-Rr-6;dx<=Rr+6;dx++){
    const x=ct.x+dx,y=ct.y+dy;if(!inb(x,y))continue;const d=Math.hypot(dx,dy);if(d<Rr+.6||d>Rr+6)continue;
    const i=idx(x,y);if(owner[i]!==ct.c||terr[i]!==T.GRASS||bldAt[i]>=0||cityAt[i]>=0)continue;
    if(hash(x>>2,y>>2)<.66){terr[i]=T.FARM;
      if(R()<.1&&D4.some(([a,b])=>inb(x+a,y+b)&&isRoad(terr[idx(x+a,y+b)]))){terr[i]=T.GRASS;addBuilding(x,y,'barn',ct.c,ct.id)}}}
}
function plantTrees(){for(let i=0;i<N;i++){const t=terr[i];const h=hash(tx(i),ty(i)*3);
  if(t===T.FOREST)treeKind[i]=elev[i]>.38||h<.3?2:1;else if(t===T.SAND&&seaMask[i-1|0]===0&&h>.93)treeKind[i]=3;else if(t===T.GRASS&&h>.9)treeKind[i]=1;else treeKind[i]=0}}
function setRoad(i){const t=terr[i];if(t===T.DEEP)return false;if(bldAt[i]>=0){const b=buildings[bldAt[i]];if(PROTECT.has(b.type)||worldReady)return false;bldAt[i]=-1;b.type='gone'}
  if(t===T.RUNWAY||t===T.CONC)return true;terr[i]=isWater(t)?T.BRIDGE:T.ROAD;treeKind[i]=0;return true}
// --- A* karayolu: düz arazi tercih eder, dağdan ve sudan kaçınır, kısa köprü kurar ---
function roadAStar(ax,ay,bx,by,allowForeign){
  const start=idx(ax,ay),goal=idx(bx,by);const g=new Float32Array(N).fill(1e9),prev=new Int32Array(N).fill(-1),closed=new Uint8Array(N);
  const heap=[];const push=(i,f)=>{heap.push([f,i]);let k=heap.length-1;while(k>0){const p=(k-1)>>1;if(heap[p][0]<=heap[k][0])break;[heap[p],heap[k]]=[heap[k],heap[p]];k=p}};
  const pop=()=>{const top=heap[0];const last=heap.pop();if(heap.length){heap[0]=last;let k=0;for(;;){const l=2*k+1,r=l+1;let m=k;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===k)break;[heap[m],heap[k]]=[heap[k],heap[m]];k=m}}return top};
  g[start]=0;push(start,0);let found=false,it=0;
  while(heap.length&&it++<120000){const[,i]=pop();if(closed[i])continue;closed[i]=1;if(i===goal){found=true;break}const x=tx(i),y=ty(i);
    for(let d=0;d<4;d++){const nx=x+D4[d][0],ny=y+D4[d][1];if(!inb(nx,ny))continue;const j=idx(nx,ny);if(closed[j])continue;const t=terr[j];
      if(t===T.DEEP)continue;if(seaMask[j]&&!window.__allowSea)continue;if(bldAt[j]>=0&&(worldReady||PROTECT.has(buildings[bldAt[j]].type)))continue;if(t===T.RUNWAY||(t===T.CONC&&j!==goal))continue;
      let c=isRoad(t)?.35:t===T.MOUNT?7:t===T.DEEP?18:isWater(t)?9:t===T.FOREST?1.5:bldAt[j]>=0?25:1;if(!allowForeign&&owner[j]>=0&&owner[j]!==owner[start])c+=4;
      if(prev[i]>=0&&(prev[i]-i)!==(i-j))c+=.25; // dönüş cezası: düzgün yollar
      const ng=g[i]+c;if(ng<g[j]){g[j]=ng;prev[j]=i;push(j,ng+(Math.abs(nx-bx)+Math.abs(ny-by))*.4)}}}
  if(!found)return false;for(let i=goal;i>=0;i=prev[i])setRoad(i);return true;
}
function linkToRoad(sx,sy){
  const st=idx(sx,sy);const prev=new Int32Array(N).fill(-2);const q=[st];prev[st]=-1;let end=-1;
  for(let h=0;h<q.length&&h<40000;h++){const i=q[h];if(i!==st&&isRoad(terr[i])&&cityAt[i]>=0){end=i;break}const x=tx(i),y=ty(i);
    for(const[dx,dy]of D4){const nx=x+dx,ny=y+dy;if(!inb(nx,ny))continue;const j=idx(nx,ny);if(prev[j]!==-2)continue;const t=terr[j];
      if(t===T.DEEP||t===T.RUNWAY||t===T.CONC)continue;if(bldAt[j]>=0&&PROTECT.has(buildings[bldAt[j]].type))continue;prev[j]=i;q.push(j)}}
  if(end>=0)roadAStar(sx,sy,tx(end),ty(end));
}
function findArea(nt,w,h,minD,maxD,ok){
  const cap=capOf(nt.id);const cands=[];
  for(let y=1;y<H-h-1;y++)for(let x=1;x<W-w-1;x++){const d=Math.hypot(x+w/2-cap.x,y+h/2-cap.y);if(d<minD||d>maxD)continue;
    let good=true;for(let yy=-1;yy<=h&&good;yy++)for(let xx=-1;xx<=w;xx++){const i=idx(x+xx,y+yy);const inner=yy>=0&&yy<h&&xx>=0&&xx<w;
      if(inner&&((owner[i]!==nt.id&&owner[i]>=0)||!ok(terr[i])||bldAt[i]>=0||cityAt[i]>=0)){good=false;break}if(!inner&&cityAt[i]>=0){good=false;break}}
    if(good)cands.push({x,y,d})}
  cands.sort((a,b)=>a.d-b.d);const r=cands.length?cands[Math.min(cands.length-1,ri(0,3))]:null;
  if(r)for(let yy=-1;yy<=h;yy++)for(let xx=-1;xx<=w;xx++){const i=idx(r.x+xx,r.y+yy);if(owner[i]<0&&!isWater(terr[i]))owner[i]=nt.id}
  return r;
}
function placeAirport(nt){
  let w=12,a=findArea(nt,12,3,12,26,freeLand);if(!a){w=10;a=findArea(nt,10,3,8,30,t=>freeLand(t)||t===T.MOUNT)}if(!a)return;
  for(let xx=0;xx<w;xx++){terr[idx(a.x+xx,a.y)]=T.CONC;terr[idx(a.x+xx,a.y+1)]=T.RUNWAY;terr[idx(a.x+xx,a.y+2)]=T.GRASS;for(let yy=0;yy<3;yy++)treeKind[idx(a.x+xx,a.y+yy)]=0}
  addBuilding(a.x+1,a.y,'terminal',nt.id,-1);addBuilding(a.x+2,a.y,'terminal',nt.id,-1);addBuilding(a.x+5,a.y,'atc',nt.id,-1);
  for(let xx=6;xx<10;xx++)decor[idx(a.x+xx,a.y)]=2;
  const ap={c:nt.id,x:a.x,y:a.y,w,rx0:a.x,rx1:a.x+w-1,ry:a.y+1};airports.push(ap);nt.airport=ap;
  const e=idx(a.x+1,a.y-1);if(bldAt[e]>=0){buildings[bldAt[e]].type='gone';bldAt[e]=-1}terr[e]=T.ROAD;linkToRoad(a.x+1,a.y-1);
}
function placeBase(nt){
  const a=findArea(nt,5,5,10,24,freeLand)||findArea(nt,5,5,5,40,t=>freeLand(t)||t===T.MOUNT);if(!a)return;
  for(let yy=0;yy<4;yy++)for(let xx=0;xx<5;xx++){terr[idx(a.x+xx,a.y+yy)]=T.CONC;treeKind[idx(a.x+xx,a.y+yy)]=0}
  for(let yy=0;yy<5;yy++)terr[idx(a.x+2,a.y+yy)]=T.ROAD;
  addBuilding(a.x,a.y,'barracks',nt.id,-1);addBuilding(a.x+1,a.y,'barracks',nt.id,-1);addBuilding(a.x+3,a.y,'hangar',nt.id,-1);addBuilding(a.x+4,a.y+2,'depot',nt.id,-1);
  for(let yy=2;yy<4;yy++)for(let xx=0;xx<2;xx++)decor[idx(a.x+xx,a.y+yy)]=1;
  linkToRoad(a.x+2,a.y+4);const bs={c:nt.id,x:a.x,y:a.y};bases.push(bs);nt.base=bs;
}
function placePort(nt,nearCity){
  const ct=nearCity||capOf(nt.id);let best=null,bd=1e9;
  for(let i=0;i<N;i++){if(owner[i]!==nt.id||!freeLand(terr[i])||bldAt[i]>=0)continue;const x=tx(i),y=ty(i);
    let sea=-1;for(const[dx,dy]of D4){const j=idx(x+dx,y+dy);if(inb(x+dx,y+dy)&&seaMask[j]&&wdist[j]<=2){sea=j;break}}if(sea<0)continue;
    let open=0;for(const[dx,dy]of D8){const nx=x+dx*3,ny=y+dy*3;if(inb(nx,ny)&&seaMask[idx(nx,ny)])open++}if(open<4)continue;
    const d=Math.hypot(x-ct.x,y-ct.y);if(d<bd&&d<40){bd=d;best={i,sea}}}
  if(!best)return null;const x=tx(best.i),y=ty(best.i);terr[best.i]=T.CONC;treeKind[best.i]=0;const cr=addBuilding(x,y,'crane',nt.id,-1);
  let wh=null;for(const[dx,dy]of D4){const j=idx(x+dx,y+dy);if(inb(x+dx,y+dy)&&freeLand(terr[j])&&bldAt[j]<0){terr[j]=T.CONC;treeKind[j]=0;wh=addBuilding(x+dx,y+dy,'portwh',nt.id,-1);
    for(const[ex,ey]of D4){const k=idx(x+dx+ex,y+dy+ey);if(inb(x+dx+ex,y+dy+ey)&&freeLand(terr[k])&&bldAt[k]<0){terr[k]=T.ROAD;linkToRoad(x+dx+ex,y+dy+ey);break}}break}}
  // rıhtım çıkışı: denizde gemilerin yanaştığı açık su noktası
  let berth=best.sea;for(let k=0;k<4;k++){const bx=tx(berth),by=ty(berth);let nb=berth;for(const[dx,dy]of D4){const j=idx(bx+dx,by+dy);if(inb(bx+dx,by+dy)&&seaMask[j]&&wdist[j]>wdist[nb])nb=j}berth=nb}
  const p={c:nt.id,x,y,berth,dock:best.sea,b:cr,wh};ports.push(p);if(!nt.port)nt.port=p;return p;
}
function computeEnt(b){b.ent=-1;let best=-1,bd=9;for(let r=1;r<=3&&best<0;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const x=b.x+dx,y=b.y+dy;if(!inb(x,y))continue;const j=idx(x,y);if(isRoad(terr[j])){const d=Math.abs(dx)+Math.abs(dy);if(d<bd){bd=d;best=j}}}b.ent=best}
function computeEntrances(){
  buildings=buildings.filter(b=>b.type!=='gone');buildings.forEach((b,k)=>{b.id=k});bldAt.fill(-1);for(const b of buildings)bldAt[b.i]=b.id;
  for(const b of buildings)computeEnt(b);
}
function computeRoadComp(){
  roadComp.fill(-1);let comp=0;const q=new Int32Array(N);
  for(let s=0;s<N;s++){if(!isRoad(terr[s])||roadComp[s]>=0)continue;let h=0,t=0;q[t++]=s;roadComp[s]=comp;
    while(h<t){const i=q[h++],x=tx(i),y=ty(i);for(const[dx,dy]of D4){const nx=x+dx,ny=y+dy;if(!inb(nx,ny))continue;const j=idx(nx,ny);if(isRoad(terr[j])&&roadComp[j]<0){roadComp[j]=comp;q[t++]=j}}}
    comp++}
}

function buildStraitBridges(){const comp=new Int32Array(N).fill(-1),sizes=[],q=new Int32Array(N);let c=0;
  for(let s=0;s<N;s++){if(isWater(terr[s])||comp[s]>=0)continue;let h=0,t=0;q[t++]=s;comp[s]=c;while(h<t){const i=q[h++],x=tx(i),y=ty(i);for(const[dx,dy]of D4){const nx=x+dx,ny=y+dy;if(!inb(nx,ny))continue;const j=idx(nx,ny);if(!isWater(terr[j])&&comp[j]<0){comp[j]=c;q[t++]=j}}}sizes.push(t);c++}
  let main=0;for(let k=1;k<c;k++)if(sizes[k]>sizes[main])main=k;const best=new Map();
  for(let i=0;i<N;i++){const ci=comp[i];if(ci<0||ci===main||sizes[ci]<40)continue;const x=tx(i),y=ty(i);
    for(const[dx,dy]of D4){let k=1,okk=false;for(;k<=9;k++){const nx=x+dx*k,ny=y+dy*k;if(!inb(nx,ny))break;const t=terr[idx(nx,ny)];if(t===T.DEEP)break;if(!isWater(t)){okk=comp[idx(nx,ny)]===main;break}}
      if(!okk||k<2)continue;const cur=best.get(ci);if(!cur||k<cur.k)best.set(ci,{k,x,y,dx,dy})}}
  let n=0;for(const[,b]of best){if(n>=12)break;for(let s=1;s<b.k;s++){const j=idx(b.x+b.dx*s,b.y+b.dy*s);terr[j]=T.BRIDGE;treeKind[j]=0}
    for(const[px,py,isl]of[[b.x,b.y,1],[b.x+b.dx*b.k,b.y+b.dy*b.k,0]]){const p=idx(px,py);if(bldAt[p]<0){terr[p]=T.ROAD;treeKind[p]=0}
      if(isl){let sx=0,sy=0,cn=0;for(let j=0;j<N;j++)if(comp[j]===comp[p]){sx+=tx(j);sy+=ty(j);cn++}const cx=sx/cn,cy=sy/cn;let bj=p,bd=1e9;for(let j=0;j<N;j++)if(comp[j]===comp[p]&&!isWater(terr[j])){const d=Math.hypot(tx(j)-cx,ty(j)-cy);if(d<bd){bd=d;bj=j}}if(bj!==p)roadAStar(px,py,tx(bj),ty(bj))}
      connectAny(px,py)}n++}
  return n}
function connectAny(x,y){const st=idx(x,y),seen=new Uint8Array(N),q=[st];seen[st]=1;
  for(let h=0;h<q.length&&h<6000;h++){const i=q[h];if(isRoad(terr[i])&&Math.abs(tx(i)-x)+Math.abs(ty(i)-y)>=3){roadAStar(x,y,tx(i),ty(i));return true}
    for(const[dx,dy]of D4){const nx=tx(i)+dx,ny=ty(i)+dy;if(!inb(nx,ny))continue;const j=idx(nx,ny);if(seen[j]||isWater(terr[j]))continue;seen[j]=1;q.push(j)}}return false}

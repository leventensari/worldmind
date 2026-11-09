// ============================================================
// Hareket fiziği: sağdan akan iki şeritli yollar, kaldırımlar,
// Bézier virajlar, takip mesafesi, trafik ışıkları
// ============================================================
// Hızlar: karo / oyun dakikası (1 karo ≈ 250 m)
const SPD={car:1.6,bus:1.2,emerg:2.6,walk:.3};
const LANE={car:.165,walk:.41};
let isInter=new Uint8Array(N); // kavşak karoları (3+ yol komşusu)
function computeIntersections(){isInter=new Uint8Array(N);for(let i=0;i<N;i++){if(!isRoad(terr[i]))continue;const x=tx(i),y=ty(i);let n=0;for(const[dx,dy]of D4)if(inb(x+dx,y+dy)&&isRoad(terr[idx(x+dx,y+dy)]))n++;if(n>=3)isInter[i]=1}}
const dirIdx=(dx,dy)=>dx===1?0:dx===-1?1:dy===1?2:3;
function lightGreen(i,axisX){const off=hash(tx(i),ty(i))*1.6;const ph=Math.floor((now+off)/.8)%2;return axisX?ph===0:ph===1}
function segGeom(m){
  const p=m.path,k=m.pi,i=p[k];const cx=tx(i)+.5,cy=ty(i)+.5;
  const dd=(a,b)=>[tx(b)-tx(a),ty(b)-ty(a)];
  const din=k>0?dd(p[k-1],i):(k<p.length-1?dd(i,p[k+1]):[1,0]);
  const dout=k<p.length-1?dd(i,p[k+1]):din;
  const o=m.mode==='walk'?LANE.walk:LANE.car;
  const rI=[-din[1],din[0]],rO=[-dout[1],dout[0]];
  const P0=k===0?[cx-dout[0]*.15+rO[0]*o,cy-dout[1]*.15+rO[1]*o]:[cx-din[0]*.5+rI[0]*o,cy-din[1]*.5+rI[1]*o];
  const P2=k===p.length-1?[cx+din[0]*.15+rI[0]*o,cy+din[1]*.15+rI[1]*o]:[cx+dout[0]*.5+rO[0]*o,cy+dout[1]*.5+rO[1]*o];
  let C;if(din[0]===dout[0]&&din[1]===dout[1])C=[(P0[0]+P2[0])/2,(P0[1]+P2[1])/2];
  else if(din[0]===-dout[0]&&din[1]===-dout[1])C=[cx+din[0]*.3,cy+din[1]*.3];
  else C=[cx+rI[0]*o+rO[0]*o,cy+rI[1]*o+rO[1]*o];
  m.P0=P0;m.C=C;m.P2=P2;m.len=Math.max(.05,Math.hypot(C[0]-P0[0],C[1]-P0[1])+Math.hypot(P2[0]-C[0],P2[1]-C[1]));
  m.din=din;m.dout=dout;m.key=i*4+dirIdx(dout[0],dout[1]);m.kin=i*4+dirIdx(din[0],din[1]);
}
function moverPos(m){const t=m.t,u=1-t;const P0=m.P0,C=m.C,P2=m.P2;
  m.gx=u*u*P0[0]+2*u*t*C[0]+t*t*P2[0];m.gy=u*u*P0[1]+2*u*t*C[1]+t*t*P2[1];
  const dx=2*u*(C[0]-P0[0])+2*t*(P2[0]-C[0]),dy=2*u*(C[1]-P0[1])+2*t*(P2[1]-C[1]);
  const l=Math.hypot(dx,dy);if(l>1e-6){m.fx=dx/l;m.fy=dy/l}}
function startMove(m,path){m.path=path;m.pi=0;m.t=0;m.spd=m.spd||0;m.stuck=0;segGeom(m);moverPos(m)}
// Takip mesafesi ve ışıklar: her karede bir kez hesaplanır, alt adımlarda tüketilir
function computeGaps(list){
  const lane=new Map(),entering=new Map();
  for(const m of list){if(!m.path||m.mode==='walk')continue;let a=lane.get(m.key);if(!a)lane.set(m.key,a=[]);a.push(m);
    let b=entering.get(m.kin);if(!b)entering.set(m.kin,b=[]);b.push(m)}
  for(const m of list){if(!m.path){continue}m.gap=99;if(m.mode==='walk')continue;
    const same=lane.get(m.key);if(same)for(const o of same){if(o===m)continue;if(o.t>m.t||(o.t===m.t&&o.id>m.id)){const g=(o.t-m.t)*m.len;if(g<m.gap)m.gap=g}}
    if(m.gap===99&&m.pi<m.path.length-1){const nxt=m.path[m.pi+1];const k2=nxt*4+dirIdx(m.dout[0],m.dout[1]);const ahead=entering.get(k2);
      if(ahead)for(const o of ahead){const g=(1-m.t)*m.len+o.t*o.len;if(g<m.gap)m.gap=g}
      // kırmızı ışık: kavşağa girmeden önce dur
      if(!m.veh&&isInter[nxt]&&!isInter[m.path[m.pi]]&&m.t<.8){if(!lightGreen(nxt,m.dout[0]!==0)){const g=(.86-m.t)*m.len;if(g<m.gap)m.gap=g;m.redLight=true}else m.redLight=false}}
    if(m.stuck>2.5){m.gap=99;if(m.stuck>3.2)m.stuck=0} // kilitlenmeyi çöz
  }
}
const MIN_GAP=.42;
function stepMover(m,dm){ // true dönerse yol bitti
  const vmax=m.mode==='walk'?SPD.walk:m.veh==='army'?.8:m.veh?SPD.emerg:m.bus?SPD.bus:SPD.car;
  let target=vmax;if(m.gap!==undefined&&m.mode!=='walk'){const free=m.gap-MIN_GAP;target=free<=0?0:Math.min(vmax,free*4)}
  m.spd+=(target-m.spd)*Math.min(1,dm*(target<m.spd?9:3));if(m.spd<.02&&target<.02)m.spd=0;
  if(m.spd===0&&m.mode!=='walk')m.stuck=(m.stuck||0)+dm;else m.stuck=0;
  let d=m.spd*dm;if(m.gap!==undefined&&m.mode!=='walk'){const lim=Math.max(0,m.gap-MIN_GAP);if(d>lim)d=lim;m.gap-=d}
  while(d>0){const rem=(1-m.t)*m.len;if(d<rem){m.t+=d/m.len;d=0}else{d-=rem;if(m.pi>=m.path.length-1){m.t=1;moverPos(m);return true}m.pi++;m.t=0;segGeom(m)}}
  if(m.mode==='walk'&&m.pi>=m.path.length-1&&m.t>=.999){moverPos(m);return true}
  moverPos(m);m.tile=m.path[m.pi];return false;
}

// ---------- Arka plan trafiği (şehir hayatı) ----------
let ambient=[];
function cityRoadTiles(ct){const r=[];for(let dy=-ct.R;dy<=ct.R;dy++)for(let dx=-ct.R;dx<=ct.R;dx++){const x=ct.x+dx,y=ct.y+dy;if(!inb(x,y))continue;const i=idx(x,y);if(isRoad(terr[i])&&cityAt[i]===ct.id)r.push(i)}return r}
function initAmbient(){ambient=[];for(const ct of cities)spawnAmbientFor(ct)}
function spawnAmbientFor(ct){
  const roads=cityRoadTiles(ct);ct.roads=roads;if(roads.length<6)return;
  const n=Math.min(120,Math.round(roads.length*.55));const have=ambient.filter(a=>a.city===ct.id).length;
  for(let k=have;k<n;k++){const r=R();const kind=r<.3?'walk':r<.36?'bus':r<.42?'taxi':r<.5?'van':'car';
    const t0=pick(roads);const a={id:200000+ambient.length+k,amb:true,city:ct.id,c:ct.c,tile:t0,gx:tx(t0)+.5,gy:ty(t0)+.5,mode:kind==='walk'?'walk':'car',bus:kind==='bus',kind,
      role:pick(['worker','merchant','student','retiree','worker']),hs:0,phase:R(),col:pick(['#C0392B','#ECF0F1','#2C3E50','#2980B9','#7F8C8D','#F1C40F','#16A085','#8E44AD','#D35400','#BDC3C7','#34495E','#E8E2D0']),spd:0,path:null,hdg:0,vis:true};
    ambient.push(a)}
}
function ambientDensity(c){const h=hourOf();let d=(h>=7&&h<9.5)||(h>=17&&h<19.5)?1:(h>=9.5&&h<17)?.68:(h>=19.5&&h<23)?.45:(h>=5.5&&h<7)?.3:.1;
  const nt=nations[c];if(nt){if(nt.weather==='fırtına')d*=.5;if(nt.quarantine)d*=.45;if(nt.curfew&&(h>=21||h<6))d*=.05}return d}
let ambBudget=0;
function ambientNewRoute(a){const ct=cities[a.city];if(!ct||!ct.roads||!ct.roads.length)return;
  for(let k=0;k<4;k++){const dest=pick(ct.roads);if(dest===a.tile)continue;const dd=Math.abs(tx(dest)-tx(a.tile))+Math.abs(ty(dest)-ty(a.tile));if(dd<3||dd>(a.mode==='walk'?7:22))continue;
    const p=findPath(a.tile,dest);if(p&&p.length>1){startMove(a,p);return}}a.path=null}
let movers=[];
function updateMovement(dm,dtReal){
  // görünür / hareketli tüm varlıkların listesi
  movers.length=0;for(const a of agents)if(a.alive&&a.state==='MOVE'&&a.path)movers.push(a);
  const ambDm=Math.min(dm,dtReal*4);
  for(const a of ambient){a.on=a.phase<ambientDensity(a.c);if(!a.on)continue;if(!a.path){if(ambBudget-->0)ambientNewRoute(a);continue}movers.push(a)}
  computeGaps(movers);
  const steps=Math.max(1,Math.ceil(dm/.2));const sdm=dm/steps,asdm=ambDm/steps;
  for(let s=0;s<steps;s++)for(const m of movers){if(!m.path)continue;
    if(m.amb){if(stepMover(m,asdm)){m.tile=m.path[m.path.length-1];m.path=null}}
    else if(stepMover(m,sdm)){a_arrive(m)}}
}
function a_arrive(a){a.tile=a.path[a.path.length-1];a.path=null;arrive(a)}

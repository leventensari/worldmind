// ============================================================
// Sprite sistemi: Blender'da üretilen 8 yönlü izometrik sprite'lar
// Kare biçimi: [dosya, gen, yük, ax, ay, ileriGx, ileriGy]; 1 karo = 128 px (dünyada 32 birim → /4)
// ============================================================
const SPR={ready:false,man:null,img:{}};
SPR.promise=(async function loadSprites(){
  if(!/^https?:/.test(location.protocol))return;
  try{const gj=async u=>{try{const r=await fetch(u,{cache:'no-cache'});return r.ok?await r.json():{}}catch(e){return{}}};const nm=await gj('sprites/sprites.json'),tm=await gj('sprites_toon/sprites.json');const man={};for(const id in nm)man[id]=tm[id]?{...tm[id],base:'sprites_toon/'}:{...nm[id],base:'sprites/'};for(const id in tm)if(!man[id])man[id]={...tm[id],base:'sprites_toon/'};if(!Object.keys(man).length)return;const jobs=[];
    for(const id in man)for(const fr of man[id].f){const im=new Image();im.src=man[id].base+fr[0];SPR.img[fr[0]]=im;jobs.push(im.decode().catch(()=>{}))}
    await Promise.all(jobs);SPR.man=man;SPR.ready=true;if(typeof markAllDirty==='function')markAllDirty();console.log('sprite yüklendi:',Object.keys(man).length)}catch(e){console.warn('sprite yok',e)}
})();
function sprFrame(id,fx,fy){const m=SPR.man&&SPR.man[id];if(!m)return null;let best=null,bd=-9;for(const f of m.f){const d=f[5]*fx+f[6]*fy;if(d>bd){bd=d;best=f}}
  const im=SPR.img[best[0]];return im&&im.complete&&im.naturalWidth?{im,f:best}:null}
function drawSprite(g,id,wx,wy,fx,fy,lift=0,alpha=1,shadowOnly=false){const s=sprFrame(id,fx,fy);if(!s)return null;const f=s.f;
  if(shadowOnly){g.save();g.globalAlpha=.22*alpha;g.filter='brightness(0) blur(1px)';g.drawImage(s.im,wx-f[3]/4,wy-f[4]/4,f[1]/4,f[2]/4*.6+0);g.restore();return s}
  if(alpha<1){g.save();g.globalAlpha=alpha}g.drawImage(s.im,wx-f[3]/4,wy-f[4]/4-lift,f[1]/4,f[2]/4);if(alpha<1)g.restore();return s}
const CIV_CARS=['car_sedan','car_suv','car_hatchback-sports','car_sedan','car_suv','car_van'];
function vehSpriteId(m,kind){
  switch(kind){case'taxi':return'car_taxi';case'bus':return'bus';case'police':return'car_police';case'fire':return'car_firetruck';case'amb':return'car_ambulance';
    case'army':return pk(['mil_tank','mil_apc','mil_jeep','mil_ltank'][m.id%4],['tank','apc','armytruck','artillery'][m.id%4]);
    case'van':return['car_delivery','car_van','car_truck','car_garbage-truck'][m.id%4];
    default:return m.role==='farmer'?'car_tractor':CIV_CARS[m.id%CIV_CARS.length]}}
function drawVehicle(g,m,t){
  const kind=m.veh||(m.amb?(m.bus?'bus':m.kind==='taxi'?'taxi':m.kind==='van'?'van':'car'):(m.role==='farmer'?'van':'car'));
  if(SPR.ready){const p=W2(m.gx,m.gy);const s=drawSprite(g,vehSpriteId(m,kind),p[0],p[1]-(m._lift||0),(m.hx=lerp(m.hx??((m.fx??1)),(m.fx??1),.25)),(m.hy=lerp(m.hy??((m.fy??0)),(m.fy??0),.25)));
    if(s){if(m.veh==='police'||m.veh==='fire'||m.veh==='amb'){const on=((t*6+m.id)|0)%2;const top=p[1]-s.f[4]/4*.82;
        g.fillStyle=on?(m.veh==='police'?'#3D7BFF':'#FF2B2B'):'#FFFFFF';g.fillRect(p[0]-1.4,top-1,2.8,1.3);
        g.globalCompositeOperation='lighter';g.fillStyle=on?'rgba(70,120,255,.4)':'rgba(255,60,60,.4)';g.beginPath();g.arc(p[0],top,5.5,0,7);g.fill();g.globalCompositeOperation='source-over'}
      if(m.redLight&&m.spd<.05){const r=W2(m.gx-((m.fx??1))*.2,m.gy-((m.fy??0))*.2);g.fillStyle='rgba(255,40,40,.95)';g.fillRect(r[0]-.7,r[1]-2.2,1.4,.9)}
      return}}
  drawVehicleProc(g,m,t)}
function drawShip(g,s,t){
  if(SPR.ready){const id=s.kind==='tanker'?'ship_ship-large':s.kind==='ferry'?'ship_ship-ocean-liner-small':s.kind==='fishing'?'ship_boat-fishing-small':s.kind==='tug'?'ship_boat-tug-a':s.kind==='navy'?pk({destroyer:'nav_destroyer',carrier:'nav_carrier',sub:'nav_submarine',cruiser:'nav_cruiser'}[s.cls||'destroyer'],s.cls==='cruiser'?'destroyer':(s.cls||'destroyer')):(s.cargo.charCodeAt(2)%2?'ship_ship-cargo-a':'ship_ship-cargo-b');
    const[a0,b0]=s.route[Math.min(s.seg,s.route.length-2)],[a1,b1]=s.route[Math.min(s.seg+1,s.route.length-1)];let fx=a1-a0,fy=b1-b0;const l=Math.hypot(fx,fy)||1;
    s.fx=lerp(s.fx??fx/l,fx/l,.06);s.fy=lerp(s.fy??fy/l,fy/l,.06);
    drawWake(g,s)
    const p=W2(s.gx,s.gy);if(drawSprite(g,id,p[0],p[1]+1.5,s.fx,s.fy))return}
  drawShipProc(g,s,t)}
// Uçak: ekran açısını ızgara yönüne çevir
function screenToGridDir(ang){const dx=Math.cos(ang),dy=Math.sin(ang);let gx=dx/HW+dy/HH,gy=dy/HH-dx/HW;const l=Math.hypot(gx,gy)||1;return[gx/l,gy/l]}
function drawAircraft(g,p,q){if(!SPR.ready)return false;const id=(p.kind==='strike'||p.kind==='cap')?(p.from%2?pk('jet_FighterJet1',pk('mil_jet','fighter')):pk('jet_FighterJet2','bomber')):p.kind==='heli'?pk('mil_heli','heli'):'airliner';
  const[fx,fy]=screenToGridDir(q.ang);drawSprite(g,id,q.x+q.alt*.25,q.y+q.alt*.1,fx,fy,0,1,true);return!!drawSprite(g,id,q.x,q.y,fx,fy,q.alt)}
function drawArmyUnit(g,m,t){if(m.id%3===2){drawInfantry(g,m,t);return true}if(!SPR.ready)return false;const fp_=formPos(m);const p=W2(fp_.gx,fp_.gy);const j=0,k=0;
  const kind_=m.id%3===0?'tank':m.id%6===1?'artillery':'apc';const id=pk({tank:'mil_tank',artillery:'mil_ltank',apc:'mil_apc'}[kind_],kind_);let ax=(m.fx??1),ay=(m.fy??0);if(m.aimTo){ax=m.aimTo[0]-m.gx;ay=m.aimTo[1]-m.gy;const l=Math.hypot(ax,ay)||1;ax/=l;ay/=l}m.aimX=ax;m.aimY=ay;const s=drawSprite(g,id,p[0]+j,p[1]+k,ax,ay);
  if(s&&kind_==='artillery'&&m.aimTo&&R()<.005){const tg=W2(m.aimTo[0]+ax*4+rnd(-1.5,1.5),m.aimTo[1]+ay*4+rnd(-1.5,1.5));projs.push({x0:p[0],y0:p[1]-9,x1:tg[0],y1:tg[1],t0:performance.now(),dur:1500,h:95,kind:'shell'})}
  if(s&&R()<.012){particles.push({x:p[0]+j+(m.aimX||1)*10,y:p[1]+k-6,vx:(m.aimX||1)*.6,vy:-.2,life:.6,dec:.07,kind:'flash',s:2.4})}return!!s}

// ---------- Bina sprite'ları ----------
const L_=(p,a)=>a.split('').map(c=>p+c);
const BLD_SPR={house:L_('bld_house_','abcdefghijklmnopqrstu'),apartment:L_('bld_com_','abcdefg'),office:L_('bld_com_','hijklmn'),shop:L_('bld_com_','abcdef'),mall:L_('bld_com_','klmn'),
  tower:L_('bld_sky_','abcde'),highrise:L_('bld_sky_','abcde'),factory:L_('bld_ind_','abcdefghij'),warehouse:L_('bld_ind_','klmnopqrst'),power:['bld_ind_c','bld_ind_e'],hospital:['bld_com_m','bld_com_n'],police:['bld_com_h','bld_com_i'],fire:['bld_ind_k','bld_ind_l'],school:['bld_com_b','bld_com_c'],university:['bld_com_l','bld_com_k'],portwh:['bld_ind_p'],barracks:['bld_ind_q'],depot:['v3_radar'],hangar:['v3_hangar'],terminal:['v3_terminal'],atc:['v3_tower'],barracks:['v3_barracks','v3_hq']};
const SVC_BADGE={hospital:['#E5483F','cross'],police:['#2F64D6','shield'],fire:['#E0602A','flame'],school:['#E8A93A','book'],university:['#3E9A6E','book']};
function drawBldSprite(g,b,px,py){if(!SPR.ready)return false;const list=BLD_SPR[b.type];if(!list)return false;
  const id=list[Math.floor(hash(b.id,7)*list.length)];const m=SPR.man[id];if(!m)return false;const f=m.f[b.v%m.f.length];const im=SPR.img[f[0]];if(!im||!im.naturalWidth)return false;
  g.drawImage(im,px-f[3]/4,py-f[4]/4,f[1]/4,f[2]/4);b._spr=f;drawProps(g,b,px,py);const bd=SVC_BADGE[b.type];if(bd)drawBadge(g,px,py-f[4]/4-7,bd[0],bd[1]);return true}
function drawBadge(g,x,y,col,ic){g.save();g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.arc(x+.6,y+.8,5.4,0,7);g.fill();g.fillStyle='#FFFFFF';g.beginPath();g.arc(x,y,5.4,0,7);g.fill();g.fillStyle=col;g.beginPath();g.arc(x,y,4.4,0,7);g.fill();g.fillStyle='#FFFFFF';g.strokeStyle='#FFFFFF';g.lineWidth=.9;
  if(ic==='cross'){g.fillRect(x-.8,y-2.8,1.6,5.6);g.fillRect(x-2.8,y-.8,5.6,1.6)}
  else if(ic==='shield'){g.beginPath();g.moveTo(x,y-2.8);g.lineTo(x+2.4,y-1.8);g.lineTo(x+2,y+1);g.lineTo(x,y+2.8);g.lineTo(x-2,y+1);g.lineTo(x-2.4,y-1.8);g.closePath();g.fill()}
  else if(ic==='flame'){g.beginPath();g.moveTo(x,y-3);g.quadraticCurveTo(x+3,y,x+1.6,y+2.6);g.lineTo(x-1.6,y+2.6);g.quadraticCurveTo(x-3,y,x,y-3);g.fill()}
  else{g.fillRect(x-2.6,y-1.8,2.3,3.8);g.fillRect(x+.3,y-1.8,2.3,3.8)}g.restore()}
function nightSprLights(g,b,px,py,la){const f=b._spr;const w=f[1]/4,h=f[4]/4;g.fillStyle='rgba(255,205,120,'+(.8*la)+')';const n=Math.min(26,Math.max(3,(w*h/120)|0));
  for(let k=0;k<n;k++){if(hash(b.id*13+k,(now/200)|0)>.6)continue;const u=hash(b.id,k*3+1),v=hash(k*5+2,b.id);g.fillRect(px-w*.42+u*w*.84,py-h*.92+v*h*.78,1.5,1.5)}}

function pk(a,b){return SPR.man&&SPR.man[a]?a:b}

// ---------- yaya sprite'ları (Kenney Mini Characters, CC0) ----------
const PED_IDS=['ped_ma','ped_fa','ped_mb','ped_fb','ped_mc','ped_fc','ped_md','ped_fd','ped_me','ped_fe','ped_mf','ped_ff'];
function drawPedSprite(g,m,t,px,py){return false;if(!SPR.ready||UNIF[m.role])return false;const id=PED_IDS[m.id%12];if(!SPR.man[id])return false;
  const bob=Math.abs(Math.sin(t*8+m.id))*.7;return!!drawSprite(g,id,px,py-bob,(m.fx??1),(m.fy??0))}

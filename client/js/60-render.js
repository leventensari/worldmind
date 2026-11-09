// ============================================================
// Çizim motoru
//  - Zemin: 16×16 karoluk parçalar, yakınlaştırmaya göre 1×/2×/3×/4× çözünürlükte pişirilir
//  - Canlı nesneler (bina, ağaç, araç, insan): derinliğe göre sıralanıp her karede çizilir
//  - Uzak görünüm: binalar zeminle birlikte pişirilir (performans)
// ============================================================
const cv=document.getElementById('world'),ctx=cv.getContext('2d');
let VW=0,VH=0,DPR=1,frameNo=0;
function resize(){DPR=Math.min(2.5,window.devicePixelRatio||1);VW=innerWidth;VH=innerHeight;cv.width=Math.round(VW*DPR);cv.height=Math.round(VH*DPR)}
const cam={x:0,y:0,z:1.6,follow:null};
const CS=16,CWn=Math.ceil(W/CS),CHn=Math.ceil(H/CS);
const chunkVer=new Uint32Array(CWn*CHn);const chunkCache=new Map();let chunkBytes=0;const CHUNK_BUDGET=230*1024*1024;
let miniDirty=true;
function markDirty(x,y){if(!inb(x,y))return;const cx=(x/CS)|0,cy=(y/CS)|0;chunkVer[cx+cy*CWn]++;
  // kenardaki karolar komşu parçaya taşabilir (sınır çizgisi, dağ)
  const lx=x%CS,ly=y%CS;if(lx===0&&cx>0)chunkVer[cx-1+cy*CWn]++;if(ly===0&&cy>0)chunkVer[cx+(cy-1)*CWn]++;if(lx===CS-1&&cx<CWn-1)chunkVer[cx+1+cy*CWn]++;if(ly===CS-1&&cy<CHn-1)chunkVer[cx+(cy+1)*CWn]++;miniDirty=true}
function markAllDirty(){for(let i=0;i<chunkVer.length;i++)chunkVer[i]++;miniDirty=true}
function chunkGeom(cx,cy,pad){const x0=cx*CS,y0=cy*CS;return{x0,y0,ox:(x0-y0-CS)*HW,oy:(x0+y0)*HH-pad,w:CS*2*HW,h:CS*2*HH+pad}}
function getChunk(mode,k,cx,cy,budgetLeft){
  const key=mode+'|'+k+'|'+cx+'|'+cy;const ver=chunkVer[cx+cy*CWn];let c=chunkCache.get(key);
  if(c&&c.ver===ver){c.used=frameNo;return c}
  if(budgetLeft<=0)return c||null; // bu karede yeniden pişirme bütçesi doldu; eskisi varsa onu kullan
  const pad=mode==='lo'?96:40;const gm=chunkGeom(cx,cy,pad);
  if(!c){const cvs=document.createElement('canvas');cvs.width=gm.w*k;cvs.height=gm.h*k;c={...gm,cv:cvs,k,mode,bytes:cvs.width*cvs.height*4};chunkCache.set(key,c);chunkBytes+=c.bytes;evictChunks()}
  renderChunk(c);c.ver=ver;c.used=frameNo;c.fresh=true;return c}
function evictChunks(){if(chunkBytes<=CHUNK_BUDGET)return;const arr=[...chunkCache.entries()].sort((a,b)=>a[1].used-b[1].used);
  for(const[k,v]of arr){if(chunkBytes<=CHUNK_BUDGET*.8)break;if(v.used>=frameNo-2)continue;chunkCache.delete(k);chunkBytes-=v.bytes}}
function renderChunk(c){const g=c.cv.getContext('2d');g._lo=c.mode==='lo';g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,c.cv.width,c.cv.height);g.setTransform(c.k,0,0,c.k,0,0);g.lineJoin='round';
  const Lt=[];for(let s=0;s<CS*2-1;s++)for(let dx=0;dx<CS;dx++){const dy=s-dx;if(dy<0||dy>=CS)continue;const x=c.x0+dx,y=c.y0+dy;if(!inb(x,y))continue;Lt.push(x,y,(x-y)*HW-c.ox,(x+y)*HH+HH-c.oy)}
  for(let q=0;q<Lt.length;q+=4)paintGround(g,Lt[q],Lt[q+1],Lt[q+2],Lt[q+3]);
  for(let q=0;q<Lt.length;q+=4)paintBorders(g,Lt[q],Lt[q+1],Lt[q+2],Lt[q+3]);
  for(let q=0;q<Lt.length;q+=4){const x=Lt[q],y=Lt[q+1],px=Lt[q+2],py=Lt[q+3],i=idx(x,y);
    if(terr[i]===T.MOUNT)paintMountain(g,x,y,px,py);
    if(c.mode==='lo'){if(treeKind[i]&&bldAt[i]<0)for(const[ox,oy,v]of treeOffsets(x,y)){g.save();g.translate(px+(ox-oy)*HW,py+(ox+oy)*HH);drawTreeArt(g,treeKind[i],v);g.restore()}
      const bi=bldAt[i];if(bi>=0){const b=buildings[bi];b._pr=b.type==='construction'?clamp(1-(b.doneAt-now)/(6*1440),.1,.95):0;if(!drawBldSprite(g,b,px,py)){g.save();g.translate(px,py);drawBuildingArt(g,b);g.restore()}}}}
}
function treeOffsets(x,y){const t=terr[idx(x,y)];const h=hash(x,y);
  if(t===T.FOREST)return[[-.22+h*.1,-.2,(h*7)|0],[.22,-.05+h*.1,(h*13)|0],[-.05,.24-h*.1,(h*5)|0]];
  return[[(h-.5)*.4,(hash(y,x)-.5)*.4,(h*9)|0]]}

// ---------- Araç ve gemi çizimi: ızgara uzayında prizma ----------
const W2=(gx,gy)=>[(gx-gy)*HW,(gx+gy)*HH];
function extrude(g,pts,z0,z1,col,top){ // pts: dünya koordinatlı köşeler (saat yönü / tersi fark etmez)
  const n=pts.length/2;let area=0;for(let i=0;i<n;i++){const j=(i+1)%n;area+=pts[i*2]*pts[j*2+1]-pts[j*2]*pts[i*2+1]}const sgn=area>0?1:-1;
  for(let i=0;i<n;i++){const j=(i+1)%n;const ax=pts[i*2],ay=pts[i*2+1],bx=pts[j*2],by=pts[j*2+1];const nx=(by-ay)*sgn,ny=-(bx-ax)*sgn;if(ny<=0)continue;
    const lit=nx<0?-.05:-.32;g.fillStyle=shade(col,lit);poly(g,[ax,ay-z0,bx,by-z0,bx,by-z1,ax,ay-z1])}
  g.fillStyle=top||shade(col,.12);const tp=[];for(let i=0;i<n;i++)tp.push(pts[i*2],pts[i*2+1]-z1);poly(g,tp)}
function rectPts(gx,gy,fx,fy,L_,W_,off=0){const rx=-fy,ry=fx;const c=[gx+fx*off,gy+fy*off];const o=[];
  for(const[a,b]of[[1,1],[1,-1],[-1,-1],[-1,1]]){const px=c[0]+fx*L_/2*a+rx*W_/2*b,py=c[1]+fy*L_/2*a+ry*W_/2*b;const w=W2(px,py);o.push(w[0],w[1])}return o}
const VEH={car:{L:.34,W:.18,H:2.4,cab:1.8},taxi:{L:.34,W:.18,H:2.4,cab:1.8,col:'#F2C230'},van:{L:.42,W:.2,H:4,cab:0},bus:{L:.82,W:.22,H:5,cab:0},
  police:{L:.36,W:.19,H:2.4,cab:1.8,col:'#F4F6F8'},fire:{L:.62,W:.22,H:4.6,cab:0,col:'#C62828'},amb:{L:.46,W:.21,H:4.4,cab:0,col:'#FAFAFA'},army:{L:.56,W:.22,H:4.6,cab:0,col:'#55663A'}};
function drawVehicleProc(g,m,t){
  const kind=m.veh||(m.amb?(m.bus?'bus':m.kind==='taxi'?'taxi':m.kind==='van'?'van':'car'):(m.role==='farmer'?'van':'car'));const V=VEH[kind]||VEH.car;
  const fx=m.fx||1,fy=m.fy||0;const col=V.col||(kind==='bus'?(['#2E7DD1','#D9A12B','#3BA55C'][m.c%3]):m.col||'#999');
  const base=rectPts(m.gx,m.gy,fx,fy,V.L,V.W);
  g.fillStyle='rgba(0,0,0,.28)';const sh=base.map((v,i)=>v+(i%2?1.2:1.6));poly(g,sh);
  extrude(g,base,.6,V.H,col);
  if(V.cab){const cab=rectPts(m.gx,m.gy,fx,fy,V.L*.5,V.W*.86,-V.L*.06);extrude(g,cab,V.H,V.H+V.cab,'#2C3A46',shade(col,.08))}
  if(kind==='bus'||kind==='amb'||kind==='van'||kind==='fire'){const w=rectPts(m.gx,m.gy,fx,fy,V.L*.96,V.W*1.01);g.fillStyle='rgba(40,60,75,.75)';const z=V.H-1.4;
    for(let i=0;i<4;i++){const j=(i+1)%4;const ax=w[i*2],ay=w[i*2+1],bx=w[j*2],by=w[j*2+1];if((bx-ax)*0+1&&Math.abs(bx-ax)>3){poly(g,[ax,ay-z,bx,by-z,bx,by-z-1,ax,ay-z-1])}}}
  if(kind==='taxi'){const p=W2(m.gx,m.gy);g.fillStyle='#222';g.fillRect(p[0]-1,p[1]-V.H-V.cab-1,2,1)}
  if(kind==='amb'){const p=W2(m.gx,m.gy);g.fillStyle='#D32F2F';g.fillRect(p[0]-1.5,p[1]-V.H-.8,3,1)}
  if(kind==='fire'){const a=W2(m.gx-fx*.25,m.gy-fy*.25),b=W2(m.gx+fx*.2,m.gy+fy*.2);g.strokeStyle='#D8D8D8';g.lineWidth=.8;g.beginPath();g.moveTo(a[0],a[1]-V.H-.6);g.lineTo(b[0],b[1]-V.H-.6);g.stroke()}
  if(kind==='police'){const p=W2(m.gx,m.gy);g.fillStyle='#1F4E9C';const s=rectPts(m.gx,m.gy,fx,fy,V.L*1.01,V.W*1.02);g.strokeStyle='#1F4E9C';g.lineWidth=.6;g.beginPath();g.moveTo(s[0],s[1]-1.4);g.lineTo(s[2],s[3]-1.4);g.lineTo(s[4],s[5]-1.4);g.stroke()}
  if(m.veh==='police'||m.veh==='fire'||m.veh==='amb'){const p=W2(m.gx,m.gy);const on=((t*6+m.id)|0)%2;const top=V.H+(V.cab||0)+.2;
    g.fillStyle=on?(m.veh==='police'?'#3D7BFF':'#FF2B2B'):'#FFFFFF';g.fillRect(p[0]-1.4,p[1]-top-1.2,2.8,1.2);
    g.globalCompositeOperation='lighter';g.fillStyle=on?'rgba(70,120,255,.35)':'rgba(255,60,60,.35)';g.beginPath();g.arc(p[0],p[1]-top,5,0,7);g.fill();g.globalCompositeOperation='source-over'}
  if(m.redLight&&m.spd<.05){const r=W2(m.gx-fx*V.L*.5,m.gy-fy*V.L*.5);g.fillStyle='rgba(255,40,40,.9)';g.fillRect(r[0]-.6,r[1]-1.8,1.2,.8)}
}
const ROLE_COL={worker:'#3E7CB1',merchant:'#C77D2E',student:'#E8C547',doctor:'#F4F4F4',police:'#1F4E9C',fire:'#C0392B',soldier:'#556B2F',farmer:'#8D6E3F',thief:'#262626',retiree:'#9B8BB0'};
function drawPersonOld(g,m,t,px,py){const col=ROLE_COL[m.role]||'#888';const step=Math.sin(t*9+m.id)*.9;
  g.fillStyle='rgba(0,0,0,.22)';g.beginPath();g.ellipse(px+.6,py+.2,1.4,.5,0,0,7);g.fill();
  g.strokeStyle='#2A2F36';g.lineWidth=.7;g.beginPath();g.moveTo(px-.4,py-2.6);g.lineTo(px-.4+step*.5,py);g.moveTo(px+.4,py-2.6);g.lineTo(px+.4-step*.5,py);g.stroke();
  g.fillStyle=col;g.fillRect(px-1.1,py-5.2,2.2,2.8);g.fillStyle=m.hs===2?'#A5D06A':'#E3B48F';g.beginPath();g.arc(px,py-6.1,.95,0,7);g.fill();
  if(m.role==='thief'&&m.wanted){g.fillStyle='#F0584C';g.fillRect(px-.5,py-9,1,1.6)}}
function drawSoldierGroup(g,m,t){const p=W2(m.gx,m.gy);const j=(hash(m.id,3)-.5)*22,k=(hash(3,m.id)-.5)*12;const x=p[0]+j,y=p[1]+k;
  g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.ellipse(x+.5,y+.2,1.4,.5,0,0,7);g.fill();g.fillStyle='#4B5A2A';g.fillRect(x-1,y-5,2,5);g.fillStyle='#5E6E36';g.beginPath();g.arc(x,y-6,1.1,0,7);g.fill();
  g.strokeStyle='#222';g.lineWidth=.6;g.beginPath();g.moveTo(x,y-4);g.lineTo(x+3,y-5.5);g.stroke();if(R()<.008)particles.push({x:x+3,y:y-5.5,vx:.4,vy:-.1,life:.5,dec:.08,kind:'flash',s:1.2})}
const SHIP={cargo:{L:1.5,W:.36,H:3,col:'#7A2E24',deck:'#5E6A72'},tanker:{L:1.8,W:.42,H:3,col:'#2F3E4B',deck:'#8A3A2A'},ferry:{L:1.1,W:.34,H:3.4,col:'#F2F2F2',deck:'#DADDE0'},fishing:{L:.5,W:.18,H:1.8,col:'#3A6EA5',deck:'#C9B48A'}};
function drawShipProc(g,s,t){const S_=SHIP[s.kind]||SHIP.cargo;const[a0,b0]=s.route[Math.min(s.seg,s.route.length-2)],[a1,b1]=s.route[Math.min(s.seg+1,s.route.length-1)];
  let fx=a1-a0,fy=b1-b0;const l=Math.hypot(fx,fy)||1;fx/=l;fy/=l;s.fx=lerp(s.fx??fx,fx,.08);s.fy=lerp(s.fy??fy,fy,.08);const nl=Math.hypot(s.fx,s.fy)||1;fx=s.fx/nl;fy=s.fy/nl;
  // dümen suyu
  if(s.wake.length>1){g.lineCap='round';for(let k=1;k<s.wake.length;k++){const a=s.wake[k-1],b=s.wake[k];g.strokeStyle=`rgba(235,248,255,${.5*(1-k/s.wake.length)})`;g.lineWidth=(S_.W*12)*(1+k*.18);g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke()}g.lineCap='butt'}
  const rx=-fy,ry=fx;const P=(f,r)=>W2(s.gx+fx*f+rx*r,s.gy+fy*f+ry*r);const Lh=S_.L/2,Wh=S_.W/2;
  const hull=[P(Lh,0),P(Lh-.22,Wh),P(-Lh,Wh*.9),P(-Lh,-Wh*.9),P(Lh-.22,-Wh)].flat();
  g.fillStyle='rgba(10,30,50,.3)';poly(g,hull.map((v,i)=>v+(i%2?2:1)));
  extrude(g,hull,-.5,S_.H,S_.col,S_.deck);
  if(s.kind==='cargo'){const cs=['#C0392B','#2E86C1','#E67E22','#27AE60','#D4AC0D','#7D3C98'];for(let k=0;k<4;k++){const f0=-Lh+.38+k*.22;const p=rectPts(s.gx+fx*f0,s.gy+fy*f0,fx,fy,.18,S_.W*.78);extrude(g,p,S_.H,S_.H+2.6,cs[(k+(s.cargo.length*3))%6])}}
  if(s.kind==='tanker'){g.strokeStyle='#C9A646';g.lineWidth=.6;const a=P(-Lh+.4,0),b=P(Lh-.3,0);g.beginPath();g.moveTo(a[0],a[1]-S_.H-.3);g.lineTo(b[0],b[1]-S_.H-.3);g.stroke()}
  const br=rectPts(s.gx-fx*(Lh-.16),s.gy-fy*(Lh-.16),fx,fy,s.kind==='fishing'?.14:.22,S_.W*.8);extrude(g,br,S_.H,S_.H+(s.kind==='ferry'?4:s.kind==='fishing'?2:5.5),s.kind==='ferry'?'#FFFFFF':'#ECEFF1');
  if(s.kind==='ferry'){const d=rectPts(s.gx,s.gy,fx,fy,S_.L*.6,S_.W*.8);extrude(g,d,S_.H,S_.H+3,'#FFFFFF');g.fillStyle='rgba(40,70,100,.8)';for(let k=0;k<5;k++){const p=P(-.25+k*.13,Wh*.82);g.fillRect(p[0]-.6,p[1]-S_.H-2.4,1.2,.9)}}
  if(s.kind==='fishing'){const p=P(.05,0);g.strokeStyle='#5A4A3A';g.lineWidth=.5;g.beginPath();g.moveTo(p[0],p[1]-S_.H);g.lineTo(p[0],p[1]-S_.H-6);g.lineTo(p[0]+4,p[1]-S_.H-1);g.stroke()}
}
function drawPlane(g,x,y,ang,s,col,tail){g.save();g.translate(x,y);g.rotate(ang);g.scale(s,s);
  g.fillStyle=col;g.beginPath();g.moveTo(11,0);g.quadraticCurveTo(9,-1.8,4,-1.8);g.lineTo(-9,-1.2);g.lineTo(-10.5,0);g.lineTo(-9,1.2);g.lineTo(4,1.8);g.quadraticCurveTo(9,1.8,11,0);g.fill();
  g.beginPath();g.moveTo(2,-1.4);g.lineTo(-3.5,-9.5);g.lineTo(-5.5,-9.5);g.lineTo(-2.6,-1.3);g.closePath();g.fill();g.beginPath();g.moveTo(2,1.4);g.lineTo(-3.5,9.5);g.lineTo(-5.5,9.5);g.lineTo(-2.6,1.3);g.closePath();g.fill();
  g.beginPath();g.moveTo(-7.5,-1);g.lineTo(-9.6,-4);g.lineTo(-10.6,-4);g.lineTo(-9.8,-.8);g.closePath();g.fill();g.beginPath();g.moveTo(-7.5,1);g.lineTo(-9.6,4);g.lineTo(-10.6,4);g.lineTo(-9.8,.8);g.closePath();g.fill();
  if(tail){g.fillStyle=tail;g.fillRect(-10.4,-1,3,2);g.fillStyle='rgba(60,90,120,.8)';g.fillRect(8,-.9,1.6,1.8)}g.restore()}
function flames(g,x,y,f,t){const n=3+Math.round(f*2);for(let k=0;k<n;k++){const ph=t*9+k*1.7;const hh=(5+f*4)*(.7+.3*Math.sin(ph));const ox=(k-n/2)*2.4;
  g.fillStyle=k%2?'rgba(255,170,40,.92)':'rgba(255,90,30,.88)';g.beginPath();g.moveTo(x+ox-2.2,y);g.quadraticCurveTo(x+ox+Math.sin(ph)*1.5,y-hh*1.2,x+ox+2.2,y);g.fill();
  g.fillStyle='rgba(255,235,140,.9)';g.beginPath();g.moveTo(x+ox-1,y);g.quadraticCurveTo(x+ox,y-hh*.6,x+ox+1,y);g.fill()}}

// ---------- Kare çizimi ----------
const w2s=(wx,wy)=>[(wx-cam.x)*cam.z+VW/2,(wy-cam.y)*cam.z+VH/2];
const s2w=(sx,sy)=>[(sx-VW/2)/cam.z+cam.x,(sy-VH/2)/cam.z+cam.y];
function s2tile(sx,sy){const[wx,wy]=s2w(sx,sy);const u=wx/HW,v=wy/HH;return[Math.floor((u+v)/2),Math.floor((v-u)/2)]}
const LAYERS={pol:false,night:true,labels:true,weather:true,npc:true,clouds:true};
let selAgent=null,selBuilding=null,selNation=0,rainDrops=[],lightning=0;
const clouds=[];function initClouds(){clouds.length=0;for(let k=0;k<9;k++)clouds.push({x:rnd(-4000,4000),y:rnd(0,4000),r:rnd(180,420),sx:rnd(.7,1.3)})}
function nightAlpha(){const h=hourOf();if(h>=7&&h<17.5)return 0;if(h>=17.5&&h<20)return(h-17.5)/2.5*.5;if(h>=5&&h<7)return(7-h)/2*.5;return .5}
let glowSprite=null;function getGlow(){if(glowSprite)return glowSprite;const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,214,140,.9)');gr.addColorStop(.35,'rgba(255,190,110,.35)');gr.addColorStop(1,'rgba(255,170,90,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return glowSprite=c}
let drawList=[];
function render(){
  frameNo++;const t=performance.now()/1000;
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.fillStyle='#17486F';ctx.fillRect(0,0,VW,VH);
  if(cam.follow&&cam.follow.alive!==false){const p=W2(cam.follow.gx,cam.follow.gy);cam.x=lerp(cam.x,p[0],.12);cam.y=lerp(cam.y,p[1],.12)}
  let shx=0,shy=0;if(shake>.3){shx=rnd(-shake,shake);shy=rnd(-shake,shake);shake*=.92}
  ctx.save();ctx.translate(VW/2+shx,VH/2+shy);ctx.scale(cam.z,cam.z);ctx.translate(-cam.x,-cam.y);
  const live=cam.z>=1.05;const zd=cam.z*DPR;const k=live?(zd<=1.25?1:zd<=2.3?2:zd<=3.4?3:4):1;const mode=live?'g':'lo';
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='low';
  const vx0=cam.x-VW/2/cam.z,vx1=cam.x+VW/2/cam.z,vy0=cam.y-VH/2/cam.z,vy1=cam.y+VH/2/cam.z;
  const inView=(wx,wy,m=30)=>wx>vx0-m&&wx<vx1+m&&wy>vy0-m&&wy<vy1+m+60;
  // zemin parçaları
  const vis=[];for(let cy=0;cy<CHn;cy++)for(let cx=0;cx<CWn;cx++){const gm=chunkGeom(cx,cy,mode==='lo'?96:40);if(gm.ox>vx1||gm.ox+gm.w<vx0||gm.oy>vy1||gm.oy+gm.h<vy0)continue;vis.push([cx,cy])}
  vis.sort((a,b)=>(a[0]+a[1])-(b[0]+b[1])||a[0]-b[0]);
  let budget=frameNo<3?99:4;
  for(const[cx,cy]of vis){let c=getChunk(mode,k,cx,cy,budget);if(c&&c.fresh){budget--;c.fresh=false}
    if(!c){c=chunkCache.get(mode+'|'+(k>1?k-1:1)+'|'+cx+'|'+cy)||chunkCache.get('g|1|'+cx+'|'+cy)||chunkCache.get('lo|1|'+cx+'|'+cy);if(!c)continue}
    ctx.drawImage(c.cv,c.ox,c.oy,c.w,c.h)}
  // tile aralığı
  const[ax,ay]=s2tile(0,0),[bx,by]=s2tile(VW,VH),[cx_,cy_]=s2tile(VW,0),[dx_,dy_]=s2tile(0,VH);
  const X0=clamp(Math.min(ax,dx_)-2,0,W-1),X1=clamp(Math.max(bx,cx_)+3,0,W-1),Y0=clamp(Math.min(ay,cy_)-2,0,H-1),Y1=clamp(Math.max(by,dy_)+3,0,H-1);
  // karo katmanları: su parıltısı, sel, siyasi harita, orman yangını
  for(let y=Y0;y<=Y1;y++)for(let x=X0;x<=X1;x++){const i=idx(x,y);const px=(x-y)*HW,py=(x+y)*HH+HH;if(px<vx0-20||px>vx1+20||py<vy0-20||py>vy1+20)continue;
    if(live&&seaMask[i]&&((x*3+y)&3)===0){const h=hash(x,y);const a=.18*(.5+.5*Math.sin(t*1.6+h*40));ctx.fillStyle=`rgba(255,255,255,${a})`;ctx.fillRect(px-4+h*6,py-1+hash(y,x)*3,3.5,.6)}
    if(flood[i]>0){ctx.fillStyle='rgba(70,140,190,.6)';dia(ctx,px,py,HW+.5,HH+.3);ctx.fill()}
    if(LAYERS.pol){const o=owner[i];if(o>=0&&!isWater(terr[i])){ctx.fillStyle=NATIONS[o].color;ctx.globalAlpha=.26;dia(ctx,px,py,HW+.5,HH+.3);ctx.fill();ctx.globalAlpha=1}}
    if(forestFire[i]>0){flames(ctx,px,py-2,1+forestFire[i]*.4,t+i);if(R()<.04)particles.push({x:px,y:py-8,vx:rnd(-.2,.2),vy:-.5,life:1,dec:.008,kind:'smoke',s:3})}}
  // gemiler (su üstünde, nesnelerden önce)
  for(const s of ships){if(s.hidden)continue;const p=W2(s.gx,s.gy);if(!inView(p[0],p[1],60))continue;if(live)shipQ.push(s);else{ctx.fillStyle=s.kind==='ferry'?'#FFF':'#5B2A22';ctx.fillRect(p[0]-3,p[1]-1.5,6,3)}}
  if(!live)// uzak görünümde basit köprü
  for(let y=Y0;y<=Y1;y++)for(let x=X0;x<=X1;x++){const i=idx(x,y);if(terr[i]!==T.BRIDGE||!seaMask[i])continue;const px=(x-y)*HW,py=(x+y)*HH+HH;if(px<vx0-30||px>vx1+30||py<vy0-30||py>vy1+40)continue;
    ctx.fillStyle='#4E545A';dia(ctx,px,py-4,HW+.5,HH+.3);ctx.fill();ctx._overlay=true;paintRoad(ctx,x,y,px,py-8,T.ROAD);ctx._overlay=false;
    const con=roadCon(x,y);ctx.strokeStyle='#E1E4E7';ctx.lineWidth=1;ctx.beginPath();if(!con[0]){ctx.moveTo(px+HW,py-9);ctx.lineTo(px,py+HH-9)}if(!con[1]){ctx.moveTo(px-HW,py-9);ctx.lineTo(px,py-HH-9)}if(!con[2]){ctx.moveTo(px-HW,py-9);ctx.lineTo(px,py+HH-9)}if(!con[3]){ctx.moveTo(px+HW,py-9);ctx.lineTo(px,py-HH-9)}ctx.stroke()}
  // canlı nesneler: derinlik sıralı
  seasonOverlay(ctx);drawList.length=0;if(live)for(const s of shipQ)drawList.push({d:s.gx+s.gy,k:8,s});shipQ.length=0;
  if(live){const S=zd<=1.6?2:zd<=3?3:4;
    for(let y=Y0;y<=Y1;y++)for(let x=X0;x<=X1;x++){const i=idx(x,y);const px=(x-y)*HW,py=(x+y)*HH+HH;if(px<vx0-30||px>vx1+30||py<vy0-20||py>vy1+120)continue;
      if(terr[i]===T.BRIDGE&&seaMask[i])drawList.push({d:x+y+1.08,k:7,x,y,px,py});const bi=bldAt[i];if(bi>=0){drawList.push({d:x+y+1,k:1,b:buildings[bi],px,py,S});continue}
      if(treeKind[i])for(const[ox,oy,v]of treeOffsets(x,y))drawList.push({d:x+y+1+ox+oy,k:2,kind:treeKind[i],v,px:px+(ox-oy)*HW,py:py+(ox+oy)*HH,S});
      if(isInter[i]&&cam.z>=1.8)drawList.push({d:x+y+1.6,k:5,i,px,py});if(decor[i]===1)drawList.push({d:x+y+1,k:6,px,py});if(decor[i]===2)drawList.push({d:x+y+1,k:9,px,py})}
    if(LAYERS.npc){for(const a of agents){if(!a.alive||!a.vis)continue;const p=W2(a.gx,a.gy);if(!inView(p[0],p[1]))continue;drawList.push({d:a.gx+a.gy+(terr[a.tile]===T.BRIDGE?.2:0),k:3,m:a,px:p[0],py:p[1]})}
      for(const a of ambient){if(!a.on||!a.path)continue;const p=W2(a.gx,a.gy);if(!inView(p[0],p[1]))continue;drawList.push({d:a.gx+a.gy,k:3,m:a,px:p[0],py:p[1]})}}
    drawList.sort((a,b)=>a.d-b.d);
    for(const o of drawList){
      if(o.k===1){const b=o.b;if(b.type==='construction')b._pr=clamp(1-(b.doneAt-now)/(6*1440),.1,.95);if(!drawBldSprite(ctx,b,o.px,o.py)){const sp=buildingSprite(b,o.S);ctx.drawImage(sp.cv,o.px-sp.ax,o.py-sp.ay,sp.wu,sp.hu)}
        if(b.fire>0){flames(ctx,o.px,o.py-b.h*.6,b.fire,t+b.id);if(R()<.3)particles.push({x:o.px+rnd(-4,4),y:o.py-b.h-4,vx:rnd(-.2,.3),vy:rnd(-.9,-.4),life:1,dec:.006,kind:'smoke',s:rnd(3,6)})}}
      else if(o.k===2){const sp=treeSprite(o.kind,o.v,o.S);ctx.drawImage(sp.cv,o.px-sp.ax,o.py-sp.ay,sp.wu,sp.hu)}
      else if(o.k===3){const m=o.m;m._lift=bridgeH(m.tile);o.py-=m._lift;if(m.state==='FRONT'){if(!drawArmyUnit(ctx,m,t))drawSoldierGroup(ctx,m,t)}else if(m.mode==='walk'&&!m.veh)drawPerson(ctx,m,t,o.px,o.py);else drawVehicle(ctx,m,t);
        if(m.state==='ONSITE'&&m.veh==='fire'&&m.inc&&m.inc.b!==undefined){const b=buildings[m.inc.b];if(b&&b.fire>0){const bp=W2(b.x+.5,b.y+.5);ctx.strokeStyle='rgba(170,215,255,.7)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(o.px,o.py-5);ctx.quadraticCurveTo((o.px+bp[0])/2,Math.min(o.py,bp[1])-16,bp[0]+Math.sin(t*8)*2,bp[1]-b.h*.6);ctx.stroke()}}}
      else if(o.k===5)drawTrafficLight(ctx,o.i,o.px,o.py);else if(o.k===9){const s=sprFrame('airliner',-.707,.707);if(s){const f=s.f,k=.42;ctx.drawImage(s.im,o.px-f[3]/4*k,o.py-f[4]/4*k,f[1]/4*k,f[2]/4*k)}else paintParkedPlane(ctx,o.px,o.py)}else if(o.k===7)drawBridgeTile(ctx,o.x,o.y,o.px,o.py);else if(o.k===8)drawShip(ctx,o.s,t);else if(o.k===6){if(!(SPR.ready&&drawSprite(ctx,[pk('mil_apc','apc'),pk('mil_jeep','armytruck')][(o.px|0)%2],o.px,o.py,.707,.707)))paintTank(ctx,o.px,o.py)}}
  }else if(LAYERS.npc){ // uzak görünüm: araçlar nokta
    for(const a of ambient){if(!a.on||!a.path||a.mode==='walk')continue;const p=W2(a.gx,a.gy);if(!inView(p[0],p[1]))continue;ctx.fillStyle=a.col;ctx.fillRect(p[0]-1.2,p[1]-1.6,2.4,1.6)}
    for(const a of agents){if(!a.alive||!a.vis)continue;const p=W2(a.gx,a.gy);if(!inView(p[0],p[1]))continue;ctx.fillStyle=a.veh==='army'||a.state==='FRONT'?'#4B5A2A':a.veh?'#FFFFFF':a.col;ctx.fillRect(p[0]-1.2,p[1]-1.6,2.4,1.6)}}
  // fabrika dumanı
  if(frameNo%10===0)for(let y=Y0;y<=Y1;y+=1)for(let x=X0;x<=X1;x++){const bi=bldAt[idx(x,y)];if(bi<0)continue;const b=buildings[bi];if(!BT[b.type].smoke||R()>.35)continue;const p=W2(x+.5,y+.5);
    particles.push({x:p[0]+(b.type==='factory'?HW*BT.factory.s*.45:5),y:p[1]-b.h-(b.type==='factory'?16:4),vx:rnd(.05,.3),vy:rnd(-.5,-.25),life:1,dec:.007,kind:'steam',s:rnd(2,3.5)})}
  for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.life-=p.dec;if(p.kind==='smoke'||p.kind==='steam'){p.s+=.04;p.vy*=.995}if(!inView(p.x,p.y))continue;const a=Math.max(0,p.life);
    ctx.fillStyle=p.kind==='flash'?`rgba(255,${150+a*100|0},60,${a})`:p.kind==='smoke'?`rgba(60,60,60,${a*.5})`:p.kind==='dust'?`rgba(160,140,110,${a*.55})`:`rgba(232,234,238,${a*.32})`;drawParticle(ctx,p,a)}
  particles=particles.filter(p=>p.life>0);if(particles.length>1500)particles.splice(0,particles.length-1500);
  // bulut gölgeleri
  if(LAYERS.clouds&&cam.z<3){for(const c of clouds){c.x+=.06*c.sx;if(c.x>gwx(W,0)+800)c.x=gwx(0,H)-800;const gr=ctx.createRadialGradient(c.x,c.y,c.r*.2,c.x,c.y,c.r);gr.addColorStop(0,'rgba(10,25,35,.12)');gr.addColorStop(1,'rgba(10,25,35,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.ellipse(c.x,c.y,c.r*1.6,c.r,0,0,7);ctx.fill()}}
  // gece
  const na=LAYERS.night?nightAlpha():0;
  if(na>0){ctx.fillStyle=`rgba(10,18,48,${na})`;ctx.fillRect(vx0-60,vy0-200,vx1-vx0+120,vy1-vy0+400);
    ctx.globalCompositeOperation='lighter';const la=na/.5;const glow=getGlow();
    if(live){for(const o of drawList){if(o.k!==1)continue;const b=o.b;if(b._spr&&BLD_SPR[b.type]){nightSprLights(ctx,b,o.px,o.py,la);continue}if(!b._wp)b._wp=windowPoints(b);const wp=b._wp;if(!wp.length)continue;ctx.fillStyle=`rgba(255,205,120,${.85*la})`;
        for(let q=0;q<wp.length;q+=3)if(hash(b.id*7+q,b.id+((now/180)|0))<.6)ctx.fillRect(o.px+wp[q]-.8,o.py+wp[q+1]-1,1.6,1.6)}
      ctx.globalAlpha=.55*la;for(let y=Y0;y<=Y1;y++)for(let x=X0;x<=X1;x++){const i=idx(x,y);if(terr[i]!==T.ROAD||(x+y)%2||isInter[i])continue;const p=W2(x+.86,y+.86);if(!inView(p[0],p[1]))continue;ctx.drawImage(glow,p[0]-9,p[1]-9,18,18)}ctx.globalAlpha=1;
      for(const o of drawList){if(o.k!==3||o.m.mode==='walk')continue;const m=o.m;const f=W2(m.gx+(m.fx||0)*.5,m.gy+(m.fy||0)*.5);ctx.globalAlpha=.4*la;ctx.drawImage(glow,f[0]-7,f[1]-7,14,14);ctx.globalAlpha=1}}
    else{ctx.fillStyle=`rgba(255,200,120,${.5*la})`;for(let y=Y0;y<=Y1;y++)for(let x=X0;x<=X1;x++){const bi=bldAt[idx(x,y)];if(bi<0||BT[buildings[bi].type].cat==='none')continue;if(hash(x,y+((now/240)|0))>.55)continue;const p=W2(x+.5,y+.5);ctx.fillRect(p[0]-1,p[1]-buildings[bi].h*.5,2,2)}}
    for(const b of burning){const p=W2(b.x+.5,b.y+.5);ctx.fillStyle=`rgba(255,120,30,${.25*la})`;ctx.beginPath();ctx.arc(p[0],p[1]-b.h*.6,22,0,7);ctx.fill()}
    ctx.globalCompositeOperation='source-over'}
  // uçaklar
  for(const p of planes){const q=planePos(p);if(!inView(q.x,q.y,140))continue;const sc=p.kind==='strike'?.75:1.05;
    if(!drawAircraft(ctx,p,q)){drawPlane(ctx,q.x+q.alt*.25,q.y+q.alt*.1,q.ang,sc,'rgba(0,0,0,.2)');drawPlane(ctx,q.x,q.y-q.alt,q.ang,sc,p.kind==='strike'?'#8E979E':'#F4F6F8',p.col)}
    if(q.alt>45&&live)drawContrail(ctx,q,p)
    if(na>0&&(frameNo>>3)%2){ctx.fillStyle='#ff4040';ctx.fillRect(q.x-1,q.y-q.alt-1,2,2)}}
  drawWarOverlay(ctx,t);
  // etiketler
  if(LAYERS.labels){ctx.textAlign='center';for(const ct of cities){const p=W2(ct.x+.5,ct.y+.5);if(!inView(p[0],p[1],120))continue;
    const sz=(ct.capital?14:11)/Math.max(.5,cam.z);ctx.font=`600 ${sz}px "Chakra Petch",sans-serif`;const txt=ct.name;const tw=ctx.measureText(txt).width;const yy=p[1]-(live?95:40)/Math.max(.8,cam.z*.7);
    const ph=sz*1.55;ctx.fillStyle='rgba(9,22,32,.82)';ctx.beginPath();ctx.roundRect?ctx.roundRect(wxr(p[0]-tw/2-sz*.95),yy-ph*.72,tw+sz*1.6,ph,sz*.3):ctx.rect(p[0]-tw/2-sz*.95,yy-ph*.72,tw+sz*1.6,ph);ctx.fill();
    ctx.fillStyle=NATIONS[ct.c].color;ctx.fillRect(p[0]-tw/2-sz*.72,yy-ph*.46,sz*.5,sz*.5);ctx.fillStyle='#F2F6F8';ctx.fillText(txt,p[0]+sz*.25,yy);
    if(ct.capital||ct.colony){ctx.font=`500 ${sz*.68}px "IBM Plex Sans",sans-serif`;ctx.fillStyle='#BFD0DA';ctx.fillText(ct.capital?nations[ct.c].name+' başkenti':nations[ct.c].name+' kolonisi',p[0],yy+ph*.78)}}}
  // seçim
  if(selAgent&&selAgent.alive){const p=W2(selAgent.gx,selAgent.gy);ctx.strokeStyle='#E3B341';ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(p[0],p[1],8,4,0,0,7);ctx.stroke()}
  if(selBuilding){const p=W2(selBuilding.x+.5,selBuilding.y+.5);ctx.strokeStyle='#E3B341';ctx.lineWidth=1.5;dia(ctx,p[0],p[1],HW,HH);ctx.stroke()}
  ctx.restore();
  drawWeather(t);
}
const wxr=v=>v;
function drawTrafficLight(g,i,px,py){const gx=tx(i),gy=ty(i);const ph=lightGreen(i,true);
  for(const[u,v,axisX]of[[.42,-.42,true],[-.42,.42,true],[.42,.42,false],[-.42,-.42,false]]){const p=W2(gx+.5+u,gy+.5+v);g.strokeStyle='#3A3F44';g.lineWidth=.6;g.beginPath();g.moveTo(p[0],p[1]);g.lineTo(p[0],p[1]-7);g.stroke();
    const green=axisX?ph:!ph;g.fillStyle='#22272B';g.fillRect(p[0]-1,p[1]-9.5,2,3);g.fillStyle=green?'#3BE07A':'#FF4136';g.fillRect(p[0]-.6,p[1]-(green?7.4:9.1),1.2,1.2)}}
function drawWeather(t){
  if(!LAYERS.weather)return;const[cx,cy]=s2tile(VW/2,VH/2);let w='açık';if(inb(cx,cy)){const o=owner[idx(cx,cy)];if(o>=0)w=nations[o].weather}
  ctx.setTransform(DPR,0,0,DPR,0,0);
  if(w==='bulutlu'){ctx.fillStyle='rgba(140,150,160,.07)';ctx.fillRect(0,0,VW,VH)}
  if(w==='yağmurlu'||w==='fırtına'||w==='karlı'){const n=w==='fırtına'?260:w==='karlı'?170:150;while(rainDrops.length<n)rainDrops.push({x:rnd(0,VW),y:rnd(0,VH),v:rnd(.7,1.3)});rainDrops.length=n;
    ctx.fillStyle=w==='fırtına'?'rgba(20,30,45,.13)':'rgba(30,40,55,.06)';ctx.fillRect(0,0,VW,VH);
    if(w==='karlı'){ctx.fillStyle='rgba(255,255,255,.85)';for(const d of rainDrops){d.y+=1.2*d.v;d.x+=Math.sin(t+d.v*9)*.5;if(d.y>VH){d.y=-4;d.x=rnd(0,VW)}ctx.fillRect(d.x,d.y,1.8,1.8)}}
    else{ctx.strokeStyle='rgba(190,210,230,.4)';ctx.lineWidth=1;ctx.beginPath();for(const d of rainDrops){d.y+=11*d.v;d.x-=2.5*d.v;if(d.y>VH){d.y=-10;d.x=rnd(0,VW+80)}ctx.moveTo(d.x,d.y);ctx.lineTo(d.x+2.5,d.y-10)}ctx.stroke()}
    if(w==='fırtına'){if(R()<.004)lightning=1;if(lightning>0){ctx.fillStyle=`rgba(235,240,255,${lightning*.45})`;ctx.fillRect(0,0,VW,VH);lightning-=.08}}}
}
// ---------- Mini harita ----------
const mini=document.getElementById('mini'),mctx=mini.getContext('2d');let miniBase=null;
const MW=W+H,MH=(W+H)/2;mini.width=MW;mini.height=MH;
function buildMini(){miniBase=document.createElement('canvas');miniBase.width=MW;miniBase.height=MH;const g=miniBase.getContext('2d');
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=idx(x,y),t=terr[i];let c;
    if(isWater(t))c=waterCol(i);else if(isRoad(t)||t===T.RUNWAY)c='#A8ADB2';else if(bldAt[i]>=0)c='#E2DDD2';else if(t===T.MOUNT)c='#8E9384';else if(t===T.SAND)c='#E3D29A';
    else{const o=owner[i];const base=t===T.FOREST?'#477A30':t===T.FARM?'#B4A859':'#6FA347';c=o>=0?mixHex(base,NATIONS[o].color,.4):base}
    g.fillStyle=c;g.fillRect(x-y+H,(x+y)/2,2,1)}miniDirty=false}
function drawMini(){if(!miniBase||miniDirty)buildMini();mctx.clearRect(0,0,MW,MH);mctx.drawImage(miniBase,0,0);
  for(const b of burning){mctx.fillStyle='#FF5A2A';mctx.fillRect(b.x-b.y+H-1,(b.x+b.y)/2-1,3,3)}
  for(const w of wars)if(w.front){mctx.fillStyle='#FF2D2D';mctx.beginPath();mctx.arc(w.front.x-w.front.y+H,(w.front.x+w.front.y)/2,4+Math.sin(performance.now()/200),0,7);mctx.fill()}
  for(const s of ships){if(s.hidden)continue;mctx.fillStyle='#F4F4F4';mctx.fillRect(s.gx-s.gy+H,(s.gx+s.gy)/2,1.5,1.5)}
  for(const p of planes){const q=planePos(p);mctx.fillStyle=p.kind==='strike'?'#FF8080':'#FFFFFF';mctx.fillRect(q.x/HW+H-1,q.y/TH-1,2.5,2.5)}
  const x0=(cam.x-VW/2/cam.z)/HW+H,x1=(cam.x+VW/2/cam.z)/HW+H,y0=(cam.y-VH/2/cam.z)/TH,y1=(cam.y+VH/2/cam.z)/TH;mctx.strokeStyle='#E3B341';mctx.lineWidth=1.5;mctx.strokeRect(x0,y0,x1-x0,y1-y0)}

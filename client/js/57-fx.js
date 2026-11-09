// ============================================================
// Efektler, piyade, yaya çeşitliliği, hava çatışması, cephe göstergesi
// ============================================================
let tracers=[];
const FX={};
function fxSprite(k){if(FX[k])return FX[k];const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');const gr=g.createRadialGradient(32,32,0,32,32,32);
  const st={smoke:[[0,'rgba(72,72,74,.9)'],[.55,'rgba(62,62,64,.45)'],[1,'rgba(60,60,62,0)']],steam:[[0,'rgba(242,244,247,.85)'],[.6,'rgba(236,239,243,.35)'],[1,'rgba(236,239,243,0)']],
    fire:[[0,'rgba(255,250,210,1)'],[.3,'rgba(255,190,60,.95)'],[.65,'rgba(240,90,20,.6)'],[1,'rgba(200,40,10,0)']],dust:[[0,'rgba(175,155,125,.8)'],[1,'rgba(175,155,125,0)']],
    flash:[[0,'rgba(255,255,235,1)'],[.35,'rgba(255,215,130,.75)'],[1,'rgba(255,160,60,0)']]}[k]||[[0,'#fff'],[1,'rgba(255,255,255,0)']];
  for(const[o,c2]of st)gr.addColorStop(o,c2);g.fillStyle=gr;g.fillRect(0,0,64,64);return FX[k]=c}
function boom(x,y,kind){boomWorld(gwx(x,y),gwy(x,y),kind)}
function boomWorld(wx,wy,kind){const P=o=>particles.push(o);
  if(kind==='dust'){for(let k=0;k<8;k++)P({x:wx+rnd(-8,8),y:wy+rnd(-4,4),vx:rnd(-.3,.3),vy:rnd(-.4,-.1),life:1,dec:rnd(.006,.012),kind:'dust',s:rnd(3,6)});return}
  const big=kind==='big'||kind==='air',sc=big?1:.6;
  P({x:wx,y:wy-3,vx:0,vy:0,life:1,dec:.09,kind:'flash',s:9*sc});P({x:wx,y:wy,vx:0,vy:0,life:1,dec:.05,kind:'ring',s:4*sc});
  for(let k=0;k<(big?7:4);k++)P({x:wx+rnd(-4,4)*sc,y:wy-rnd(0,6)*sc,vx:rnd(-.3,.3),vy:rnd(-.6,-.1),life:1,dec:rnd(.025,.045),kind:'fire',s:rnd(3,6)*sc});
  for(let k=0;k<(big?9:5);k++)P({x:wx+rnd(-5,5)*sc,y:wy-rnd(2,8)*sc,vx:rnd(-.25,.25),vy:rnd(-.7,-.3),life:1,dec:rnd(.005,.009),kind:'smoke',s:rnd(3,5)*sc});
  for(let k=0;k<(big?10:5);k++){const a=rnd(0,6.28),v=rnd(1,2.6);P({x:wx,y:wy-3,vx:Math.cos(a)*v,vy:Math.sin(a)*v*.6-1.2,life:1,dec:rnd(.03,.05),kind:'spark',s:1})}
  if(kind==='air')for(let k=0;k<6;k++)P({x:wx,y:wy,vx:rnd(-.6,.6),vy:rnd(.5,1.2),life:1,dec:.012,kind:'smoke',s:rnd(2,4)})}
function drawParticle(g,p,a){
  if(p.kind==='spark'){p.vy+=.09;g.strokeStyle='rgba(255,220,120,'+a+')';g.lineWidth=.9;g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x-p.vx*2,p.y-p.vy*2);g.stroke();return}
  if(p.kind==='ring'){p.s+=1.6;g.strokeStyle='rgba(255,240,210,'+(a*.6)+')';g.lineWidth=1.4;g.beginPath();g.ellipse(p.x,p.y,p.s*2,p.s,0,0,7);g.stroke();return}
  const k=p.kind==='flash'?(p.s>4?'flash':'fire'):p.kind;const grow=p.kind==='smoke'||p.kind==='steam'||p.kind==='dust';const r=p.s*(grow?2.1:1.7);
  g.globalAlpha=Math.max(0,Math.min(1,a*(p.kind==='steam'?.55:p.kind==='smoke'?.8:1)));g.drawImage(fxSprite(k),p.x-r,p.y-r,r*2,r*2);g.globalAlpha=1}
// ---------- hava çatışması ----------
function dogfights(){const mil=planes.filter(p=>(p.kind==='strike'||p.kind==='heli'||p.kind==='cap')&&!p.done);
  for(let i=0;i<mil.length;i++)for(let j=i+1;j<mil.length;j++){const a=mil[i],b=mil[j];if(a.from===b.from||!atWar(a.from,b.from))continue;
    const qa=planePos(a),qb=planePos(b);if(Math.hypot(qa.x-qb.x,(qa.y-qa.alt)-(qb.y-qb.alt))>160)continue;
    if(R()<.5)tracers.push({x0:qa.x,y0:qa.y-qa.alt,x1:qb.x+rnd(-6,6),y1:qb.y-qb.alt+rnd(-4,4),life:1});
    if(R()<.03){const A=nations[a.from],B=nations[b.from];const pa=powerOf(A,false),pb=powerOf(B,false);const loser=R()<pa/(pa+pb)?b:a;loser.done=true;const q=planePos(loser);boomWorld(q.x,q.y-q.alt,'air');
      news(loser.from,nations[loser.from].name+' '+(loser.kind==='heli'?'helikopteri':'savaş uçağı')+' hava çatışmasında düşürüldü.','hi')}}}
function scramble(def,att,x1,y1){if(!def.base)return;const x0=gwx(def.base.x+.5,def.base.y+.5),y0=gwy(def.base.x+.5,def.base.y+.5);
  planes.push({kind:'strike',from:def.id,to:att.id,pts:[[x0,y0],[x1,y1]],t0:now,dur:Math.max(12,Math.hypot(x1-x0,y1-y0)/70),col:'#8E979E',intercept:true})}
// ---------- piyade mangası ----------
function drawInfantry(g,m,t){let ax=(m.fx??1),ay=(m.fy??0);if(m.aimTo){ax=m.aimTo[0]-m.gx;ay=m.aimTo[1]-m.gy;const l=Math.hypot(ax,ay)||1;ax/=l;ay/=l}
  const rx=-ay,ry=ax,sdx=(ax-ay)*HW,sdy=(ax+ay)*HH,sl=Math.hypot(sdx,sdy)||1,ux=sdx/sl,uy=sdy/sl;const fp_=formPos(m);const j=0,k0=0;
  for(let k=0;k<5;k++){const ox=(k-2)*.14,oy=(k%2)*.12;const q=W2(fp_.gx+rx*ox*.6-ax*oy,fp_.gy+ry*ox*.6-ay*oy);const x=q[0]+j,y=q[1]+k0,bob=Math.sin(t*8+k+m.id)*.4;
    g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.ellipse(x+.6,y+.2,1.6,.6,0,0,7);g.fill();
    g.fillStyle='#3E4A26';g.fillRect(x-1,y-2.6,.8,2.6);g.fillRect(x+.2,y-2.6,.8,2.6);
    g.fillStyle='#4F5B3A';g.fillRect(x-1.3,y-5.6+bob,2.6,3.3);g.fillStyle='#2F3826';g.fillRect(x-1.35,y-5.3+bob,2.7,1.9);g.fillStyle='#3A4430';g.fillRect(x-1.9,y-5.4+bob,.7,2.3);g.fillStyle='#C9A27E';g.beginPath();g.arc(x,y-6.4+bob,.85,0,7);g.fill();
    g.fillStyle='#46523A';g.beginPath();g.ellipse(x,y-6.95+bob,1.25,.95,0,Math.PI,0);g.fill();g.fillRect(x-1.45,y-7+bob,2.9,.45);g.fillStyle='#1E2418';g.fillRect(x-.25,y-7.9+bob,.5,.5);
    g.strokeStyle='#1E1E1E';g.lineWidth=.6;g.beginPath();g.moveTo(x,y-4.4+bob);g.lineTo(x+ux*4,y-4.4+bob+uy*4);g.stroke();
    if(R()<.006){particles.push({x:x+ux*4.5,y:y-4.4+uy*4.5,vx:ux*.5,vy:uy*.5,life:.5,dec:.12,kind:'flash',s:1.4});tracers.push({x0:x+ux*4,y0:y-4.4,x1:x+ux*60+rnd(-8,8),y1:y-4.4+uy*60+rnd(-6,6),life:.6})}}}
// ---------- çeşitlendirilmiş yayalar ----------
const SKIN=['#F1C9A5','#E0AC82','#C68A5E','#9C6640','#6E4428'],HAIR=['#2B1D14','#4A3220','#7A5230','#C9A15A','#1A1A1A','#8E8E8E'],
  SHIRT=['#3E7CB1','#C0392B','#27AE60','#E1B12C','#8E44AD','#ECF0F1','#2C3E50','#E67E22','#16A085','#D35480','#7F8C8D','#F5CBA7'],PANT=['#2C3E50','#34495E','#5D4037','#1F2A36','#7F8C8D','#3B3B98'];
const UNIF={police:['#1F4E9C','#1A2B4A'],doctor:['#F4F6F8','#DDE3E8'],fire:['#B83227','#2A2A2A'],soldier:['#55633A','#3E4A26']};
function drawPerson(g,m,t,px,py){if(drawPedSprite(g,m,t,px,py))return;const h=hash(m.id,11),sc=.9+h*.25,sw=Math.sin(t*8+m.id);const u=UNIF[m.role];
  const shirt=u?u[0]:SHIRT[(m.id*7)%SHIRT.length],pant=u?u[1]:PANT[(m.id*3)%PANT.length],skin=SKIN[(m.id*5)%SKIN.length],hair=HAIR[(m.id*13)%HAIR.length];
  g.save();g.translate(px,py);g.scale(sc,sc);g.fillStyle='rgba(0,0,0,.22)';g.beginPath();g.ellipse(.6,.2,1.7,.6,0,0,7);g.fill();
  g.strokeStyle=pant;g.lineWidth=.95;g.lineCap='round';g.beginPath();g.moveTo(-.4,-2.8);g.lineTo(-.4+sw*.7,0);g.moveTo(.4,-2.8);g.lineTo(.4-sw*.7,0);g.stroke();
  g.fillStyle=shirt;g.beginPath();g.moveTo(-1.25,-5.6);g.lineTo(1.25,-5.6);g.lineTo(1.05,-2.6);g.lineTo(-1.05,-2.6);g.closePath();g.fill();
  g.strokeStyle=shirt;g.lineWidth=.7;g.beginPath();g.moveTo(-1.2,-5.2);g.lineTo(-1.5-sw*.5,-3.2);g.moveTo(1.2,-5.2);g.lineTo(1.5+sw*.5,-3.2);g.stroke();
  g.fillStyle=m.hs===2?'#A5D06A':skin;g.beginPath();g.arc(0,-6.5,1,0,7);g.fill();
  g.fillStyle=m.role==='police'?'#1A2B4A':m.role==='fire'?'#E1B12C':hair;g.beginPath();g.arc(0,-6.9,1.02,Math.PI,0);g.fill();
  const nt=nations[m.c];if(nt&&(nt.weather==='yağmurlu'||nt.weather==='fırtına')&&h>.45){g.fillStyle=['#C0392B','#2C3E50','#F1C40F','#16A085'][m.id%4];g.beginPath();g.arc(0,-8.6,3.2,Math.PI,0);g.fill();g.strokeStyle='#333';g.lineWidth=.4;g.beginPath();g.moveTo(0,-8.6);g.lineTo(0,-5);g.stroke()}
  if(m.role==='thief'&&m.wanted){g.fillStyle='#F0584C';g.fillRect(-.5,-11,1,1.6)}g.restore()}
// ---------- cephe göstergesi ve mermi izleri ----------
function drawWarOverlay(g,t){drawProjectiles(g);
  for(const w of wars){if(!w.front)continue;const p=W2(w.front.x,w.front.y);const A=nations[w.a],B=nations[w.b];const pul=.5+.5*Math.sin(t*3);
    g.strokeStyle='rgba(255,70,60,'+(.35+pul*.3)+')';g.lineWidth=2;g.setLineDash([8,6]);g.beginPath();g.ellipse(p[0],p[1],170,85,0,0,7);g.stroke();g.setLineDash([]);
    const z=Math.max(.6,cam.z),fs=12/z;g.font='700 '+fs+'px "Chakra Petch",sans-serif';g.textAlign='center';const txt=A.name+'  ⚔  '+B.name;const tw=g.measureText(txt).width;const y=p[1]-110/z;
    g.fillStyle='rgba(30,8,8,.86)';g.fillRect(p[0]-tw/2-10/z,y-fs*1.1,tw+20/z,fs*2.7);g.fillStyle='#FF6A5C';g.fillText(txt,p[0],y);
    const pa=powerOf(A,false),pb=powerOf(B,true),fr=pa/(pa+pb),bw=tw+10/z,bx=p[0]-bw/2,by=y+fs*.5;g.fillStyle=A.color;g.fillRect(bx,by,bw*fr,fs*.45);g.fillStyle=B.color;g.fillRect(bx+bw*fr,by,bw*(1-fr),fs*.45);
    g.font='500 '+(fs*.75)+'px "IBM Plex Sans",sans-serif';g.fillStyle='#F2D9D6';g.fillText('Kayıp '+w.cas[0]+' / '+w.cas[1]+', '+stratOf(A)+' / '+stratOf(B),p[0],by+fs*1.4)}
  for(const tr of tracers){g.strokeStyle='rgba(255,225,130,'+tr.life+')';g.lineWidth=1;g.setLineDash([3,5]);g.beginPath();g.moveTo(tr.x0,tr.y0);g.lineTo(tr.x1,tr.y1);g.stroke();g.setLineDash([]);tr.life-=.1}
  tracers=tracers.filter(x=>x.life>0)}

// ---------- yüksek deniz köprüsü ----------
let shipQ=[];
function bridgeH(i){if(i<0||terr[i]!==T.BRIDGE||!seaMask[i])return 0;const x=tx(i),y=ty(i);for(const[dx,dy]of D4){const j=idx(x+dx,y+dy);if(inb(x+dx,y+dy)&&terr[j]===T.ROAD)return 8}return 16}
function drawBridgeTile(g,x,y,px,py){const H=bridgeH(idx(x,y));
  if((x+y)%2===0||H<16){g.fillStyle='#8C9399';g.fillRect(px-3,py-H+2,6,H);g.fillStyle='#6D747A';g.fillRect(px,py-H+2,3,H);g.fillStyle='rgba(255,255,255,.12)';g.fillRect(px-3,py-1,6,1.5)}
  g.fillStyle='#3F454B';dia(g,px,py-H+3.5,HW+.4,HH+.25);g.fill();g.fillStyle='#575E65';dia(g,px,py-H+1.5,HW+.4,HH+.25);g.fill();
  g._overlay=true;paintRoad(g,x,y,px,py-H,T.ROAD);g._overlay=false;
  const con=roadCon(x,y);g.strokeStyle='#E6E9EC';g.lineWidth=1;g.beginPath();const t=py-H-2.2;
  if(!con[0]){g.moveTo(px+HW,t);g.lineTo(px,t+HH)}if(!con[1]){g.moveTo(px-HW,t);g.lineTo(px,t-HH)}if(!con[2]){g.moveTo(px-HW,t);g.lineTo(px,t+HH)}if(!con[3]){g.moveTo(px+HW,t);g.lineTo(px,t-HH)}g.stroke()}

// ---------- muharebe düzeni, mermiler, hava savunması, deniz savaşı ----------
let projs=[];
function formPos(m){let ax=1,ay=0;if(m.aimTo){ax=m.aimTo[0]-m.gx;ay=m.aimTo[1]-m.gy;const l=Math.hypot(ax,ay)||1;ax/=l;ay/=l}
  const row=m.id%3===0?0:m.id%3===1?1:2,col=((m.slot||m.id)%10)-4.5;return{gx:m.gx+(-ay)*col*.45-ax*row*.55,gy:m.gy+ax*col*.45-ay*row*.55,ax,ay}}
function drawProjectiles(g){const tn=performance.now();
  for(const p of projs){const k=(tn-p.t0)/p.dur;if(k>=1){p.done=true;boomWorld(p.x1,p.y1,p.kind==='missile'?'air':'shell');if(p.onHit)p.onHit();continue}
    const x=lerp(p.x0,p.x1,k),y=lerp(p.y0,p.y1,k)-Math.sin(k*Math.PI)*p.h;g.fillStyle=p.kind==='missile'?'#FFFFFF':'#FFD27A';g.beginPath();g.arc(x,y,1.4,0,7);g.fill();
    if(R()<.7)particles.push({x,y,vx:0,vy:-.05,life:.7,dec:.03,kind:p.kind==='missile'?'steam':'smoke',s:1.3})}
  projs=projs.filter(p=>!p.done);
  // hava savunması: düşman jetleri üsse yaklaşınca füze
  for(const p of planes){if(p.kind!=='strike'||p.done)continue;for(const w of warsOf(p.from)){const e=nations[w.a===p.from?w.b:w.a];if(!e.base)continue;const bx=gwx(e.base.x+.5,e.base.y+.5),by=gwy(e.base.x+.5,e.base.y+.5);const q=planePos(p);
    if(Math.hypot(q.x-bx,q.y-by)>320||R()>.01)continue;const att=nations[p.from];
    projs.push({x0:bx,y0:by-6,x1:q.x,y1:q.y-q.alt,t0:tn,dur:800,h:18,kind:'missile',onHit:()=>{if(!p.done&&R()<.3+techOf(e)*.3-techOf(att)*.2){p.done=true;news(att.id,att.name+' savaş uçağı '+e.name+' hava savunmasınca vuruldu.','hi')}}})}}}
function navalBattles(){const nv=ships.filter(s=>s.kind==='navy'&&!s.done&&!s.hidden);
  for(const a of nv)for(const b of nv){if(a===b||a.c===b.c||!atWar(a.c,b.c))continue;if(Math.hypot(a.gx-b.gx,a.gy-b.gy)>12||R()>.01)continue;const pa=W2(a.gx,a.gy),pb=W2(b.gx,b.gy);
    projs.push({x0:pa[0],y0:pa[1]-6,x1:pb[0],y1:pb[1]-4,t0:performance.now(),dur:a.cls==='sub'?1600:900,h:a.cls==='sub'?0:30,kind:'missile',onHit:()=>{const A=nations[a.c],B=nations[b.c];
      if(!b.done&&R()<.3*powerOf(A,false)/(powerOf(B,false)+1)){b.done=true;news(B.id,B.name+' '+(b.cls==='carrier'?'uçak gemisi':b.cls==='sub'?'denizaltısı':b.cls==='cruiser'?'kruvazörü':'muhribi')+' deniz çatışmasında batırıldı.','big')}}})}}
// ---------- sürekli, eğimli deniz köprüsü (öncekini geçersiz kılar) ----------
let bDist=null;
function computeBridgeDist(){bDist=new Uint8Array(N);const q=[];const isSB=j=>terr[j]===T.BRIDGE&&seaMask[j];
  for(let i=0;i<N;i++){if(!isSB(i))continue;const x=tx(i),y=ty(i);for(const[dx,dy]of D4){if(!inb(x+dx,y+dy))continue;const j=idx(x+dx,y+dy);if(isRoad(terr[j])&&!isSB(j)){bDist[i]=1;q.push(i);break}}}
  for(let h=0;h<q.length;h++){const i=q[h],x=tx(i),y=ty(i);for(const[dx,dy]of D4){if(!inb(x+dx,y+dy))continue;const j=idx(x+dx,y+dy);if(isSB(j)&&!bDist[j]){bDist[j]=Math.min(9,bDist[i]+1);q.push(j)}}}}
function bridgeH(i){if(i<0||terr[i]!==T.BRIDGE||!seaMask[i])return 0;if(!bDist)computeBridgeDist();return Math.min(15,(bDist[i]||3)*5)}
function edgeH(i,j){return terr[j]===T.BRIDGE&&seaMask[j]?(bridgeH(i)+bridgeH(j))/2:0}
function drawBridgeTile(g,x,y,px,py){const i=idx(x,y),H=bridgeH(i),con=roadCon(x,y),ax=con[0]||con[1];
  const nP=ax?[x+1,y]:[x,y+1],nM=ax?[x-1,y]:[x,y-1];const hP=inb(nP[0],nP[1])?edgeH(i,idx(nP[0],nP[1])):0,hM=inb(nM[0],nM[1])?edgeH(i,idx(nM[0],nM[1])):0;
  const P=(u,v)=>{const l=L(u,v);const w=ax?u:v;const hh=w>=.5?hP:w<=-.5?hM:lerp(hM,hP,w+.5);return[px+l[0],py+l[1]-hh]};
  if((x+y)%2===0&&H>6){g.fillStyle='#8C9399';g.fillRect(px-2.6,py-H+2,5.2,H);g.fillStyle='#6D747A';g.fillRect(px,py-H+2,2.6,H)}
  const c=[P(-.5,-.5),P(.5,-.5),P(.5,.5),P(-.5,.5)];
  const fac=(a,b)=>{g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.lineTo(b[0],b[1]+3.4);g.lineTo(a[0],a[1]+3.4);g.closePath();g.fill()};
  g.fillStyle='#454B51';fac(c[3],c[2]);g.fillStyle='#3A3F44';fac(c[2],c[1]);
  g.fillStyle='#50565D';g.beginPath();g.moveTo(c[0][0],c[0][1]);for(let k=1;k<4;k++)g.lineTo(c[k][0],c[k][1]);g.closePath();g.fill();
  const S=(u0,v0,u1,v1,col)=>{const a=P(u0,v0),b=P(u1,v0),cc=P(u1,v1),d=P(u0,v1);g.fillStyle=col;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.lineTo(cc[0],cc[1]);g.lineTo(d[0],d[1]);g.closePath();g.fill()};
  if(ax){S(-.5,-.5,.5,-.32,'#B9BDC1');S(-.5,.32,.5,.5,'#B9BDC1')}else{S(-.5,-.5,-.32,.5,'#B9BDC1');S(.32,-.5,.5,.5,'#B9BDC1')}
  g.strokeStyle='#E9CF5E';g.lineWidth=.6;g.setLineDash([2.2,2.2]);const m1=ax?P(-.5,0):P(0,-.5),m2=ax?P(.5,0):P(0,.5);g.beginPath();g.moveTo(m1[0],m1[1]);g.lineTo(m2[0],m2[1]);g.stroke();g.setLineDash([]);
  g.strokeStyle='#E6E9EC';const rl=(a,b)=>{g.lineWidth=.9;g.beginPath();g.moveTo(a[0],a[1]-2.4);g.lineTo(b[0],b[1]-2.4);g.stroke();g.lineWidth=.55;for(let k=0;k<=3;k++){const t=k/3,x0=lerp(a[0],b[0],t),y0=lerp(a[1],b[1],t);g.beginPath();g.moveTo(x0,y0);g.lineTo(x0,y0-2.4);g.stroke()}};
  if(ax){rl(P(-.5,-.5),P(.5,-.5));rl(P(-.5,.5),P(.5,.5))}else{rl(P(-.5,-.5),P(-.5,.5));rl(P(.5,-.5),P(.5,.5))}}

// ---------- dümen suyu ve yoğuşma izi ----------
function drawWake(g,s){const W=s.wake;if(W.length<3)return;const sm=s.kind==='fishing'?.45:s.kind==='navy'&&s.cls==='carrier'?1.4:1;
  for(let k=1;k<W.length;k++){const a=W[k-1],b=W[k];let px=-(b[1]-a[1]),py=b[0]-a[0];const l=Math.hypot(px,py)||1;px/=l;py/=l;const f=k/W.length,al=.5*(1-f);
    const spread=(2+k*1.6)*sm;g.fillStyle='rgba(240,250,255,'+al+')';
    for(const sg of[-1,1]){g.beginPath();g.ellipse(b[0]+px*spread*sg,b[1]+py*spread*.5*sg,(1.2+k*.25)*sm,(.6+k*.1)*sm,0,0,7);g.fill()}
    if(k<5){g.fillStyle='rgba(220,240,250,'+(al*.7)+')';g.beginPath();g.ellipse(b[0],b[1],(1.6+k*.4)*sm,(.8+k*.2)*sm,0,0,7);g.fill()}}
  const h=W[0];g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.ellipse(h[0],h[1],2.2*sm,1*sm,0,0,7);g.fill()}
function drawContrail(g,q,p){const c=Math.cos(q.ang),s_=Math.sin(q.ang),L=p.kind==='liner'?90:60,sp=p.kind==='liner'?7:4;
  for(const sg of[-1,1]){const x0=q.x-c*8-s_*sp*sg,y0=q.y-q.alt-s_*8+c*sp*sg*.5,x1=x0-c*L,y1=y0-s_*L;const gr=g.createLinearGradient(x0,y0,x1,y1);
    gr.addColorStop(0,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');g.strokeStyle=gr;g.lineWidth=1.1;g.lineCap='round';g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke()}g.lineCap='butt'}

// ---------- detay objeleri ----------
function drawProps(g,b,px,py){if(!g._lo&&cam.z<1.3)return;const cat=BT[b.type]&&BT[b.type].cat,h=hash(b.x*7+b.y,b.id||3);const ox=px+HW*.55,oy=py+HH*.35;
  const box=(x,y,w,hh,c1,c2)=>{g.fillStyle=c2;g.fillRect(x,y-hh,w,hh);g.fillStyle=c1;g.fillRect(x,y-hh-1.2,w,1.2)};
  if(cat==='ind'){box(ox-4,oy,3,2.4,'#C89B5A','#9C7340');box(ox-.6,oy+.6,3,2.4,'#C89B5A','#9C7340');g.fillStyle='#4E6E8E';g.fillRect(ox+3,oy-3,1.6,3);g.fillStyle='#B5473A';g.fillRect(ox+5,oy-2.6,1.6,2.6)}
  else if(cat==='com'){g.fillStyle='#7A5332';g.fillRect(ox-3,oy-1.6,4.2,.8);g.fillRect(ox-2.8,oy-.8,.6,.8);g.fillRect(ox+.6,oy-.8,.6,.8);g.fillStyle='#8E5A3C';g.fillRect(ox+2.4,oy-1.8,2,1.8);g.fillStyle='#4FA14A';g.beginPath();g.arc(ox+3.4,oy-2.4,1.4,0,7);g.fill()}
  else if(cat==='res'&&h>.35){g.strokeStyle='#F2EEE6';g.lineWidth=.6;g.beginPath();g.moveTo(px-HW*.7,py+HH*.3);g.lineTo(px-HW*.2,py+HH*.55);g.stroke();for(let k=0;k<4;k++){const x=px-HW*.7+k*HW*.17,y=py+HH*.3+k*HH*.085;g.beginPath();g.moveTo(x,y);g.lineTo(x,y-1.6);g.stroke()}
    g.fillStyle='#3B6EA5';g.fillRect(ox,oy-2.6,1.2,1);g.fillStyle='#555';g.fillRect(ox+.4,oy-1.6,.4,1.6)}}
// ---------- mevsimler ----------
const SEASONS=[['Sonbahar','rgba(214,120,40,.07)'],['Kış','rgba(225,238,255,.16)'],['İlkbahar','rgba(120,220,120,.05)'],['Yaz','rgba(255,220,120,.04)']];
function seasonIdx(){return Math.floor(dayIdx()/10)%4}
function seasonOverlay(g){const s=SEASONS[seasonIdx()];g.save();g.setTransform(1,0,0,1,0,0);g.fillStyle=s[1];g.fillRect(0,0,g.canvas.width,g.canvas.height);
  if(seasonIdx()===1&&cam.z>.9){g.fillStyle='rgba(255,255,255,.75)';const tm=performance.now()/1000;for(let k=0;k<90;k++){const x=(hash(k,1)*g.canvas.width+tm*12*(1+hash(k,2)))%g.canvas.width,y=(hash(k,3)*g.canvas.height+tm*40*(1+hash(k,4)))%g.canvas.height;g.fillRect(x,y,1.6,1.6)}}g.restore()}
let lastSeason=-1;function seasonDay(){const s=seasonIdx();if(s!==lastSeason){if(lastSeason>=0)news(-1,'Mevsim değişti: '+SEASONS[s][0]+' geldi.'+(s===1?' Kar yağışı ulaşımı yavaşlatıyor.':''),'info');lastSeason=s}}
// ---------- kaynak ekonomisi ----------
const PRICE={petrol:1,tahil:1,maden:1};
function ensureRes(nt){if(nt.kaynak)return;nt.kaynak={petrol:Math.round(hash(nt.id,41)*100),tahil:Math.round(hash(nt.id,42)*100),maden:Math.round(hash(nt.id,43)*100)}}
function resourcesDay(){for(const nt of nations)ensureRes(nt);
  for(const k of['petrol','tahil','maden']){const top=nations.slice().sort((a,b)=>b.kaynak[k]-a.kaynak[k]).slice(0,3);const disrupted=top.filter(n=>wars.some(w=>w.a===n.id||w.b===n.id)).length;
    const target=1+disrupted*.35;const old=PRICE[k];PRICE[k]=lerp(PRICE[k],target,.25);
    if(PRICE[k]>1.3&&old<=1.3)news(-1,'Küresel '+(k==='tahil'?'tahıl':k)+' fiyatları yükseliyor: üretici ülkelerdeki savaş arzı kesti.','hi')}
  for(const nt of nations){const r=nt.kaynak,imp=(50-r.petrol)/50;nt.treasury+=(r.petrol-50)/50*(PRICE.petrol-1)*.6+(r.tahil-50)/50*(PRICE.tahil-1)*.3;
    if(imp>0&&PRICE.petrol>1.15)nt.growth-=imp*(PRICE.petrol-1)*.0015}}

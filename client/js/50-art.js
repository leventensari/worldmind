// ============================================================
// Sanat: yüksek çözünürlüklü prosedürel sprite'lar (bina, ağaç) ve zemin boyama
// Tüm çizimler karo merkezine göre "dünya birimi" ile yapılır; ölçek S ile önbelleğe alınır.
// ============================================================
const _sh=new Map();
function shade(hex,f){const k=hex+'|'+f;let v=_sh.get(k);if(v)return v;const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;
  if(f<0){r*=1+f;g*=1+f;b*=1+f}else{r+=(255-r)*f;g+=(255-g)*f;b+=(255-b)*f}v=`rgb(${r|0},${g|0},${b|0})`;_sh.set(k,v);return v}
function hexShade(hex,f){return f<0?mixHex(hex,'#000000',-f):mixHex(hex,'#ffffff',f)}
function mixHex(a,b,t){const A=parseInt(a.slice(1),16),B=parseInt(b.slice(1),16);const f=s=>Math.round(((A>>s)&255)*(1-t)+((B>>s)&255)*t);return'#'+((1<<24)+(f(16)<<16)+(f(8)<<8)+f(0)).toString(16).slice(1)}
function poly(g,p){g.beginPath();g.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)g.lineTo(p[i],p[i+1]);g.closePath();g.fill()}
function polyS(g,p){g.beginPath();g.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)g.lineTo(p[i],p[i+1]);g.closePath();g.stroke()}
function dia(g,cx,cy,hw,hh){g.beginPath();g.moveTo(cx,cy-hh);g.lineTo(cx+hw,cy);g.lineTo(cx,cy+hh);g.lineTo(cx-hw,cy);g.closePath()}
// ızgara (gx,gy) → yerel ekran (karo merkezi orijin)
const L=(u,v)=>[(u-v)*HW,(u+v)*HH];

// ---------- Kutu (prizma) çizimi: sol yüz aydınlık, sağ yüz gölgeli ----------
function faceGrad(g,x0,y0,x1,y1,col,top,bot){const gr=g.createLinearGradient(x0,y0,x1,y1);gr.addColorStop(0,shade(col,top));gr.addColorStop(1,shade(col,bot));return gr}
function box(g,s,h,wall,roof,ox=0,oy=0,sd){ // sd: derinlik oranı (varsayılan s)
  const w=HW*s,d=HH*(sd||s);
  g.fillStyle=faceGrad(g,0,oy-h,0,oy+d,wall,.06,-.1);poly(g,[ox-w,oy,ox,oy+d,ox,oy+d-h,ox-w,oy-h]);
  g.fillStyle=faceGrad(g,0,oy-h,0,oy+d,wall,-.22,-.4);poly(g,[ox,oy+d,ox+w,oy,ox+w,oy-h,ox,oy+d-h]);
  g.fillStyle=roof||shade(wall,.18);poly(g,[ox,oy-d-h,ox+w,oy-h,ox,oy+d-h,ox-w,oy-h]);
  // kenar vurgusu
  g.strokeStyle='rgba(255,255,255,.22)';g.lineWidth=.4;g.beginPath();g.moveTo(ox-w,oy-h);g.lineTo(ox,oy+d-h);g.lineTo(ox+w,oy-h);g.stroke();
  g.strokeStyle='rgba(0,0,0,.18)';g.beginPath();g.moveTo(ox,oy+d);g.lineTo(ox,oy+d-h);g.stroke();
}
// yüz üzerinde nokta: face 0=sol, 1=sağ; u yatay [0,1], v yükseklik
function fp(face,s,u,v,ox=0,oy=0){const w=HW*s,d=HH*s;return face===0?[ox-w+u*w,oy+u*d-v]:[ox+u*w,oy+d-u*d-v]}
function quadOnFace(g,face,s,u0,u1,v0,v1,ox,oy){const a=fp(face,s,u0,v0,ox,oy),b=fp(face,s,u1,v0,ox,oy),c=fp(face,s,u1,v1,ox,oy),d=fp(face,s,u0,v1,ox,oy);poly(g,[a[0],a[1],b[0],b[1],c[0],c[1],d[0],d[1]])}
function windowGrid(g,s,h,rows,cols,opt={}){
  const base=opt.base??3,top=opt.top??2,ox=opt.ox||0,oy=opt.oy||0,wu=opt.wu??.55,wv=opt.wv??.55;
  const rowH=(h-base-top)/rows;
  for(let f=0;f<2;f++){for(let r=0;r<rows;r++){const v0=base+r*rowH+rowH*(1-wv)/2,v1=v0+rowH*wv;
      for(let c=0;c<cols;c++){const u0=(c+(1-wu)/2)/cols,u1=u0+wu/cols;
        g.fillStyle=f===0?(opt.glass||'#2E4457'):(opt.glass2||'#1F3040');quadOnFace(g,f,s,u0,u1,v0,v1,ox,oy);
        g.fillStyle=f===0?'rgba(190,220,240,.35)':'rgba(150,180,200,.18)';quadOnFace(g,f,s,u0,u0+(u1-u0)*.45,v0+(v1-v0)*.55,v1,ox,oy)}}}
}
function windowPoints(b){ // gece ışıkları için pencere merkezleri (yerel birim)
  const d=BT[b.type],s=d.s,h=b.h;let rows=0,cols=0,base=3;
  switch(b.type){case'apartment':rows=Math.floor(h/5);cols=3;break;case'highrise':rows=Math.floor(h/4.2);cols=3;break;case'tower':rows=Math.floor(h/3.6);cols=4;break;case'office':rows=Math.floor(h/4.4);cols=3;break;
    case'hospital':rows=Math.floor(h/5);cols=4;break;case'house':rows=1;cols=2;base=2;break;case'police':case'school':case'university':case'parliament':case'terminal':rows=2;cols=3;break;default:return[]}
  const pts=[],rowH=(h-base-2)/rows;for(let f=0;f<2;f++)for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const p=fp(f,s,(c+.5)/cols,base+(r+.5)*rowH);pts.push(p[0],p[1],f)}return pts}
function flagPole(g,x,y,col,h=11){g.strokeStyle='#E8E8E8';g.lineWidth=.6;g.beginPath();g.moveTo(x,y);g.lineTo(x,y-h);g.stroke();g.fillStyle=col;g.beginPath();g.moveTo(x,y-h);g.lineTo(x+6,y-h+1);g.lineTo(x+5.5,y-h+3.5);g.lineTo(x,y-h+3);g.closePath();g.fill()}
function aoBase(g,s){const w=HW*s,d=HH*s;g.fillStyle='rgba(0,0,0,.22)';poly(g,[-w-1.5,0,0,d+1.5,w+1.5,0,w+.5,0,0,d+.5,-w-.5,0])}
function castShadow(g,s,h){const w=HW*s,d=HH*s,L_=Math.min(h,60)*.5;g.fillStyle='rgba(20,30,20,.20)';poly(g,[0,d,w,0,w+L_,-L_*.18,L_,d-L_*.18])}
function rooftopBits(g,s,h,v){const w=HW*s,d=HH*s;
  g.strokeStyle='rgba(0,0,0,.18)';g.lineWidth=.6;dia(g,0,-h,w*.82,d*.82);g.stroke();
  if(v%2===0){box(g,.16,2.6,'#9AA0A6',null,-w*.3,-h);box(g,.12,2,'#A8AEB4',null,w*.25,-h+1)}
  else{g.fillStyle='#8B6A4A';g.beginPath();g.ellipse(w*.2,-h-3,2.2,1.1,0,0,7);g.fill();g.fillRect(w*.2-2.2,-h-3,4.4,3);g.fillStyle='#6E5238';g.beginPath();g.ellipse(w*.2,-h,2.2,1.1,0,0,Math.PI);g.fill()}
  if(v===3){g.fillStyle='#24384F';for(let k=0;k<3;k++){g.save();g.translate(-w*.35+k*3.2,-h+1);g.transform(1,.5,-1,.5,0,0);g.fillRect(-1,-1,2.4,1.6);g.restore()}}
}
function hipRoof(g,s,h,roof,rh=7){const w=HW*s+1,d=HH*s+.5;const ap=[0,-h-rh];
  g.fillStyle=shade(roof,.15);poly(g,[-w,-h,0,-d-h,ap[0],ap[1]]);g.fillStyle=shade(roof,-.05);poly(g,[0,-d-h,w,-h,ap[0],ap[1]]);
  g.fillStyle=faceGrad(g,0,-h-rh,0,-h+d,roof,.05,-.08);poly(g,[-w,-h,0,d-h,ap[0],ap[1]]);g.fillStyle=shade(roof,-.32);poly(g,[0,d-h,w,-h,ap[0],ap[1]]);
  g.strokeStyle='rgba(0,0,0,.12)';g.lineWidth=.35;g.beginPath();for(let k=1;k<4;k++){const t=k/4;g.moveTo(lerp(-w,ap[0],t),lerp(-h,ap[1],t));g.lineTo(lerp(0,ap[0],t),lerp(d-h,ap[1],t))}g.stroke()}
function gableRoof(g,s,h,roof,rh=6,wall){ // sırt ızgara u ekseni boyunca
  const w=HW*s+.8,d=HH*s+.4,a=s/2;const r0=L(-a,0),r1=L(a,0);const ly=-h-rh;
  g.fillStyle=shade(roof,.14);poly(g,[0,-d-h,w,-h,r1[0],r1[1]+ly,r0[0],r0[1]+ly]);
  g.fillStyle=faceGrad(g,0,ly,0,d-h,roof,.02,-.12);poly(g,[-w,-h,0,d-h,r1[0],r1[1]+ly,r0[0],r0[1]+ly]);
  g.fillStyle=wall?shade(wall,-.3):shade(roof,-.35);poly(g,[w,-h,0,d-h,r1[0],r1[1]+ly]);
  g.strokeStyle='rgba(0,0,0,.14)';g.lineWidth=.35;g.beginPath();for(let k=1;k<5;k++){const t=k/5;g.moveTo(lerp(-w,r0[0],t),lerp(-h,r0[1]+ly,t));g.lineTo(lerp(0,r1[0],t),lerp(d-h,r1[1]+ly,t))}g.stroke();
  g.strokeStyle=shade(roof,-.4);g.lineWidth=.6;g.beginPath();g.moveTo(r0[0],r0[1]+ly);g.lineTo(r1[0],r1[1]+ly);g.stroke()}
// ---------- Bina sanatı ----------
function drawBuildingArt(g,b){
  const d=BT[b.type];const s=d.s,h=b.h,w=HW*s,dd=HH*s;const nc=NATIONS[b.c]?NATIONS[b.c].color:'#888';
  if(b.type!=='rubble'&&b.type!=='construction')castShadow(g,s,h);
  aoBase(g,s);
  switch(b.type){
    case'house':{box(g,s,h,b.wall,null);g.fillStyle='#5A4030';quadOnFace(g,0,s,.62,.8,0,4.2);windowGrid(g,s,h,1,2,{base:1.8,top:1.5,wu:.4,glass:'#3B5568'});
      if(b.v%2)hipRoof(g,s,h,b.roof);else gableRoof(g,s,h,b.roof,6,b.wall);if(b.v===2){box(g,.08,5,'#8A4B3A',null,w*.35,-h-2)}break}
    case'apartment':{box(g,s,h,b.wall,'#A3A8AD');windowGrid(g,s,h,Math.floor(h/5),3,{base:3,glass:'#2F4558'});
      g.fillStyle=shade(b.wall,-.2);for(let r=1;r<Math.floor(h/5);r++){quadOnFace(g,0,s,0,1,3+r*(h-5)/Math.floor(h/5)-.4,3+r*(h-5)/Math.floor(h/5)+.2)}
      g.fillStyle='#4A3A2E';quadOnFace(g,0,s,.42,.58,0,3.4);rooftopBits(g,s,h,b.v);break}
    case'highrise':{box(g,s,h,b.wall,'#B9BEC3');windowGrid(g,s,h,Math.floor(h/4.2),3,{base:4,glass:'#355A78',glass2:'#24425C',wu:.62});
      g.fillStyle='rgba(255,255,255,.18)';for(let r=4;r<h;r+=8.4)quadOnFace(g,0,s,0,1,r,r+.7);rooftopBits(g,s,h,b.v);
      g.strokeStyle='#C8CDD2';g.lineWidth=.6;g.beginPath();g.moveTo(0,-h-dd*.2);g.lineTo(0,-h-9);g.stroke();break}
    case'tower':{const glass=b.wall;box(g,s,h,glass,shade(glass,.35));
      g.fillStyle='rgba(225,240,255,.10)';quadOnFace(g,0,s,0,1,0,h);
      g.strokeStyle='rgba(255,255,255,.28)';g.lineWidth=.45;g.beginPath();for(let k=3.6;k<h-1;k+=3.6){const a=fp(0,s,0,k),c=fp(0,s,1,k),e=fp(1,s,1,k);g.moveTo(a[0],a[1]);g.lineTo(c[0],c[1]);g.lineTo(e[0],e[1])}g.stroke();
      g.strokeStyle='rgba(0,0,0,.18)';g.beginPath();for(let k=1;k<4;k++){const a=fp(0,s,k/4,0),c=fp(0,s,k/4,h),e=fp(1,s,k/4,0),f=fp(1,s,k/4,h);g.moveTo(a[0],a[1]);g.lineTo(c[0],c[1]);g.moveTo(e[0],e[1]);g.lineTo(f[0],f[1])}g.stroke();
      // gökyüzü yansıması
      const gr=g.createLinearGradient(-w,-h,0,0);gr.addColorStop(0,'rgba(255,255,255,.22)');gr.addColorStop(.5,'rgba(255,255,255,0)');g.fillStyle=gr;quadOnFace(g,0,s,0,1,h*.4,h);
      if(b.v%2===0){box(g,s*.6,6,hexShade(glass,-.1),shade(glass,.3),0,-h)}g.strokeStyle='#D0D4D8';g.lineWidth=.7;g.beginPath();g.moveTo(0,-h-(b.v%2===0?6:0)-dd*.3);g.lineTo(0,-h-16);g.stroke();g.fillStyle='#FF4A3D';g.fillRect(-.7,-h-17,1.4,1.4);break}
    case'office':{box(g,s,h,b.wall,'#9EA4AA');windowGrid(g,s,h,Math.floor(h/4.4),3,{base:4,glass:'#3A5970',wu:.7,wv:.6});
      g.fillStyle='#2F3E4B';quadOnFace(g,0,s,.3,.7,0,3.5);rooftopBits(g,s,h,b.v);break}
    case'shop':{const wall=['#F2E3C9','#E8D1D1','#D8E6D3','#E6E0F0','#F3E6B5'][b.v%5];box(g,s,h,wall,'#B7BCC0');
      g.fillStyle='rgba(165,215,240,.85)';quadOnFace(g,0,s,.08,.92,.6,4.6);quadOnFace(g,1,s,.08,.92,.6,4.6);
      const aw=['#D24B3F','#2F7FBF','#2E9E6A','#E39A2C'][b.v];for(let k=0;k<6;k++){g.fillStyle=k%2?'#F7F7F2':aw;quadOnFace(g,0,s,k/6,(k+1)/6,4.8,6.6);g.fillStyle=k%2?'#D9D9D2':shade(aw,-.25);quadOnFace(g,1,s,k/6,(k+1)/6,4.8,6.6)}
      g.fillStyle=aw;quadOnFace(g,0,s,.25,.75,h-1.2,h+1.6);rooftopBits(g,s,h,1);break}
    case'mall':{box(g,s,h,'#DADDE0','#C4C8CC');g.fillStyle='rgba(140,200,235,.85)';quadOnFace(g,0,s,.05,.95,1,h-3);quadOnFace(g,1,s,.05,.6,1,h-3);
      g.fillStyle='#E04E3A';quadOnFace(g,0,s,.2,.8,h-2.2,h-.6);g.fillStyle='rgba(170,215,240,.9)';dia(g,0,-h,w*.45,dd*.45);g.fill();g.strokeStyle='rgba(255,255,255,.6)';g.lineWidth=.4;dia(g,0,-h,w*.45,dd*.45);g.stroke();break}
    case'factory':{box(g,s,h,'#8E8478','#77706A');windowGrid(g,s,h,1,4,{base:3,top:3,glass:'#4A5560'});
      g.fillStyle='#A9A196';for(let k=0;k<4;k++){const u=k/4;const a=fp(0,s,u,h),c=fp(0,s,u+.25,h);g.save();g.translate(w*.5,-dd*.5);poly(g,[a[0],a[1],c[0],c[1],c[0],c[1]-4,a[0]+0,a[1]]);g.fillStyle='rgba(160,210,235,.6)';poly(g,[c[0]-.4,c[1]-.4,c[0]-.4,c[1]-3.6,a[0]+.5,a[1]-.3]);g.fillStyle='#A9A196';g.restore()}
      box(g,.1,h+16,'#8A3F30',null,w*.45,-dd*.2);g.fillStyle='#F2F2F2';g.fillRect(w*.45-1.6,-h-12-dd*.2,3.2,1.4);g.fillStyle='#4A2018';g.beginPath();g.ellipse(w*.45,-h-16-dd*.2,1.6,.8,0,0,7);g.fill();break}
    case'warehouse':{box(g,s,h,'#B8BDC2','#CDD1D5');g.fillStyle='#596068';quadOnFace(g,0,s,.15,.45,0,6.5);quadOnFace(g,0,s,.55,.85,0,6.5);
      g.strokeStyle='rgba(0,0,0,.12)';g.lineWidth=.4;g.beginPath();for(let k=1;k<10;k++){const a=fp(1,s,k/10,0),c=fp(1,s,k/10,h);g.moveTo(a[0],a[1]);g.lineTo(c[0],c[1])}g.stroke();break}
    case'power':{box(g,.5,h,'#9BA1A6','#8A9095',-w*.35,dd*.1);
      for(const[ox,oy]of[[w*.35,-dd*.15],[w*.05,dd*.35]]){const gr=g.createLinearGradient(ox-5,0,ox+5,0);gr.addColorStop(0,'#E4E7EA');gr.addColorStop(1,'#A9AEB3');g.fillStyle=gr;
        g.beginPath();g.moveTo(ox-5,oy);g.quadraticCurveTo(ox-3,oy-h*.8,ox-3.6,oy-h-4);g.lineTo(ox+3.6,oy-h-4);g.quadraticCurveTo(ox+3,oy-h*.8,ox+5,oy);g.closePath();g.fill();
        g.fillStyle='#6E7378';g.beginPath();g.ellipse(ox,oy-h-4,3.6,1.6,0,0,7);g.fill();g.fillStyle='#C9CDD0';g.beginPath();g.ellipse(ox,oy,5,2.2,0,0,Math.PI);g.fill()}break}
    case'hospital':{box(g,s,h,'#EEF1F3','#DCE0E3');windowGrid(g,s,h,Math.floor(h/5),4,{base:5,glass:'#4A7A99',wu:.7});
      g.fillStyle='#D8312C';quadOnFace(g,0,s,0,1,h-1.6,h-.4);quadOnFace(g,1,s,0,1,h-1.6,h-.4);
      g.fillStyle='#3E8E5A';dia(g,0,-h,w*.5,dd*.5);g.fill();g.strokeStyle='#F4F4F4';g.lineWidth=.8;dia(g,0,-h,w*.36,dd*.36);g.stroke();g.fillStyle='#FFFFFF';g.font='bold 5px sans-serif';g.textAlign='center';g.fillText('H',0,-h+1.8);
      g.fillStyle='#D8312C';quadOnFace(g,0,s,.38,.62,h*.55,h*.55+4.5);g.fillStyle='#FFFFFF';quadOnFace(g,0,s,.47,.53,h*.55+.6,h*.55+3.9);quadOnFace(g,0,s,.4,.6,h*.55+1.8,h*.55+2.7);
      g.fillStyle='#3B4A55';quadOnFace(g,0,s,.35,.65,0,4);break}
    case'police':{box(g,s,h,'#E9EEF4','#CBD3DC');g.fillStyle='#2155A8';quadOnFace(g,0,s,0,1,h-3.2,h-1.4);quadOnFace(g,1,s,0,1,h-3.2,h-1.4);windowGrid(g,s,h-3,1,3,{base:2,glass:'#2D3E52'});
      g.fillStyle='#1B3E7A';quadOnFace(g,0,s,.35,.65,0,3.6);box(g,.12,3,'#2155A8',null,0,-h);g.fillStyle='#3D7BFF';g.fillRect(-.8,-h-4.4,1.6,1.2);break}
    case'fire':{box(g,s,h,'#B03A2E','#7C7C7C');g.fillStyle='#E9E4DA';quadOnFace(g,0,s,.08,.46,0,6.6);quadOnFace(g,0,s,.54,.92,0,6.6);
      g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=.3;g.beginPath();for(let k=1;k<6;k++){for(const[u0,u1]of[[.08,.46],[.54,.92]]){const a=fp(0,s,u0,k*1.1),c=fp(0,s,u1,k*1.1);g.moveTo(a[0],a[1]);g.lineTo(c[0],c[1])}}g.stroke();
      box(g,.22,h+8,'#9A3326','#7C7C7C',w*.45,-dd*.25);break}
    case'school':{box(g,s,h,'#E5A548','#B8B2A6');windowGrid(g,s,h,2,4,{base:2,glass:'#2F4051'});g.fillStyle='#FFFFFF';quadOnFace(g,0,s,0,1,h-1.6,h-.8);flagPole(g,0,-h-dd,nc);break}
    case'university':{box(g,s,h,'#D8CBB0','#B6AB92');windowGrid(g,s,h,2,4,{base:2,glass:'#3B4A55'});
      g.fillStyle='#6E8F7A';g.beginPath();g.arc(0,-h-1,6,Math.PI,0);g.fill();g.fillStyle='#8FB39C';g.beginPath();g.arc(-2,-h-2.5,2.4,Math.PI,0);g.fill();g.fillStyle='#C9BC9E';g.fillRect(-6,-h-1.2,12,1.4);break}
    case'parliament':{box(g,s,h,'#F2EFE6','#DCD6C6');g.fillStyle='#E3DECF';quadOnFace(g,0,s,.15,.85,h-3,h);
      g.fillStyle='#FFFFFF';for(let k=0;k<7;k++){quadOnFace(g,0,s,.17+k*.1,.21+k*.1,0,h-3)}g.fillStyle='rgba(0,0,0,.15)';for(let k=0;k<7;k++)quadOnFace(g,0,s,.21+k*.1,.23+k*.1,0,h-3);
      g.fillStyle='#DCD6C6';g.fillRect(-4.5,-h-5,9,5);const gr=g.createRadialGradient(-2,-h-10,1,0,-h-6,8);gr.addColorStop(0,'#F7DC86');gr.addColorStop(1,'#B9862A');g.fillStyle=gr;g.beginPath();g.arc(0,-h-5,5.5,Math.PI,0);g.fill();
      g.fillRect(-.5,-h-14,1,4);flagPole(g,w-3,-h+1,nc,12);break}
    case'stadium':{g.fillStyle='#9AA1A8';g.beginPath();g.ellipse(0,-4,w,dd+1.5,0,0,7);g.fill();g.fillStyle='#7F868D';g.fillRect(-w,-4,w*2,4);g.beginPath();g.ellipse(0,0,w,dd+1.5,0,0,Math.PI);g.fill();
      g.fillStyle='#C4372E';g.beginPath();g.ellipse(0,-4.5,w*.92,dd*.92+1,0,0,7);g.fill();g.fillStyle='#4E9E3C';g.beginPath();g.ellipse(0,-4.5,w*.66,dd*.66,0,0,7);g.fill();
      g.strokeStyle='rgba(255,255,255,.75)';g.lineWidth=.4;g.beginPath();g.ellipse(0,-4.5,w*.66,dd*.66,0,0,7);g.moveTo(-w*.33,-4.5-dd*.33);g.lineTo(w*.33,-4.5+dd*.33);g.stroke();
      for(const[x,y]of[[-w,-4],[w,-4],[0,-4-dd-1.5]]){g.strokeStyle='#DDD';g.lineWidth=.6;g.beginPath();g.moveTo(x,y);g.lineTo(x,y-10);g.stroke();g.fillStyle='#F6F2D0';g.fillRect(x-1.2,y-11,2.4,1.4)}break}
    case'barracks':{box(g,s,h,'#6B7350','#596043');windowGrid(g,s,h,1,4,{base:1.5,glass:'#2E3322'});break}
    case'hangar':{box(g,s,h-4,'#7A8070','#7A8070');const gr=g.createLinearGradient(-w,0,w,0);gr.addColorStop(0,'#9AA090');gr.addColorStop(1,'#6E7464');g.fillStyle=gr;g.beginPath();g.ellipse(0,-h+4,w*.98,dd+4,0,Math.PI,0);g.fill();
      g.fillStyle='#3A3F33';quadOnFace(g,0,s,.2,.8,0,h-5);flagPole(g,w,-h+3,nc);break}
    case'depot':{box(g,s,h,'#9C8F64','#83784F');g.fillStyle='#E8C547';quadOnFace(g,0,s,.4,.6,1,3);break}
    case'terminal':{box(g,s,h,'#8FB3C8','#E9EDF0');g.fillStyle='rgba(225,242,255,.6)';quadOnFace(g,0,s,.03,.97,1,h-2);quadOnFace(g,1,s,.03,.97,1,h-2);
      g.strokeStyle='rgba(255,255,255,.5)';g.lineWidth=.35;g.beginPath();for(let k=1;k<10;k++){const a=fp(0,s,k/10,1),c=fp(0,s,k/10,h-2);g.moveTo(a[0],a[1]);g.lineTo(c[0],c[1])}g.stroke();
      g.fillStyle='#F2F4F6';g.beginPath();g.ellipse(0,-h-1,w*.9,dd*.9+1.5,0,Math.PI,0);g.fill();break}
    case'atc':{box(g,s,h-5,'#D8DDE2','#C9CED3');box(g,.52,5,'#5B7C96','#E0E4E8',0,-h+5);g.fillStyle='rgba(180,225,255,.7)';quadOnFace(g,0,.52,0,1,1,4,0,-h+5);g.fillStyle='#F44';g.fillRect(-.6,-h-dd*.6-3,1.2,1.2);break}
    case'portwh':{const cs=['#C0392B','#2E86C1','#E67E22','#27AE60','#7D3C98'];for(let r=0;r<2;r++)for(let k=0;k<3;k++)box(g,.24,4.5,cs[(b.id+k+r)%5],null,-6+k*5.4-r*2,3-k*2.7-r*4.5);
      box(g,.24,4.5,cs[(b.id+3)%5],null,3.5,-3.5);break}
    case'crane':{g.strokeStyle='#D2462F';g.lineWidth=1.3;g.beginPath();g.moveTo(-4,2);g.lineTo(-2,-h);g.moveTo(4,2);g.lineTo(2,-h);g.moveTo(-2,-h*.5);g.lineTo(2,-h*.5);g.moveTo(-14,-h+5);g.lineTo(14,-h-4);g.stroke();
      g.fillStyle='#E8B830';g.fillRect(-3,-h-2,6,3.5);g.strokeStyle='#666';g.lineWidth=.5;g.beginPath();g.moveTo(10,-h-2.8);g.lineTo(10,-h+12);g.stroke();g.fillStyle='#2E86C1';g.fillRect(8,-h+12,4,2.4);break}
    case'barn':{box(g,.55,h,'#A8392C','#777',-3,1);g.save();g.translate(-3,1);gableRoof(g,.55,h,'#7E8487',5,'#A8392C');g.restore();g.fillStyle='#F0E8DA';quadOnFace(g,0,.55,.35,.65,0,4.5,-3,1);
      const gr=g.createLinearGradient(5,0,11,0);gr.addColorStop(0,'#E2E5E7');gr.addColorStop(1,'#A4A9AD');g.fillStyle=gr;g.fillRect(5,-h-3,6,h+3);g.fillStyle='#D0D4D7';g.beginPath();g.arc(8,-h-3,3,Math.PI,0);g.fill();break}
    case'construction':{g.fillStyle='#BFB59A';dia(g,0,0,w,dd);g.fill();const pr=b._pr??.5;box(g,.62,4+pr*16,'#A9AEB3','#C7CBCF');
      g.strokeStyle='#E8B830';g.lineWidth=.7;g.beginPath();for(let k=0;k<5;k++){g.moveTo(-w*.75,-k*4.5);g.lineTo(w*.75,-k*4.5)}g.moveTo(-w*.75,0);g.lineTo(-w*.75,-20);g.moveTo(w*.75,0);g.lineTo(w*.75,-20);g.stroke();
      g.strokeStyle='#F2B705';g.lineWidth=1;g.beginPath();g.moveTo(w*.55,3);g.lineTo(w*.55,-34);g.lineTo(-w*1.1,-30);g.moveTo(w*.55,-34);g.lineTo(w*.9,-33);g.stroke();g.strokeStyle='#555';g.lineWidth=.4;g.beginPath();g.moveTo(-w*.6,-30.5);g.lineTo(-w*.6,-18);g.stroke();break}
    case'rubble':{g.fillStyle='#7C7166';poly(g,[-w,0,-2,-5,3,-2,w,0,0,dd]);g.fillStyle='#9A8F80';poly(g,[-w*.4,-1,0,-7,w*.5,-1,0,dd*.5]);g.fillStyle='#5E554C';poly(g,[-2,-3,1,-9,3,-2]);
      g.strokeStyle='#4A433C';g.lineWidth=.7;g.beginPath();g.moveTo(-4,-2);g.lineTo(2,-10);g.moveTo(3,-1);g.lineTo(6,-6);g.stroke();break}
  }
}
// ---------- Ağaç sanatı ----------
function drawTreeArt(g,kind,v){
  g.fillStyle='rgba(15,35,10,.25)';g.beginPath();g.ellipse(2.5,1,5,2.2,0,0,7);g.fill();
  if(kind===2){ // iğne yapraklı
    g.fillStyle='#5A3E25';g.fillRect(-.7,-3,1.4,4);const cols=[['#24552A','#2F6B33','#3E8040'],['#1F4D2E','#2A6239','#3A7A48']][v%2];
    for(let k=0;k<3;k++){const y=-3-k*3.6,wd=5.4-k*1.4;g.fillStyle=cols[0];poly(g,[-wd,y,0,y-6,wd,y]);g.fillStyle=cols[2];poly(g,[-wd,y,0,y-6,-wd*.2,y])}return}
  if(kind===3){ // palmiye
    g.strokeStyle='#8A6A42';g.lineWidth=1.2;g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(1.5,-6,.6,-12);g.stroke();
    g.fillStyle='#3D8A3A';for(let k=0;k<6;k++){const a=k/6*Math.PI*2;g.beginPath();g.ellipse(.6+Math.cos(a)*3,-12+Math.sin(a)*1.4,3.6,1,a,0,7);g.fill()}return}
  const pal=[['#2F6B2A','#3F8634','#5DA548'],['#3A6E26','#4C8A30','#6BAA44'],['#2D5F33','#3C7A40','#58A05A'],['#6B7A2A','#86973A','#A9B856']][v%4];
  g.fillStyle='#5A3E25';g.fillRect(-.7,-4,1.4,4.6);
  g.fillStyle=pal[0];g.beginPath();g.arc(0,-7,5,0,7);g.fill();g.beginPath();g.arc(-3,-5.5,3.4,0,7);g.fill();g.beginPath();g.arc(3,-5.6,3.2,0,7);g.fill();
  g.fillStyle=pal[1];g.beginPath();g.arc(-1,-8,3.6,0,7);g.fill();g.fillStyle=pal[2];g.beginPath();g.arc(-2,-9.2,1.8,0,7);g.fill();
}
// ---------- Sprite önbelleği ----------
const spriteCache=new Map();let spriteBytes=0;const SPRITE_BUDGET=140*1024*1024;
function spriteKeyB(b,S){const flags=['school','parliament','hangar'].includes(b.type)?b.c:'';const pr=b.type==='construction'?Math.round((b._pr??.5)*4):'';return`b|${b.type}|${b.h}|${b.wall}|${b.roof}|${b.v}|${flags}|${pr}|${S}`}
function makeSprite(key,S,wu,hu,ax,ay,draw){
  let sp=spriteCache.get(key);if(sp){sp.used=frameNo;return sp}
  const cv=document.createElement('canvas');cv.width=Math.ceil(wu*S);cv.height=Math.ceil(hu*S);const g=cv.getContext('2d');g.setTransform(S,0,0,S,ax*S,ay*S);g.lineJoin='round';draw(g);
  sp={cv,ax,ay,wu,hu,used:frameNo,bytes:cv.width*cv.height*4};spriteCache.set(key,sp);spriteBytes+=sp.bytes;
  if(spriteBytes>SPRITE_BUDGET){const arr=[...spriteCache.entries()].sort((a,b)=>a[1].used-b[1].used);for(const[k,v]of arr){if(spriteBytes<SPRITE_BUDGET*.75)break;if(v.used>=frameNo-1)continue;spriteCache.delete(k);spriteBytes-=v.bytes}}
  return sp}
function buildingSprite(b,S){const hu=b.h+46;return makeSprite(spriteKeyB(b,S),S,48,hu,22,b.h+34,g=>drawBuildingArt(g,b))}
function treeSprite(kind,v,S){return makeSprite(`t|${kind}|${v}|${S}`,S,16,24,7,20,g=>drawTreeArt(g,kind,v))}

// ---------- Zemin boyama (parça önbelleğine) ----------
const GRASS_COL=['#6FA347','#73A84A','#6A9E43','#77AC4E','#6DA145'];
function tintOwner(base,x,y){const o=owner[idx(x,y)];return o>=0?mixHex(base,NATIONS[o].color,.06):base}
function waterCol(i){const d=wdist[i];if(terr[i]===T.LAKE)return'#3E8FBE';if(!seaMask[i])return'#4597C2';const t=clamp((d-1)/9,0,1);return mixHex('#4FA9CF','#17486F',t)}
function paintGround(g,x,y,px,py){
  const i=idx(x,y),t=terr[i],h=hash(x,y);let col;
  const bi=bldAt[i];const bt=bi>=0?buildings[bi].type:null;
  switch(t){
    case T.DEEP:case T.WATER:case T.LAKE:col=waterCol(i);break;
    case T.SAND:col=h<.5?'#E3D29A':'#DFCD93';break;
    case T.FOREST:col=tintOwner('#557F35',x,y);break;
    case T.MOUNT:col='#86906E';break;
    case T.FARM:{const f=hash(x>>1,(y/3)|0);col=f<.3?'#D9C46A':f<.6?'#8FBF4F':f<.8?'#A6B85A':'#B39466';break}
    case T.ROAD:case T.BRIDGE:col='#4F555C';break;
    case T.RUNWAY:col='#3A3F45';break;
    case T.PARK:col='#7DBE55';break;
    case T.RUBBLE:col='#8B8075';break;
    case T.CONC:col=h<.5?'#B7BBBE':'#B2B6B9';break;
    default:{if(bt){const c=BT[bt].cat;col=c==='res'&&bt==='house'?'#8CBF5E':c==='res'?'#B9BCBE':c==='work'?(bt==='factory'||bt==='warehouse'||bt==='power'?'#8C9093':'#C3C6C8'):c==='svc'?'#CDD0D2':c==='farm'?'#9DBE63':'#B5B8BA'}else col=tintOwner(GRASS_COL[(h*5)|0],x,y)}
  }
  g.fillStyle=col;dia(g,px,py,HW+.55,HH+.3);g.fill();
  if(isWater(t)||t===T.BRIDGE){ // kıyı köpüğü ve sığ su
    const land=(xx,yy)=>inb(xx,yy)&&!isWater(terr[idx(xx,yy)])&&terr[idx(xx,yy)]!==T.BRIDGE;
    g.strokeStyle='rgba(225,245,250,.75)';g.lineWidth=1.1;g.beginPath();
    if(land(x+1,y)){g.moveTo(px+HW,py);g.lineTo(px,py+HH)}if(land(x,y+1)){g.moveTo(px-HW,py);g.lineTo(px,py+HH)}
    if(land(x-1,y)){g.moveTo(px-HW,py);g.lineTo(px,py-HH)}if(land(x,y-1)){g.moveTo(px+HW,py);g.lineTo(px,py-HH)}g.stroke();
  }
  if(t===T.SAND&&wdist[i]===0){g.fillStyle='rgba(255,255,255,.18)';for(let k=0;k<3;k++)g.fillRect(px-6+hash(x+k,y)*10,py-2+hash(y,x+k)*4,1,1)}
  if(t===T.GRASS&&!bt||t===T.FOREST){g.fillStyle=h<.5?'rgba(255,255,255,.06)':'rgba(0,0,0,.05)';for(let k=0;k<5;k++){const a=hash(x*7+k,y),b_=hash(y*7+k,x);g.fillRect(px-9+a*18,py-4+b_*8,1.2,.8)}}
  if(t===T.FARM){const f=hash(x>>1,(y/3)|0);g.strokeStyle=f<.3?'rgba(150,120,40,.4)':'rgba(40,80,20,.32)';g.lineWidth=.7;g.beginPath();for(let k=-3;k<=3;k++){const o=k*.13;const a=L(-.5,o),b_=L(.5,o);g.moveTo(px+a[0],py+a[1]);g.lineTo(px+b_[0],py+b_[1])}g.stroke()}
  if(t===T.ROAD||t===T.BRIDGE)paintRoad(g,x,y,px,py,t);
  if(t===T.RUNWAY){g.strokeStyle='#F2F2F2';g.lineWidth=.9;g.setLineDash([3,2.4]);g.beginPath();const a=L(-.45,0),b_=L(.45,0);g.moveTo(px+a[0],py+a[1]);g.lineTo(px+b_[0],py+b_[1]);g.stroke();g.setLineDash([]);
    g.strokeStyle='rgba(255,255,255,.7)';g.lineWidth=.5;g.beginPath();for(const o of[-.4,.4]){const c=L(-.5,o),d=L(.5,o);g.moveTo(px+c[0],py+c[1]);g.lineTo(px+d[0],py+d[1])}g.stroke()}
  if(t===T.PARK){g.strokeStyle='#DCCFA6';g.lineWidth=1.3;g.beginPath();const a=L(-.5,0),b_=L(.5,0),c=L(0,-.5),d=L(0,.5);g.moveTo(px+a[0],py+a[1]);g.lineTo(px+b_[0],py+b_[1]);g.moveTo(px+c[0],py+c[1]);g.lineTo(px+d[0],py+d[1]);g.stroke();
    if(h<.35){g.fillStyle='#BFC4C7';g.beginPath();g.ellipse(px,py,5,2.5,0,0,7);g.fill();g.fillStyle='#69B6DE';g.beginPath();g.ellipse(px,py,3.8,1.9,0,0,7);g.fill();g.fillStyle='rgba(255,255,255,.8)';g.fillRect(px-.4,py-3,.8,3)}}
  if(t===T.RUBBLE){for(let k=0;k<7;k++){const a=hash(x+k,y*3+k);g.fillStyle=k%2?'#6E655C':'#A19686';g.fillRect(px-8+a*14,py-3+hash(y+k,x)*6,2.4,1.5)}}
  if(t===T.CONC){g.strokeStyle='rgba(80,85,90,.18)';g.lineWidth=.5;g.beginPath();const a=L(-.5,0),b_=L(.5,0);g.moveTo(px+a[0],py+a[1]);g.lineTo(px+b_[0],py+b_[1]);g.stroke();
    if(decor[i]===1){if(!SPR.ready)paintTank(g,px,py);else if(g._lo)drawSprite(g,pk('mil_apc','apc'),px,py,.707,.707)}if(decor[i]===2&&!SPR.ready){paintParkedPlane(g,px,py)}}
  if(bt)paintLot(g,x,y,px,py,buildings[bi]);
}
function paintTank(g,px,py){g.fillStyle='rgba(0,0,0,.25)';poly(g,[px-5,py+1,px,py+3.5,px+5,py+1,px,py-1.5]);g.fillStyle='#4F5A36';poly(g,[px-5,py,px,py+2.5,px+5,py,px,py-2.5]);g.fillStyle='#5D6A40';poly(g,[px-2.4,py-1.4,px,py,px+2.4,py-1.4,px,py-2.8]);g.strokeStyle='#3A4328';g.lineWidth=.9;g.beginPath();g.moveTo(px,py-1.6);g.lineTo(px+5.5,py-4.2);g.stroke()}
function paintParkedPlane(g,px,py){g.save();g.translate(px,py);g.transform(1,.5,-1,.5,0,0);g.fillStyle='rgba(0,0,0,.2)';g.fillRect(-6,-1,12,2.4);g.fillStyle='#F2F4F6';g.fillRect(-7,-1.2,14,2.4);g.fillRect(-1.5,-7,3,14);g.fillRect(-7,-3,2,6);g.fillStyle='#D04848';g.fillRect(-7,-.5,2,1);g.restore()}
function paintLot(g,x,y,px,py,b){
  const t=b.type;if(t==='house'){ // bahçe çiti ve garaj yolu
    g.strokeStyle='rgba(240,235,220,.85)';g.lineWidth=.6;g.beginPath();dia(g,px,py,HW*.92,HH*.92);g.stroke();
    if(b.ent>=0){const ex=tx(b.ent)-x,ey=ty(b.ent)-y;if(Math.abs(ex)+Math.abs(ey)===1){g.fillStyle='#9EA2A6';const a=L(ex*.15-.08*Math.abs(ey),ey*.15-.08*Math.abs(ex)),c=L(ex*.5,ey*.5);g.beginPath();g.moveTo(px+a[0],py+a[1]);g.lineTo(px+c[0],py+c[1]);g.lineWidth=3;g.strokeStyle='#A6AAAE';g.stroke()}}}
  if(['office','tower','mall','hospital','highrise'].includes(t)){g.fillStyle='rgba(255,255,255,.35)';for(let k=0;k<4;k++){const p=L(-.42+k*.12,.42);g.fillRect(px+p[0]-1.2,py+p[1]-.6,2.4,1.2)}
    const cs=['#C0392B','#2C3E50','#ECF0F1','#2980B9','#7F8C8D'];for(let k=0;k<3;k++){const p=L(.42,-.3+k*.25);paintCarTop(g,px+p[0],py+p[1],cs[(b.id+k)%5])}}
  if(t==='factory'||t==='warehouse'){g.strokeStyle='rgba(255,230,120,.5)';g.lineWidth=.5;g.beginPath();for(let k=0;k<4;k++){const a=L(.3,-.4+k*.2),c=L(.46,-.4+k*.2);g.moveTo(px+a[0],py+a[1]);g.lineTo(px+c[0],py+c[1])}g.stroke()}
  if(t==='school'){g.strokeStyle='rgba(255,255,255,.7)';g.lineWidth=.5;dia(g,px+L(.3,.3)[0],py+L(.3,.3)[1],4,2);g.stroke()}
}
function paintCarTop(g,x,y,c){g.save();g.translate(x,y);g.transform(1,.5,-1,.5,0,0);g.fillStyle=c;g.fillRect(-1,-2,2,4);g.fillStyle='rgba(30,40,50,.6)';g.fillRect(-.8,-.8,1.6,1.4);g.restore()}
function roadCon(x,y){return[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>inb(x+dx,y+dy)&&isRoad(terr[idx(x+dx,y+dy)]))}
function paintRoad(g,x,y,px,py,t){
  if(t===T.BRIDGE&&seaMask[idx(x,y)]&&!g._overlay){g.fillStyle=waterCol(idx(x,y));dia(g,px,py,HW+.55,HH+.3);g.fill();g.fillStyle='rgba(0,0,0,.2)';dia(g,px+4,py+5,HW*.85,HH*.85);g.fill();g.fillStyle='#7E848A';g.fillRect(px-1.6,py-6,3.2,8);g.fillStyle='#6A7076';g.fillRect(px,py-6,1.6,8);return}
  const con=roadCon(x,y);const n=con.filter(Boolean).length;const SW=.18; // kaldırım genişliği
  const Q=(u0,v0,u1,v1,col)=>{const a=L(u0,v0),b=L(u1,v0),c=L(u1,v1),d=L(u0,v1);g.fillStyle=col;poly(g,[px+a[0],py+a[1],px+b[0],py+b[1],px+c[0],py+c[1],px+d[0],py+d[1]])};
  const swc=t===T.BRIDGE?'#C9CDD1':'#B9BDC1',curb='#8E9398';
  if(t===T.BRIDGE){g.fillStyle=waterCol(idx(x,y));dia(g,px,py,HW+.55,HH+.3);g.fill();g.fillStyle='rgba(0,0,0,.25)';dia(g,px+2,py+3,HW*.95,HH*.95);g.fill()}
  Q(-.5,-.5,.5,.5,'#4F555C');
  // kaldırımlar: bağlantısı olmayan kenarlar ve köşeler
  const E=[[.5-SW,-.5,.5,.5],[-.5,-.5,-.5+SW,.5],[-.5,.5-SW,.5,.5],[-.5,-.5,.5,-.5+SW]];// +x,-x,+y,-y
  for(let k=0;k<4;k++)if(!con[k]){const e=E[k];Q(e[0],e[1],e[2],e[3],swc)}
  for(const[cu,cv]of[[-1,-1],[1,-1],[-1,1],[1,1]]){const u0=cu<0?-.5:.5-SW,v0=cv<0?-.5:.5-SW;Q(u0,v0,u0+SW,v0+SW,swc)}
  // bordür çizgisi
  g.strokeStyle=curb;g.lineWidth=.5;g.beginPath();
  const seg=(u0,v0,u1,v1)=>{const a=L(u0,v0),b=L(u1,v1);g.moveTo(px+a[0],py+a[1]);g.lineTo(px+b[0],py+b[1])};
  const iS=.5-SW;
  if(!con[0])seg(iS,-iS,iS,iS);if(!con[1])seg(-iS,-iS,-iS,iS);if(!con[2])seg(-iS,iS,iS,iS);if(!con[3])seg(-iS,-iS,iS,-iS);
  if(con[0]){seg(iS,-iS,.5,-iS);seg(iS,iS,.5,iS)}if(con[1]){seg(-.5,-iS,-iS,-iS);seg(-.5,iS,-iS,iS)}if(con[2]){seg(-iS,iS,-iS,.5);seg(iS,iS,iS,.5)}if(con[3]){seg(-iS,-.5,-iS,-iS);seg(iS,-.5,iS,-iS)}
  g.stroke();
  if(n>=3){ // yaya geçitleri
    g.fillStyle='rgba(240,240,240,.85)';for(let k=0;k<4;k++){if(!con[k])continue;for(let s=0;s<5;s++){const o=-iS+.04+s*(2*iS-.08)/5;const w2=(2*iS-.08)/10;
      if(k===0)Q(iS-.1,o,iS-.02,o+w2,'rgba(240,240,240,.85)');if(k===1)Q(-iS+.02,o,-iS+.1,o+w2,'rgba(240,240,240,.85)');if(k===2)Q(o,iS-.1,o+w2,iS-.02,'rgba(240,240,240,.85)');if(k===3)Q(o,-iS+.02,o+w2,-iS+.1,'rgba(240,240,240,.85)')}}}
  else{ // şerit çizgileri
    g.strokeStyle='#E9CF5E';g.lineWidth=.55;g.setLineDash([2.2,2.2]);g.beginPath();
    const horiz=con[0]||con[1],vert=con[2]||con[3];
    if(horiz&&!vert)seg(-.5,0,.5,0);else if(vert&&!horiz)seg(0,-.5,0,.5);else{for(let k=0;k<4;k++)if(con[k]){const d=[[.5,0],[-.5,0],[0,.5],[0,-.5]][k];seg(0,0,d[0],d[1])}}
    g.stroke();g.setLineDash([])}
  if(t===T.BRIDGE){g.strokeStyle='#E2E5E8';g.lineWidth=.8;g.beginPath();if(!con[0])seg(.5,-.5,.5,.5);if(!con[1])seg(-.5,-.5,-.5,.5);if(!con[2])seg(-.5,.5,.5,.5);if(!con[3])seg(-.5,-.5,.5,-.5);g.stroke()}
}
function paintBorders(g,x,y,px,py){
  const i=idx(x,y),o=owner[i];if(isWater(terr[i]))return;
  const chk=(xx,yy)=>{if(!inb(xx,yy))return false;const j=idx(xx,yy);if(isWater(terr[j]))return false;return owner[j]!==o};
  if(o<0)return;const col=NATIONS[o].color;
  const edges=[];if(chk(x+1,y))edges.push([HW,0,0,HH]);if(chk(x,y+1))edges.push([-HW,0,0,HH]);if(chk(x-1,y))edges.push([-HW,0,0,-HH]);if(chk(x,y-1))edges.push([HW,0,0,-HH]);
  if(!edges.length)return;
  g.lineCap='round';
  for(const[a,b,c,d]of edges){const other=(()=>{return true})();g.strokeStyle=shade(col,-.1);g.lineWidth=2.6;g.globalAlpha=.85;g.beginPath();g.moveTo(px+a,py+b);g.lineTo(px+c,py+d);g.stroke();
    g.strokeStyle='rgba(255,255,255,.75)';g.lineWidth=.7;g.setLineDash([2,2]);g.beginPath();g.moveTo(px+a,py+b);g.lineTo(px+c,py+d);g.stroke();g.setLineDash([]);g.globalAlpha=1}
  g.lineCap='butt';
}
function paintMountain(g,x,y,px,py){const i=idx(x,y),h=hash(x,y);const ht=12+h*12,ox=(h-.5)*6;
  const gr=g.createLinearGradient(px-HW,py-ht,px,py+HH);gr.addColorStop(0,'#A6AA9C');gr.addColorStop(1,'#7E846F');g.fillStyle=gr;poly(g,[px-HW,py,px+ox,py-ht,px,py+HH]);
  g.fillStyle='#636957';poly(g,[px,py+HH,px+ox,py-ht,px+HW,py]);
  g.fillStyle='rgba(0,0,0,.08)';poly(g,[px+ox,py-ht,px+ox*.3+2,py,px,py+HH]);
  if(elev[i]>.42||h>.55){g.fillStyle='#F2F5F7';poly(g,[px+ox-4,py-ht+6,px+ox,py-ht,px+ox+4,py-ht+6,px+ox+1,py-ht+4.5])}}

// ============================================================
// Ses: sentezlenen müzik, şehir ve savaş ambiyansı, konumsal efektler (Web Audio, dosya yok)
// ============================================================
const AU={ctx:null,on:true};
function auInit(){if(AU.ctx)return;try{const C=new(window.AudioContext||window.webkitAudioContext)();AU.ctx=C;
  AU.master=C.createGain();AU.master.gain.value=AU.on?.9:0;AU.master.connect(C.destination);
  AU.bus=C.createDynamicsCompressor();AU.bus.connect(AU.master);
  const len=C.sampleRate*2;const bb=C.createBuffer(1,len,C.sampleRate),bd=bb.getChannelData(0);let b=0;for(let i=0;i<len;i++){b=(b+.02*(Math.random()*2-1))/1.02;bd[i]=b*3.5}AU.brown=bb;
  const wb=C.createBuffer(1,len,C.sampleRate),wd=wb.getChannelData(0);for(let i=0;i<len;i++)wd[i]=Math.random()*2-1;AU.white=wb;
  AU.amb=loopNoise(AU.brown,500);AU.war=loopNoise(AU.brown,160);startMusic();setInterval(auTick,250)}catch(e){console.warn('ses',e)}}
function loopNoise(buf,f){const C=AU.ctx,s=C.createBufferSource();s.buffer=buf;s.loop=true;const fl=C.createBiquadFilter();fl.type='lowpass';fl.frequency.value=f;const g=C.createGain();g.gain.value=0;s.connect(fl).connect(g).connect(AU.bus);s.start();return g}
function env(g,t,a,peak,d){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(Math.max(.0002,peak),t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d)}
function panTo(p){const C=AU.ctx;if(!C.createStereoPanner)return AU.bus;const s=C.createStereoPanner();s.pan.value=clamp(p,-1,1);s.connect(AU.bus);return s}
function spatial(wx,wy,range){const d=Math.hypot(wx-cam.x,wy-cam.y),zf=clamp((cam.z-.6)/1.4,0,1);return{g:clamp(1-d/(range/Math.max(.5,cam.z)),0,1)*zf,pan:(wx-cam.x)*cam.z/(innerWidth/2)}}
function sfxNoise(buf,f,q,peak,dur,pan,type){const C=AU.ctx,t=C.currentTime,s=C.createBufferSource();s.buffer=buf;const fl=C.createBiquadFilter();fl.type=type||'lowpass';fl.frequency.value=f;fl.Q.value=q;const g=C.createGain();
  s.connect(fl).connect(g).connect(panTo(pan));env(g,t,.005,peak,dur);s.start(t,Math.random()*1.5);s.stop(t+dur+.1)}
function sfxBoom(wx,wy,kind){if(!AU.ctx||!AU.on)return;const sp=spatial(wx,wy,1400);if(sp.g<.03)return;const big=kind==='big'||kind==='air';
  sfxNoise(AU.brown,big?180:300,.7,sp.g*(big?1:.6),big?1.6:.8,sp.pan);sfxNoise(AU.white,900,1,sp.g*.25,.12,sp.pan)}
function sfxShot(pan,g){sfxNoise(AU.white,1800+Math.random()*1500,2,g,.05+Math.random()*.04,pan,'bandpass')}
function tone(type,f,pan,g,d,sweep){const C=AU.ctx,t=C.currentTime,o=C.createOscillator();o.type=type;o.frequency.setValueAtTime(f,t);if(sweep){o.frequency.exponentialRampToValueAtTime(f*sweep,t+d*.5);o.frequency.exponentialRampToValueAtTime(f,t+d)}
  const fl=C.createBiquadFilter();fl.type='lowpass';fl.frequency.value=1500;const e=C.createGain();o.connect(fl).connect(e).connect(panTo(pan));env(e,t,.01,g,d);o.start(t);o.stop(t+d+.1)}
function auTick(){if(!AU.ctx||typeof cities==='undefined'||!cities.length)return;const t=AU.ctx.currentTime;
  let cb=0,cp=0;for(const ct of cities){const p=W2(ct.x,ct.y),sp=spatial(p[0],p[1],(ct.R||8)*40+500);if(sp.g>cb){cb=sp.g;cp=sp.pan}}
  const night=typeof nightAmt==='function'?nightAmt()>.5:false,city=cb*(night?.45:1);AU.amb.gain.setTargetAtTime(AU.on?city*.5:0,t,.4);
  if(AU.on&&city>.15){if(Math.random()<city*.1)tone('square',380+Math.random()*120,cp+rnd(-.4,.4),city*.06,.25);if(!night&&Math.random()<city*.1)tone('sine',2200+Math.random()*1500,cp+rnd(-.6,.6),city*.04,.18,1.4)}
  let wb=0,wp=0;for(const w of wars){if(!w.front)continue;const p=W2(w.front.x,w.front.y),sp=spatial(p[0],p[1],1600);if(sp.g>wb){wb=sp.g;wp=sp.pan}}
  AU.war.gain.setTargetAtTime(AU.on?wb*.9:0,t,.5);
  if(AU.on&&wb>.08){const n=Math.random()<wb?ri(1,5):0;for(let k=0;k<n;k++)setTimeout(()=>sfxShot(wp+rnd(-.5,.5),wb*.35),k*rnd(60,140));if(Math.random()<wb*.15)sfxNoise(AU.brown,140,.7,wb*.7,1.8,wp+rnd(-.4,.4))}}
// kısık ambiyans müziği: yumuşak akorlar + seyrek çan notaları + yankı
function startMusic(){const C=AU.ctx,g=C.createGain();g.gain.value=.05;const fl=C.createBiquadFilter();fl.type='lowpass';fl.frequency.value=1100;
  const dl=C.createDelay();dl.delayTime.value=.42;const fb=C.createGain();fb.gain.value=.35;dl.connect(fb).connect(dl);g.connect(fl);fl.connect(AU.bus);fl.connect(dl);dl.connect(AU.bus);AU.music=g;
  const CH=[[57,60,64],[53,57,60],[48,52,55],[55,59,62],[52,55,59],[53,57,60]],hz=m=>440*Math.pow(2,(m-69)/12);let i=0;
  const play=()=>{const t=C.currentTime+.05,ch=CH[i++%CH.length];
    for(const m of ch)for(const det of[-4,4]){const o=C.createOscillator();o.type='triangle';o.frequency.value=hz(m-12);o.detune.value=det;const e=C.createGain();o.connect(e).connect(g);
      e.gain.setValueAtTime(0,t);e.gain.linearRampToValueAtTime(.18,t+2.5);e.gain.linearRampToValueAtTime(0,t+8.5);o.start(t);o.stop(t+8.7)}
    for(let k=0;k<3;k++)if(Math.random()<.6){const o=C.createOscillator();o.type='sine';o.frequency.value=hz(pick(ch)+12+pick([0,2,7]));const e=C.createGain();o.connect(e).connect(g);
      const tt=t+1+k*2.3+Math.random();e.gain.setValueAtTime(0,tt);e.gain.linearRampToValueAtTime(.12,tt+.02);e.gain.exponentialRampToValueAtTime(.001,tt+2.2);o.start(tt);o.stop(tt+2.4)}};
  play();setInterval(play,8000)}
// patlamalara ses
(function(){const ob=boomWorld;boomWorld=function(wx,wy,kind){ob(wx,wy,kind);try{sfxBoom(wx,wy,kind)}catch(e){}}})();
// ses butonu ve ilk etkileşimde başlatma
(function(){try{AU.on=localStorage.getItem('d10_sound')!=='0'}catch(e){}
  const ref=$('#uiBtn')||$('#summitBtn');if(ref&&!$('#sndBtn'))ref.insertAdjacentHTML('beforebegin','<button class="tbtn" id="sndBtn" title="Sesi aç veya kapat">'+(AU.on?'🔊':'🔇')+'</button>');
  const btn=$('#sndBtn');if(btn)btn.onclick=()=>{auInit();AU.on=!AU.on;btn.textContent=AU.on?'🔊':'🔇';try{localStorage.setItem('d10_sound',AU.on?'1':'0')}catch(e){}if(AU.master)AU.master.gain.setTargetAtTime(AU.on?.9:0,AU.ctx.currentTime,.1)};
  const first=()=>{auInit();if(AU.ctx&&AU.ctx.state==='suspended')AU.ctx.resume();removeEventListener('pointerdown',first);removeEventListener('keydown',first)};
  addEventListener('pointerdown',first);addEventListener('keydown',first)})();

window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message).slice(0,160)));
// ============================================================
// Ana döngü ve açılış
// ============================================================
let lastHour=0,lastDay=0;
function hourly(){
  diseaseHour();
  for(const nt of nations){if(R()<.014*(1.3-nt.lvl.fire)){const c=[];for(let k=0;k<30;k++){const b=buildings[ri(0,buildings.length-1)];if(b.c===nt.id&&b.ent>=0&&['factory','house','apartment','shop','warehouse','office'].includes(b.type))c.push(b)}if(c.length)ignite(pick(c),pick(['elektrik kontağı','ihmal','gaz kaçağı','sanayi kazası']))}}
  if(floodList.length)floodList=floodList.filter(i=>flood[i]>0);
}
function daily(){
  for(const nt of nations){weatherDay(nt);economyDay(nt)}
  relationsDay();warDay();constructionDay();
  const before=cities.map(c=>c.R).join(',')+cities.length;
  for(const nt of nations)growthDay(nt);
  const after=cities.map(c=>c.R).join(',')+cities.length;
  if(before!==after){bDist=null;computeRoadComp();computeIntersections();pathCache.clear();for(const ct of cities)spawnAmbientFor(ct)}
  scheduleFlights();scheduleShips();ensureFishing();presidentsDay();storyDaily();
  for(const nt of nations){
    if(R()<.0016)quake(nt);if(nt.weather==='fırtına'&&R()<.15||nt.weather==='yağmurlu'&&R()<.008)floodEv(nt);
    if(R()<.003)wildfire(nt);if(R()<.0018)epidemic(nt);if(R()<.0008)crisis(nt);
    if(R()<.1){const c=aliveOf(nt.id).filter(a=>a.hs===0);if(c.length)infect(pick(c))}}
  if(dayIdx()%7===0){const best=nations.slice().sort((a,b)=>b.gdp-a.gdp)[0];news(-1,`Haftalık özet: en büyük ekonomi ${best.name} ($${nf(best.gdp,0)} milyar), toplam ${cities.length} şehir, ${wars.length} aktif savaş.`,'info')}
}
function simStep(dm){
  now+=dm;
  for(const a of agents){if(!a.alive||a.state==='MOVE'||a.state==='WAIT')continue;if(now>=a.next)think(a);
    if(a.state==='HOME')a.energy=Math.min(1,a.energy+.0012*dm);else a.energy=Math.max(0,a.energy-.0004*dm);
    if(a.state==='WORK')a.money=Math.min(1,a.money+.0003*dm);else a.fun=Math.max(0,a.fun-.0002*dm)}
  updateFires(dm);if(anyWild)updateWildfires(dm);warTick(dm);shipsTick(dm);flightsTick();
  if(floodList.length)for(const i of floodList)flood[i]-=dm;
  const h=Math.floor(now/60);if(h!==lastHour){lastHour=h;hourly()}
  const d=dayIdx();if(d!==lastDay){lastDay=d;daily()}
}
let lastTs=0,uiT=0,miniT=0,running=false,fps=60;
function loop(ts){
  const dt=Math.min(.1,(ts-lastTs)/1000||0);lastTs=ts;fps=lerp(fps,dt>0?1/dt:60,.05);
  const dmTotal=dt*SPEEDS[speedIdx];let dm=dmTotal;
  try{while(dm>0){const st=Math.min(dm,2);dm-=st;simStep(st)}processTrips();ambBudget=30;updateMovement(dmTotal,dt);while(deferred.length)deferred.shift()()}catch(e){console.error(e)}
  try{render()}catch(e){console.error(e)}
  uiT+=dt;miniT+=dt;
  if(uiT>.5){uiT=0;fitTop();updateClock();renderNations();updateDossier();if(feedDirty)renderFeed();updateInspect()}
  if(miniT>.5){miniT=0;drawMini()}
  requestAnimationFrame(loop)}
function boot(){
  $('#loading').style.display='flex';const bar=$('#loadbar'),msg=$('#loadmsg');
  setTimeout(()=>{
    chunkCache.clear();chunkBytes=0;spriteCache.clear();spriteBytes=0;pathCache.clear();shipPaths.clear();feed.length=0;wars=[];incidents=[];burning=[];planes=[];ships=[];particles=[];tripQ.length=0;floodList=[];
    now=360;lastHour=6;lastDay=0;
    const prog=(p,m)=>{bar.style.width=(p*100)+'%';msg.textContent=m};
    worldReady=false;bDist=null;genWorld(prog);const SV=readSave();window.__resumed=!!SV;if(SV)applySave(SV);populate();worldReady=true;initRelations();computeIntersections();initAmbient();initClouds();markAllDirty();
    if(window.__resumed)news(-1,'Kayıt yüklendi; dünya kaldığı yerden devam ediyor.','ai');else for(const nt of nations)remember(nt,`Göreve başladım. Ülkem ${nt.name}, ideolojim ${nt.pres.ideo}.`);
    news(-1,`${fmtDate(now,false)}: Worldmind başladı. On ülke, on yapay zekâ başkan, ${agents.length} vatandaş ajanı ve ${ambient.length} sürücü ile yaya sahnede.`,'ai');
    scheduleFlights();scheduleShips();ensureFishing();for(const s of ships)if(s.depart)s.depart=now+rnd(0,300);
    selNation=0;dossierFor=-1;const c=capOf(0);focusTile(idx(c.x,c.y),1.6);
    bar.style.width='100%';msg.textContent='Grafikler yükleniyor…';Promise.race([SPR.promise||Promise.resolve(),new Promise(r=>setTimeout(r,20000))]).then(()=>{markAllDirty();$('#loading').style.display='none'});
    renderNations();updateDossier();renderFeed();updateClock();
    checkServer().then(ok=>{if(ok)news(-1,`Yapay zekâ bağlantısı kuruldu; başkanlar dil modeliyle düşünüyor.`,'ai')});
    if(!running){running=true;resize();requestAnimationFrame(loop)}
    if(!sessionFlag('intro'))openModal(`<h3>Worldmind’e hoş geldin</h3>
      <p>On ülke, geniş ve sahipsiz bir kıtaya dağılmış küçük başkentlerle başlıyor. Zamanla sınırlarını genişletiyor, yeni mahalleler ve kasabalar kuruyor. Yer kalmayınca yükseğe yapılaşıyor, denizaşırı koloni kuruyor ya da komşusuyla toprak için savaşıyorlar.</p>
      <p>Her ülkeyi bir yapay zekâ başkan yönetir. Vatandaşlar işe gider, sağ şeritten araç kullanır, kırmızı ışıkta durur, kaldırımdan yürür. Polis hırsızı kovalar, itfaiye yangına koşar, gemiler limanlar arasında yük taşır.</p>
      <p>Haritayı sürükle, tekerlekle yakınlaş, bir insana ya da binaya tıkla. Boşluk tuşu zamanı durdurur, 1–5 tuşları hızı seçer.</p>
      <div class="mbtns"><button class="tbtn primary" onclick="closeModal()">Simülasyonu izle</button></div>`);
  },40);
}
function sessionFlag(k){try{const v=sessionStorage.getItem('d10_'+k);sessionStorage.setItem('d10_'+k,'1');return v}catch(e){return null}}
window.addEventListener('resize',()=>{resize();fitTop()});fitTop();
setSpeed(1);boot();

if(location.search.includes('selftest'))setTimeout(()=>{try{closeModal();setSpeed(3);cam.z=2.4;const w=wars[0];const sold=agents.find(a=>a.role==='soldier'&&a.alive);
  const shot=()=>{const d=document.createElement('pre');d.id='selftest';d.textContent=JSON.stringify({spr:SPR.ready,sprites:SPR.man?Object.keys(SPR.man).length:0,err:window.__errs.slice(0,8),agents:agents.length,movers:movers.length,ships:ships.length,planes:planes.length,fps:Math.round(fps),drawn:drawList.length,vehDrawn:drawList.filter(o=>o.k===3).length,day:dayIdx()});document.body.appendChild(d)};
  setTimeout(shot,9000)}catch(e){window.__errs.push('selftest '+e.message)}},3000);

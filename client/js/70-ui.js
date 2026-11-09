// ============================================================
// Arayüz
// ============================================================
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nf=(v,d=1)=>Number(v).toLocaleString('tr-TR',{minimumFractionDigits:d,maximumFractionDigits:d});
function toast(text,ai){const el=document.createElement('div');if(ai)el.className='ai';el.textContent=text;$('#toast').appendChild(el);setTimeout(()=>el.remove(),4500);while($('#toast').children.length>3)$('#toast').firstChild.remove()}
function setSpeed(i){speedIdx=i;document.querySelectorAll('.speeds button').forEach(b=>b.classList.toggle('on',+b.dataset.s===i))}
document.querySelectorAll('.speeds button').forEach(b=>b.onclick=()=>setSpeed(+b.dataset.s));
document.querySelectorAll('[data-menu]').forEach(b=>b.onclick=e=>{e.stopPropagation();const m=$('#'+b.dataset.menu);const open=!m.classList.contains('open');document.querySelectorAll('.menu').forEach(x=>x.classList.remove('open'));if(open)m.classList.add('open')});
document.addEventListener('click',e=>{if(!e.target.closest('.menuwrap'))document.querySelectorAll('.menu').forEach(x=>x.classList.remove('open'))});
const lyMap={lyPol:'pol',lyNight:'night',lyLabels:'labels',lyWeather:'weather',lyNpc:'npc',lyClouds:'clouds'};
for(const k in lyMap){const el=$('#'+k);if(el)el.onchange=e=>{LAYERS[lyMap[k]]=e.target.checked}}
document.querySelectorAll('[data-ev]').forEach(b=>b.onclick=()=>{const nt=nations[selNation];const ev=b.dataset.ev;const cap=capOf(nt.id);
  if(ev==='quake')quake(nt);if(ev==='epidemic')epidemic(nt);if(ev==='flood')floodEv(nt);if(ev==='wildfire')wildfire(nt);
  if(ev==='storm'){nt.forceStorm=1;nt.weather='fırtına';news(nt.id,`${nt.name}: şiddetli fırtına uyarısı, uçuş ve gemi seferleri iptal.`,'hi')}
  if(ev==='crisis')crisis(nt);if(ev==='war'){const ca=capOf(nt.id);const o=nations.filter(x=>x.id!==nt.id&&!atWar(nt.id,x.id)).sort((p,q)=>Math.hypot(capOf(p.id).x-ca.x,capOf(p.id).y-ca.y)-Math.hypot(capOf(q.id).x-ca.x,capOf(q.id).y-ca.y))[0];if(o){setRel(nt.id,o.id,-90);declareWar(nt.id,o.id,'sınır anlaşmazlığı');const f=frontTile(nt.id,o.id);setTimeout(()=>focusTile(idx(Math.round(f.cx),Math.round(f.cy)),2.2),400);setSpeed(2)}}if(ev==='border')borderIncident(nt);if(ev==='crimewave')crimeWave(nt);
  if(ev==='fire'){const c=buildings.filter(x=>x.c===nt.id&&x.ent>=0&&!['rubble','construction'].includes(x.type));const b=pick(c);ignite(b,'elektrik kontağı');focusTile(b.i,2.4)}
  if(ev==='quake'||ev==='flood'||ev==='epidemic')focusTile(idx(cap.x,cap.y),1.4);
  document.querySelectorAll('.menu').forEach(x=>x.classList.remove('open'))});
function focusTile(i,z){cam.follow=null;const p=W2(tx(i)+.5,ty(i)+.5);cam.x=p[0];cam.y=p[1];if(z)cam.z=z}

function renderNations(){
  $('#natlist').innerHTML=nations.map(nt=>{const tags=(warsOf(nt.id).length?'<span class="tag war">savaş</span>':'')+(nt.quarantine?'<span class="tag q">karantina</span>':'')+(nt.curfew?'<span class="tag cf">yasak</span>':'');
    return`<button class="nat${nt.id===selNation?' sel':''}" data-n="${nt.id}"><span class="sw" style="background:linear-gradient(90deg,${nt.def.flag[0]} 0 34%,${nt.def.flag[1]} 34% 66%,${nt.def.flag[0]} 66%)"></span><span class="nm">${nt.name}${tags}</span><span class="ap" style="color:${nt.approval<35?'var(--alert)':nt.approval>60?'var(--ok)':'var(--ink)'}">%${nf(nt.approval,0)}</span><span class="sub">${esc(nt.pres.name)}, ${lo(nt.pres.ideo)}</span><span class="apbar"><i style="width:${nt.approval}%;background:${nt.approval<35?'var(--alert)':nt.approval>60?'var(--ok)':'var(--sky)'}"></i></span></button>`}).join('')}
$('#natlist').onclick=e=>{const b=e.target.closest('.nat');if(!b)return;selectNation(+b.dataset.n,true)};
function selectNation(k,fly){selNation=k;dossierFor=-1;renderNations();updateDossier();if(fly){const c=capOf(k);focusTile(idx(c.x,c.y),Math.max(cam.z,1.5))}if(innerWidth<760){$('#dossier').classList.remove('collapsed');$('#nations').classList.remove('open')}}
$('#dosToggle').onclick=()=>$('#dossier').classList.toggle('collapsed');$('#natToggle').onclick=()=>$('#nations').classList.toggle('open');
function fitTop(){document.documentElement.style.setProperty('--topH',$('#top').offsetHeight+'px')}
if(innerWidth<760)$('#dossier').classList.add('collapsed');

let dossierFor=-1;
function flagHTML(nt){const[a,b]=nt.def.flag;return`<div class="flag" style="background:linear-gradient(90deg,${a} 0 34%,${b} 34% 66%,${a} 66%)"></div>`}
function territoryOf(c){let n=0;for(let i=0;i<N;i++)if(owner[i]===c)n++;return n}
function updateDossier(){
  const nt=nations[selNation];const D=$('#dossier');
  if(dossierFor!==selNation){dossierFor=selNation;
    D.innerHTML=`<div class="dhead">${flagHTML(nt)}<div><div class="dname">${nt.name}</div><div class="dsub" id="dCap"></div></div></div>
    <div class="pres" id="dPres"></div>
    <div class="dbtns"><button class="tbtn primary" id="dThink">Başkanı düşündür</button><button class="tbtn" id="dFly">Başkente git</button></div>
    <div class="grid" id="dStats"></div>
    <div class="sect"><h2>Şehirler ve büyüme</h2><div id="dCities" style="font-size:12.5px"></div></div>
    <div class="sect"><h2>Bütçe dağılımı ve hizmet seviyesi</h2><div id="dBudget"></div></div>
    <div class="sect"><h2>Dış ilişkiler</h2><div id="dRel"></div></div>
    <div class="sect"><h2>Karar defteri</h2><ul class="log" id="dLog"></ul></div>
    <div class="sect"><h2>Başkanla görüş</h2><div class="chat"><div class="msgs" id="dMsgs"></div>
      <form id="dChat"><input id="dChatIn" placeholder="Örn: Neden vergileri artırdınız?" autocomplete="off" aria-label="Başkana mesaj"><button class="tbtn">Gönder</button></form></div></div>`;
    $('#dThink').onclick=()=>runSummit([nt]);$('#dFly').onclick=()=>{const c=capOf(nt.id);focusTile(idx(c.x,c.y),1.8)};
    $('#dChat').onsubmit=e=>{e.preventDefault();const v=$('#dChatIn').value.trim();if(!v)return;$('#dChatIn').value='';presChat(nt,v)};renderChat(nt)}
  const P=nt.pres;const alive=nationAgents(nt.id);const pop=popOf(nt);
  if(!nt._terrT||now-nt._terrT>240){nt._terr=territoryOf(nt.id);nt._terrT=now}
  $('#dCap').textContent=`Başkent ${capOf(nt.id).name}, ${cityList(nt.id).length} şehir, hava ${nt.weather}`;
  $('#dPres').innerHTML=`<div class="pn">${esc(P.name)}</div><div class="pi">${P.ideo}: ${IDEO[P.ideo].blurb} Ruh hâli ${P.mood}.</div>
    <div class="brainrow"><span class="chip${/Claude|Sunucu|Yapay/.test(P.brain)?' claude':''}">Son karar: ${esc(P.brain)}</span><span class="chip">Saldırganlık ${nf(P.traits.aggr*100,0)}</span><span class="chip">Temkin ${nf(P.traits.caution*100,0)}</span><span class="chip">Empati ${nf(P.traits.empathy*100,0)}</span></div>
    ${P.speech?`<q>${esc(P.speech)}</q>`:''}`;
  const st=(k,v,cls='')=>`<div class="stat"><div class="k">${k}</div><div class="v ${cls}">${v}</div></div>`;
  const crime7=nt.stats.crimeDays.slice(0,7).reduce((a,b)=>a+b,0);
  ensureRes(nt);$('#dStats').innerHTML=st('Kaynaklar','Petrol '+nt.kaynak.petrol+', Tahıl '+nt.kaynak.tahil+', Maden '+nt.kaynak.maden)+st('Petrol fiyatı','x'+PRICE.petrol.toFixed(2),PRICE.petrol>1.2?'bad':'')+st('Nüfus',nf(pop,1)+' milyon')+st('GSYH','$'+nf(nt.gdp,0)+' milyar')+st('Büyüme','%'+nf(nt.growth*100,1),nt.growth<0?'bad':'good')+st('Hazine',nf(nt.treasury,1)+' milyar',nt.treasury<0?'bad':'')+
    st('Toprak',nf(nt._terr*.0625,0)+' km²',nt.landlocked?'warn':'')+st('Onay','%'+nf(nt.approval,0),nt.approval<35?'bad':nt.approval>60?'good':'')+st('Vergi oranı','%'+nf(nt.tax*100,0))+st('Mutluluk',nf(nt.happiness,0)+'/100')+
    st('İşsizlik','%'+nf(nt.unemployment*100,1),nt.unemployment>.1?'bad':'')+st('Suç (7 gün)',crime7,crime7>alive*.12?'bad':'')+st('Tutuklama',nt.stats.arrests)+st('Enfekte',nt.stats.infected,nt.stats.infected>alive*.05?'bad':'')+
    st('Askerî güç',nf(nt.mil,0)+'/100')+st('Yangınlar',nt.stats.fires)+st('Ölüm / doğum',nt.stats.deaths+' / '+nt.stats.births)+st('Yeni yapı',nt.stats.built);
  $('#dCities').innerHTML=cityList(nt.id).map(c=>`<div class="bar"><span>${esc(c.name)}</span><span class="t"><i style="width:${c.R/c.maxR*100}%;background:${c.blocked?'var(--brass)':'var(--sky)'}"></i></span><span>${c.R}/${c.maxR}</span></div>`).join('')+
    `<div style="color:var(--mute);margin-top:4px">${nt.landlocked?'Sahipsiz arazi kalmadı: ülke artık dikey yapılaşma, koloni ya da diplomasiyle büyüyebilir.':'Sınırlar sahipsiz araziye doğru genişliyor ('+nt.stats.claimed+' karo kazanıldı).'}</div>`;
  $('#dBudget').innerHTML=SECTORS.map(s=>`<div class="bar"><span>${SECTOR_TR[s]}</span><span class="t"><i style="width:${nt.lvl[s]*100}%;background:${nt.lvl[s]<.45?'var(--alert)':nt.lvl[s]>.8?'var(--ok)':'var(--sky)'}"></i></span><span>%${nf(nt.budget[s]*100,0)}</span></div>`).join('');
  $('#dRel').innerHTML=nations.filter(o=>o.id!==nt.id).sort((a,b)=>nt.rel[b.id]-nt.rel[a.id]).map(o=>{const r=nt.rel[o.id];const l=r>=0?50:50+r/2,w=Math.abs(r)/2;
    const tg=(atWar(nt.id,o.id)?'savaş ':'')+(nt.ally.has(o.id)?'müttefik ':'')+(nt.trade.has(o.id)?'ticaret ':'')+(nt.sanction.has(o.id)?'yaptırım ':'')+(isNeighbor(nt.id,o.id)?'komşu':'');
    return`<div class="rel"><span class="sw" style="background:${o.color}"></span><span>${o.name}</span><span class="t"><i style="left:${l}%;width:${w}%;background:${r<0?'var(--alert)':'var(--ok)'}"></i></span><span style="color:var(--mute);font-size:11px">${r>0?'+':''}${r} ${tg}</span></div>`}).join('');
  $('#dLog').innerHTML=nt.decisions.slice(0,8).map(d=>`<li><em>${fmtTime(d.t)} ${esc(d.src)}</em>${esc(d.summary)}${d.reason?`<br><span style="color:var(--mute)">Gerekçe: ${esc(d.reason)}</span>`:''}</li>`).join('')||'<li>Başkan ilk kararını birkaç gün içinde verecek. Beklemek istemiyorsan “Başkanı düşündür”e bas.</li>';
}
function renderChat(nt){const M=$('#dMsgs');if(!M)return;M.innerHTML=nt.chat.map(m=>`<div class="m${m.me?' me':''}">${esc(m.text)}</div>`).join('')||'<div class="m">Başkana bir soru sor ya da bir politika öner. Ajan kendi karakterine göre yanıt verir, ikna olursa eyleme geçer.</div>';M.scrollTop=M.scrollHeight}

let feedFilter='all';
document.querySelectorAll('.feedtabs button').forEach(b=>b.onclick=()=>{feedFilter=b.dataset.f;document.querySelectorAll('.feedtabs button').forEach(x=>x.classList.toggle('on',x===b));renderFeed()});
function renderFeed(){feedDirty=false;const items=feed.filter(f=>feedFilter==='all'||(feedFilter==='ai'&&f.kind==='ai')||(feedFilter==='hi'&&(f.kind==='hi'||f.kind==='big'))||(feedFilter==='sel'&&f.c===selNation)).slice(0,140);
  $('#feedlist').innerHTML=items.map(f=>`<li class="${f.kind==='hi'||f.kind==='big'?'hi':f.kind==='ai'?'ai':''}" data-k="${feed.indexOf(f)}"><time>${fmtTime(f.t)}</time><span class="sw" style="background:${f.c>=0?NATIONS[f.c].color:'#888'}"></span><span>${esc(f.text)}</span></li>`).join('')}
$('#feedlist').onclick=e=>{const li=e.target.closest('li');if(!li)return;const f=feed[+li.dataset.k];if(!f)return;if(f.tile>=0)focusTile(f.tile,Math.max(cam.z,2));if(f.c>=0&&f.c!==selNation)selectNation(f.c,f.tile<0)};
function updateClock(){const d=dateOf(now);const sh=ships.filter(s=>!s.hidden).length;
  $('#clock').innerHTML=`${GUNLER[d.getUTCDay()]} ${fmtDate(now)}<small>Oyun günü ${dayIdx()+1}, ${planes.length} uçuş, ${sh} gemi seferde, ${wars.length?wars.length+' aktif savaş':'savaş yok'}</small>`}

function openInspect(){$('#inspect').classList.add('open');updateInspect()}
$('#inspect .x').onclick=()=>{$('#inspect').classList.remove('open');selAgent=null;selBuilding=null;cam.follow=null};
let citizenSay='';
function updateInspect(){if(!$('#inspect').classList.contains('open'))return;const B=$('#inspBody');
  if(selAgent){const a=selAgent;const nt=nations[a.c];const hs=['sağlıklı','enfekte (belirti yok)','hasta','bağışık'][a.hs];
    const where={home:'eve',work:'işe',leisure:'gezmeye',patrol:'devriyeye',crime:'hedefe',respond:'olay yerine',chase:'şüpheliyi kovalamaya',hospital:'hastaneye',front:'cepheye',return:'merkeze'}[a.purpose]||'';
    B.innerHTML=`<h3>${esc(a.name)}</h3><div style="font-size:12px;color:var(--mute)">${ROLE_TR[a.role]}, ${a.age} yaşında, ${nt.name}</div>
      <dl><dt>Durum</dt><dd>${a.alive?(STATE_TR[a.state]||a.state):'Hayatını kaybetti ('+(a.cause||'')+')'}${a.state==='MOVE'&&where?' ('+where+(a.mode==='walk'?', yürüyerek':', araçla')+')':''}${a.redLight?' — kırmızı ışıkta bekliyor':''}</dd>
      <dt>Sağlık</dt><dd>${hs}</dd><dt>Enerji</dt><dd>%${nf(a.energy*100,0)}</dd><dt>Keyif</dt><dd>%${nf(a.fun*100,0)}</dd><dt>Birikim</dt><dd>%${nf(a.money*100,0)}</dd>
      <dt>Ev</dt><dd>${BT[buildings[a.home]?.type]?.lbl||'-'}</dd><dt>İş</dt><dd>${a.work===a.home?'-':BT[buildings[a.work]?.type]?.lbl||'-'}</dd></dl>
      <div class="dbtns"><button class="tbtn" id="iFollow">${cam.follow===a?'Takibi bırak':'Takip et'}</button><button class="tbtn" id="iTalk">Vatandaşa sor</button></div>${citizenSay?`<div class="say">${esc(citizenSay)}</div>`:''}`;
    $('#iFollow').onclick=()=>{cam.follow=cam.follow===a?null:a;updateInspect()};$('#iTalk').onclick=()=>citizenTalk(a)}
  else if(selBuilding){const b=selBuilding;const nt=nations[b.c];const inside=agents.filter(a=>a.alive&&a.at===b.id&&!a.vis);const ct=cities[b.city];
    B.innerHTML=`<h3>${BT[b.type].lbl}</h3><div style="font-size:12px;color:var(--mute)">${ct?esc(ct.name)+', ':''}${nt.name}</div>
      <dl><dt>İçerideki kişi</dt><dd>${inside.length}</dd><dt>Durum</dt><dd>${b.fire>0?'Yanıyor, hasar %'+nf(b.burn,0):b.type==='construction'?(BT[b.target]?BT[b.target].lbl+' inşaatı, ':'')+fmtDate(b.doneAt,false)+' tarihinde bitecek':b.type==='rubble'?'Yeniden inşa bekliyor':'Faal'}</dd>
      ${inside.length?`<dt>Örnek</dt><dd>${inside.slice(0,4).map(a=>esc(a.name)+' ('+lo(ROLE_TR[a.role])+')').join(', ')}</dd>`:''}</dl>`}}
async function citizenTalk(a){citizenSay='Düşünüyor…';updateInspect();const nt=nations[a.c];
  const prompt=`${nt.name} adlı ülkede yaşayan ${a.age} yaşında bir ${lo(ROLE_TR[a.role])} olan ${a.name} karakterini oyna. Şu an: ${STATE_TR[a.state]||a.state}. Sağlık: ${['sağlıklı','enfekte','hasta','bağışık'][a.hs]}.
Ülke durumu: devlet başkanı ${nt.pres.name} (${nt.pres.ideo}), onay %${nf(nt.approval,0)}, vergi %${nf(nt.tax*100,0)}, işsizlik %${nf(nt.unemployment*100,1)}, enfekte ${nt.stats.infected}, karantina ${nt.quarantine?'var':'yok'}, sokağa çıkma yasağı ${nt.curfew?'var':'yok'}, ${warsOf(nt.id).length?'ülke savaşta':'barış var'}, hava ${nt.weather}.
Son olaylar: ${feed.filter(f=>f.c===nt.id).slice(0,4).map(f=>f.text).join(' | ')||'sakin'}.
Bir gazeteci sana "Hayat nasıl gidiyor, hükümet hakkında ne düşünüyorsun?" diye soruyor. Karakterine uygun, samimi, 2-3 cümlelik Türkçe bir yanıt ver. Sadece yanıtı yaz.`;
  try{citizenSay=String((await askLLM(prompt)).data).trim()}catch(e){citizenSay=errText(e)}updateInspect()}
function errText(e){const c=e&&e.code;if(c==='unavailable')return'Yapay zekâ servisi bu görünümde kullanılamıyor. Oyunu claude.ai içinde ya da kendi sunucunda (npm start) açtığında devreye girer; yerel ajanlar çalışmaya devam ediyor.';
  if(c==='not_granted')return'Claude kullanımına izin verilmedi; yerel ajanlar çalışmaya devam ediyor.';if(c==='rate_limited')return'Yapay zekâ kullanım sınırına ulaşıldı, biraz sonra tekrar dene.';if(c==='server'||/fetch|HTTP|sağlayıcı/i.test(String(e&&e.message)))return'Yapay zekâ servisi şu an yanıt vermedi, birazdan tekrar denenecek.';return'Yanıt alınamadı, birazdan tekrar dene.'}
async function presChat(nt,text){nt.chat.push({me:true,text});nt.chat.push({me:false,text:'Düşünüyor…'});renderChat(nt);
  const hist=nt.chat.slice(-8,-2).map(m=>(m.me?'Danışman: ':'Sen: ')+m.text).join('\n');
  const prompt=briefFor(nt)+`\n\nÖnceki konuşma:\n${hist||'-'}\n\nBir danışmanın sana şunu söyledi: "${text}"\nKarakterine ve ideolojine uygun, en fazla 3 cümlelik Türkçe bir yanıt ver. İkna olduysan uygun eylemleri de seç (zorunlu değil).\nYalnızca JSON döndür: {"reply":"...","actions":[...]} Eylem biçimleri:\n`+ACTION_SCHEMA.split('Kullanılabilir eylemler (0-5 adet seç):')[1];
  let reply;try{const r=await askLLM(prompt,true);const o=parseJSONLoose(r.data);reply=o.reply||'…';const done=[];for(const a of o.actions||[]){const d=applyAction(nt,a,r.src);if(d)done.push(d)}
    if(done.length){logDecision(nt,r.src+' (görüşme)',done.join('; '),reply,'danışman görüşmesi sonrası');remember(nt,`Bir danışmanla görüştüm ve şunu yaptım: ${done.join('; ')}.`);reply+=`\n\nAlınan karar: ${done.join('; ')}.`}
    else remember(nt,`Bir danışman "${text.slice(0,80)}" dedi; yanıtım: ${reply.slice(0,80)}`)}catch(e){reply=errText(e)}
  nt.chat[nt.chat.length-1]={me:false,text:reply};if(nt.chat.length>30)nt.chat.splice(0,nt.chat.length-30);renderChat(nt);updateDossier()}

function openModal(html){$('#modalBox').innerHTML=html;$('#modal').classList.add('open')}
function closeModal(){$('#modal').classList.remove('open')}
$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal()};
let summitRunning=false;
async function runSummit(list){
  if(summitRunning)return;list=list||nations;const s=await getSampler();const srv=await checkServer();
  if((!s||claudeBlocked)&&!srv){openModal(`<h3>Yapay zekâ servisi bu görünümde yok</h3><p>Başkanlar şu an tarayıcıda çalışan ücretsiz yerel ajanlarla karar vermeye devam ediyor.</p><p>Gerçek dil modeli ajanları iki yolla devreye girer: oyunu claude.ai içinde açtığında Claude ile, ya da kendi sunucunda <b>npm start</b> ile çalıştırdığında ücretsiz modellerle (Pollinations, Groq, OpenRouter, Ollama).</p><div class="mbtns"><button class="tbtn primary" onclick="closeModal()">Tamam</button></div>`);return}
  summitRunning=true;const prev=speedIdx;if(list.length>1)setSpeed(0);
  openModal(`<h3>${list.length>1?'Yapay zekâ zirvesi':esc(list[0].pres.name)+' düşünüyor'}</h3><p>Her başkan yalnızca kendi ülkesinin verisini, hafızasını ve gelen teklifleri görerek ayrı bir yapay zekâ ajanı olarak karar verir.${list.length>1?' Zirve süresince zaman durduruldu.':''}</p><div id="sumRows">${list.map(nt=>`<div class="sumrow" id="sr${nt.id}"><b style="color:${nt.color}">${nt.name}</b>, ${esc(nt.pres.name)}<div class="acts">Sırada bekliyor</div></div>`).join('')}</div><div class="mbtns"><button class="tbtn" id="sumClose">Kapat</button></div>`);
  $('#sumClose').onclick=closeModal;
  for(const nt of list){const row=$('#sr'+nt.id);if(row)row.querySelector('.acts').textContent='Düşünüyor…';
    try{const{plan,src}=await llmThink(nt);const done=runDecision(nt,plan,src);
      if(row)row.querySelector('.acts').innerHTML=`<q style="display:block;color:#E6EEF3;margin:4px 0">${esc(plan.speech||'')}</q>${done.length?esc(done.join('; ')):'Mevcut politikalar sürdürülüyor.'}${plan.reason?'<br>Gerekçe: '+esc(plan.reason):''}<br><span style="color:var(--brass)">${esc(src)}</span>`}
    catch(e){if(row)row.querySelector('.acts').textContent=errText(e)+' Bu tur yerel ajan karar verdi.';runDecision(nt,localThink(nt),'Yerel ajan');if(e&&['not_granted','rate_limited','unavailable'].includes(e.code))break}
    updateDossier();await new Promise(r=>setTimeout(r,1200))}
  summitRunning=false;if(list.length>1)setSpeed(prev||1);toast('Zirve tamamlandı, kararlar uygulandı.',true)}
$('#summitBtn').onclick=()=>runSummit();
async function openSettings(){
  const s=await getSampler();const srv=await checkServer();
  openModal(`<h3>Ayarlar</h3>
  <p><b>Yapay zekâ sağlayıcıları</b></p>
  <div class="provider"><i class="on"></i>Yerel ajan: her zaman açık, ücretsiz, tarayıcıda çalışır</div>
  ${s&&!claudeBlocked?'<div class="provider"><i class="on"></i>Claude: kullanılabilir</div>':''}
  <div class="provider"><i class="${srv?'on':''}"></i>Yapay zekâ sunucusu: ${srv?'bağlı ve çalışıyor':'bağlı değil (npm start ile çalıştırınca açılır)'}</div>
  ${srv?`<label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" id="sAuto" style="width:auto;margin:0" ${SERVER.auto?'checked':''}> Başkanlar her karar gününde sunucudaki ücretsiz modelle otomatik düşünsün</label>`:''}
  <p style="font-size:12px;color:var(--mute)">Emeği geçenler: askerî araç modelleri Low Poly Models by @Zsky_01 (CC BY 4.0); savaş gemileri WW2 RTS & SLG Naval Fleet Pack by winyunq (CC BY 4.0, render ve renk uyarlaması yapıldı); savaş jetleri Fighter Jets by ikrambandagi (itch.io, ücretsiz); şehir ve araç modelleri Kenney (CC0).</p>
  <label>Dünya tohumu (yeni harita için değiştir)<input id="sSeed" type="number" value="${SEED}"></label>
  <div class="mbtns"><button class="tbtn" id="sNew">Yeni dünya kur</button><button class="tbtn primary" id="sSave">Kaydet</button></div>`);
  $('#sSave').onclick=()=>{const a=$('#sAuto');if(a){SERVER.auto=a.checked;try{localStorage.setItem('d10_server_auto',a.checked?'1':'0')}catch(e){}}closeModal();toast('Ayarlar kaydedildi.',true)};
  $('#sNew').onclick=()=>{SEED=+$('#sSeed').value||SEED;closeModal();boot()}}
$('#setBtn').onclick=openSettings;

// ---------- Giriş ----------
const ptrs=new Map();let dragStart=null,pinch0=null,moved=false;
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;dragStart={x:e.clientX,y:e.clientY,cx:cam.x,cy:cam.y};
  if(ptrs.size===2){const[p,q]=[...ptrs.values()];pinch0={d:Math.hypot(p.x-q.x,p.y-q.y),z:cam.z}}cv.classList.add('drag')});
cv.addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId))return;ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2&&pinch0){const[p,q]=[...ptrs.values()];cam.z=clamp(pinch0.z*Math.hypot(p.x-q.x,p.y-q.y)/pinch0.d,.35,5);moved=true;return}
  if(dragStart){const dx=e.clientX-dragStart.x,dy=e.clientY-dragStart.y;if(Math.abs(dx)+Math.abs(dy)>4){moved=true;cam.follow=null}cam.x=dragStart.cx-dx/cam.z;cam.y=dragStart.cy-dy/cam.z}});
const endPtr=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinch0=null;if(!ptrs.size){cv.classList.remove('drag');if(!moved&&dragStart)pickAt(e.clientX,e.clientY);dragStart=null}};
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('wheel',e=>{e.preventDefault();const[wx,wy]=s2w(e.clientX,e.clientY);cam.z=clamp(cam.z*Math.exp(-e.deltaY*.0015),.35,5);const[wx2,wy2]=s2w(e.clientX,e.clientY);cam.x+=wx-wx2;cam.y+=wy-wy2},{passive:false});
mini.addEventListener('click',e=>{const r=mini.getBoundingClientRect();const mx=(e.clientX-r.left)*MW/r.width,my=(e.clientY-r.top)*MH/r.height;cam.follow=null;cam.x=(mx-H)*HW;cam.y=my*TH});
window.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;const k=e.key;
  if(k===' '){e.preventDefault();setSpeed(speedIdx?0:1)}else if(k>='1'&&k<='5')setSpeed(+k);
  const st=40/cam.z;if(k==='ArrowLeft'||k==='a')cam.x-=st;if(k==='ArrowRight'||k==='d')cam.x+=st;if(k==='ArrowUp'||k==='w')cam.y-=st;if(k==='ArrowDown'||k==='s')cam.y+=st;
  if(k==='+'||k==='=')cam.z=clamp(cam.z*1.2,.35,5);if(k==='-')cam.z=clamp(cam.z/1.2,.35,5);if(k==='Escape'){closeModal();$('#inspect .x').click()}});
function pickAt(sx,sy){
  let best=null,bd=12;for(const a of agents){if(!a.alive||!a.vis)continue;const p=W2(a.gx,a.gy);const[px,py]=w2s(p[0],p[1]-3);const d=Math.hypot(px-sx,py-sy);if(d<bd){bd=d;best=a}}
  citizenSay='';
  if(best){selAgent=best;selBuilding=null;if(best.c!==selNation)selectNation(best.c,false);openInspect();return}
  const[x,y]=s2tile(sx,sy);for(let k=5;k>=0;k--){const xx=x+k,yy=y+k;if(!inb(xx,yy))continue;const b=bldAt[idx(xx,yy)];if(b>=0&&(k===0||buildings[b].h>=k*14)){selBuilding=buildings[b];selAgent=null;if(selBuilding.c!==selNation)selectNation(selBuilding.c,false);openInspect();return}}
  if(inb(x,y)){const o=owner[idx(x,y)];if(o>=0&&o!==selNation)selectNation(o,false)}}

// ICONS_V2: buton ikonları
(function(){const I={summit:'<path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/><path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z"/>',
  bolt:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5" fill="none" stroke="currentColor" stroke-width="2"/>',
  gear:'<path d="M12 8a4 4 0 100 8 4 4 0 000-8zm8.9 5.3l2-1.6-2-3.4-2.4.8a7.6 7.6 0 00-1.7-1L16.4 5h-4l-.5 2.6a7.6 7.6 0 00-1.7 1L7.8 7.8l-2 3.4 2 1.6a7 7 0 000 2l-2 1.6 2 3.4 2.4-.8c.5.4 1.1.7 1.7 1l.5 2.6h4l.5-2.6c.6-.3 1.2-.6 1.7-1l2.4.8 2-3.4-2-1.6a7 7 0 000-2z" fill-rule="evenodd"/>'};
  const svg=p=>'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'+p+'</svg>';
  const add=(el,k)=>{if(el&&!el.querySelector('svg'))el.insertAdjacentHTML('afterbegin',svg(I[k]))};
  add($('#summitBtn'),'summit');add(document.querySelector('[data-menu="evMenu"]'),'bolt');add(document.querySelector('[data-menu="layMenu"]'),'layers');add($('#setBtn'),'gear');
  const sp={0:'<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'};
  const b0=document.querySelector('.speeds button[data-s="0"]');if(b0)b0.innerHTML=sp[0];})();

// Panelleri gizle / göster (H)
(function(){const sb=$('#summitBtn');if(sb&&!$('#uiBtn'))sb.insertAdjacentHTML('beforebegin','<button class="tbtn" id="uiBtn" title="Panelleri gizle veya göster (H)">◱</button>');
  const t=()=>{document.body.classList.toggle('noui');fitTop()};$('#uiBtn').onclick=t;
  window.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;if(e.key==='h'||e.key==='H')t()})})();

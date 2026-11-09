// ============================================================
// Hikâye katmanı: Worldmind Gazetesi ve diplomatik müzakere masası
// ============================================================
let papers=[],negs=[],negBusy=false,paperBusy=false;
const NEG_TOPIC=p=>({trade:'serbest ticaret anlaşması',alliance:'askerî ittifak',peace:'barış antlaşması',land_sale:'sınır bölgesinin '+(p.price||0).toFixed(1)+' milyara satışı'}[p.type]||p.type);
function persona(n){const t=n.pres.traits;return n.pres.name+', '+n.name+' devlet başkanı ('+n.pres.ideo+'; saldırganlık '+t.aggr.toFixed(2)+', temkin '+t.caution.toFixed(2)+'). Hazine '+n.treasury.toFixed(0)+' milyar, askerî güç '+n.mil.toFixed(0)+', onay %'+n.approval.toFixed(0)+'.'}
async function negotiate(B,p){negBusy=true;p.neg=true;const A=nations[p.from];const topic=NEG_TOPIC(p);
  const log={t:now,a:A.id,b:B.id,type:p.type,topic,msgs:[],result:null};negs.unshift(log);if(negs.length>40)negs.pop();
  try{for(let turn=0;turn<4;turn++){const sp=turn%2===0?A:B,ot=turn%2===0?B:A;const last=sp===B&&turn>=1;
      const prompt=persona(sp)+'\nKarşı taraf: '+persona(ot)+'\nİlişki puanı: '+sp.rel[ot.id]+'. Gündem: '+A.name+' tarafından önerilen '+topic+'.\nŞimdiye kadarki görüşme:\n'+
        (log.msgs.map(m=>nations[m.c].pres.name+': '+m.text).join('\n')||'(ilk konuşan sensin)')+'\n'+(turn===3?'Bu senin son sözün, kesin kararını ver.\n':'')+
        'Karakterine ve ülkenin çıkarına uygun, 1-2 cümlelik diplomatik Türkçe bir mesaj yaz. Yalnızca JSON: {"message":"...","decision":"continue|accept|reject"}';
      const r=await askLLM(prompt,true);const o=parseJSONLoose(r.data);log.msgs.push({c:sp.id,text:String(o.message||'…').slice(0,400)});
      if(last&&(o.decision==='accept'||o.decision==='reject')){log.result=o.decision;break}}}catch(e){log.err=true}
  if(!log.result)log.result=B.rel[A.id]>10?'accept':'reject';
  if(B.inbox.includes(p)){resolveProposal(B,p,log.result==='accept');news(B.id,'Müzakere masası: '+A.pres.name+' ile '+B.pres.name+' '+topic+' görüştü, sonuç '+(log.result==='accept'?'anlaşma':'ret')+'.','ai')}
  negBusy=false;if($('#modal').classList.contains('open')&&$('#dipList'))showDiplomacy()}
function startNegotiation(){if(negBusy)return;for(const B of nations)for(const p of B.inbox)if(!p.neg&&['trade','alliance','peace','land_sale'].includes(p.type)){negotiate(B,p);return}}
function localPaper(){const big=feed.filter(f=>f.kind==='big'||f.kind==='hi').slice(0,8),ai=feed.filter(f=>f.kind==='ai').slice(0,4);const h=big[0]||ai[0];
  return{t:now,manset:h?h.text:'Dünyada sakin bir hafta',spot:'Yerel muhabirlerimizin derlediği haftalık özet.',haberler:big.slice(1,6).concat(ai.slice(0,2)).slice(0,5).map(f=>({ulke:f.c>=0?nations[f.c].name:'Dünya',baslik:f.text.split(/[:;.]/)[0],ozet:f.text})),
    kose:{yazar:'Derya Kalem',baslik:'Haftanın notu',metin:'Liderlerin kararları sokakta hissediliyor. Önümüzdeki hafta da gözler başkentlerde olacak.'},borsa:'En büyük ekonomi '+nations.slice().sort((a,b)=>b.gdp-a.gdp)[0].name+'.'}}
async function makePaper(){if(paperBusy)return;paperBusy=true;
  const items=feed.filter(f=>f.kind==='big'||f.kind==='ai'||f.kind==='hi').slice(0,45).map(f=>'- '+(f.c>=0?nations[f.c].name+': ':'')+f.text).join('\n');
  const prompt='Sen "Worldmind Gazetesi" genel yayın yönetmenisin. Tarih: '+fmtDate(now,false)+'. Bu haftanın olayları:\n'+items+'\n\nTarafsız, canlı, profesyonel bir Türkçe gazete sayfası hazırla. Yalnızca JSON: {"manset":"...","spot":"1 cümle","haberler":[{"ulke":"Ülke adı ya da Dünya","baslik":"...","ozet":"1-2 cümle"}],"kose":{"yazar":"uydurma köşe yazarı","baslik":"...","metin":"3-4 cümle yorum"},"borsa":"tek cümle ekonomi özeti"} (4-6 haber)';
  let o;try{const r=await askLLM(prompt,true);o=parseJSONLoose(r.data);o.t=now}catch(e){o=localPaper()}
  papers.unshift(o);if(papers.length>20)papers.pop();paperBusy=false;toast('Worldmind Gazetesi’nin yeni sayısı çıktı.',true);return o}
function storyDaily(){saveGame();electionsDay();migrationDay();resourcesDay();seasonDay();const d=dayIdx();if(d>0&&d%7===0&&SERVER.ok)makePaper();if(SERVER.ok&&SERVER.auto)startNegotiation()}
// ---------- arayüz ----------
function showPaper(i=0){const p=papers[i];if(!p){openModal('<h3>Gazete hazırlanıyor…</h3><p>Editörler haftanın olaylarını derliyor.</p>');makePaper().then(()=>showPaper(0));return}
  const nav=papers.length>1?'<div class="mbtns">'+papers.map((x,k)=>'<button class="tbtn'+(k===i?' primary':'')+'" onclick="showPaper('+k+')">'+fmtDate(x.t,false)+'</button>').slice(0,6).join('')+'</div>':'';
  openModal('<div class="paper"><div class="pmast">WORLDMIND GAZETESİ</div><div class="pdate">'+fmtDate(p.t,false)+', haftalık baskı</div><h2 class="pman">'+esc(p.manset||'')+'</h2><p class="pspot">'+esc(p.spot||'')+'</p><div class="pcols">'+
    (p.haberler||[]).map(h=>'<article><small>'+esc(h.ulke||'')+'</small><h4>'+esc(h.baslik||'')+'</h4><p>'+esc(h.ozet||'')+'</p></article>').join('')+'</div>'+
    (p.kose?'<aside class="pkose"><small>Köşe yazısı, '+esc(p.kose.yazar||'')+'</small><h4>'+esc(p.kose.baslik||'')+'</h4><p>'+esc(p.kose.metin||'')+'</p></aside>':'')+(p.borsa?'<div class="pborsa">Piyasalar: '+esc(p.borsa)+'</div>':'')+
    '</div><div class="mbtns"><button class="tbtn" onclick="makePaper().then(()=>showPaper(0))">Yeni sayı hazırla</button><button class="tbtn primary" onclick="closeModal()">Kapat</button></div>'+nav)}
function showDiplomacy(){openModal('<h3>Diplomasi masası</h3><p>Başkanların yapay zekâ ile yürüttüğü müzakereler. Son sözü teklifi alan başkan söyler.</p><div id="dipList">'+
  (negs.length?negs.map(l=>{const A=nations[l.a],B=nations[l.b];return'<div class="sumrow"><b style="color:'+A.color+'">'+A.name+'</b> → <b style="color:'+B.color+'">'+B.name+'</b>, '+esc(l.topic)+
    ' <span class="chip'+(l.result==='accept'?' claude':'')+'">'+(l.result?(l.result==='accept'?'anlaşma':'ret'):'sürüyor…')+'</span>'+l.msgs.map(m=>'<div class="dmsg" style="border-color:'+nations[m.c].color+'"><b>'+esc(nations[m.c].pres.name)+':</b> '+esc(m.text)+'</div>').join('')+'</div>'}).join('')
  :'<p>Henüz müzakere yok. Teklifler geldiğinde başkanlar burada konuşur.</p>')+'</div><div class="mbtns"><button class="tbtn" onclick="startNegotiation();setTimeout(showDiplomacy,400)">Bekleyen teklifi müzakereye aç</button><button class="tbtn primary" onclick="closeModal()">Kapat</button></div>')}
(function(){const set=$('#setBtn');if(!set||$('#paperBtn'))return;set.insertAdjacentHTML('beforebegin','<button class="tbtn" id="paperBtn">Gazete</button><button class="tbtn" id="dipBtn">Diplomasi</button>');
  $('#paperBtn').onclick=()=>showPaper(0);$('#dipBtn').onclick=showDiplomacy;
  const st=document.createElement('style');st.textContent='.paper{background:#F4EFE3;color:#1E1B16;border-radius:10px;padding:22px 24px;font-family:Georgia,"Times New Roman",serif}.pmast{font:900 30px Georgia,serif;text-align:center;letter-spacing:.06em;border-bottom:3px double #1E1B16;padding-bottom:6px}.pdate{text-align:center;font-size:12px;color:#6B6152;margin:6px 0 12px}.pman{font:800 26px/1.2 Georgia,serif;margin:6px 0}.pspot{font-style:italic;color:#4A4236;margin:0 0 14px}.pcols{columns:2 240px;column-gap:22px}.pcols article{break-inside:avoid;margin-bottom:12px;border-top:1px solid #CBBFA8;padding-top:6px}.pcols small,.pkose small{text-transform:uppercase;letter-spacing:.08em;color:#8A4B2A;font:700 10px sans-serif}.pcols h4,.pkose h4{margin:3px 0;font:700 16px/1.25 Georgia,serif}.pcols p,.pkose p{margin:0;font-size:14px;line-height:1.5;color:#2E2A22}.pkose{background:#EAE2D0;border-left:4px solid #8A4B2A;padding:10px 12px;margin-top:8px}.pborsa{margin-top:12px;font:600 13px sans-serif;color:#2F5D3A}.dmsg{margin:6px 0 0 8px;padding:6px 10px;border-left:3px solid;background:rgba(255,255,255,.04);border-radius:0 8px 8px 0;font-size:13px}';document.head.appendChild(st)})();

// ---------- seçimler ve göç ----------
const PRES_NAMES=['Selin Arda','Marco Bellini','Aiko Tanaka','Jonas Berg','Leila Haddad','Diego Rivera','Nadia Petrova','Kwame Asante','Ingrid Lund','Omar Farouk','Elif Demir','Lucas Moreau','Hana Kim','Rafael Costa','Zeynep Aksoy','Viktor Hale'];
const IDEOS=['liberal reformcu','muhafazakâr','popülist','milliyetçi','yeşil','teknokrat','sosyal demokrat'];
async function election(nt){const old=nt.pres.name,ap=nt.approval;if(ap>=45){news(nt.id,nt.name+' seçimleri: '+old+' %'+ap.toFixed(0)+' onayla yeniden seçildi.','ai');return}
  let name=pick(PRES_NAMES.filter(n=>!nations.some(x=>x.pres.name===n))),ideo=pick(IDEOS.filter(i=>i!==nt.pres.ideo)),why='';
  if(SERVER.ok){try{const r=await askLLM('Sen '+nt.name+' ülkesinin seçim komisyonusun. Görevdeki başkan '+old+' ('+nt.pres.ideo+') %'+ap.toFixed(0)+' onayla seçimi kaybetti. Ülke durumu: hazine '+nt.treasury.toFixed(0)+' milyar, işsizlik %'+(nt.unemp||0).toFixed?.(1)+'. Kazanan yeni başkanı belirle. Yalnızca JSON: {"isim":"Ad Soyad","ideoloji":"'+IDEOS.join('|')+'","neden":"1 cümle"}',true);const o=parseJSONLoose(r.data);if(o.isim)name=String(o.isim).slice(0,40);if(IDEOS.includes(o.ideoloji))ideo=o.ideoloji;why=o.neden?' '+o.neden:''}catch(e){}}
  nt.pres.name=name;nt.pres.ideo=ideo;const t=nt.pres.traits;t.aggr=clamp(rnd(.05,.9),0,1);t.caution=clamp(rnd(.2,.9),0,1);nt.approval=clamp(ap+15,30,70);
  news(nt.id,nt.name+' seçimleri: '+old+' kaybetti; yeni başkan '+ideo+' '+name+'.'+why,'big');}
function electionsDay(){const d=dayIdx();for(const nt of nations)if(d>0&&(d+nt.id*3)%30===0)election(nt)}
function migrationDay(){for(const w of wars){for(const id of[w.a,w.b]){const nt=nations[id];
  const dest=nations.filter(x=>x.id!==w.a&&x.id!==w.b&&!atWar(x.id,w.a)&&!atWar(x.id,w.b)).sort((a,b)=>(b.rel[id]||0)-(a.rel[id]||0))[0];if(!dest)continue;
  const n=popOf(nt)*.003;nt.popF*=.997;dest.popF+=n/Math.max(1e-6,popOf(dest)/dest.popF);if(dayIdx()%3===0)news(id,nt.name+'’dan '+dest.name+'’ya savaştan kaçan yaklaşık '+(n*1000).toFixed(0)+' bin kişi göç etti.','info')}}}

// ---------- kaydet / devam et ----------
const SAVE_KEY='worldmind_save',SKIPK=new Set(['res','leisure','roles','fronts','_spr']);
function b64(a){const u=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)}
function unb64(s,T){const bin=atob(s),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new T(u.buffer)}
function saveGame(manual){if(!worldReady)return;try{const arr={};for(const n of['terr','owner','treeKind','decor','bldAt','cityAt']){try{const a=eval(n);if(a&&a.buffer)arr[n]=[a.constructor.name,b64(a)]}catch(e){}}
  const S={v:1,t:Date.now(),now,lastHour,lastDay,arr,buildings,cities,nations,wars,feed:feed.slice(0,150),papers,negs};
  localStorage.setItem(SAVE_KEY,JSON.stringify(S,(k,v)=>SKIPK.has(k)?undefined:v instanceof Map?{__map:[...v]}:v));if(manual)toast('Oyun kaydedildi.')}
  catch(e){console.warn('kayıt',e);if(manual)toast('Kayıt başarısız: '+e.message,true)}}
function readSave(){try{const s=localStorage.getItem(SAVE_KEY);return s?JSON.parse(s,(k,v)=>v&&v.__map?new Map(v.__map):v):null}catch(e){return null}}
function applySave(S){for(const n in S.arr){const[ct,d]=S.arr[n];try{const a=eval(n);a.set(unb64(d,window[ct]||Uint8Array).subarray(0,a.length))}catch(e){}}
  buildings.length=0;buildings.push(...S.buildings);cities.length=0;cities.push(...S.cities);S.nations.forEach((o,i)=>{if(nations[i])Object.assign(nations[i],o)});
  wars.length=0;wars.push(...S.wars);feed.length=0;feed.push(...S.feed);if(S.papers)papers.push(...S.papers);if(S.negs)negs.push(...S.negs);
  now=S.now;lastHour=S.lastHour;lastDay=S.lastDay;for(const f of['computeRoadComp','computeEntrances'])if(typeof window[f]==='function')window[f]();bDist=null}
setInterval(()=>saveGame(),120000);addEventListener('beforeunload',()=>saveGame());
document.addEventListener('click',e=>{if(e.target&&e.target.id==='sNew')try{localStorage.removeItem(SAVE_KEY)}catch(_){}},true);
(function(){const ref=$('#summitBtn');if(ref&&!$('#saveBtn'))ref.insertAdjacentHTML('beforebegin','<button class="tbtn" id="saveBtn" title="Oyunu kaydet (otomatik kayıt da açık)">💾</button>');const b=$('#saveBtn');if(b)b.onclick=()=>saveGame(true)})();

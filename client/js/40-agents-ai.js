// ============================================================
// Devlet başkanı ajanları
//  1) Yerel ajan: tarayıcıda, ücretsiz, sürekli çalışır (fayda tabanlı)
//  2) Sunucu ajanı: kendi sunucunda /api/agent → ücretsiz LLM zinciri (Pollinations, Groq, OpenRouter, Ollama)
//  3) Claude ajanı: claude.ai içinde açıldığında "sample" yeteneğiyle
// ============================================================
const ACTION_TR={tax:'Vergi',budget:'Bütçe',build:'İnşaat',trade:'Ticaret teklifi',alliance:'İttifak teklifi',sanction:'Yaptırım',lift_sanction:'Yaptırımı kaldır',war:'Savaş ilanı',peace:'Barış teklifi',aid:'İnsani yardım',quarantine:'Karantina',curfew:'Sokağa çıkma yasağı',mobilize:'Seferberlik',cancel_trade:'Ticareti iptal',accept:'Teklifi kabul',reject:'Teklifi reddet',found_city:'Yeni kasaba',colony:'Denizaşırı koloni',expand:'Sınır genişletme',spy:'İstihbarat operasyonu',buy_land:'Toprak satın alma teklifi',land_sale:'toprak satış teklifi'};
const lo=s=>String(s).toLocaleLowerCase('tr-TR');
const BUILDABLE=['hospital','police','fire','school','university','apartment','highrise','house','factory','office','tower','power','mall','stadium'];
const natByName=s=>{if(s===undefined||s===null)return null;if(typeof s==='number')return nations[s]||null;const t=String(s).toLowerCase().trim();return nations.find(n=>n.name.toLowerCase()===t)||nations.find(n=>t.includes(n.name.toLowerCase()))||null};
function remember(nt,text){nt.pres.memory.push(`[${fmtDate(now,false)}] ${text}`);if(nt.pres.memory.length>14)nt.pres.memory.shift()}
function logDecision(nt,src,summary,speech,reason){nt.decisions.unshift({t:now,src,summary,speech,reason});if(nt.decisions.length>30)nt.decisions.pop();if(speech)nt.pres.speech=speech;nt.pres.brain=src;news(nt.id,`${nt.pres.name} (${src}): ${summary}`,'ai')}
function applyAction(nt,act,src){
  if(!act||typeof act!=='object')return null;const type=String(act.type||'').toLowerCase();const tgt=natByName(act.target);const okT=tgt&&tgt.id!==nt.id;
  switch(type){
    case'tax':{const v=Number(act.value);if(!isFinite(v))return null;const nv=clamp(v>1?v/100:v,.05,.6);const d=nv-nt.tax;nt.tax=nv;if(Math.abs(d)>.005)nt.rally-=d*60;
      let note='';if(d>.05){const sh=(d-.05)*100;nt.approval-=sh*1.6;nt.disasterPenalty+=sh*.004;nt.unemployment+=sh*.002;news(nt.id,`${nt.name}: vergi artışına karşı büyük protestolar; sendikalar grev ilan etti, yatırımcılar sermaye çekiyor.`,'hi');note=' (protesto ve sermaye kaçışı)';remember(nt,`Vergiyi ${Math.round(d*100)} puan birden artırdım; halk sokağa döküldü, yatırımcı kaçtı.`)}
      else if(d<-.05){const sh=(-d-.05)*100;nt.rally+=sh*.6;nt.treasury-=nt.gdp*sh*.002;news(nt.id,`${nt.name}: sert vergi indirimi kısa vadede alkışlandı, ekonomistler bütçe açığı uyarısı yapıyor.`,'info');note=' (bütçe açığı riski)';remember(nt,`Vergiyi ${Math.round(-d*100)} puan birden indirdim; bütçe açığı büyüdü.`)}
      return`vergi %${Math.round(nv*100)}${note}`}
    case'budget':{const b={};let s=0;for(const k of SECTORS){const v=Number(act[k]??(act.shares&&act.shares[k])??nt.budget[k]);b[k]=Math.max(.02,isFinite(v)?(v>1?v/100:v):nt.budget[k]);s+=b[k]}
      for(const k of SECTORS)nt.budget[k]=b[k]/s;const top=SECTORS.slice().sort((p,q)=>nt.budget[q]-nt.budget[p])[0];return`bütçe yeniden dağıtıldı (öncelik: ${lo(SECTOR_TR[top])})`}
    case'build':{const bt=String(act.building||act.what||'').toLowerCase();if(!BUILDABLE.includes(bt))return null;const c=COST[bt]||1;
      if(nt.treasury<-nt.gdp*.3)return`${lo(BT[bt].lbl)} inşaatı bütçe yetersizliğinden ertelendi`;const b=startConstruction(nt,bt,ri(3,8),true);if(!b)return null;nt.treasury-=c;return`${lo(BT[bt].lbl)} inşaatı (${c} milyar)`}
    case'found_city':{if(now-nt.lastTown<5*1440)return null;const ct=foundTown(nt,false);return ct?`${ct.name} kasabası kuruldu`:'kasaba için uygun arazi bulunamadı'}
    case'colony':{if(!nt.port)return'koloni için liman gerekiyor';if(now-nt.lastTown<5*1440)return null;const ct=foundTown(nt,true);return ct?`${ct.name} kolonisi kuruldu`:'uygun koloni yeri bulunamadı'}
    case'expand':{nt.expandFocus=10;nt.treasury-=1;return'sınır bölgelerine yerleşim teşviki (10 gün)'}
    case'trade':case'alliance':case'peace':{if(!okT)return null;
      if(type==='trade'&&nt.trade.has(tgt.id))return null;if(type==='alliance'&&nt.ally.has(tgt.id))return null;if(type==='peace'&&!atWar(nt.id,tgt.id))return null;
      if(tgt.inbox.some(p=>p.from===nt.id&&p.type===type))return null;tgt.inbox.push({from:nt.id,type,t:now,note:act.note||''});return`${tgt.name}’ya ${lo(ACTION_TR[type])}`}
    case'spy':{if(!okT)return null;const succ=R()<.35+techOf(nt)*.3-techOf(tgt)*.2+nt.lvl.police*.15;const caught=R()<.25+tgt.lvl.police*.3-techOf(nt)*.1;const op=act.op||pick(['tech','sabotage','propaganda']);let r='başarısız';
      if(succ){if(op==='tech'){nt.gdp*=1.006;r='teknoloji sırları ele geçirildi'}else if(op==='sabotage'){const bs=buildings.filter(b=>b.c===tgt.id&&['factory','power','warehouse'].includes(b.type));if(bs.length)ignite(pick(bs),'sabotaj');r='sanayi sabotajı'}else{tgt.approval-=4;r='dezenformasyon kampanyası'}}
      if(caught){addRel(nt.id,tgt.id,-22);news(tgt.id,`${tgt.name} istihbaratı ${nt.name} ajanlarını yakaladı; büyükelçi sınır dışı edildi.`,'big')}
      return`${tgt.name}'ya istihbarat operasyonu (${r}${caught?', ifşa oldu':''})`}
    case'buy_land':{if(!okT||!isNeighbor(nt.id,tgt.id))return null;const price=clamp(Number(act.amount)||4,1,20);if(nt.treasury<price)return'toprak alımı için hazine yetersiz';if(tgt.inbox.some(p=>p.from===nt.id&&p.type==='land_sale'))return null;
      tgt.inbox.push({from:nt.id,type:'land_sale',t:now,price});return`${tgt.name}'dan ${price.toFixed(1)} milyara sınır bölgesi satın alma teklifi`}
    case'cancel_trade':{if(!okT||!nt.trade.has(tgt.id))return null;nt.trade.delete(tgt.id);tgt.trade.delete(nt.id);addRel(nt.id,tgt.id,-12);return`${tgt.name} ile ticaret anlaşması feshedildi`}
    case'sanction':{if(!okT||nt.sanction.has(tgt.id))return null;nt.sanction.add(tgt.id);nt.trade.delete(tgt.id);tgt.trade.delete(nt.id);addRel(nt.id,tgt.id,-18);return`${tgt.name}’ya ekonomik yaptırım`}
    case'lift_sanction':{if(!okT||!nt.sanction.has(tgt.id))return null;nt.sanction.delete(tgt.id);addRel(nt.id,tgt.id,8);return`${tgt.name} üzerindeki yaptırımlar kaldırıldı`}
    case'war':{if(!okT)return null;if(nt.rel[tgt.id]>-15)return`${tgt.name}’ya savaş ilanı meclisten geçmedi (ilişkiler buna izin vermiyor)`;if(nt.ally.has(tgt.id))return null;
      declareWar(nt.id,tgt.id,act.reason||act.note);remember(nt,`${tgt.name}’ya savaş ilan ettim.`);return`${tgt.name}’ya savaş ilanı`}
    case'aid':{if(!okT)return null;const amt=clamp(Number(act.amount)||1,.2,5);if(nt.treasury<amt)return null;nt.treasury-=amt;tgt.treasury+=amt;addRel(nt.id,tgt.id,Math.round(amt*4));return`${tgt.name}’ya ${amt.toFixed(1)} milyar yardım`}
    case'quarantine':case'curfew':case'mobilize':{const on=act.on===undefined?true:!!act.on&&act.on!=='false';const key={quarantine:'quarantine',curfew:'curfew',mobilize:'mobilized'}[type];if(nt[key]===on)return null;nt[key]=on;
      if(type==='mobilize')for(const s of(nt.roles.soldier||[]))if(s.alive&&!warsOf(nt.id).length){if(on)mobilizeSoldier(s);else if(s.state==='FRONT'||s.purpose==='front'){s.veh='army';goB(s,s.work,'return')}}
      return`${lo(ACTION_TR[type])} ${on?'ilan edildi':'kaldırıldı'}`}
    case'accept':case'reject':{const p=nt.inbox.find(x=>(natByName(act.from)||{}).id===x.from&&(!act.offer||x.type===act.offer));if(!p)return null;return resolveProposal(nt,p,type==='accept')}
  }
  return null;
}
function resolveProposal(nt,p,yes){nt.inbox=nt.inbox.filter(x=>x!==p);const o=nations[p.from];
  if(!yes){addRel(nt.id,o.id,-3);return`${o.name}’nın ${lo(ACTION_TR[p.type])} reddedildi`}
  if(p.type==='trade'){nt.trade.add(o.id);o.trade.add(nt.id);addRel(nt.id,o.id,10);news(nt.id,`${nt.name} ile ${o.name} serbest ticaret anlaşması imzaladı.`,'ai')}
  if(p.type==='alliance'){nt.ally.add(o.id);o.ally.add(nt.id);addRel(nt.id,o.id,15);news(nt.id,`${nt.name} ile ${o.name} askerî ittifak kurdu.`,'ai')}
  if(p.type==='land_sale'){const ft=frontTile(o.id,nt.id);const got=annex(o.id,nt.id,{front:{x:ft.cx,y:ft.cy}});o.treasury-=p.price;nt.treasury+=p.price;addRel(nt.id,o.id,5);news(o.id,`${o.name}, ${nt.name}'dan ${got} karo sınır bölgesini ${p.price.toFixed(1)} milyara satın aldı.`,'big');remember(nt,`${o.name}'ya toprak sattım; hazineye ${p.price.toFixed(1)} milyar girdi.`);remember(o,`${nt.name}'dan toprak satın aldım.`)}
  if(p.type==='peace'){const w=wars.find(w=>(w.a===nt.id&&w.b===o.id)||(w.a===o.id&&w.b===nt.id));if(w)endWar(w,'barış antlaşması');remember(nt,`${o.name} ile barış imzaladım.`);remember(o,`${nt.name} ile barış imzaladım.`)}
  return`${o.name}’nın ${lo(ACTION_TR[p.type])} kabul edildi`}

// ---------- Yerel ajan ----------
function perceive(nt){const alive=nationAgents(nt.id);const crime7=nt.stats.crimeDays.slice(0,7).reduce((a,b)=>a+b,0);const infR=nt.stats.infected/Math.max(1,alive);
  const others=nations.filter(o=>o.id!==nt.id).map(o=>({o,rel:nt.rel[o.id],adj:isNeighbor(nt.id,o.id),ratio:o.mil/Math.max(1,nt.mil)}));
  const threat=others.filter(e=>e.adj&&e.rel<-30&&e.o.pres.traits.aggr>.5).reduce((s,e)=>s+(-e.rel/100)*e.ratio,0)+warsOf(nt.id).length;
  const cs=cityList(nt.id);const room=cs.filter(c=>!c.blocked&&c.R<c.maxR).length;
  return{alive,crime7,infR,others,threat,overload:nt.overload,debt:nt.treasury<0,room,cities:cs.length}}
function localThink(nt){
  const P=nt.pres,Tr=P.traits,I=IDEO[P.ideo],S=perceive(nt);const acts=[],why=[];
  for(const p of[...nt.inbox]){if(p.neg)continue;const o=nations[p.from];let u=nt.rel[o.id]/100;
    if(p.type==='trade')u+=I.trade*.6-(nt.sanction.has(o.id)?1:0);if(p.type==='alliance')u+=S.threat*.5-.35+(P.ideo===o.pres.ideo?.2:0);
    if(p.type==='peace')u=nt.weariness*Tr.caution*2+(o.mil>nt.mil?.4:-.2)-Tr.aggr*.3;
    if(p.type==='land_sale')u=(nt.treasury<0?.55:-.25)+(p.price/Math.max(1,nt.gdp*.01))*.1+nt.rel[o.id]/150-Tr.aggr*.35;acts.push({type:u>.15?'accept':'reject',from:o.name,offer:p.type})}
  const b={...I.pref};
  if(S.infR>.03){b.health+=.12;why.push('salgın yayılıyor')}if(S.crime7>S.alive*.08){b.police+=.08;why.push('suç oranı yükseldi')}
  if(S.threat>.4){b.military+=.12*Tr.aggr+.05;why.push('sınırda tehdit var')}if(nt.unemployment>.1){b.infra+=.06;b.welfare+=.04;why.push('işsizlik arttı')}
  if(nt.happiness<45)b.welfare+=.06;if(nt.disasterPenalty>.01){b.infra+=.06;b.fire+=.03;why.push('afet yaraları sarılmalı')}
  acts.push({type:'budget',...b});
  if(S.debt&&nt.treasury<-nt.gdp*.05){acts.push({type:'tax',value:nt.tax+.01+Tr.caution*.01});why.push('hazine açık veriyor')}
  else if(nt.approval<45&&nt.treasury>nt.gdp*.05)acts.push({type:'tax',value:nt.tax-.01-(P.ideo==='Popülist'?.01:0)});
  else if(Math.abs(nt.tax-I.tax)>.02)acts.push({type:'tax',value:nt.tax+(I.tax-nt.tax)*.3});
  // büyüme stratejisi
  if(S.room===0&&S.cities<6&&now-nt.lastTown>12*1440){acts.push({type:nt.landlocked&&nt.port?'colony':'found_city'});why.push('şehirlerde yer kalmadı')}
  else if(!nt.landlocked&&R()<I.expand*.25&&nt.treasury>3)acts.push({type:'expand'});
  if(nt.port&&S.cities<6&&R()<I.expand*.07&&nt.treasury>8&&now-nt.lastTown>15*1440)acts.push({type:'colony'});
  if(nt.treasury>-nt.gdp*.1){const need=[];
    if(S.overload||S.infR>.04)need.push(['hospital',3]);if(S.crime7>S.alive*.1)need.push(['police',2]);if(nt.stats.fires>3&&R()<.4)need.push(['fire',1.5]);
    if(nt.unemployment>.09)need.push(['factory',2]);if(nt.lvl.education<.55)need.push(['school',1]);if(nt.happiness>55&&R()<.3)need.push(['apartment',1.2]);
    if(R()<.12&&nt.treasury>5)need.push([pick(['mall','office','university','stadium','power','tower']),.8]);
    need.sort((a,b)=>b[1]-a[1]);if(need.length&&R()<.7)acts.push({type:'build',building:need[0][0]})}
  if(S.infR>.05&&!nt.quarantine&&Tr.caution>.35)acts.push({type:'quarantine',on:true});if(S.infR<.01&&nt.quarantine)acts.push({type:'quarantine',on:false});
  if(S.crime7>S.alive*.15&&!nt.curfew&&(P.ideo==='Muhafazakâr'||P.ideo==='Milliyetçi'||Tr.caution>.6))acts.push({type:'curfew',on:true});if(S.crime7<S.alive*.05&&nt.curfew)acts.push({type:'curfew',on:false});
  if(S.threat>.6&&!nt.mobilized&&Tr.aggr>.45)acts.push({type:'mobilize',on:true});if(S.threat<.2&&nt.mobilized&&!warsOf(nt.id).length)acts.push({type:'mobilize',on:false});
  for(const e of S.others){const o=e.o;
    if(!nt.trade.has(o.id)&&!nt.sanction.has(o.id)&&e.rel>12&&R()<I.trade*.35)acts.push({type:'trade',target:o.name});
    if(!nt.ally.has(o.id)&&e.rel>55&&R()<.25+S.threat*.3)acts.push({type:'alliance',target:o.name});
    if(e.rel<-45&&!nt.sanction.has(o.id)&&R()<Tr.aggr*.25)acts.push({type:'sanction',target:o.name});
    if(nt.sanction.has(o.id)&&e.rel>-10&&R()<.3)acts.push({type:'lift_sanction',target:o.name});
    if(e.rel<-30&&R()<.07*(1+Tr.aggr))acts.push({type:'spy',target:o.name});
    if(e.adj&&nt.landlocked&&o.treasury<0&&nt.treasury>10&&R()<.3)acts.push({type:'buy_land',target:o.name,amount:Math.min(15,nt.treasury*.4)});
    if(atWar(nt.id,o.id)&&(nt.weariness*Tr.caution>.25||e.ratio>1.4)&&R()<.5)acts.push({type:'peace',target:o.name});
    const landHunger=nt.landlocked&&S.room===0?.25:0;
    if(!atWar(nt.id,o.id)&&e.adj&&e.rel<-65+landHunger*60&&Tr.aggr>.6&&nt.mil>o.mil*1.25&&!warsOf(nt.id).length&&R()<(.18+landHunger)*Tr.aggr*(1-Tr.caution*.6))
      acts.push({type:'war',target:o.name,reason:landHunger?'yaşam alanı ihtiyacı ve sınır anlaşmazlığı':'süregelen sınır ihlalleri'});
    if(Tr.empathy>.6&&o.disasterPenalty>.012&&e.rel>0&&nt.treasury>3&&R()<.4)acts.push({type:'aid',target:o.name,amount:1})}
  return{acts,speech:makeSpeech(nt,acts,why),reason:why.join(', ')||'durum istikrarlı, rotayı koruyoruz'};
}
function makeSpeech(nt,acts,why){const has=t=>acts.find(a=>a.type===t);
  if(has('war'))return`Sabrımız tükendi. ${has('war').target} karşısında milletimizi korumak için ordumuz harekete geçiyor.`;
  if(has('peace'))return`Savaşın bedelini çocuklarımız ödüyor. ${has('peace').target} ile masaya oturmaya hazırız.`;
  if(has('colony'))return'Topraklarımız dar geliyor. Denizlerin ötesinde yeni bir yurt kuruyoruz.';
  if(has('found_city'))return'Yeni bir kasaba kuruyoruz; gençlerimize yeni bir başlangıç sunacağız.';
  if(has('quarantine')&&has('quarantine').on)return'Sağlığınız her şeyden önce gelir. Sınırlarımızı geçici olarak kapatıyor, hastanelerimizi güçlendiriyoruz.';
  if(has('curfew')&&has('curfew').on)return'Sokaklarımızı suçlulara bırakmayacağız. Geceleri evlerinizde kalın, polisimiz görevde.';
  if(has('build'))return`Yeni bir ${lo(BT[has('build').building].lbl)} yapıyoruz. Söz verdik, yapıyoruz.`;
  if(has('expand'))return'Sınır bölgelerimizi kalkındırıyoruz; her vadi, her ova bu milletin geleceği.';
  if(has('trade'))return`${has('trade').target} ile ticaret köprüleri kurmak refahımızı büyütecek.`;
  if(has('sanction'))return`${has('sanction').target} yönetiminin tutumunu kabul etmiyoruz; ekonomik adımlar atıyoruz.`;
  if(why.length)return`Gündemimiz açık: ${why[0]}. Bütçemizi buna göre düzenledik.`;
  return pick(['Ekonomimiz istikrarlı, kurumlarımız çalışıyor. Aynı kararlılıkla devam.','Bu hafta önceliğimiz vatandaşlarımızın gündelik hayatını kolaylaştırmak.','Komşularımızla barış ve işbirliği en büyük sermayemizdir.'])}
function runDecision(nt,plan,src){
  const done=[];for(const a of(plan.acts||plan.actions||[])){try{const r=applyAction(nt,a,src);if(r)done.push(r)}catch(e){console.error(e)}}
  nt.inbox=nt.inbox.filter(p=>now-p.t<7*1440);const summary=done.length?done.slice(0,5).join('; '):'mevcut politikalar sürdürülüyor';
  remember(nt,`${src} kararı: ${summary}.`);logDecision(nt,src,summary,plan.speech,plan.reason);
  nt.pres.mood=nt.approval>60?'özgüvenli':nt.approval>42?'temkinli':'baskı altında';return done}

// ---------- LLM için durum özeti ----------
function briefFor(nt){
  const S=perceive(nt),P=nt.pres,f=(v,d=1)=>Number(v).toFixed(d);
  const others=nations.filter(o=>o.id!==nt.id).map(o=>`${o.name}: ilişki ${nt.rel[o.id]}${isNeighbor(nt.id,o.id)?', kara komşusu':''}${nt.trade.has(o.id)?', ticaret':''}${nt.ally.has(o.id)?', müttefik':''}${atWar(nt.id,o.id)?', SAVAŞTA':''}${nt.sanction.has(o.id)?', yaptırım uyguluyoruz':''}; lider ${o.pres.name} (${o.pres.ideo}); askerî güç ${f(o.mil,0)}; nüfus ${f(popOf(o),1)} milyon; hazine ${f(o.treasury,0)} milyar`).join('\n');
  const cs=cityList(nt.id).map(c=>`${c.name} (yarıçap ${c.R}/${c.maxR}${c.blocked?', çevresi dolu':''}${c.colony?', koloni':''})`).join(', ');
  return `Tarih: ${fmtDate(now)}
Sen ${nt.name} devlet başkanı ${P.name}’sın. İdeoloji: ${P.ideo} (${IDEO[P.ideo].blurb}). Kişilik: saldırganlık ${f(P.traits.aggr,2)}, temkin ${f(P.traits.caution,2)}, empati ${f(P.traits.empathy,2)}, karizma ${f(P.traits.charisma,2)}.
Hafızan:
${P.memory.slice(-8).join('\n')||'- yeni göreve başladın'}

ÜLKE DURUMU
Nüfus ${f(popOf(nt),1)} milyon, GSYH ${f(nt.gdp)} milyar, büyüme %${f(nt.growth*100)}, hazine ${f(nt.treasury)} milyar, vergi %${f(nt.tax*100,0)}, işsizlik %${f(nt.unemployment*100)}
Mutluluk ${f(nt.happiness,0)}/100, onay %${f(nt.approval,0)}, askerî güç ${f(nt.mil,0)}/100
Şehirler: ${cs}. Sahipsiz araziye genişleme ${nt.landlocked?'artık mümkün değil (her yanımız komşu ya da deniz)':'devam ediyor'}. Liman: ${nt.port?'var':'yok'}.
Son 7 günde suç: ${S.crime7}, enfekte: ${nt.stats.infected} (%${f(S.infR*100)}), hastane taşması: ${nt.overload?'evet':'hayır'}
Karantina: ${nt.quarantine?'açık':'kapalı'}, sokağa çıkma yasağı: ${nt.curfew?'açık':'kapalı'}, seferberlik: ${nt.mobilized?'açık':'kapalı'}, hava: ${nt.weather}
Bütçe payları: ${SECTORS.map(s=>`${s} ${f(nt.budget[s]*100,0)}%`).join(', ')}
Hizmet seviyeleri (0-1): ${SECTORS.map(s=>`${s} ${f(nt.lvl[s],2)}`).join(', ')}

DİĞER ÜLKELER
${others}

GELEN TEKLİFLER
${nt.inbox.map(p=>`- ${nations[p.from].name}: ${p.type} teklifi`).join('\n')||'- yok'}

SON OLAYLAR
${feed.filter(x=>x.c===nt.id).slice(0,8).map(x=>'- '+x.text).join('\n')||'- kayda değer olay yok'}`}
const ACTION_SCHEMA=`Yalnızca geçerli JSON döndür, başka hiçbir şey yazma:
{"speech":"halka 1-2 cümlelik Türkçe konuşma","reason":"kısa gerekçe","actions":[ ... ]}
Kullanılabilir eylemler (0-5 adet seç):
{"type":"tax","value":0.08-0.55}
{"type":"budget","health":p,"police":p,"fire":p,"military":p,"education":p,"infra":p,"welfare":p}  (paylar toplamı 1)
{"type":"build","building":"hospital|police|fire|school|university|apartment|highrise|house|factory|office|tower|power|mall|stadium"}
{"type":"found_city"}  (kendi topraklarında yeni kasaba)
{"type":"colony"}  (liman varsa denizaşırı sahipsiz araziye koloni)
{"type":"expand"}  (sınırları sahipsiz araziye doğru hızla genişlet)
{"type":"trade|alliance|peace|sanction|lift_sanction|cancel_trade|war","target":"Ülke adı"}
{"type":"aid","target":"Ülke adı","amount":0.2-5}
{"type":"spy","target":"Ülke adı","op":"tech|sabotage|propaganda"}  (gizli operasyon; ifşa olursa kriz çıkar)
{"type":"buy_land","target":"Kara komşusu","amount":1-20}  (borçlu komşudan parayla sınır bölgesi satın alma teklifi)
{"type":"quarantine|curfew|mobilize","on":true|false}
{"type":"accept|reject","from":"Ülke adı","offer":"trade|alliance|peace|land_sale"}
Not: Vergiyi tek seferde 5 puandan fazla değiştirmek serbesttir ama bedeli vardır; sert artış protesto, onay kaybı ve sermaye kaçışı doğurur, sert indirim bütçe açığını büyütür.
Kişiliğine ve ideolojine sadık kal, gerçekçi ve tutarlı ol.`;
function parseJSONLoose(t){if(typeof t!=='string')return t;const m=t.replace(/```json|```/g,'').match(/\{[\s\S]*\}/);if(!m)throw new Error('JSON bulunamadı');return JSON.parse(m[0])}

// ---------- Sağlayıcılar ----------
let samplerPromise=null,claudeBlocked=false;
function getSampler(){if(!samplerPromise)samplerPromise=(async()=>{try{if(typeof claude==='undefined'||!claude||!claude.use)return null;return await claude.use('sample')}catch(e){return null}})();return samplerPromise}
let SERVER={ok:false,providers:[],checked:false,auto:true,every:3};
async function checkServer(){if(SERVER.checked)return SERVER.ok;SERVER.checked=true;
  if(!/^https?:/.test(location.protocol))return false;
  try{const r=await fetch('/api/health',{cache:'no-store'});if(r.ok){const j=await r.json();SERVER.ok=!!j.ok;SERVER.providers=j.providers||[]}}catch(e){SERVER.ok=false}
  try{const s=localStorage.getItem('d10_server_auto');if(s!==null)SERVER.auto=s==='1'}catch(e){}
  return SERVER.ok}
async function serverChat(prompt,json){const r=await fetch('/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,json:!!json})});
  if(!r.ok){let m='HTTP '+r.status;try{m=(await r.json()).error||m}catch(e){}throw{code:r.status===429?'rate_limited':'server',message:m}}
  const j=await r.json();return{text:j.text,provider:j.provider}}
// Tek giriş noktası: önce Claude (claude.ai içinde), sonra kendi sunucumuz
async function askLLM(prompt,json){
  const s=await getSampler();
  if(s&&!claudeBlocked){try{if(json)return{data:await s.json(prompt,{modelTier:'quick',cache:false}),src:'Claude'};const r=await s(prompt,{modelTier:'quick',cache:false});return{data:r.text,src:'Claude'}}
    catch(e){if(e&&e.code==='not_granted')claudeBlocked=true;if(!(await checkServer()))throw e}}
  if(await checkServer()){const r=await serverChat(prompt,json);return{data:json?parseJSONLoose(r.text):r.text,src:'Yapay zekâ'}}
  throw{code:'unavailable'}}
async function llmThink(nt){const r=await askLLM(briefFor(nt)+'\n\nBu haftaki kararlarını ver.\n'+ACTION_SCHEMA,true);return{plan:parseJSONLoose(r.data),src:r.src}}
// Sunucu modunda başkanlar otomatik LLM kararı verir (kuyruk, aynı anda tek istek)
const llmQueue=[];let llmBusy=false;
async function llmQueueTick(){if(llmBusy||!llmQueue.length)return;const nt=llmQueue.shift();llmBusy=true;
  try{const{plan,src}=await llmThink(nt);runDecision(nt,plan,src)}catch(e){runDecision(nt,localThink(nt),'Yerel ajan')}
  llmBusy=false;if(llmQueue.length)setTimeout(llmQueueTick,1500)}
function presidentsDay(){
  for(const nt of nations){if(now<nt.nextThink)continue;nt.nextThink=now+rnd(2.5,3.5)*1440;
    if(SERVER.ok&&SERVER.auto){if(!llmQueue.includes(nt))llmQueue.push(nt);continue}
    try{runDecision(nt,localThink(nt),'Yerel ajan')}catch(e){console.error(e)}}
  llmQueueTick()}

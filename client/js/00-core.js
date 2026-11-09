'use strict';
// ============================================================
// Worldmind — çekirdek: rastgelelik, gürültü, sabitler, veri tanımları
// ============================================================
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let SEED=20261026;
let R=mulberry32(SEED);
const rnd=(a=1,b)=>b===undefined?R()*a:a+R()*(b-a);
const ri=(a,b)=>Math.floor(rnd(a,b+1));
const pick=arr=>arr[Math.floor(R()*arr.length)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const hash=(x,y)=>{let h=Math.imul(x*374761393+y*668265263,1274126177);h^=h>>>13;h=Math.imul(h,1274126177);h^=h>>>16;return((h>>>0)%10000)/10000};
function makeNoise(seed){
  const r=mulberry32(seed);const P=new Float32Array(65536);for(let i=0;i<P.length;i++)P[i]=r();
  const s=t=>t*t*(3-2*t);
  function v(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
    const g=(i,j)=>P[((j&255)<<8)|(i&255)];
    const a=g(xi,yi),b=g(xi+1,yi),c=g(xi,yi+1),d=g(xi+1,yi+1),u=s(xf),w=s(yf);
    return a+(b-a)*u+(c-a)*w+(a-b-c+d)*u*w}
  return (x,y,oct=4)=>{let f=0,amp=1,sum=0,fr=1;for(let o=0;o<oct;o++){f+=v(x*fr+o*17.3,y*fr+o*31.7)*amp;sum+=amp;amp*=.5;fr*=2}return f/sum}
}

// Harita: 256×256 karo. Bir karo yaklaşık 250 m; dünya ~64×64 km.
const W=256,H=256,N=W*H,HW=16,HH=8,TH=16;
const T={DEEP:0,WATER:1,SAND:2,GRASS:3,FOREST:4,MOUNT:5,FARM:6,ROAD:7,RUNWAY:8,BRIDGE:9,PARK:10,RUBBLE:11,CONC:12,LAKE:13};
const terr=new Uint8Array(N),owner=new Int8Array(N).fill(-1),bldAt=new Int32Array(N).fill(-1),elev=new Float32Array(N),cityAt=new Int16Array(N).fill(-1);
const flood=new Float32Array(N),forestFire=new Float32Array(N),seaMask=new Uint8Array(N),decor=new Uint8Array(N),wdist=new Uint8Array(N),treeKind=new Uint8Array(N);
const idx=(x,y)=>y*W+x, inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
const tx=i=>i%W, ty=i=>(i/W)|0;
const isWater=t=>t<=1||t===T.LAKE, isRoad=t=>t===T.ROAD||t===T.BRIDGE;
const isLand=t=>!isWater(t);
const D4=[[1,0],[-1,0],[0,1],[0,-1]];
const D8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

// ---------- İdeolojiler ----------
const IDEO={
  'Liberal reformcu':{pref:{health:.14,police:.11,fire:.06,military:.10,education:.2,infra:.24,welfare:.15},tax:.22,aggr:.2,trade:.9,expand:.5,blurb:'Açık piyasa, düşük vergi, güçlü ticaret.'},
  'Muhafazakâr':{pref:{health:.14,police:.2,fire:.08,military:.18,education:.14,infra:.14,welfare:.12},tax:.25,aggr:.45,trade:.5,expand:.6,blurb:'Düzen, güvenlik ve gelenek önce gelir.'},
  'Sosyal demokrat':{pref:{health:.22,police:.1,fire:.07,military:.07,education:.2,infra:.12,welfare:.22},tax:.33,aggr:.15,trade:.65,expand:.35,blurb:'Güçlü sosyal devlet, sağlık ve eğitim.'},
  'Milliyetçi':{pref:{health:.12,police:.15,fire:.07,military:.3,education:.11,infra:.15,welfare:.1},tax:.27,aggr:.75,trade:.3,expand:.95,blurb:'Ulusal çıkar, güçlü ordu, toprak genişlemesi.'},
  'Teknokrat':{pref:{health:.16,police:.11,fire:.08,military:.1,education:.22,infra:.23,welfare:.1},tax:.27,aggr:.25,trade:.75,expand:.55,blurb:'Veriye dayalı yönetim, altyapı ve bilim.'},
  'Popülist':{pref:{health:.15,police:.13,fire:.06,military:.14,education:.1,infra:.12,welfare:.3},tax:.2,aggr:.55,trade:.4,expand:.7,blurb:'Halkın sesi; harcamayı sever, krizde sert.'},
  'Yeşil':{pref:{health:.22,police:.09,fire:.12,military:.05,education:.2,infra:.17,welfare:.15},tax:.31,aggr:.08,trade:.6,expand:.25,blurb:'Barış, çevre ve kamu sağlığı; doğayı korur.'}
};
const IDEO_KEYS=Object.keys(IDEO);
const SECTORS=['health','police','fire','military','education','infra','welfare'];
const SECTOR_TR={health:'Sağlık',police:'Emniyet',fire:'İtfaiye',military:'Ordu',education:'Eğitim',infra:'Altyapı',welfare:'Sosyal yardım'};
const SECTOR_REF={health:.06,police:.025,fire:.012,military:.035,education:.05,infra:.045,welfare:.08};

const NATIONS=[
 {name:'Anadora',color:'#D64B42',flag:['#D64B42','#F4EDE4'],cities:['Anadora Kenti','Selvira','Port Kalen','Mirena','Tovar','Lisse'],pres:'Elena Varga',ideo:'Liberal reformcu',pop:38},
 {name:'Belvaria',color:'#3A78D0',flag:['#3A78D0','#F2C14E'],cities:['Belgrava','Ostrin','Lumen','Varnek','Dolin','Sava'],pres:'Tomas Rehn',ideo:'Muhafazakâr',pop:24},
 {name:'Castelia',color:'#E2A72E',flag:['#E2A72E','#7A2E1E'],cities:['Castel Mar','Vigo Alto','Serrat','Lunares','Pradera','Oroz'],pres:'Joaquim Ferro',ideo:'Popülist',pop:31},
 {name:'Draskova',color:'#8656CC',flag:['#8656CC','#1E1E2A'],cities:['Draskograd','Velny','Korsk','Brod','Zelin','Ostrov'],pres:'Viktor Drask',ideo:'Milliyetçi',pop:44},
 {name:'Elyria',color:'#23A7A5',flag:['#23A7A5','#F4F4F4'],cities:['Elys','Marenne','Talo','Sirène','Aube','Corail'],pres:'Ingrid Halle',ideo:'Yeşil',pop:12},
 {name:'Ferrona',color:'#E8742A',flag:['#E8742A','#2B3A55'],cities:['Ferro Nova','Augusta','Rhenn','Kessel','Altburg','Weida'],pres:'Aylin Demirel',ideo:'Teknokrat',pop:27},
 {name:'Galmeria',color:'#379F60',flag:['#379F60','#F7E37A'],cities:['Galmer','Sunhaven','Oriel','Brightwater','Ashby','Kelso'],pres:'Kofi Mensah',ideo:'Sosyal demokrat',pop:19},
 {name:'Halvenia',color:'#CF5094',flag:['#CF5094','#FFFFFF'],cities:['Halven','Brisa','Lorne','Ystad','Fjell','Molde'],pres:'Mira Solberg',ideo:'Liberal reformcu',pop:15},
 {name:'Istrava',color:'#8DB332',flag:['#8DB332','#3A2A1A'],cities:['Istrabad','Kurza','Nemet','Orsha','Pinsk','Lida'],pres:'Nikolai Istrin',ideo:'Milliyetçi',pop:35},
 {name:'Kaldera',color:'#A06C48',flag:['#A06C48','#E9D8B4'],cities:['Kalder','Sumer','Vashti','Uruk','Eridu','Lagash'],pres:'Leyla Aram',ideo:'Teknokrat',pop:22}
];
const FIRST=['Ada','Emir','Lina','Omar','Sena','Can','Ivo','Maya','Deniz','Rafi','Zara','Kerem','Nora','Teo','Elif','Mert','Yara','Luka','Asel','Bora','Iris','Jonas','Selin','Pavel','Rana','Hugo','Ece','Milan','Dila','Arda','Noor','Ilya','Ceren','Tarik','Vera','Emre','Lea','Okan','Sofi','Yusuf'];
const LAST=['Aksoy','Varga','Rehn','Ferro','Molnar','Kaya','Solberg','Mensah','Aram','Dvorak','Lind','Petrov','Costa','Yılmaz','Navarro','Halle','Novak','Berg','Demir','Santos','Ivanov','Ward','Basri','Lorne','Kral','Moreau','Tan','Öz','Reyes','Kuzmin'];
const PRES_POOL=['Selim Aras','Irina Vos','Marco Bellan','Hana Kader','Oskar Lund','Dina Farah','Pietro Galli','Asya Korkmaz','Ruben Dahl','Lena Marsh','Tariq Nadim','Greta Holm'];

// ---------- Bina türleri ----------
// s: taban genişliği (karo oranı), h: yükseklik aralığı, cat: kategori, cap: kapasite, res: konut başına sakin
const BT={
 house:{s:.56,h:[7,9],cat:'res',cap:4,res:3,lbl:'Müstakil ev'},
 apartment:{s:.74,h:[18,30],cat:'res',cap:24,res:8,lbl:'Apartman'},
 highrise:{s:.7,h:[44,64],cat:'res',cap:60,res:14,lbl:'Rezidans kulesi'},
 tower:{s:.68,h:[40,78],cat:'work',cap:30,lbl:'Ofis kulesi'},
 office:{s:.74,h:[22,34],cat:'work',cap:20,lbl:'Ofis binası'},
 shop:{s:.78,h:[8,10],cat:'work',cap:8,lbl:'Dükkân ve market',leisure:1},
 mall:{s:.9,h:[13,15],cat:'work',cap:20,lbl:'Alışveriş merkezi',leisure:1},
 factory:{s:.88,h:[11,13],cat:'work',cap:25,lbl:'Fabrika',smoke:1},
 warehouse:{s:.86,h:[9,11],cat:'work',cap:10,lbl:'Depo'},
 power:{s:.9,h:[13,15],cat:'work',cap:12,lbl:'Enerji santrali',smoke:1},
 hospital:{s:.86,h:[22,26],cat:'svc',cap:40,lbl:'Hastane'},
 police:{s:.78,h:[11,13],cat:'svc',cap:12,lbl:'Emniyet müdürlüğü'},
 fire:{s:.78,h:[11,13],cat:'svc',cap:10,lbl:'İtfaiye istasyonu'},
 school:{s:.82,h:[10,12],cat:'svc',cap:30,lbl:'Okul'},
 university:{s:.9,h:[15,17],cat:'svc',cap:40,lbl:'Üniversite'},
 parliament:{s:.92,h:[15,17],cat:'svc',cap:20,lbl:'Meclis ve cumhurbaşkanlığı'},
 stadium:{s:.94,h:[9,10],cat:'work',cap:30,lbl:'Stadyum',leisure:1},
 barracks:{s:.84,h:[7,8],cat:'mil',cap:20,lbl:'Kışla'},
 hangar:{s:.9,h:[10,11],cat:'mil',cap:10,lbl:'Askerî hangar'},
 depot:{s:.68,h:[6,7],cat:'mil',cap:6,lbl:'Mühimmat deposu'},
 terminal:{s:.92,h:[11,12],cat:'work',cap:20,lbl:'Havalimanı terminali'},
 atc:{s:.34,h:[30,32],cat:'work',cap:4,lbl:'Kontrol kulesi'},
 portwh:{s:.88,h:[8,9],cat:'work',cap:12,lbl:'Liman deposu'},
 crane:{s:.5,h:[28,30],cat:'work',cap:4,lbl:'Liman vinci'},
 barn:{s:.66,h:[9,10],cat:'farm',cap:6,lbl:'Çiftlik'},
 construction:{s:.78,h:[6,6],cat:'none',cap:0,lbl:'İnşaat alanı'},
 rubble:{s:.8,h:[2,2],cat:'none',cap:0,lbl:'Enkaz'},
 gone:{s:.5,h:[0,0],cat:'none',cap:0,lbl:'Kaldırılmış yapı'}
};
const WALLS={house:['#EADFC8','#DCC9A8','#C9D4DA','#E8D1C2','#D5DBC1','#F0E6D2'],apartment:['#B4664E','#CDBEA4','#9298A0','#BE9473','#A8B1BA','#D3C3A6'],
  highrise:['#7E9AB0','#9AA9B6','#B6B0A2','#8496A6'],tower:['#5F86A6','#6E8EA6','#4F7590','#7B9AB0','#5B7F98'],office:['#A3AEB8','#BDB6A6','#8A9EAE','#C2C6C9']};
const ROOFS=['#B4452F','#8E4E33','#5C6670','#A0522D','#6B4B3A','#4F6D7A','#7A3B30'];

let buildings=[],cities=[],nations=[],agents=[],airports=[],ports=[],bases=[];
let roadComp=new Int32Array(N).fill(-1);
let worldReady=false; // nüfus yerleştikten sonra binalar yol için silinmez
const qh=v=>Math.round(v/2)*2; // yükseklik nicemleme (sprite önbelleği için)
function addBuilding(x,y,type,c,city){
  const d=BT[type];const b={id:buildings.length,x,y,i:idx(x,y),type,c,city,h:qh(ri(d.h[0],d.h[1])),
    wall:(WALLS[type]?pick(WALLS[type]):null),roof:pick(ROOFS),v:ri(0,3),ent:-1,fire:0,burn:0,orig:type,doneAt:0,target:null};
  buildings.push(b);bldAt[b.i]=b.id;return b;
}
function setType(b,type){b.type=type;const d=BT[type];b.h=qh(ri(d.h[0],d.h[1]));if(WALLS[type])b.wall=pick(WALLS[type]);b.v=ri(0,3)}

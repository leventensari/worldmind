// ============================================================
// Worldmind sunucusu — bağımlılık yok (Node 18+)
//  - client/ klasörünü servis eder
//  - /api/agent: başkan ajanları için ücretsiz LLM zinciri
//  - /api/health: durum
// ============================================================
'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),zlib=require('zlib');
const ROOT=path.join(__dirname,'..');
// .env dosyasını oku (varsa)
try{for(const line of fs.readFileSync(path.join(ROOT,'.env'),'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m&&!(m[1]in process.env))process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}}catch(e){}
const ENV=process.env;
// Anahtarı yanlış satıra yazılsa bile anahtar önekinden doğru sağlayıcıyı bul
for(const k of ['GROQ_API_KEY','OPENROUTER_API_KEY','POLLINATIONS_KEY']){const v=(ENV[k]||'').trim();if(/^gsk_/.test(v)&&k!=='GROQ_API_KEY'){if(!ENV.GROQ_API_KEY)ENV.GROQ_API_KEY=v;ENV[k]=''}else if(/^sk-or-/.test(v)&&k!=='OPENROUTER_API_KEY'){if(!ENV.OPENROUTER_API_KEY)ENV.OPENROUTER_API_KEY=v;ENV[k]=''}}
const PORT=+ENV.PORT||8080,HOST=ENV.HOST||'0.0.0.0';
const PUBLIC=path.join(ROOT,'client');
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};

// ---------- LLM sağlayıcıları ----------
const PROVIDERS={
  pollinations:{enabled:ENV.POLLINATIONS_DISABLED!=='1',
    url:()=>ENV.POLLINATIONS_KEY?'https://gen.pollinations.ai/v1/chat/completions':'https://text.pollinations.ai/openai',
    headers:()=>ENV.POLLINATIONS_KEY?{Authorization:'Bearer '+ENV.POLLINATIONS_KEY}:{},model:()=>ENV.POLLINATIONS_MODEL||'openai'},
  groq:{enabled:!!ENV.GROQ_API_KEY,url:()=>'https://api.groq.com/openai/v1/chat/completions',headers:()=>({Authorization:'Bearer '+ENV.GROQ_API_KEY}),model:()=>ENV.GROQ_MODEL||'openai/gpt-oss-20b'},
  openrouter:{enabled:!!ENV.OPENROUTER_API_KEY,url:()=>'https://openrouter.ai/api/v1/chat/completions',headers:()=>({Authorization:'Bearer '+ENV.OPENROUTER_API_KEY,'HTTP-Referer':ENV.PUBLIC_URL||'http://localhost','X-Title':'Dunya 10'}),model:()=>ENV.OPENROUTER_MODEL||'meta-llama/llama-3.3-70b-instruct:free'},
  ollama:{enabled:!!ENV.OLLAMA_URL,url:()=>ENV.OLLAMA_URL.replace(/\/$/,'')+'/v1/chat/completions',headers:()=>({}),model:()=>ENV.OLLAMA_MODEL||'llama3.1'}
};
const ORDER=(ENV.PROVIDERS||'groq,openrouter,pollinations,ollama').split(',').map(s=>s.trim()).filter(k=>PROVIDERS[k]&&PROVIDERS[k].enabled);
const SYSTEM='Bir ülkenin devlet başkanını ya da vatandaşını oynayan bir yapay zekâ ajanısın. Türkçe yanıt ver. JSON istendiğinde yalnızca geçerli JSON döndür.';
async function callProvider(name,prompt,json){
  const p=PROVIDERS[name];const ctl=new AbortController();const to=setTimeout(()=>ctl.abort(),+ENV.LLM_TIMEOUT_MS||45000);
  try{const r=await fetch(p.url(),{method:'POST',signal:ctl.signal,headers:{'Content-Type':'application/json',...p.headers()},
      body:JSON.stringify({model:p.model(),messages:[{role:'system',content:SYSTEM},{role:'user',content:prompt+(json?'\n\nYalnızca JSON döndür.':'')}],temperature:.7,max_tokens:1800,...(/gpt-oss/.test(p.model())?{reasoning_effort:'low'}:{})})});
    if(!r.ok)throw new Error(name+' HTTP '+r.status+' '+(await r.text()).slice(0,160));
    const ct=r.headers.get('content-type')||'';let text;
    if(ct.includes('json')){const j=await r.json();text=j.choices?.[0]?.message?.content??j.message?.content??''}else text=await r.text();
    if(!text||!String(text).trim())throw new Error(name+' boş yanıt');
    if(json&&!/\{[\s\S]*\}/.test(text))throw new Error(name+' JSON döndürmedi');
    return String(text);
  }finally{clearTimeout(to)}
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function askChain(prompt,json){
  const errs=[];for(const name of ORDER){for(let attempt=0;attempt<3;attempt++){try{const text=await callProvider(name,prompt,json);return{text,provider:name}}
      catch(e){const m=String(e.message||e);errs.push(m);console.warn('[llm]',m.slice(0,200));if(!/429|5\d\d|abort|boş|JSON/i.test(m))break;await sleep(2500*(attempt+1))}}}
  const e=new Error('Tüm sağlayıcılar başarısız: '+errs.join(' | '));e.status=502;throw e;
}
// ---------- hız sınırı ve kuyruk ----------
const hits=new Map();const PER_MIN=+ENV.RATE_PER_MIN||30;
function limited(ip){const t=Date.now();const a=(hits.get(ip)||[]).filter(x=>t-x<60000);a.push(t);hits.set(ip,a);return a.length>PER_MIN}
setInterval(()=>{const t=Date.now();for(const[k,a]of hits)if(!a.some(x=>t-x<60000))hits.delete(k)},60000).unref();
let active=0;const waiters=[];const MAX_CONC=+ENV.MAX_CONCURRENCY||3;
async function withSlot(fn){if(active>=MAX_CONC)await new Promise(r=>waiters.push(r));active++;try{return await fn()}finally{active--;const w=waiters.shift();if(w)w()}}

// ---------- HTTP ----------
function send(res,code,body,headers={}){res.writeHead(code,{'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin',...headers});res.end(body)}
function sendJSON(res,code,obj){send(res,code,JSON.stringify(obj),{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'})}
function readBody(req,limit=200000){return new Promise((ok,bad)=>{let s='';req.on('data',c=>{s+=c;if(s.length>limit){bad(new Error('çok büyük'));req.destroy()}});req.on('end',()=>ok(s));req.on('error',bad)})}
function serveStatic(req,res){
  let p=decodeURIComponent(new URL(req.url,'http://x').pathname);if(p==='/')p='/index.html';
  const file=path.normalize(path.join(PUBLIC,p));if(!file.startsWith(PUBLIC))return send(res,403,'yasak');
  fs.stat(file,(err,st)=>{if(err||!st.isFile())return send(res,404,'bulunamadı');
    const ext=path.extname(file).toLowerCase();const type=MIME[ext]||'application/octet-stream';
    const h={'Content-Type':type,'Cache-Control':ext==='.html'?'no-cache':'no-cache'};
    const gz=/\bgzip\b/.test(req.headers['accept-encoding']||'')&&/text|javascript|json|svg/.test(type);
    if(gz){h['Content-Encoding']='gzip';res.writeHead(200,{...h,'X-Content-Type-Options':'nosniff'});fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res)}
    else{res.writeHead(200,{...h,'Content-Length':st.size,'X-Content-Type-Options':'nosniff'});fs.createReadStream(file).pipe(res)}})
}
const server=http.createServer(async(req,res)=>{
  const ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();
  try{
    if(req.url==='/api/health')return sendJSON(res,200,{ok:ORDER.length>0,providers:ORDER,time:new Date().toISOString()});
    if(req.url==='/api/agent'&&req.method==='POST'){
      if(limited(ip))return sendJSON(res,429,{error:'Dakikalık istek sınırı aşıldı'});
      const body=JSON.parse(await readBody(req)||'{}');const prompt=String(body.prompt||'').slice(0,24000);if(!prompt)return sendJSON(res,400,{error:'prompt boş'});
      const out=await withSlot(()=>askChain(prompt,!!body.json));return sendJSON(res,200,out);
    }
    if(req.method==='GET'||req.method==='HEAD')return serveStatic(req,res);
    send(res,405,'izin yok');
  }catch(e){sendJSON(res,e.status||500,{error:String(e.message||e).slice(0,400)})}
});
server.listen(PORT,HOST,()=>{console.log(`Worldmind çalışıyor: http://localhost:${PORT}`);console.log('Yapay zekâ sağlayıcıları: '+(ORDER.join(', ')||'yok (yalnızca yerel ajan)'))});

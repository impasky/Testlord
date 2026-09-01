/** İlk oturum akışını baştan sona yürütür ve her adımı ekran görüntüsüne alır. */
import { chromium, devices } from 'playwright';
const WEB='http://127.0.0.1:5173', API='http://localhost:3000', OUT='/tmp/pgtest/ss';
const CHROME='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b=await chromium.launch({executablePath:CHROME,args:['--no-sandbox']});
const p=await (await b.newContext({...devices['iPhone 13']})).newPage();
p.on('pageerror',e=>console.log('JS HATA:',e.message));
const bitir=async(k)=>{await b.close();process.exit(k);};
setTimeout(()=>{console.log('ZAMAN AŞIMI');bitir(1);},170000);
const tikla=async(parca)=>{
  const ok=await p.evaluate((m)=>{
    const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(m));
    if(!b) return false; b.click(); return true;
  },parca);
  if(!ok){
    const hepsi=await p.evaluate(()=>[...document.querySelectorAll('button')].map(x=>x.textContent.trim()).filter(Boolean));
    throw new Error(`buton yok: ${parca} | var: ${hepsi.join(' | ').slice(0,300)}`);
  }
};
let token=null;
const apiPost=async(y,g)=>{
  const r=await fetch(`${API}/api${y}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(g??{})});
  if(!r.ok) throw new Error(`${y}: ${r.status} ${await r.text()}`);
};
try{
  await p.goto(WEB,{waitUntil:'domcontentloaded'});
  await p.waitForSelector('input[type=email]',{timeout:15000});
  const d=Date.now();
  await p.fill('input[placeholder="Kara Yusuf"]',`Bak ${d.toString(36).slice(-4)}`);
  await p.fill('input[type=email]',`bak${d}@lordlar.dev`);
  await p.fill('input[type=password]','parola1234');
  await p.click('button[type=submit]');
  await p.waitForSelector('nav button:has-text("Malikâne")',{timeout:25000});
  token=await p.evaluate(()=>localStorage.getItem('lordlar_token')??localStorage.getItem('token'));
  await p.waitForTimeout(1200);
  await p.screenshot({path:`${OUT}/1-malikane.png`});
  console.log('1 malikâne ✓');

  await p.locator('nav button:has-text("Kışla")').click();
  await p.waitForTimeout(1500);
  await p.screenshot({path:`${OUT}/2-kisla-ordusuz.png`});
  console.log('2 kışla (ordusuz) ✓');

  await tikla('Mızrakçı eğit'); await p.waitForTimeout(700);
  await tikla('Okçu eğit'); await p.waitForTimeout(700);
  await tikla('Köylü Milis eğit'); await p.waitForTimeout(900);
  await p.screenshot({path:`${OUT}/3-kisla-kuyruk.png`});
  console.log('3 eğitim kuyruğu ✓');

  if(token){ await apiPost('/test/kuyruklari-bitir'); }
  await p.reload({waitUntil:'domcontentloaded'});
  await p.waitForSelector('nav button:has-text("Kışla")',{timeout:20000});
  await p.locator('nav button:has-text("Kışla")').click();
  await p.waitForTimeout(1800);
  await p.screenshot({path:`${OUT}/4-kisla-ordulu.png`});
  console.log('4 kışla (ordulu) ✓');

  await tikla('haritada aç');
  await p.waitForTimeout(2500);
  await p.screenshot({path:`${OUT}/5-harita-bolge.png`});
  console.log('5 harita/bölge ✓');

  // "Hepsi" ile bütün orduyu seç -> önizleme kendiliğinden gelmeli
  await tikla('Hepsi');
  await p.waitForTimeout(2000);
  await p.waitForTimeout(1400);
  await p.screenshot({path:`${OUT}/6-onizleme.png`});
  console.log('6 önizleme ✓');

  await tikla('Saldır');
  await p.waitForTimeout(2000);
  await p.screenshot({path:`${OUT}/7-saldiri-sonrasi.png`});
  console.log('7 saldırı ✓');
}catch(e){console.log('HATA:',e.message.slice(0,400));}
await bitir(0);

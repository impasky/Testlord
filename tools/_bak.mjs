import { chromium, devices } from 'playwright';
const WEB='http://127.0.0.1:5173', API='http://localhost:3000', OUT='/tmp/pgtest/ss';
const CHROME='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b=await chromium.launch({executablePath:CHROME,args:['--no-sandbox']});
const p=await (await b.newContext({...devices['iPhone 13']})).newPage();
p.on('pageerror',e=>console.log('JS HATA:',e.message));
const bitir=async(k)=>{await b.close();process.exit(k);};
setTimeout(()=>{console.log('ZAMAN AŞIMI');bitir(1);},120000);
try{
  await p.goto(WEB,{waitUntil:'domcontentloaded'});
  await p.waitForSelector('input[type=email]',{timeout:15000});
  const d=Date.now();
  await p.fill('input[placeholder="Kara Yusuf"]',`Tan ${d.toString(36).slice(-4)}`);
  await p.fill('input[type=email]',`tan${d}@lordlar.dev`);
  await p.fill('input[type=password]','parola1234');
  await p.click('button[type=submit]');
  await p.waitForSelector('nav button:has-text("Malikâne")',{timeout:25000});
  await p.waitForTimeout(2200);
  await p.screenshot({path:`${OUT}/t1-tanitim.png`});
  console.log('1 tanıtım ✓');
  await p.locator('nav button:has-text("Harita")').click();
  await p.waitForTimeout(2200);
  await p.screenshot({path:`${OUT}/t2-harita.png`});
  console.log('2 harita ✓');
}catch(e){console.log('HATA:',e.message.slice(0,300));}
await bitir(0);

/**
 * Üretim modu testi: tek servisli dağıtımın telefonda çalıştığını doğrular.
 *
 * Dağıtımdan önce yerelde koşturulur — Render'a gitmeden önce kırığı burada
 * yakalarsın. Bu test API adresi hatasını yakaladı: üretimde arayüz API'yi
 * ayrı bir portta arıyordu, oysa tek serviste aynı origin'de.
 *
 *   pnpm build
 *   DATABASE_URL=... JWT_SECRET=... NODE_ENV=production PORT=3200 \
 *     AUTO_MIGRATE=true SERVE_WEB=true RUN_WORKER=true SEED_DEMO_LORDS=true \
 *     node apps/api/dist/index.js
 *   node tools/uretim-testi.mjs
 */
import { chromium, devices } from 'playwright';
const URL = process.env.URETIM_URL ?? 'http://localhost:3200';
const SP = process.env.SMOKE_OUT ?? '.';
let hata=0; const k=(a,c,d='')=>{console.log(`  ${c?'[GEÇTİ]':'[KALDI]'} ${a}${d?` — ${d}`:''}`); if(!c)hata++;};

const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const ctx=await b.newContext({...devices['iPhone 13']});
const page=await ctx.newPage();
const hatalar=[];
page.on('console',m=>{if(m.type()==='error')hatalar.push(m.text());});
page.on('requestfailed',r=>hatalar.push('düştü: '+r.url()));

console.log(`Üretim modu — telefon boyutunda, tek adres (${URL})\n`);
await page.goto(URL,{waitUntil:'networkidle'});
k('Sayfa açıldı', (await page.title())==='Lordlar Çağı');
await page.screenshot({path:`${SP}/tel-1-giris.png`,fullPage:true});

const d=Date.now();
await page.fill('input[placeholder="Kara Yusuf"]',`Gezgin ${d.toString(36).slice(-4)}`);
await page.fill('input[type=email]',`tel${d}@lordlar.dev`);
await page.fill('input[type=password]','parola1234');
await page.click('button[type=submit]');
let girdi=true;
try{ await page.waitForSelector('nav button:has-text("Malikâne")',{timeout:15000}); }
catch{ girdi=false; console.log('   sayfa:',(await page.locator('body').innerText()).slice(0,200)); }
k('Telefondan kayıt olup oyuna girildi', girdi);
if(!girdi){ for(const h of hatalar.slice(0,4)) console.log('    -',h); await b.close(); process.exit(1); }
await page.waitForTimeout(1200);
await page.screenshot({path:`${SP}/tel-2-malikane.png`,fullPage:true});

const tasma=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
k('Yatay taşma yok',!tasma, await page.evaluate(()=>`${document.documentElement.scrollWidth}px içerik / ${window.innerWidth}px ekran`));

// Alt gezinme sekmeleri
for(const [s,f] of [['Kışla','tel-3-kisla.png'],['Harita','tel-4-harita.png']]){
  await page.locator(`nav button:has-text("${s}")`).click();
  await page.waitForTimeout(1600);
  await page.screenshot({path:`${SP}/${f}`,fullPage:true});
}
// Sıralama menü sayfasında
await page.locator('nav button:has-text("Menü")').click();
await page.waitForTimeout(600);
await page.locator('button:has-text("Sıralama")').last().click();
await page.waitForTimeout(1600);
await page.screenshot({path:`${SP}/tel-5-siralama.png`,fullPage:true});
// Sıralama artık tablo değil kart listesi (mobil düzen)
const satir = await page.locator('text=/Sv \\d+ · \\d+ bölge/').count();
k('Sıralamada rakip lordlar var', satir >= 5, `${satir} lord`);

await page.locator('nav button:has-text("Harita")').click();
await page.waitForTimeout(1500);
const dusman=await page.locator('svg path[fill="url(#dusman)"]').count();
k('Haritada düşman bölgesi var', dusman>0, `${dusman} bölge`);

k('Konsolda hata yok', hatalar.length===0, hatalar[0]??'');
await b.close();
console.log(hata===0?'\nSONUÇ: telefondan üretim modunda oynanabiliyor.':`\nSONUÇ: ${hata} sorun.`);
process.exit(hata===0?0:1);

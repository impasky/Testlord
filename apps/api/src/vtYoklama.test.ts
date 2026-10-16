import { createServer, type Server } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { veritabaniniYokla, vtHedefi, yoklamaAciklamasi, yoklamaOzeti } from './vtYoklama';

let sunucu: Server;
let acikKapi = 0;

beforeAll(async () => {
  sunucu = createServer((s) => s.end());
  await new Promise<void>((r) => sunucu.listen(0, '127.0.0.1', () => r()));
  acikKapi = (sunucu.address() as { port: number }).port;
});
afterAll(() => new Promise<void>((r) => sunucu.close(() => r())));

describe('veritabanı yoklaması', () => {
  it('adresten yalnız sunucu ve kapı çıkıyor; parola hiçbir metne girmiyor', async () => {
    const adres = 'postgresql://lordlar:cok-gizli-parola@dpg-abc123xyz-a:5432/lordlar_cagi';
    expect(vtHedefi(adres)).toEqual({ host: 'dpg-abc123xyz-a', port: 5432 });
    const y = await veritabaniniYokla(adres);
    const metin = `${yoklamaOzeti(y!)}\n${yoklamaAciklamasi(y, 120)}`;
    expect(metin).not.toContain('cok-gizli-parola');
    expect(metin).not.toContain('lordlar:');
  });

  it("Render'ın çözülmeyen iç adresi: bölge ve veritabanı durumu söyleniyor", async () => {
    const y = await veritabaniniYokla('postgresql://u:p@dpg-abc123xyz-a:5432/db');
    expect(y).toMatchObject({ dns: 'cozulemedi', tcp: 'denenmedi' });
    const a = yoklamaAciklamasi(y, 120);
    expect(a).toMatch(/AYNI bölgedeki/);
    expect(a).toMatch(/Available/);
  });

  it('kapalı kapı reddediliyor, açık kapı açık', async () => {
    const kapali = await veritabaniniYokla('postgresql://u:p@127.0.0.1:1/db');
    expect(kapali?.tcp).toBe('reddedildi');
    expect(yoklamaAciklamasi(kapali, 5)).toMatch(/reddediyor/);
    const acik = await veritabaniniYokla(`postgresql://u:p@127.0.0.1:${acikKapi}/db`);
    expect(acik?.tcp).toBe('acik');
    expect(yoklamaAciklamasi(acik, 5)).toMatch(/kullanıcı adı, parola/);
  });

  it('bozuk ya da boş adres: yoklama yok, açıklama söylüyor', async () => {
    expect(await veritabaniniYokla('')).toBeNull();
    expect(yoklamaAciklamasi(null, 5)).toMatch(/DATABASE_URL okunamıyor/);
  });
});

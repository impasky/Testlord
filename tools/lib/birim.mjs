/**
 * Kışladaki bir birimin kartını açar.
 *
 * Birim listesi aynı anda TEK kartı açık tutuyor: beş tam kart Ordu
 * ekranının içeriğinin %65'ini yiyordu (1318 piksel) ve oyuncu tek
 * seferde tek birim eğitiyor. Omurganın işaret ettiği birim hazır açık
 * geliyor; başka bir birim isteyen önce onun satırına dokunuyor.
 *
 * Test de oyuncunun yaptığını yapmalı. Zaten açıksa hiçbir şey yapmıyor,
 * yani çağırmak her zaman güvenli.
 */
export async function birimiAc(page, ad) {
  const satir = page.locator(`button[aria-expanded="false"]:has-text("${ad}")`);
  if (await satir.count()) {
    await satir.first().click();
    await page.waitForTimeout(400);
  }
}

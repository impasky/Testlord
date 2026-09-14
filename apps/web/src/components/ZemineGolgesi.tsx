/**
 * ZEMİNE OTURTAN İKİ GÖLGE.
 *
 * Oyuncunun tarifi: **"binalar havada duruyor gibi görünüyor."** Tek bir
 * yumuşak elips yetmiyor; bir nesnenin yere BASTIĞINI söyleyen şey iki
 * ayrı sinyal:
 *
 *   ORTAM — geniş ve soluk, nesnenin çevresine yayılan karartma.
 *   TEMAS — dar ve KOYU, tam tabanın olduğu yerde.
 *
 * İkisinin de dikey merkezi çizimin tabanına (kutunun altından %2
 * yukarısı) oturuyor, yani gölge nesnenin ÖNÜNE de taşıyor. Önceki hâlde
 * elips kutunun dibindeydi: nesnenin altında değil, altındaki boşluktaydı
 * ve açık zeminde hiç görünmüyordu.
 *
 * ── Neden ayrı bir bileşen ───────────────────────────────────────────
 *
 * Aynı iş iki yerde yapılıyor: şehir ekranındaki binalar ve bölge
 * sahnesindeki yapılar. İki kopya, bir gün birinin düzelip ötekinin
 * düzelmemesi demek — ve bu ders pahalıya öğrenildi.
 */
export function ZemineGolgesi() {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-7%] left-1/2 h-[18%] w-[84%] -translate-x-1/2 rounded-[50%]"
        style={{
          // Sıcak siyah: saf siyah bir leke taş döşemede mürekkep gibi
          // duruyordu; kahveye çalan karartma çimende çiğnenmiş toprak,
          // taşta aşınma gibi okunuyor.
          background:
            'radial-gradient(ellipse at center, rgba(38,28,16,0.44) 0%, rgba(38,28,16,0.20) 52%, rgba(38,28,16,0) 78%)',
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-2%] left-1/2 h-[8%] w-[46%] -translate-x-1/2 rounded-[50%]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.30) 55%, rgba(0,0,0,0) 82%)',
        }}
      />
    </>
  );
}

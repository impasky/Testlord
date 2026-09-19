/**
 * Evdeki orduyu bölgenin garnizonuna EKLER (üstüne yazmaz).
 *
 * `/map/:id/garrison` hedefi MUTLAK yazıyor: gönderilen ordu neyse
 * garnizon o oluyor. Sınamalar bunu "evdeki orduyu garnizona taşı" diye
 * kullanıyordu ve doğru çalışıyordu — çünkü fetihten sonra ordu eve
 * dönüyordu.
 *
 * Gelir garnizona bağlanınca (docs/16 §6) fetih sağ kalan orduyu
 * bölgede bırakmaya başladı. O anda ev boşaldı ve aynı çağrı garnizonu
 * SIFIRLAR hâle geldi: dört ayrı sınama "0 birim" diyordu ve garnizonu
 * boşaltan sınamanın kendisiydi.
 *
 * Tek yerde durması bilerek: aynı deyim dört dosyaya kopyalanmıştı ve
 * dördünü ayrı ayrı düzeltmek, beşincisi yazıldığında aynı hatayı
 * yeniden davet etmek olurdu.
 */
export async function garnizonaEkle(lord, regionId) {
  const evdeki = (await lord.get('/army')).home ?? {};
  const mevcut = (await lord.get(`/map/${regionId}`)).kendiGarnizonum ?? {};
  const hedef = { ...mevcut };
  for (const [tur, adet] of Object.entries(evdeki)) {
    hedef[tur] = Number(hedef[tur] ?? 0) + Number(adet || 0);
  }
  if (Object.keys(evdeki).length > 0) {
    await lord.post(`/map/${regionId}/garrison`, { army: hedef });
  }
  return hedef;
}

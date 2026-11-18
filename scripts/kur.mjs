// Her gün GitHub Actions çalıştırır: USD/TRY kurunu çeker, docs/rate.json'a yazar,
// önceki güne göre değişim eşiği aşarsa ntfy ile telefona bildirim atar.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const TOPIC = process.env.NTFY_TOPIC;
const ESIK = Number(process.env.ESIK_YUZDE || 2);       // günlük kritik değişim %
const LISTE_KURU = 49.85;                               // fiyat listesinin hazırlandığı kur
const FILE = 'docs/rate.json';

async function kurCek() {
  const kaynaklar = [
    async () => (await (await fetch('https://open.er-api.com/v6/latest/USD')).json()).rates.TRY,
    async () => (await (await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY')).json()).rates.TRY,
  ];
  for (const k of kaynaklar) { try { const r = await k(); if (r > 1) return r; } catch {} }
  throw new Error('Kur alınamadı');
}

const state = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { history: [] };
const kur = Math.round((await kurCek()) * 10000) / 10000;
const bugun = new Date().toISOString().slice(0, 10);
const onceki = state.history.filter(h => h.date < bugun).at(-1);

state.history = state.history.filter(h => h.date !== bugun);
state.history.push({ date: bugun, rate: kur });
state.history = state.history.slice(-60);
state.rate = kur; state.date = bugun; state.updated = new Date().toISOString();
writeFileSync(FILE, JSON.stringify(state, null, 1));

const pct = (a, b) => ((a - b) / b) * 100;
const gunluk = onceki ? pct(kur, onceki.rate) : 0;
const listeyeGore = pct(kur, LISTE_KURU);
console.log(`Kur ${kur} · günlük ${gunluk.toFixed(2)}% · listeye göre ${listeyeGore.toFixed(2)}%`);

if (TOPIC && Math.abs(gunluk) >= ESIK) {
  const yon = gunluk > 0 ? 'yükseldi' : 'düştü';
  const ornek = Math.round(20 * kur * 1.2).toLocaleString('tr-TR');
  await fetch(`https://ntfy.sh/${TOPIC}`, {
    method: 'POST',
    headers: { Title: `Dolar ${yon}: %${Math.abs(gunluk).toFixed(1)}`, Priority: 'high', Tags: 'warning' },
    body: `ParobitaChain: kur ${onceki.rate} -> ${kur} (bir günde ${gunluk > 0 ? '+' : ''}${gunluk.toFixed(1)}%). ` +
          `Listeye göre ${listeyeGore > 0 ? '+' : ''}${listeyeGore.toFixed(1)}%. 20$'lık ürün artık ${ornek} TL (KDV dahil). Satış fiyatlarına bak.`,
  });
  console.log('Bildirim gönderildi');
}

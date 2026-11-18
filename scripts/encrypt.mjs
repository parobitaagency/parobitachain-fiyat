// Kullanım: node scripts/encrypt.mjs data.json SIFRE  → docs/data.enc.json
// Fiyat + foto verisini şifreler; sayfa herkese açık olsa da şifresiz okunamaz.
import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto as c } from 'node:crypto';

const [, , src, pw] = process.argv;
if (!src || !pw) { console.error('node scripts/encrypt.mjs data.json SIFRE'); process.exit(1); }
const plain = new TextEncoder().encode(readFileSync(src, 'utf8'));
const salt = c.getRandomValues(new Uint8Array(16));
const iv = c.getRandomValues(new Uint8Array(12));
const base = await c.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
const key = await c.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ct = new Uint8Array(await c.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
const b64 = u => Buffer.from(u).toString('base64');
writeFileSync('docs/data.enc.json', JSON.stringify({ v: 1, it: 250000, salt: b64(salt), iv: b64(iv), ct: b64(ct) }));
console.log('docs/data.enc.json yazıldı');

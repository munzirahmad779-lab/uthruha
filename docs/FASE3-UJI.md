# Fase 3 — Cara Menjalankan Uji Dua Lapis (lokal)

Fixture uji adalah dua baris basis data bernama persis `UJI-GRATIS` dan
`UJI-PREMIUM` (dibuat oleh `scripts/seed-uji.ts` — baca kepala berkas itu
untuk penjelasan persis cara pembuatannya). Bukan akun mahasiswa, bukan
akun Google asli. Autentikasi uji hanya bekerja bila server dijalankan
dengan `UTH_MODE_UJI=1` (header `x-uji-user`); produksi tidak memasang
env itu.

```bash
# 1) stub layanan luar (LLM + Midtrans + Drive tiruan) di port 3999
STUB_PORT=3999 node scripts/stub-uji.mjs &

# 2) seed fixture ke store uji terpisah
UTH_DATA_FILE=/tmp/uthruha-uji/db.json npx tsx scripts/seed-uji.ts

# 3) server mode uji di port 3311
UTH_MODE_UJI=1 UTH_DATA_FILE=/tmp/uthruha-uji/db.json \
KOLAM_UJI_BASE=http://127.0.0.1:3999/llm/v1 \
MIDTRANS_SERVER_KEY=kunci-uji-lokal MIDTRANS_CLIENT_KEY=klien-uji \
MIDTRANS_API_BASE=http://127.0.0.1:3999 DRIVE_API_BASE=http://127.0.0.1:3999 \
npx next start -p 3311 &

# 4) jalankan rangkaian uji (36 pemeriksaan)
MIDTRANS_SERVER_KEY=kunci-uji-lokal UTH_URL_UJI=http://127.0.0.1:3311 \
npx tsx scripts/test-lapis-uji.ts
```

Catatan kejujuran label: pada rangkaian ini, langkah AI memakai stub
(kalengan deterministik) dan Drive memakai stub — keduanya SIMULASI untuk
layanan yang ditiru. Pencarian rujukan tamu memakai basis data ASLI
(OpenAlex/Crossref/Google Books/Open Library lewat internet). Mesin status
pembayaran, verifikasi tanda tangan webhook, aturan lapis, BM25, dan
validasi ISBN adalah kode produksi yang sama persis dengan yang berjalan
di live.

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

# Uji Dua Kunci — login Google di halaman awal + gerbang dua kunci

Fixture: `scripts/seed-uji-kunci.ts` (tiga pengguna @uji.local,
diautentikasi lewat cookie sesi pengguna ASLI — bukan header uji).
Suite: `scripts/test-dua-kunci.ts`, tiga fase melawan server bergerbang
di port 3312 (stub 3999 tetap dinyalakan seperti di atas):

```bash
# FASE A — kedua kunci terisi
UTH_DATA_FILE=/tmp/uthruha-uji-kunci/db.json npx tsx scripts/seed-uji-kunci.ts
UTH_MODE_UJI=1 UTH_DATA_FILE=/tmp/uthruha-uji-kunci/db.json \
UTH_LOGIN_GOOGLE_AKTIF=1 \
UTH_ACCESS_KEY=premium-uji-kunci-123456 UTH_KUNCI_GRATIS=gratis-uji-kunci-123456 \
UTH_SESI_SECRET=sesi-uji-dua-kunci-abcdef \
MIDTRANS_SERVER_KEY=kunci-uji-lokal MIDTRANS_CLIENT_KEY=klien-uji \
MIDTRANS_API_BASE=http://127.0.0.1:3999 KOLAM_UJI_BASE=http://127.0.0.1:3999/llm/v1 \
DRIVE_API_BASE=http://127.0.0.1:3999 npx next start -p 3312 &
FASE_UJI=A UTH_URL_UJI=http://127.0.0.1:3312 UJI_DATA_FILE=/tmp/uthruha-uji-kunci/db.json \
UTH_SESI_SECRET=sesi-uji-dua-kunci-abcdef UTH_ACCESS_KEY=premium-uji-kunci-123456 \
npx tsx scripts/test-dua-kunci.ts

# FASE B — restart server dengan UTH_ACCESS_KEY=premium-uji-kunci-ROTASI-789
# (data file sama), lalu:
FASE_UJI=B UTH_URL_UJI=http://127.0.0.1:3312 UJI_DATA_FILE=/tmp/uthruha-uji-kunci/db.json \
UTH_SESI_SECRET=sesi-uji-dua-kunci-abcdef UTH_ACCESS_KEY=premium-uji-kunci-ROTASI-789 \
KUNCI_PREMIUM_UJI=premium-uji-kunci-ROTASI-789 \
KUNCI_PREMIUM_LAMA_UJI=premium-uji-kunci-123456 \
npx tsx scripts/test-dua-kunci.ts

# FASE C — data file baru + seed ulang; server TANPA UTH_KUNCI_GRATIS, lalu:
FASE_UJI=C UTH_URL_UJI=http://127.0.0.1:3312 UJI_DATA_FILE=/tmp/uthruha-uji-kunci-c/db.json \
UTH_SESI_SECRET=sesi-uji-dua-kunci-abcdef UTH_ACCESS_KEY=premium-uji-kunci-123456 \
npx tsx scripts/test-dua-kunci.ts
```

Catatan: UTH_SESI_SECRET wajib diisi pada rangkaian ini — persis seperti
anjuran produksi — agar cookie identitas selamat dari rotasi kunci akses
(rahasia sesi tidak lagi meminjam UTH_ACCESS_KEY).

Catatan TAHAN LOGIN GOOGLE (28 Okt 2026): suite ini menguji mode login
Google AKTIF, jadi server uji dinyalakan dengan UTH_LOGIN_GOOGLE_AKTIF=1
(Fase A di atas; Fase B & C mengikuti env yang sama selain perubahan
yang memang menjadi subjek fasenya). Produksi berjalan dengan flag
MATI (bawaan) sampai pemilik menyalakannya. Perilaku flag mati cukup
dicek titik (server tanpa env itu): POST /api/auth/google →
403 FITUR_BELUM_AKTIF; GET /api/auth/status → loginGoogleAktif:false
dan bisaMasukTanpaKunci:false; GET /masuk → 200 tanpa bagian Google;
POST /api/masuk dengan kunci yang benar → 200 seperti biasa.

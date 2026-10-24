# أُطروحة · Uthruha

Ruang kerja penulisan karya ilmiah **berbahasa Arab**: skripsi, tesis, disertasi, dan artikel jurnal. Dibuat untuk mahasiswa dan peneliti Indonesia yang menulis dalam bahasa Arab — bukan terjemahan dari alat berbahasa Inggris.

Seluruh aplikasi berjalan di peramban. Tidak ada akun, tidak ada server data. Draf, istilah, dan rujukan Anda disimpan di `localStorage` perangkat Anda sendiri.

Satu-satunya bagian yang memanggil server adalah **Cari Rujukan**: paragraf yang Anda tempel dikirim ke `api.turath.io` untuk dicocokkan, dan — bila Anda mengisi kunci LLM — paragraf yang sama dikirim ke penyedia LLM untuk diambil istilah pencariannya. Keduanya mati total bila Anda memilih mode «Kata» atau mematikan sakelar LLM. Mesin penulisan naskah sendiri tetap deterministik.

---

## 1. Apa yang bisa dilakukan

| Bagian | Isi |
| --- | --- |
| **Panduan** (`/panduan`) | Struktur bab per jenjang, ketentuan format naskah Arab, 10 kesalahan ortografi umum, strategi istilah, gaya sitasi, batas penggunaan alat bantu. |
| **Alat** (`/alat`) | Pemeriksa ortografi, transliterasi dua arah, penyusun sitasi (4 format), bank 250 frasa akademik, simulator 66 pertanyaan sidang. |
| **Jurnal** (`/jurnal`) | Direktori 30 jurnal yang menerima naskah Arab (20 Indonesia, 10 dunia Arab/internasional) + pemadu berbasis kata kunci. |
| **Wizard** (`/mulai`) | Lima langkah: jenis karya → bidang → metode → data penelitian → rumusan masalah. |
| **Ruang kerja** (`/proyek/[id]`) | Tujuh tab: Ringkasan, Struktur, Tulis, Istilah, Rujukan, Periksa, Ekspor. Di dalamnya: pedoman kampus dinamis, pencari rujukan multi-sumber, dan catatan kaki Word asli. |

### Tujuh tab ruang kerja

1. **Ringkasan** — identitas penelitian (topik, lokasi, populasi, fenomena), rumusan & tujuan, progres per bab, langkah berikutnya.
2. **Struktur** — peta bab/sub-bab dengan target kata dan penanda bagian yang butuh data lapangan.
3. **Tulis** — editor per bagian (RTL, font naskah), pertanyaan pemicu, penyusun draf, pratinjau, tombol **Cari Rujukan**, dan **Periksa Batas**.
4. **Istilah** — kamus istilah Indonesia↔Arab, hitung pemakaian, deteksi istilah ganda.
5. **Rujukan** — data sumber sekali, keluar empat format; ditambah sub-tab **Pedoman Kampus**.
6. **Periksa** — ortografi & tanda baca, kelengkapan bagian, perbaikan otomatis yang bisa ditinjau.
7. **Ekspor** — `.docx` RTL dengan catatan kaki Word asli, dan `.md`.

### Pedoman kampus dinamis

Unggah (atau tempel) berkas pedoman penulisan kampus Anda dalam bentuk `.md`/teks, lalu tekan **Baca pedoman**. Penafsir di `lib/refs/pedoman.ts` menarik aturan secara deterministik — tanpa model bahasa:

- nama lembaga, font Arab, ukuran naskah, ukuran footnote, spasi, margin, gaya sitasi, penomoran footnote, penulisan angka (Arab/Latin)
- setiap nilai menyimpan `asal` (kutipan baris sumbernya) supaya bisa Anda audit; kalau tidak terbaca, nilai kembali ke bawaan dan ditandai
- **batas keras tidak bisa ditimpa pedoman**: maksimal 2 footnote per paragraf dan sasaran 1 halaman A4 tetap berlaku

### Pencari rujukan otomatis multi-sumber

Tempel **satu paragraf Arab** (maksimal 1 paragraf) di panel **Cari Rujukan**. Aplikasi memecahnya per kalimat, menanyakan tiap kalimat ke empat sumber, lalu menampilkan kandidat **dikelompokkan per kalimat**.

| Sumber | Status nyata | Peran |
| --- | --- | --- |
| **Turath.io** | API resmi `api.turath.io/search` — aktif, tanpa kunci | sumber utama berskor |
| **Shamela.ws** | pustaka berbasis kunci; tidak dipanggil dari peramban | cadangan |
| **Ketabonline.com** | tidak ada API publik terdokumentasi | pintu manual |
| **Usul.ai** | belum ada konfirmasi penyedia | pintu manual |
| **Waqfeya.com** | pencarian HTML; dipakai **hanya untuk verifikasi** | tautan cek |

Sumber tanpa akses API **tidak dipalsukan**: kandidatnya dikembalikan sebagai `pintu[]` dengan skor 0 dan ditampilkan terpisah sebagai tautan pembuka pencarian di situs aslinya. Panel juga menampilkan **Catatan jujur** yang menyatakan sumber mana yang benar-benar menjawab dan mana yang tidak.

**Rujukan manual.** Bila kalimat Anda tidak ada di korpus mana pun, tempel baris sitasi dari kitab cetak di panel *Rujukan manual*. Pengurai mengambil penulis, judul, kota, penerbit, tahun, jilid, halaman. Kandidat manual sengaja diberi skor 0 — artinya "Anda yang menulis ini", bukan "cocok". Kolom yang tidak terbaca ditandai `[ ! verifikasi ]`, **tidak pernah dikarang**.

### Catatan kaki yang benar-benar hidup

Penanda `[^n]` di naskah dirender sebagai **superscript** di pratinjau (hijau bila definisinya ada, merah bila tidak) dan menjadi **catatan kaki Word asli** saat diekspor:

- `word/footnotes.xml` dibuat dari nol, lengkap dengan separator (id `-1`) dan continuation separator (id `0`)
- setiap penanda menjadi `<w:footnoteReference w:id="…"/>` dengan gaya `FootnoteReference`
- `[Content_Types].xml` dan `word/_rels/document.xml.rels` ikut diperbarui
- definisi `[^n]: …` dibuang dari badan naskah, tidak muncul sebagai teks
- penanda tanpa definisi **selalu ditampilkan apa adanya**, tidak pernah dibuang diam-diam

Parser markdown catatan kaki dipakai bersama oleh pratinjau dan ekspor (`lib/refs/footnote-markdown.ts`) supaya keduanya tidak pernah berbeda tafsir.

### Periksa Batas

Tombol **Periksa Batas** menghitung jumlah footnote (total dan per paragraf), perkiraan kata, perkiraan halaman A4, dan target font/spasi dari pedoman. Angka halaman adalah **perkiraan** berbasis konstanta kata-per-halaman, bukan pengukuran Word — dan kalimatnya menyebut itu.

---

## 2. Bedanya dengan platform sejenis (Paramarta dan lain-lain)

Ini bukan tiruan, bukan salinan kode/desain/teks, dan tidak dimaksudkan menggantikan produk siapa pun. Perbedaannya struktural:

| Aspek | Platform umum | Uthruha |
| --- | --- | --- |
| Bahasa kerja | Inggris/Indonesia, Arab sebagai tempelan | **Arab sebagai bahasa utama naskah**; antarmuka Indonesia hanya untuk navigasi |
| Pasar | Semua disiplin, semua bahasa | **Khusus karya ilmiah berbahasa Arab** (UIN/IAIN, pesantren, studi Islam) |
| Mesin | Model bahasa (LLM) berbayar per token | **Mesin deterministik**: template, kamus, aturan ortografi — bisa diperiksa dan diprediksi |
| Biaya | Paket berlangganan | Tidak ada akun, tidak ada kuota |
| Data | Dikirim ke server penyedia | **Tetap di peramban Anda** |
| Arah sitasi | APA/MLA | **Catatan kaki gaya kitab** + daftar pustaka Arab (urut kaidah alfabet Arab) |
| Jurnal | Berbasis APC internasional | **Jurnal Indonesia (UIN/IAIN) + dunia Arab**, dengan catatan verifikasi |

Karena mesinnya deterministik, Uthruha **tidak** mengklaim "menulis skripsi Anda". Ia menyusun kerangka yang bisa dipertanggungjawabkan, menandai apa yang masih kosong dengan `[ … ]`, dan menolak mengarang sumber, DOI, atau angka statistik.

Halaman beranda memuat bagian **Integritas Akademik** yang menjelaskan batas ini secara terbuka, termasuk pernyataan bahwa draf otomatis wajib diperiksa dan diedit.

---

## 3. Teknologi

- **Next.js 15.5** (App Router) + **React 19** + **TypeScript 5.7** (strict)
- **Tailwind CSS 3.4** dengan palet khusus: `ink` (hijau tua), `gold` (emas), `parchment` (kertas)
- Font: **Amiri**, **Noto Naskh Arabic**, **Noto Kufi Arabic** lewat Google Fonts
- Tanpa dependensi runtime tambahan. DOCX ditulis dari nol (`lib/engine/export.ts`): ZIP metode *store* + CRC32 + WordprocessingML dengan `<w:bidi/>`, `sectPr` RTL, dan bagian `word/footnotes.xml` untuk catatan kaki asli.
- Adapter sumber rujukan memakai `fetch` bawaan Node (tanpa paket SDK). Kunci API, bila kampus Anda punya, hanya lewat variabel lingkungan server — tidak pernah dikirim ke peramban.

```
uthruha/
├── app/
│   ├── page.tsx              # beranda
│   ├── mulai/page.tsx        # wizard 5 langkah
│   ├── proyek/page.tsx       # daftar proyek (localStorage)
│   ├── proyek/[id]/page.tsx  # ruang kerja
│   ├── alat/page.tsx         # 5 alat gratis
│   ├── jurnal/page.tsx       # direktori + pemadu
│   ├── panduan/page.tsx      # panduan penulisan
│   ├── layout.tsx · not-found.tsx · robots.ts · sitemap.ts
│   └── api/refs/search/route.ts   # pencarian rujukan (Node, rate limit 30/menit/IP)
├── components/
│   ├── landing.tsx · faq.tsx · manuscript.tsx · ui.tsx
│   ├── site-header.tsx · site-footer.tsx · brand.tsx · icons.tsx
│   ├── workspace/ (shell, overview, struktur-tab, tulis-tab,
│   │               istilah-tab, refs-tab, audit-tab, export-tab,
│   │               ref-finder, pedoman-panel, batas-strip)
│   └── alat/ (ortografi, transliterasi, sitasi, frasa, sidang)
├── lib/
│   ├── content/  struktur · bidang · metode · frasa (250) · jurnal (30)
│   │             sidang (66) · panduan · types
│   ├── engine/   compose · orthografi · translit · cite · match
│   │             project · export
│   └── refs/     types · score · pedoman · footnote · footnote-markdown
│                 index · adapters/ (turath, shamela, ketabonline,
│                                    usul, waqfeya, manual, http, normalize)
└── scripts/      smoke.ts · qa-naskah.ts · qa-refs.ts · ui-check.mjs
```

---

## 4. Menjalankan

```bash
npm install
npm run dev          # http://localhost:3300
```

Produksi:

```bash
npm run build
npm run start        # http://localhost:3300
```

Port diatur di `package.json` (`-p 3300`). Ubah bila bentrok dengan aplikasi lain di komputer Anda.

### Uji

```bash
npm run typecheck    # tsc --noEmit
npm run smoke        # mesin: komposisi 189 bagian, ortografi, translit, sitasi, docx
npm run smoke:qa     # pemeriksa ortografi atas 12 kombinasi jenis × metode
npx tsx scripts/qa-refs.ts   # pedoman, footnotes.xml, rujukan manual
npm run check:ui     # Chrome headless via CDP — server harus hidup lebih dulu
```

`check:ui` memakai Chrome di `C:\Program Files\Google\Chrome\Application\chrome.exe` dan port debug 9333. Ubah lewat `UTHRUHA_BASE` dan `UTHRUHA_CDP_PORT` bila perlu.

---

## 5. Data dan batasannya

**Disimpan di peramban** (kunci `uthruha:projects:v1`):

- proyek: jenis, metode, bidang, judul/topik Arab, rumusan, tujuan, istilah, jawaban pemicu, draf per bagian, sumber, catatan
- tidak ada sinkronisasi antarperangkat; tidak ada cadangan otomatis di server

**Yang perlu Anda tahu:**

- Menghapus data situs (*clear site data*) akan menghapus semua proyek. Ekspor `.docx` adalah cadangan Anda.
- Mode privat/incognito kehilangan data saat jendela ditutup.
- Batas praktis `localStorage` ±5 MB — kira-kira cukup untuk puluhan naskah tanpa gambar.
- Draf disimpan 500 ms setelah Anda berhenti mengetik.

---

## 6. Ekspor

`buatDocx()` menulis OOXML langsung: `[Content_Types].xml`, `_rels`, `word/document.xml`, `word/styles.xml`, `docProps`. Fitur:

- arah paragraf RTL (`<w:bidi/>`) dan `sectPr` RTL
- perataan justify, indentasi baris pertama
- heading tingkat 1–3 dari markdown, daftar bernomor/berbutir, tabel dasar
- penanda `(مسودة تلقائية — لم تُراجع بعد)` pada bagian yang belum disunting

Setelah diunduh, sesuaikan font ke *Traditional Arabic* 16 pt, spasi 1,5, dan margin sesuai pedoman kampus Anda.

---

## 7. Mesin komposisi

`composeSection(project, sectionId, seed)` menyusun kerangka Arab per bagian dari:

- **struktur** (5 bab × sub-bagian, atau IMRaD untuk jurnal)
- **bidang** (9 bidang: quran, hadis, fiqh, tarbiyah, bahasa, tarikh, iqtishad, dakwah, falsafah) — teori & rujukan kunci
- **metode** (kuantitatif, kualitatif, campuran) — desain, teknik, analisis, keabsahan
- **konteks proyek** — topik, lokasi, populasi, fenomena, rumusan, tujuan, istilah

Placeholder yang tidak bisa diisi mesin tetap ditulis sebagai `[ … ]` agar terlihat dan tidak terlupa. Tombol **Variasi** memakai `seed` berbeda untuk susunan kalimat alternatif.

Ini bukan model bahasa: tidak ada API, tidak ada biaya token, dan hasilnya sama untuk masukan yang sama.

> Catatan lingkup: pernyataan di atas berlaku untuk **mesin penulisan naskah** (kerangka, istilah, ortografi). **Cari Rujukan** punya jalur LLM opsional — lihat bagian «Dua mode pencarian» di bawah.

---

## 8. Isi konten

| Konten | Jumlah |
| --- | --- |
| Frasa akademik Arab | 250 (10 per bagian × 25 bagian) |
| Jurnal | 30 (20 Indonesia, 10 dunia Arab/internasional) |
| Pertanyaan sidang | 66 (11 per kategori × 6 kategori) |
| Bidang keilmuan | 9 |
| Metode | 3 (kuantitatif, kualitatif, campuran) |
| Struktur karya | 4 (skripsi, tesis, disertasi, jurnal) |

Data jurnal bersifat **indikatif**: status indeks, APC, dan cakupan berubah. Setiap entri memuat catatan yang harus diperiksa di laman resmi penerbit.

---

## 9. Etika

Uthruha membantu kerangka, konsistensi, dan format. Ia tidak menggantikan:

- data lapangan dan interpretasi Anda,
- pembacaan sumber asli,
- bimbingan dosen,
- tanggung jawab akademik atas isi naskah.

Aturan kampus tentang penggunaan alat bantu berbeda-beda. Baca aturan itu lebih dulu; bila diminta, laporkan penggunaan alat bantu dalam ucapan terima kasih atau lampiran metodologi.

### Tentang pencarian rujukan

Fitur **Cari Rujukan** mengirim potongan kalimat Arab Anda ke `api.turath.io` untuk dicocokkan. Itu satu-satunya **sumber kitab** yang benar-benar dipanggil server; sisanya hanya tautan yang Anda buka sendiri. Kalimat yang dikirim adalah paragraf yang Anda tempel di panel, bukan seluruh naskah.

## Dua mode pencarian

Panel **Cari Rujukan** punya dua tombol. Keduanya hidup berdampingan; Anda pilih per pencarian.

### «Kata» — mencocokkan kata paragraf

Kalimat dipecah menjadi jendela 4–6 kata, lalu tiap jendela dicari ke Turath. Turath mencocokkan **frasa persis**, jadi kalimat utuh 19 kata hampir selalu menghasilkan nol — itu sebabnya dipecah. Skor = kemiripan teks (Jaccard + bonus trigram).

Ini satu-satunya mode yang didukung **semua** sumber (Turath, Shamela, Ketabonline, Usul). Paling aman untuk kutipan langsung.

### «Makna» — mencocokkan topik

Dua tahap:

1. **Istilah** — paragraf dibaca untuk diambil 4–8 istilah Arab yang lazim dipakai kitab membahas topik itu (mis. `المدني والمكي`, `أسباب النزول`, `الترجيح بين الأقوال`).
2. **Pencarian** — tiap istilah dicari ke Turath; halaman dinilai dari berapa banyak istilah muncul di **judul bab** (`meta.headings`), bukan cuma di teks. Frasa yang muncul utuh bernilai penuh; frasa yang hanya separuh katanya muncul tidak dihitung.

Tahap 1 memakai **LLM bila tersedia**; kalau tidak, jatuh ke aturan kata deterministik (kata wacana seperti «أمثلة», «وقع», «حديثه» dibuang). UI selalu menampilkan asal istilahnya: lencana **LLM** atau **Aturan kata**, plus nama penyedia dan modelnya.

**Yang tidak boleh disalahpahami:**

- Skor tinggi berarti halaman itu **membahas topik yang sama**, bukan berarti halaman itu memuat kalimat Anda.
- Nama kitab, penulis, jilid, halaman, dan tautan **selalu dari Turath** — tidak pernah dari model. LLM hanya menyusun istilah pencarian.
- Mode ini hanya didukung Turath, karena butuh metadata judul bab.

### Penyedia LLM (opsional, semuanya bergratis)

Isi kunci di `.env.local` (lihat `.env.example`). Satu kunci per layanan. Rantai dicoba berurutan dan yang kosong dilewati:

| # | Penyedia | Jatah gratis | Kunci |
|---|---|---|---|
| 1 | **Ollama** (lokal) | tanpa batas, tanpa kunci, tidak keluar komputer | — |
| 2 | **Cloudflare Workers AI** | 10.000 Neuron/hari | `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` |
| 3 | **Google Gemini** | tier gratis permanen | `GEMINI_API_KEY` |
| 4 | **Alibaba Model Studio** | ~1 juta token/model, 90 hari | `DASHSCOPE_API_KEY` |
| 5 | **Groq** | tier gratis | `GROQ_API_KEY` |
| 6 | **Cerebras** | tier gratis harian | `CEREBRAS_API_KEY` |
| 7 | **Mistral** | tier gratis | `MISTRAL_API_KEY` |
| 8 | **GitHub Models** | gratis dengan akun GitHub | `GITHUB_TOKEN` |
| 9 | **OpenRouter** | model `:free`, limit harian | `OPENROUTER_API_KEY` |

Ini sembilan **perusahaan berbeda**, masing-masing memakai jatah resminya sendiri. Yang **tidak** didukung: beberapa akun pada satu layanan untuk menembus kuota — itu melanggar ketentuan penyedia dan berisiko blokir.

Kalau semua penyedia gagal, pencarian **tetap jalan** dengan aturan kata. Aplikasi tidak pernah mati karena LLM.

### Privasi

Paragraf Anda hanya keluar bila: Anda memilih mode «Makna» **dan** sakelar LLM menyala **dan** ada kunci terisi. Untuk naskah yang belum boleh keluar, pilih **Ollama** (lokal) atau matikan sakelar LLM.

Yang **tidak** dilakukan aplikasi ini:

- tidak mengarang nama kitab, jilid, halaman, tahun, atau penerbit — kolom yang tidak terbaca ditandai `[ ! verifikasi ]`
- tidak menampilkan kandidat dari sumber tanpa API seolah-olah hasil pencarian; kandidat itu dipisah ke bagian *Pintu manual*
- tidak menyembunyikan kegagalan sumber; status tiap sumber ditampilkan apa adanya

Skor kecocokan adalah kemiripan teks deterministik (Jaccard + bonus trigram), bukan penilaian akademik. Skor tinggi berarti kalimatnya mirip, **bukan** berarti kutipannya tepat untuk argumen Anda. Baca halaman aslinya sebelum mengutip.

# CHANGELOG

## Fase 2 — Referensi, Pencarian Jurnal & Kitab, AI Helper (26 Okt 2026, branch `fase2`)

Dikerjakan mengikuti *Rancangan Lengkap Fase 1 v2*. Enam paket, satu commit per paket, `npm run build` + `typecheck` hijau di tiap paket.

### Urutan 0 — Penyelarasan & keamanan data
- Default model Groq di `lib/refs/llm/penyedia.ts` diganti ke `qwen/qwen3.8-27b` (terverifikasi di akun pemilik; `qwen3-32b` sudah tidak ada di katalog).
- CSP `connect-src` menambah `https://doaj.org` (C.2). Archive.org sengaja tidak ditambah (jalurnya server-side).
- Penyimpanan localStorage diperkeras: cadangan bergilir sebelum penimpaan, JSON rusak diamankan ke kunci terpisah (tidak lagi dibaca sebagai "kosong"), `SimpanPenuhError` untuk kuota penuh, `ukurProyek()`/`ukurPenyimpanan()`.

### Urutan 1 — Reference Manager (§1)
- `Sumber` schema v2: `penulisDaftar`, `muhaqqiq`, `tahunHijriah`, `isbn/issn`, `sumberImpor`, `perluVerifikasi`, dan field lit-review `temuan/metodeSumber/relevansi` (§6 pengganti matriks).
- `Project.versiSkema` + gerbang tunggal `migrasiProyek()` (C.8): data v1 dilengkapi, bentuk GDrive lama (`ProyekTersimpan`) dipetakan, schema lebih baru ditolak dengan pesan. Semua jalur muat lokal melewatinya.
- `lib/engine/referensi.ts`: dedup DOI-exact + judul ternormalisasi (Jaccard ≥0,92), parser BibTeX & RIS manual tanpa dependensi.
- UI tab Rujukan: panel impor BibTeX/RIS, peringatan duplikat saat simpan manual, badge sumber & "perlu verifikasi", editor tiga field lit-review per entri.

### Urutan 2 — Formatter & marker (§3)
- `lib/engine/citation.ts`: Turabian 9 (default), Chicago 17, APA 7, Arab klasik (membungkus formatter lama). Pemilih gaya per proyek di tab Rujukan.
- `lib/engine/marker.ts`: format simpan `[[ref:id|hlm:..|jilid:..]]`, kompilasi ke footnote markdown `[^n]` saat ekspor; penanda tak dikenal dipertahankan & dilaporkan, tidak dibuang.
- Tab Tulis: sisip penanda sitasi dari daftar rujukan + halaman.
- Ekspor .docx: daftar pustaka mengikuti gaya aktif; isi footnote kini mendukung run miring `<w:i/>` untuk judul (footnote tetap OOXML-native).

### Urutan 3 — Pencarian topik (§2 + C.1/C.3/C.11)
- Route server `app/api/kata-kunci`: Groq → Cloudflare Workers AI → fallback tanpa-AI; key hanya dari env server; route tetap di belakang gerbang auth (tidak masuk JALUR_BEBAS).
- `lib/engine/pencarian-topik.ts`: CrossRef `query.bibliographic` + filter journal-article dan DOAJ dari browser; BM25 lokal atas referensi & draf (diberi label jujur "pencarian kata kunci"); parser tempelan sitasi untuk impor dari clipboard.
- Panel "Cari online & lokal" di tab Rujukan: mode Jurnal / Kitab / Di referensi saya, status per sumber, sadar offline, hasil berkelompok kepercayaan, tautan pre-fill Turath.io/Shamela/Garuda, tambah-sebagai-draf dengan cek duplikat.

### Urutan 4 — Cross-check (§4)
- `lib/engine/crosscheck.ts` + panel di tab Periksa: jalur marker deterministik (penanda yatim = kritis), jalur warisan footnote `[^n]` berlabel "periksa manual", daftar abaikan per proyek (`abaikanSitasi`), daftar rujukan yang belum disitir. On-demand, bukan per ketikan.

### Urutan 5 — Kuota, offline, onboarding (C.7/C.9/C.10)
- Strip kuota penyimpanan di workspace (peringatan 70%, kritis 85%) + banner galat simpan — kegagalan menyimpan tidak lagi senyap.
- `/panduan#referensi`: empat kartu panduan (menambah rujukan, penanda sitasi, jurnal vs kitab, anti-karang).
- Petunjuk sekali-saja yang bisa ditutup di tab Rujukan (flag localStorage).
- Panel pencarian sadar status offline dengan pengalihan ke pencarian lokal.

### Belum dikerjakan (sesuai rancangan)
- §5 nested section — ditunda sampai ada demand nyata.
- muse-bridge (C.4) — ditolak.
- Embedding semantik (Transformers.js) — jalur upgrade, bukan v1.

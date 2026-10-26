# CHANGELOG

## Naskah dokumen mengalir: kalimat susunan tidak lagi terpisah-pisah (26 Okt 2026)
- Keluhan user: hasil susun menampilkan tiap kalimat sebagai blok terpisah — bagus saat menulis (mudah menyisipkan sumber di sela kalimat), tetapi buruk di dokumen akhir. Perbaikan `rapikanNaskah()` di compose.ts: pada keluaran tingkat DOKUMEN (composeNaskah), blok-blok prosa hasil susunan digabung menjadi paragraf mengalir tanpa celah antar-kalimat; judul, sub-judul, daftar, kutip, dan definisi footnote tidak disentuh. Draf tulisan mahasiswa sendiri TIDAK dirapikan — paragraf yang sengaja ia pisahkan dihormati. Tampilan per bagian di editor (composeSection) tidak berubah, jadi kemudahan menyisipkan sumber tetap ada.
- Terverifikasi sampai dokumen Word: paragraf latar belakang yang tadinya 7 blok kalimat kini 1 paragraf berisi 7 kalimat di dalam .docx hasil ekspor; blok prosa naskah menyusut dari ±110 menjadi 56. Uji scripts/test-rapikan-naskah.ts 8/8.

## Aturan per jenjang + gerbang mutu + bersih-bersih duplikasi (26 Okt 2026)
Menindaklanjuti keluhan "susunan semua jenjang disamakan & kurang elok" dan aturan tetap user (fungsi sama → gabung, yang kalah dihapus):
- **Struktur per jenjang kini sungguh berbeda** (lib/content/struktur.ts): templat `akademik()` bersama diganti perakitan babJenjang — tesis mendapat bagian Kontribusi Penelitian + Sintesis & Kritik Teori dan panduan Penelitian Terdahulu standar tesis (≥15 studi, kritis); disertasi menambah Kebaruan & Orisinalitas + Peta Jalan & Posisi Penelitian, panduan state-of-the-art (≥25 studi), dan tambahan tuntutan kebaruan pada latar belakang & kerangka teori. Target kata realistis: skripsi ±16,6 rb, tesis ±28,6 rb, disertasi ±54,5 rb kata. Jurnal bereputasi: + Abstrak Bahasa Inggris, Kata Kunci, Keterbatasan, Ucapan Terima Kasih & Pendanaan, Pernyataan Konflik Kepentingan & Data; pendahuluan wajib memuat pernyataan kebaruan; total ±6,5 rb kata. Sembilan generator compose baru ditulis untuk bagian-bagian itu (bukan stub).
- **Gerbang mutu per jenjang** (lib/engine/gerbang-mutu.ts + kartu di tab Periksa): syarat tegas berbeda per jenjang — minimum rujukan (15/30/50/25), proporsi artikel jurnal (30/50/40/70%), kitab primer ≥8 (disertasi), artikel mutakhir ≥50% (jurnal), bagian wajib jenjang terisi, sitasi tanpa rujukan hilang, dan ≥70% target kata — tampil LOLOS/BELUM per syarat.
- **Bersih-bersih sesuai aturan anti-menumpuk**: dua pemeriksa sitasi (crosscheck lama & periksa-sitasi) DIGABUNG menjadi satu mesin lib/engine/periksa-sitasi.ts (menyerap jalur warisan footnote [^n], daftar abaikan, dan hitungan penanda sehat dari crosscheck) dan satu panel bersama components/workspace/pemeriksaan-sitasi-panel.tsx yang dipakai tab Periksa & Ekspor. DIHAPUS: lib/engine/crosscheck.ts, components/workspace/crosscheck-panel.tsx, dan components/workspace/ref-search-panel.tsx (yatim, tidak dipakai di mana pun).

## Panen audit eksternal: verifikasi DOI, ISBN, fallback jurnal, mutu terukur (26 Okt 2026)
Menindaklanjuti audit & scaffold dari Claude lain (uthruha-core) — yang cocok dipanen ke produksi, yang sudah ada tidak dibangun ulang:
- **Verifikasi DOI cocok-judul** (`verifikasiDoi` di validasi-ref.ts; kemiripan Jaccard sadar harakat, ambang 0,6 — dipanen dari resolver scaffold): tombol "Periksa kecocokan DOI" membandingkan DOI dengan judul yang diketik; dan setiap penyimpanan rujukan manual ber-DOI kini dicek otomatis — DOI tertukar/asal tempel membuat referensi tersimpan dengan tanda perlu verifikasi + peringatan yang menyebut judul asli Crossref-nya. Teruji hidup terhadap DOI jurnal Indonesia asli.
- **Ambil dari ISBN** (Google Books) di formulir rujukan: judul, penulis, penerbit, tahun, dan jumlah halaman terisi otomatis; kota terbit tetap manual (Google Books jarang memuatnya, dinyatakan terbuka).
- **Pencarian jurnal kini 4 sumber**: Crossref + DOAJ + **OpenAlex** + **Semantic Scholar** (fallback berlapis sesuai rancangan audit), status tiap sumber tetap ditampilkan; tampung tetap maks 15 sesudah dedup.
- **Direktori jurnal: cap "Tautan resmi terakhir diverifikasi"** per entri — hanya untuk tautan yang benar-benar terkonfirmasi hidup saat pemeriksaan (15 dari 30 entri pada 26 Okt 2026; sisanya belum terjangkau dari jaringan pemeriksa, bukan berarti mati).
- **Pemeriksa ortografi DIUKUR + DIPERBAIKI**: korpus uji berlabel (scripts/uji-ortografi-korpus.ts) menemukan aturan ta marbuta nyaris tidak pernah menyala karena daftar katanya tidak mengenali bentuk ber-ال — diperbaiki (pencocokan melepas ال + daftar diperluas) dan spasi sebelum titik ditambah. Hasil sesudah perbaikan: recall 16/16, nol temuan keliru pada 10 kalimat bersih. Angka + batas cakupan kini dinyatakan terbuka di halaman alat ortografi.
- **Peringatan bank frasa**: pola adalah kerangka awal — tulis ulang dengan datamu sendiri agar naskah tidak seragam dan tidak terdeteksi jiplakan pola.
- Tidak diadopsi dari scaffold: fondasi Next 14/skema CSL-JSON/IndexedDB-nya (produksi sudah lebih maju: Next 15, skema v2 + Drive, mesin templat pedoman) dan render CSL (digantikan mesin templat pedoman yang teruji contoh).

## Cari langsung per kalimat kunci + panel Lugawi & Istilahi (26 Okt 2026)
- **Cari referensi LANGSUNG dari tiap kalimat kunci**: setiap kartu kalimat kunci kini punya tombol "Cari jurnal dari kalimat ini" dan "Cari kitab dari kalimat ini" — sekali klik pencarian berjalan memakai kalimat itu juga, tanpa menyalin ulang ke kotak topik. Hasil diberi label kalimat asalnya (nomor + peran) dan tampilan bergulir otomatis ke hasil.
- **Kapasitas hasil diperbesar**: jurnal ditampung sampai 15, kitab sampai 20 (sebelumnya hasil kitab tak dibatasi tampung eksplisit & jurnal ±8/sumber).
- **Mode baru "Lugawi & Istilahi"** di panel pencarian: periksa makna kamus & istilah satu kata — termasuk kata serapan dan istilah kontemporer non-Arab (Inggris/Belanda/Swiss/dll). Alur: telusur kitab (bentuk Arab kata/padanannya), Wiktionary (etimologi + padanan Arab), Wikipedia Arab/Indonesia, dan pemakaian di jurnal; kesimpulan bertingkat dan jujur — ditemukan di kitab/kamus, istilah kontemporer/serapan (dengan anjuran rujukan معجم الدخيل في اللغة العربية الحديثة ولهجاتها), atau tidak ditemukan. Teruji hidup: بوفية terdeteksi sebagai kata serapan (etimologi Wiktionary).
- **Kartu "Masih mentok? Tanyakan ke Muse"**: prompt siap salin (lugawi, istilahi, status di لسان العرب/القاموس المحيط/المعجم الوسيط, asal bahasa bila serapan, padanan Arab, contoh kalimat) + keterangan jam chat dijawab langsung 19.00–00.00 WITA. Sapaan widget chat "Tanya Muse" kini juga memuat keterangan jam yang sama.

## Widget chat Pintu Web terpasang (26 Okt 2026)
- **Widget tanya-jawab Muse kini tertanam di semua halaman** (`public/widget-claude.js` + `<Script>` di layout): pengunjung bertanya dari web, pertanyaan masuk kotak surat Cloudflare Worker dan dijawab Muse lewat hub yang sama dengan bot Telegram; widget menampilkan keterangan tunggu "biasanya 10–30 detik" + penghitung detik. Rem pemakaian aktif di Worker (10/sesi/jam, 60 global/jam, antrean maks 20).
- CSP `connect-src` ditambah origin Worker agar peramban mengizinkan widget menghubungi kotak surat.
- Koreksi alamat: nama Worker terdaftar memang `kotak-surat-muse` (huruf kecil semua) — salinan widget awal sempat tertulis `kotak-surat-claude` yang tidak ada; sudah diperbaiki di berkas sumber maupun salinan publik.

## Sitasi makin rapi: slot kosong, bentuk singkat, pemeriksa sitasi (26 Okt 2026)
- **Slot kosong di footnote/dafar pustaka pedoman dibersihkan**: label yang datanya kosong (mis. "ج" untuk jilid pada sumber tanpa jilid) tidak lagi menggantung tercetak ("…، ج، ص ١٣٧"); unit templat kosong dibuang rapi termasuk kurung cetakan yang tinggal separuh dan titik ganda.
- **Sitasi berulang tampil bentuk singkat** (kaidah Turabian): penomoran kompilasi kini per kemunculan — kemunculan pertama satu sumber = bentuk penuh sesuai pedoman/gaya, kemunculan berikutnya = penulis singkat، judul singkat (≤4 kata)، halaman. Berlaku seragam di naskah, ekspor Word, strip footnote per bagian, dan pratinjau dialog pasang footnote (yang kini menghitung nomor dari indeks kemunculan, bukan pencocokan teks).
- **Panel "Pemeriksaan sitasi" di tab Ekspor**: daftar masalah sebelum ekspor — penanda yang rujukannya sudah terhapus, sitasi kitab/artikel tanpa halaman, dan rujukan terpakai yang masih bertanda perlu verifikasi — masing-masing dengan label bab/bagian dan tombol "Buka bagian". Bila bersih, panel menyatakan jumlah sitasi yang lolos; rujukan yang belum pernah disitasi dilaporkan sebagai informasi saja. Mesinnya `lib/engine/periksa-sitasi.ts` (deterministik, tanpa AI).
- **Perbaikan lama qa-refs**: pembersih jawaban LLM (`bersihkanJawaban`) kini benar-benar membuang kata tunggal — konsep adalah frasa 2–5 kata, selaras aturan prompt istilah itu sendiri. Kegagalan uji "llm membuang kata tunggal" yang lama menggantung kini beres; seluruh suite qa-refs hijau.
- Usulan panel pemeriksaan dosen TIDAK dibangun atas arahan pemilik: web ini bantuan belajar mahasiswa, bukan alat resmi kampus.

## Sisip sitasi lama dihapus — footnote langsung sesuai pedoman (26 Okt 2026)
- **Bar "Sisip sitasi" manual di tab Tulis DIHAPUS** (dropdown rujukan + kolom hlm. + tombol "Sisipkan penanda" + peringatan soal kode [[ref:…]]). Mahasiswa tidak lagi menyisipkan/menjaga kode penanda dengan tangan.
- **Penggantinya strip "Footnote bagian ini"** di bawah editor: footnote bagian yang sedang dibuka tampil langsung sebagai hasil jadi — terformat pedoman kampus (atau gaya proyek) dan bernomor persis seperti di naskah utuh & ekspor (penomoran dihitung dari kompilasi naskah sebenarnya), siap salin per item.
- **Pemasangan sitasi sekarang lewat dua jalur pintar saja**: tombol "Pasang footnote" (dialog terarah: pilih bagian → paragraf → kalimat, dengan pratinjau pedoman bernomor) dan "Cari rujukan (AI)" (pencari rujukan yang mengekstrak konsep dengan AI). Kode penanda tetap menjadi mesin internal ekspor Word, bukan lagi urusan mahasiswa.

## Pedoman dwibahasa (Arab–Indonesia) + templat dari contoh (26 Okt 2026)
- **Contoh di pedoman kini benar-benar menjadi pola.** Sebelumnya contoh footnote/daftar pustaka di pedoman.md hanya dicatat — pola yang dipakai selalu pola bawaan. Sekarang pola diturunkan dari contoh persis pedoman (penulis، judul، (kota: penerbit، tahun)، ج، ص) dan dipakai untuk footnote & daftar pustaka; bila penurunan gagal, kegagalannya dicatat terbuka di ringkasan pedoman.
- **Pedoman berbahasa Arab terbaca penuh**: label Arab untuk ukuran/spasi (تباعد الأسطر)/margin (سم)/penomoran (لكل باب)/angka (الأرقام العربية), angka Arab-Indic (١٢٣) dinormalisasi, dan bagian daftar isi berjudul المحتويات (atau نظام الكتابة، هيكل البحث, dll) dibaca parser sistematika. Teruji pulang-pergi: footnote hasil render sama persis dengan contoh di pedoman Arab.

## Daftar isi dari pedoman kampus (26 Okt 2026)
- **Pedoman kini bisa mengatur daftar isi.** Prompt pembuat pedoman.md ditambah bagian "Daftar Isi (Sistematika Penulisan)" (daftar bersarang), dan tab Struktur mendapat panel "Daftar isi dari pedoman kampus": satu tombol menerapkan sistematika dari pedoman terunggah menjadi daftar isi proyek yang bisa diedit. Pedoman lama yang belum memuat sistematika diberi petunjuk jelas (unggah ulang dengan prompt baru).
- **Tempel daftar isi manual**: mahasiswa bisa menempel daftar isi dari buku pedoman (indentasi bersarang atau penomoran desimal 1/1.1/1.1.1, Arab maupun Latin) dan web menyusunnya menjadi bab/sub-bab/fasal — tanpa perlu unggah ulang pedoman.

## Pencarian v2: kurasi kalimat kunci + pasang footnote terarah (26 Okt 2026)
- **Alur pencarian baru (kurasi)**: judul wajib → generate kata kunci (kolam yang bisa dipilih/dihapus/ditambah) → susun TEPAT 3 kalimat kunci berperan (gambaran masalah / pendapat & dalil / analisis & jawaban), masing-masing disertai alasan penyusunannya. Kalimat bisa diedit, dikunci agar tidak tertimpa generate ulang, atau ditulis manual. Set tersimpan per bab di proyek (`kunciPencarian`) dan set itulah yang menjalankan pencarian jurnal & kitab — bukan lagi ekstrak otomatis dari paragraf. Kata terpilih yang belum terwakili di kalimat ditandai. Route `/api/kata-kunci` kini bertahap (`tahap: kata|kalimat`) dengan fallback tanpa-AI.
- **Pasang footnote terarah**: dari hasil pencarian (panel topik, kotak temuan, pencari rujukan tab Tulis) — pilih bagian → paragraf → setelah kalimat ke berapa; pratinjau menampilkan footnote persis hasil akhir (format pedoman bila ada) lengkap dengan nomornya di naskah.
- **Kotak temuan per bab** (`temuan`): hasil pencarian disimpan dulu, dipasang kapan pun.
- **Minta bot bantu cari**: tombol mode kitab menyusun teks permintaan rapi (judul + kalimat kunci kurasi) untuk dikirim ke bot Telegram @Utruhah_musebot.
- **Ambil metadata dari DOI** di form rujukan manual (CrossRef): jurnal Indonesia/Inggris ber-DOI terisi otomatis. Hasil kitab kini disertai catatan kecocokan.

## Rujukan siap salin sesuai pedoman + daftar isi fasal (26 Okt 2026)
- **Daftar pustaka tab Rujukan kini mengikuti pedoman kampus** (template pustaka pedoman), bukan format bawaan. Daftar footnote baru "Footnote di naskah ini — bernomor & sesuai pedoman/gaya": footnote persis seperti di dokumen akhir, lengkap dengan nomor urut sitasinya, siap salin satu per satu atau semua — tanpa kode penanda [[ref:…]].
- **Daftar isi**: struktur bawaan kini bisa dijadikan daftar isi milik proyek yang bisa diedit walau tanpa rumusan ("Jadikan struktur bawaan bisa diedit") — judul bab/sub-bab bebas diganti untuk semua proyek. Tingkat ketiga **fasal/matlab** (فصل/مطلب): tombol "+ Fasal" di bawah tiap sub-bab; fasal dirender sebagai sub-judul (###) di naskah dan menjorok di tab Struktur.

## Perbaikan login Google Drive (26 Okt 2026)
- **Akar gantung "Menghubungkan..." ditemukan & diperbaiki**: `requestDriveAccess()` lama tidak memasang `error_callback`, jadi kegagalan popup Google (ditutup, terblokir, origin belum diizinkan, izin ditolak) tidak pernah memanggil callback apa pun dan UI menunggu selamanya. Kini `mintaTokenDrive()`: pemuat GIS bersama (`muatGIS()`, timeout 15 dtk), `error_callback` dengan pesan Bahasa Indonesia yang bisa ditindaklanjuti per jenis error, dan watchdog 90 detik — login tidak bisa lagi menggantung tanpa penjelasan.
- Token sesi kini sadar kedaluwarsa (±55 menit dari umur token GIS 1 jam): token basi tidak dipakai lagi secara diam-diam; error 401 saat sinkron/muat memberi pesan "sesi berakhir, masuk lagi".

## Struktur dari Isykaliyyat (26 Okt 2026)
- **Daftar isi milik proyek (pola Ma'had Aly DDI Mangkoso)**: setiap bab isi mewakili satu isykal — isykal 1 → BAB II, isykal 2 → BAB III, isykal 3 → BAB IV (analisis akhir: تلخيص ما تقدم، التحليل والموازنة، الترجيح والجواب النهائي، تطبيق الجواب وآثاره). Generator `susunDaftarIsiIsykal()` menyusun dari rumusan masalah; bab pengurai memakai sub-bab تصوير المسألة، أقوال العلماء، أدلة الأقوال، مناقشة الأدلة.
- **Editor daftar isi** di tab Struktur: susun dari isykaliyyat, ganti judul bab/sub-bab (Indonesia/Arab), tambah/kurang/pindah sub-bab, hapus bab, susun ulang, atau kembali ke bawaan. Daftar efektif dipakai shell, tab Tulis/Periksa/Istilah, compose, dan ekspor lewat `strukturProyek()`.
- `Project.daftarIsi` + `sanitasiDaftarIsi()` di gerbang migrasi; proyek tanpa daftar isi tidak berubah sama sekali.

## Pematangan pasca-kajian (26 Okt 2026)
- **GDrive disambungkan ke workspace**: konverter `projectKeTersimpan()` + tombol "Sinkronkan proyek ini ke Drive" dan muat proyek Drive lewat gerbang `migrasiProyek()`. (Sebelumnya komponen login Drive tidak terhubung ke aliran Project sama sekali.)
- **Pedoman kampus = lapisan teratas sitasi**: bila proyek punya pedoman, template `formatFootnote`/`formatPustaka` pedoman yang dipakai — mengalahkan gaya proyek; gaya hanya berlaku tanpa pedoman.
- **Kalimat kunci, bukan kata kunci**: ekstraksi AI helper menyusun kalimat kunci (frasa utuh 3–7 kata); pencarian kitab berjalan per kalimat kunci Arab (maks 3) lewat route refs, hasil didedup per halaman; label UI diperbarui.

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

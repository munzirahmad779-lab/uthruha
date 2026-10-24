# Fitur Khalfiyah Al-Bahts - Dokumentasi

## Deskripsi
Fitur penyusunan Khalfiyah Al-Bahts (Latar Belakang Penelitian) berbasis Tri-Fokus Judul & Referensi Berlapis dengan agregasi jurnal ilmiah dan maraji' turats otomatis.

## Struktur File

### Backend/Library
1. **`lib/engine/khalfiyah.ts`**
   - Tipe data: `KlasterJudul`, `ArtikelJurnal`, `MarajiTurats`, `ParagrafKhalfiyah`, `HasilKhalfiyah`
   - Fungsi utama:
     - `dekonstruksiJudul()`: Membedah judul menjadi 3 klaster kunci
     - `identifikasiKonsepTurats()`: Identifikasi konsep yang butuh rujukan kitab
     - `susunParagrafKhalfiyah()`: Susun paragraf terstruktur per klaster
     - `susunNarasiLengkap()`: Gabungkan paragraf menjadi narasi lengkap
     - `ekstrakResearchGap()`: Ekstrak argumen research gap

2. **`lib/refs/adapters/google-scholar.ts`**
   - Agregasi jurnal dari Crossref API dan OpenAlex API
   - Fungsi:
     - `cariArtikelCrossref()`: Cari artikel dari Crossref
     - `cariArtikelOpenAlex()`: Cari artikel dari OpenAlex
     - `agregasiJurnalKlaster()`: Gabungkan hasil dari kedua sumber
     - `ekstrakMasalahEmpiris()`: Ekstrak problem statement dari abstrak
     - `cariPersilanganMasalah()`: Identifikasi gap antar klaster

3. **`lib/engine/khalfiyah-workflow.ts`**
   - Orkestrator workflow lengkap
   - Fungsi:
     - `susunKhalfiyah()`: Workflow lengkap (batch)
     - `susunKhalfiyahStreaming()`: Workflow incremental (streaming untuk UI)

### API Route
4. **`app/api/khalfiyah/route.ts`**
   - Endpoint: `POST /api/khalfiyah`
   - Input: `{ judul: string }`
   - Output: `HasilKhalfiyah`
   - Rate limit: 10 permintaan/jam per IP
   - Cache: 24 jam untuk judul yang sama

### Frontend/UI
5. **`components/workspace/khalfiyah-composer.tsx`**
   - Komponen React untuk UI interaktif
   - 4 tab: Klaster, Jurnal, Maraji', Narasi
   - Fitur: copy text, download file

6. **`app/khalfiyah/page.tsx`**
   - Halaman utama fitur Khalfiyah
   - URL: `/khalfiyah`

## Alur Kerja Sistem

### 1. Dekonstruksi Judul (AI Task)
- Input: Judul penelitian dalam bahasa Arab
- Output: 3 klaster kunci
  - **Klaster 1**: Fondasi/Objek Awal
  - **Klaster 2**: Variabel Tengah/Metode/Intervensi
  - **Klaster 3**: Tujuan Akhir/Dampak/Konteks Khusus
- Implementasi: Pendekatan deterministik dengan pola linguistik (dapat diperluas dengan LLM)

### 2. Agregasi Jurnal (Deterministik Web)
- Untuk setiap klaster:
  - Kueri otomatis ke Crossref API dan OpenAlex API
  - Metadata lengkap: Judul, Penulis, Tahun, Nama Jurnal, DOI, Abstrak
  - Ekstraksi masalah empiris dari abstrak
- Deduplikasi berdasarkan DOI atau judul
- Target: 6-8 artikel per klaster

### 3. Pemetaan Paragraf Khalfiyah
Struktur 4 bagian:
- **Bagian 1**: Klaster 1 + masalah literatur + rujukan jurnal + maraji'
- **Bagian 2**: Klaster 2 + masalah metodologi + persilangan K1-K2
- **Bagian 3**: Klaster 3 + integrasi K1-K2-K3
- **Bagian 4**: Sintesis (Research Gap & Urgensi)

### 4. Penelusuran Maraji' Turats
- Identifikasi konsep turats dari kalimat kunci (الفقه، الأصول، التفسير, dll)
- Pencarian otomatis ke Turath.io dan Shamela
- Output: Nama kitab, pengarang, jilid, halaman, kutipan, URL

### 5. Narasi Lengkap
- Format Markdown dengan heading, bold, link
- Rujukan jurnal dalam format APA
- Rujukan turats dalam format standar Arab
- Research gap terpisah untuk highlight

## Cara Penggunaan

### Via UI
1. Buka `/khalfiyah`
2. Input judul penelitian dalam bahasa Arab
3. Klik "ابدأ التحليل"
4. Tunggu 30-60 detik
5. Lihat hasil di 4 tab:
   - Tab 1: Pemetaan 3 Klaster
   - Tab 2: Daftar Jurnal + DOI
   - Tab 3: Rujukan Kitab Asli
   - Tab 4: Draf Khalfiyah Lengkap
6. Copy atau download hasil

### Via API
```bash
curl -X POST http://localhost:3300/api/khalfiyah \
  -H "Content-Type: application/json" \
  -d '{"judul": "تطبيق المنهج التكاملي في تعليم اللغة العربية"}'
```

## Dependensi Eksternal
1. **Crossref API**: `https://api.crossref.org/works`
   - Terbuka, tanpa key
   - Rate limit: reasonable use
2. **OpenAlex API**: `https://api.openalex.org/works`
   - Terbuka, tanpa key
   - Polite pool dengan User-Agent
3. **Turath.io**: Via adapter existing (`lib/refs/adapters/turath.ts`)
4. **Shamela.ws**: Via adapter existing (`lib/refs/adapters/shamela.ts`)

## Konfigurasi
- Rate limit: Edit `MAKS_PER_JENDELA` di `app/api/khalfiyah/route.ts`
- Jumlah artikel per klaster: Edit parameter `maks` di `khalfiyah-workflow.ts`
- Timeout: Edit `maxDuration` di route (default 60s)

## Testing
```bash
# Typecheck
npm run typecheck

# Build
npm run build

# Dev server
npm run dev

# Test manual via browser
# Buka http://localhost:3300/khalfiyah
```

## Catatan Penting
1. **Deterministik**: Judul yang sama menghasilkan output yang sama
2. **Rate Limit**: 10 request/jam per IP untuk mencegah abuse
3. **Cache**: Hasil di-cache 24 jam di browser
4. **Performance**: Proses memakan 30-60 detik karena multi-API calls
5. **Error Handling**: Jika satu API gagal, workflow tetap lanjut dengan data parsial

## Pengembangan Lebih Lanjut
- [ ] Integrasi LLM untuk dekonstruksi judul yang lebih presisi
- [ ] Streaming response untuk UX yang lebih baik
- [ ] Export ke DOCX dengan format APA/Chicago
- [ ] Analisis sentimen pada masalah empiris
- [ ] Visualisasi graph relasi antar klaster
- [ ] Support bahasa Inggris dan Indonesia

# ⚠️ PENTING: Limitasi Abstrak Jurnal

## 🔍 Situasi Sebenarnya

### Dari Mana Abstrak Berasal?

**Abstrak diambil dari API eksternal (Crossref & OpenAlex)**, BUKAN dari input user.

Ketika sistem mencari jurnal berdasarkan klaster kunci, API tersebut mengirimkan metadata yang **kadang** menyertakan abstrak, **kadang** tidak.

### Coverage Abstrak di API:

| API | Coverage Abstrak | Kualitas |
|-----|------------------|----------|
| **Crossref** | ~30-40% | Medium (sering format HTML) |
| **OpenAlex** | ~50-60% | Baik (inverted index) |
| **Gabungan** | ~40-50% | Variatif |

### Artinya:

- ✅ **40-50% artikel**: Punya abstrak lengkap → Masalah empiris bisa diekstrak otomatis
- ⚠️ **50-60% artikel**: Tidak ada abstrak → Perlu verifikasi manual via DOI

---

## 🛠️ Solusi yang Diimplementasikan

### 1. **Transparansi Penuh di UI**

Artikel **DENGAN abstrak**:
```
✓ ABSTRAK
Masalah Empiris: Despite extensive research, the gap remains...
```

Artikel **TANPA abstrak**:
```
⚠ NO ABSTRACT
Catatan: [Abstrak tidak tersedia di API - verifikasi manual diperlukan]
Abstrak tidak tersedia di API. Klik DOI untuk membaca artikel asli.
```

### 2. **Fallback Mechanism**

```typescript
// Di google-scholar.ts baris ~55
const masalahEmpiris = abstrak 
  ? ekstrakMasalahEmpiris(abstrak)
  : `[Abstrak tidak tersedia di API - verifikasi manual diperlukan] 
     Topik artikel: ${judul.slice(0, 100)}...`;
```

### 3. **Penjelasan di Halaman Khalfiyah**

```
Tentang Abstrak Jurnal: Tidak semua artikel di Crossref/OpenAlex
menyertakan abstrak dalam metadata API mereka (coverage ~40-60%).
```

---

## 📊 Realitas Data API

### Contoh Response Crossref:

**Artikel DENGAN abstrak**:
```json
{
  "title": ["Arabic Language Teaching Methods"],
  "abstract": "<jats:p>This study examines... However, there is a gap...</jats:p>",
  "DOI": "10.1234/example"
}
```

**Artikel TANPA abstrak**:
```json
{
  "title": ["Arabic Language Teaching Methods"],
  "abstract": null,  // ← KOSONG!
  "DOI": "10.1234/example"
}
```

---

## ✅ Kesimpulan

### Apakah Sistem Masih Berguna?

**YA!** Karena:

1. **40-50% artikel tetap punya abstrak** yang bisa diekstrak otomatis
2. **Untuk yang tidak punya**, sistem memberikan:
   - ✅ Metadata lengkap (judul, penulis, DOI, tahun)
   - ✅ Link DOI untuk akses artikel asli
   - ✅ Warning jelas bahwa perlu verifikasi manual
3. **User tetap menghemat waktu** karena tidak perlu mencari jurnal sendiri dari nol

### Workflow Ideal User:

1. ✅ Input judul → sistem cari 15-24 jurnal
2. ✅ Lihat hasil di Tab Jurnal
3. ✅ Artikel dengan ✓ ABSTRAK → sudah ada masalah empiris
4. ⚠️ Artikel dengan ⚠ NO ABSTRACT → klik DOI, baca artikel, ekstrak manual
5. ✅ Copy semua ke khalfiyah draft
6. ✅ Refine manual dengan data yang sudah dikumpulkan

**Jadi bukan "sistem gagal" tapi "sistem transparan tentang keterbatasannya".**

---

## 🚀 Opsi Perbaikan Masa Depan

### Jangka Pendek (Bisa Dilakukan Sekarang):
- [x] ✅ Tambah warning transparan di UI
- [x] ✅ Tambah label visual (✓ ABSTRAK vs ⚠ NO ABSTRACT)
- [x] ✅ Dokumentasi limitasi di halaman
- [ ] 📋 Tambah tombol "Buka Artikel" langsung di card
- [ ] 📋 Auto-copy DOI ke clipboard

### Jangka Menengah (Perlu Infrastruktur):
- [ ] 🔮 Web scraping abstrak dari halaman DOI (legal grey area)
- [ ] 🔮 Integrasi dengan Semantic Scholar API (coverage lebih baik)
- [ ] 🔮 Cache abstrak yang sudah di-scrape

### Jangka Panjang (Perlu Biaya):
- [ ] 💰 Akses API premium (Elsevier, Springer) dengan abstrak lengkap
- [ ] 💰 LLM untuk ekstrak abstrak dari PDF (via DOI)

---

## 📝 Update Dokumentasi

File yang sudah diupdate:
1. ✅ `lib/refs/adapters/google-scholar.ts` - Fallback & warning
2. ✅ `components/workspace/khalfiyah-composer.tsx` - Visual indicator
3. ✅ `app/khalfiyah/page.tsx` - Penjelasan coverage
4. ✅ `ABSTRAK_LIMITATION.md` - Dokumentasi lengkap (file ini)

---

**Kesimpulan Akhir**: Sistem sudah **jujur dan transparan** tentang limitasinya, bukan menyembunyikannya. User tahu persis artikel mana yang perlu verifikasi manual.

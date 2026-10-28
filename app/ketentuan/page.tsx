import type { Metadata } from "next";
import Link from "next/link";
import { EMAIL_KONTAK, TANGGAL_BERLAKU_LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Ketentuan Layanan — Kitabah",
  description:
    "Ketentuan layanan Kitabah: akun dan kunci akses, lapis gratis dan premium, jaminan admin, dan tanggung jawab pengguna.",
};

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold tracking-tight text-ink-900">{judul}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-700">{children}</div>
    </section>
  );
}

export default function KetentuanPage() {
  return (
    <div className="wrap max-w-3xl py-14 sm:py-16">
      <span className="eyebrow">Legal</span>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
        Ketentuan Layanan
      </h1>
      <p className="mt-3 text-sm text-ink-500">Berlaku sejak {TANGGAL_BERLAKU_LEGAL}.</p>
      <p className="mt-5 text-[15px] leading-relaxed text-ink-700">
        Dengan memakai Kitabah, Anda menyetujui ketentuan ini. Bila Anda tidak menyetujuinya,
        jangan gunakan layanan ini.
      </p>

      <Bagian judul="1. Tentang layanan">
        <p>
          Kitabah adalah alat bantu penulisan karya ilmiah berbahasa Arab (skripsi, tesis,
          disertasi, dan artikel jurnal). Layanan membantu menyusun kerangka dan draf awal —
          mulai dari judul, kalimat kunci, dan khalfiyah (latar belakang), pencarian rujukan
          kitab dan jurnal yang dapat diverifikasi, pemasangan footnote mengikuti pedoman
          kampus, sampai ekspor naskah ke Word dan Google Doc. Kitabah adalah alat bantu,
          bukan penulis pengganti: hasil akhirnya tetap karya dan tanggung jawab Anda.
        </p>
      </Bagian>

      <Bagian judul="2. Akun dan kunci akses">
        <p>
          Ruang kerja dibuka dengan kunci akses dan/atau masuk dengan akun Google Anda. Kunci
          akses bersifat pribadi atau kelas: hanya untuk Anda atau kelas yang menerimanya dari
          pemilik layanan. Kunci akses <strong className="text-ink-900">dilarang
          diperjualbelikan</strong> dan dilarang dibagikan kepada pihak yang tidak berhak.
          Pemilik layanan dapat mengganti kunci akses sewaktu-waktu; premium yang sudah aktif
          pada akun Anda tidak ikut tercabut oleh pergantian kunci.
        </p>
      </Bagian>

      <Bagian judul="3. Lapis gratis dan Premium">
        <p>
          <strong className="text-ink-900">Gratis:</strong> satu proyek, pencarian rujukan
          tanpa batas, maksimal tiga footnote dalam satu paragraf, dan ruang lingkup proyek
          yang terkunci setelah footnote pertama terpasang (satu kali penggantian kategori
          diperbolehkan sebelum itu).
        </p>
        <p>
          <strong className="text-ink-900">Premium:</strong> proyek dan footnote tanpa batas
          di atas, Google Doc per proyek di Drive Anda sendiri, dan chat agen AI di dalam web.
          Premium berlaku 30 hari per aktivasi dan dapat diaktifkan melalui kunci premium atau
          pembayaran pada gerbang resmi bila sudah tersedia. Proyek yang dibuat pada lapis
          gratis tidak hilang saat Anda naik ke Premium.
        </p>
      </Bagian>

      <Bagian judul="4. Jaminan admin">
        <p>
          Tidak ada pengembalian dana (refund) otomatis. Bila layanan mengalami kendala,
          laporkan melalui tombol pelaporan kendala di dalam layanan atau email ke{" "}
          <span className="font-semibold text-ink-900">{EMAIL_KONTAK}</span> — laporan Anda
          ditindaklanjuti dengan standar penyelesaian paling lambat 6 jam. Bila kendala
          terbukti berasal dari kegagalan sistem kami dan tidak pulih dalam tenggat itu, dana
          Anda kembali penuh, diproses admin secara manual dari dasbor gerbang pembayaran.
          Berubah pikiran bukan alasan pengembalian dana.
        </p>
      </Bagian>

      <Bagian judul="5. Tanggung jawab akademik">
        <p>
          Kitabah menyusun kerangka dan draf awal; data, temuan, analisis, dan kesimpulan
          adalah bagian Anda. Anda bertanggung jawab penuh atas keaslian karya yang Anda
          hasilkan, atas pemeriksaan setiap sitasi pada sumber aslinya, dan atas kepatuhan
          terhadap pedoman penulisan serta aturan integritas akademik institusi Anda.
          Menggunakan layanan ini untuk mengerjakan tugas orang lain atau untuk plagiarisme
          adalah pelanggaran ketentuan ini.
        </p>
      </Bagian>

      <Bagian judul="6. Penggunaan yang dilarang">
        <p>
          Dilarang: memperjualbelikan atau menyebarluaskan kunci akses; mencoba menembus
          gerbang akses, batas lapis, atau sistem layanan dengan cara apa pun; memakai layanan
          untuk melanggar hukum atau hak pihak lain; dan mengganggu ketersediaan layanan bagi
          pengguna lain. Pelanggaran dapat berakibat akses Anda dihentikan.
        </p>
      </Bagian>

      <Bagian judul="7. Ketersediaan dan perubahan layanan">
        <p>
          Kami berusaha menjaga layanan tetap tersedia dan akurat, tetapi tidak menjamin
          layanan bebas gangguan setiap saat. Fitur, batas lapis, dan harga dapat berubah
          dengan pemberitahuan di situs; perubahan tidak berlaku surut terhadap masa Premium
          yang sedang berjalan.
        </p>
      </Bagian>

      <Bagian judul="8. Perubahan ketentuan dan hukum yang berlaku">
        <p>
          Ketentuan ini dapat diperbarui; tanggal berlaku di halaman ini menandai versi
          terakhir. Ketentuan ini diatur oleh hukum Republik Indonesia.
        </p>
      </Bagian>

      <p className="mt-12 border-t border-ink-900/10 pt-6 text-sm text-ink-500">
        Lihat juga{" "}
        <Link href="/privasi" className="font-semibold text-gold-700 underline decoration-gold-400/50 underline-offset-2 hover:text-gold-600">
          Kebijakan Privasi
        </Link>
        .
      </p>
    </div>
  );
}

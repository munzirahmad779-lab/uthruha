import type { Metadata } from "next";
import Link from "next/link";
import { EMAIL_KONTAK, TANGGAL_BERLAKU_LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — Kitabah",
  description:
    "Kebijakan privasi Kitabah: data apa yang dikumpulkan, untuk apa dipakai, siapa yang memprosesnya, dan bagaimana meminta penghapusan data Anda.",
};

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold tracking-tight text-ink-900">{judul}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-700">{children}</div>
    </section>
  );
}

export default function PrivasiPage() {
  return (
    <div className="wrap max-w-3xl py-14 sm:py-16">
      <span className="eyebrow">Legal</span>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
        Kebijakan Privasi
      </h1>
      <p className="mt-3 text-sm text-ink-500">Berlaku sejak {TANGGAL_BERLAKU_LEGAL}.</p>
      <p className="mt-5 text-[15px] leading-relaxed text-ink-700">
        Kitabah adalah alat bantu penulisan karya ilmiah berbahasa Arab. Halaman ini menjelaskan
        data apa saja yang kami kumpulkan saat Anda memakai layanan, untuk apa data itu dipakai,
        siapa saja yang ikut memprosesnya, dan bagaimana Anda dapat meminta data Anda dihapus.
        Kami hanya mengumpulkan data yang diperlukan agar layanan berjalan — tidak ada data yang
        kami jual atau bagikan untuk iklan.
      </p>

      <Bagian judul="1. Data yang kami kumpulkan">
        <p>
          <strong className="text-ink-900">Identitas Google.</strong> Bila Anda masuk dengan
          Google, kami menerima nama, alamat email, dan foto profil Anda dari Google. Data ini
          hanya dipakai untuk mengenali Anda saat masuk dan membedakan akun Anda dari pengguna
          lain. Kami tidak meminta akses ke isi Drive, Gmail, atau data Google Anda yang lain
          pada saat masuk.
        </p>
        <p>
          <strong className="text-ink-900">Kunci akses dan sesi.</strong> Akses ke ruang kerja
          dijaga kunci akses. Peramban Anda tidak menyimpan kunci itu sendiri; yang disimpan
          adalah tanda sesi bertanda tangan (cookie) yang membuktikan Anda sudah memasukkan
          kunci yang benar, beserta — bila Anda mencentang &ldquo;ingat perangkat ini&rdquo; —
          tanda perangkat tepercaya. Sidik kunci yang berhasil dipakai dapat tercatat pada akun
          Anda agar Anda tidak perlu mengetik ulang kunci yang sama; yang tercatat adalah
          sidiknya (hasil hash satu arah), bukan kunci mentahnya.
        </p>
        <p>
          <strong className="text-ink-900">Data proyek.</strong> Judul proyek, bidang/kategori,
          dan catatan pemakaian fitur (misalnya jumlah footnote yang terpasang) disimpan di basis
          data layanan (Supabase) dan terikat pada akun Anda — data ini hanya dapat diakses
          melalui akun Anda sendiri. Isi draf naskah yang Anda tulis tersimpan di penyimpanan
          lokal peramban Anda sendiri, bukan di server kami.
        </p>
        <p>
          <strong className="text-ink-900">Uji coba tamu.</strong> Tanpa masuk pun Anda dapat
          mencoba satu kali dari sebuah judul. Untuk mencegah pengulangan dari perangkat yang
          sama, peramban Anda menyimpan penanda perangkat dan penanda bahwa uji coba sudah
          dipakai; judul yang Anda masukkan diproses untuk menyusun hasil uji coba.
        </p>
        <p>
          <strong className="text-ink-900">Laporan kendala.</strong> Bila Anda mengirim laporan
          kendala (misalnya terkait Premium), laporan itu tersimpan sebagai catatan untuk admin
          agar dapat ditindaklanjuti.
        </p>
      </Bagian>

      <Bagian judul="2. Pemrosesan oleh penyedia AI pihak ketiga">
        <p>
          Sebagian fitur Kitabah — penyusunan kalimat kunci, khalfiyah, pengembangan paragraf,
          pencarian istilah, dan chat agen Premium — bekerja dengan mengirim teks yang relevan
          ke penyedia model AI pihak ketiga, saat ini Google Gemini dan Groq. Teks hanya dikirim
          sebatas yang diperlukan untuk menjalankan fitur yang Anda minta, pada saat Anda
          memintanya. Pemrosesan di sisi penyedia mengikuti kebijakan privasi masing-masing
          penyedia. Jangan masukkan data pribadi yang sensitif ke dalam teks yang Anda proses
          dengan fitur AI.
        </p>
        <p>
          Pencarian rujukan memakai basis data akademik publik (antara lain OpenAlex, Crossref,
          Google Books, dan Open Library). Yang dikirim ke sana adalah kata kunci pencarian,
          bukan data akun Anda.
        </p>
      </Bagian>

      <Bagian judul="3. Google Drive — hanya dengan persetujuan terpisah">
        <p>
          Kitabah tidak menyentuh Google Drive Anda saat Anda masuk. Drive hanya disentuh bila
          Anda pengguna Premium dan secara terpisah menyetujui akses saat membuat Google Doc
          untuk proyek Anda. Akses itu terbatas pada berkas yang dibuat oleh aplikasi ini
          sendiri (ruang lingkup <em>drive.file</em>) di Drive Anda; kami tidak dapat melihat,
          mengubah, atau menghapus berkas Anda yang lain.
        </p>
      </Bagian>

      <Bagian judul="4. Pembayaran">
        <p>
          Bila pembayaran Premium aktif, pembayaran diproses oleh gerbang pembayaran Midtrans.
          Data kartu dan kredensial pembayaran Anda ditangani langsung oleh gerbang tersebut —
          Kitabah tidak menerima dan tidak menyimpan data kartu Anda. Yang kami simpan hanyalah
          catatan status pembayaran (misalnya nomor pesanan dan status lunas) untuk mengaktifkan
          lapis Premium Anda.
        </p>
      </Bagian>

      <Bagian judul="5. Penyimpanan dan keamanan">
        <p>
          Data akun dan catatan proyek disimpan di basis data Supabase. Tanda sesi dan tanda
          perangkat memakai tanda tangan kriptografis (HMAC) dan masa berlaku; status lapis
          (gratis/premium) selalu ditentukan oleh catatan di server, bukan oleh peramban Anda.
          Akses administratif ke data dibatasi pada pemilik layanan.
        </p>
      </Bagian>

      <Bagian judul="6. Hak Anda dan penghapusan data">
        <p>
          Anda dapat meminta salinan data akun Anda, atau meminta penghapusan akun beserta data
          yang terikat padanya (identitas, catatan proyek, dan catatan terkait), dengan
          menghubungi kami di{" "}
          <span className="font-semibold text-ink-900">{EMAIL_KONTAK}</span>. Permintaan
          penghapusan akan kami proses dan konfirmasikan melalui email. Menghapus data peramban
          Anda juga menghapus draf naskah yang tersimpan lokal di perangkat Anda.
        </p>
      </Bagian>

      <Bagian judul="7. Perubahan kebijakan">
        <p>
          Bila kebijakan ini berubah secara berarti, tanggal berlaku di halaman ini akan
          diperbarui dan perubahan akan diumumkan di situs. Versi yang berlaku adalah versi yang
          tampil di halaman ini.
        </p>
      </Bagian>

      <p className="mt-12 border-t border-ink-900/10 pt-6 text-sm text-ink-500">
        Lihat juga{" "}
        <Link href="/ketentuan" className="font-semibold text-gold-700 underline decoration-gold-400/50 underline-offset-2 hover:text-gold-600">
          Ketentuan Layanan
        </Link>
        .
      </p>
    </div>
  );
}

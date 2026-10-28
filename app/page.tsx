import Link from "next/link";
import { Faq } from "@/components/faq";
import {
  CaraKerja,
  CtaBand,
  Fitur,
  FrasaPreview,
  Hero,
  Integritas,
  JurnalPreview,
  Masalah,
  StrukturSection,
} from "@/components/landing";
import { FRASA } from "@/lib/content/frasa";
import { JURNAL } from "@/lib/content/jurnal";
import { UjiCobaTamu } from "@/components/uji-coba";
import { loginGoogleAktif } from "@/lib/security/akses";

const FAQ = [
  {
    q: "Apakah naskah saya dikirim ke server?",
    a: "Tidak. Proyek, draf, istilah, dan daftar rujukan disimpan di penyimpanan lokal peramban Anda (localStorage). Semuanya tetap ada meski Anda menutup tab, dan tidak dikirim ke mana pun. Konsekuensinya: bila Anda membersihkan data peramban atau berganti perangkat, draf tidak ikut pindah — karena itu sediakan waktu untuk mengekspor .docx.",
  },
  {
    q: "Apakah ini bisa menuliskan skripsi saya dari nol?",
    a: "Tidak, dan memang tidak dirancang untuk itu. Yang Kitabah lakukan adalah menyusun kerangka tiap bagian dari konteks penelitian Anda, lalu menandai tempat yang harus Anda isi dengan data, temuan, dan analisis sendiri. Bagian yang belum Anda isi tetap terlihat sebagai penanda, bukan kalimat palsu.",
  },
  {
    q: "Dari mana pola kalimat Arab-nya berasal?",
    a: `Ada ${FRASA.length} pola kalimat yang ditulis khusus untuk aplikasi ini, mengikuti gaya penulisan akademik berbahasa Arab (الفصحى). Polanya bisa dipakai ulang lintas penelitian: membuka latar belakang, menunjukkan kesenjangan riset, menjelaskan teknik analisis, dan seterusnya. Tidak ada kalimat yang disalin dari naskah orang lain atau dari situs lain.`,
  },
  {
    q: "Apakah cocok untuk artikel jurnal, bukan hanya skripsi?",
    a: "Ya. Struktur artikel memakai format IMRaD versi Arab: الملخص، المقدمة، الطريقة، النتائج والمناقشة، الخاتمة، المراجع. Direktori jurnalnya juga memuat jurnal yang menerima naskah berbahasa Arab, lengkap dengan catatan apa yang perlu Anda periksa di laman resminya.",
  },
  {
    q: "Apakah data jurnal di direktori itu akurat?",
    a: "Data direktori bersifat indikatif dan berubah dari waktu ke waktu — biaya publikasi, status indeks, dan cakupan bisa berubah kapan saja. Karena itu setiap entri diberi catatan verifikasi dan tautan resmi. Jangan pernah mengirim naskah hanya berdasarkan data di halaman ini.",
  },
  {
    q: "Apakah hasilnya bisa langsung diserahkan ke pembimbing?",
    a: "Belum. Draf yang dihasilkan adalah kerangka kerja: strukturnya sudah benar, tetapi isinya masih perlu data, rujukan, dan penalaran Anda. Yang biasanya paling cepat terlihat oleh pembimbing adalah bagian yang masih berisi penanda — jadi lengkapi dulu bagian-bagian itu sebelum dibawa ke bimbingan.",
  },
  {
    q: "Apakah aplikasi ini gratis?",
    a: "Ya, semua alat bisa dipakai tanpa akun dan tanpa biaya. Tidak ada kunci fitur, tidak ada kuota, tidak ada langganan. Bila nanti ada biaya operasional, itu akan diberitahukan terbuka — bukan dengan membatasi fitur yang sudah Anda pakai.",
  },
  {
    q: "Apakah tersedia pilihan bahasa selain Arab?",
    a: "Antarmuka memakai Bahasa Indonesia dengan label Arab pada setiap bagian, karena penggunanya umumnya mahasiswa Indonesia yang menulis dalam bahasa Arab. Pilihan bahasa naskah (Arab, Indonesia, Inggris) tersedia saat membuat proyek, meski kerangka yang paling lengkap saat ini adalah versi Arab.",
  },
];

export default function HomePage() {
  return (
    <>
      <Hero />
      {/* googleAktif meneruskan flag TAHAN LOGIN GOOGLE ke CTA uji coba. */}
      <UjiCobaTamu googleAktif={loginGoogleAktif()} />
      <Masalah />
      <CaraKerja />
      <Fitur />
      <StrukturSection />
      <FrasaPreview />
      <JurnalPreview />
      <Integritas />

      <section className="wrap pb-16 sm:pb-20">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <span className="eyebrow">FAQ</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-[2.4rem]">
              Pertanyaan yang sering muncul.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-700">
              Belum terjawab? Setiap halaman punya catatan pemakaian di bagian bawah.
              Untuk hal teknis penulisan, mulai dari{" "}
              <Link href="/panduan" className="font-semibold text-gold-700 underline decoration-gold-400/50 underline-offset-2 hover:text-gold-600">
                panduan
              </Link>
              .
            </p>
            <p className="mt-6 font-arabic text-lg text-ink-400" dir="rtl">
              العلم نور والجهل ظلام
            </p>
          </div>
          <Faq items={FAQ} />
        </div>
      </section>

      <CtaBand />

      <p className="wrap -mt-8 pb-8 text-center text-[11px] leading-relaxed text-ink-500">
        Kitabah adalah proyek alat bantu penulisan independen. Tidak berafiliasi dengan
        perguruan tinggi mana pun, dan tidak menggantikan pedoman penulisan yang
        dikeluarkan program studi Anda.
      </p>
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BIDANG } from "@/lib/content/bidang";
import { METODE } from "@/lib/content/metode";
import { KARYA_LABEL, type KaryaType, type Metode } from "@/lib/content/types";
import { hapusProyek, newProject, simpanProyek } from "@/lib/engine/project";
import { composeSection } from "@/lib/engine/compose";
import { strukturProyek } from "@/lib/content/struktur";
import { strukturKeDaftarIsi } from "@/lib/pedoman/skema-struktur";
import { TEMPLATE_PEDOMAN } from "@/lib/pedoman/template-pedoman";
import {
  IconArrowRight,
  IconBook,
  IconCheck,
  IconCompass,
  IconGlobe,
  IconLayers,
  IconTarget,
} from "@/components/icons";
import { Field, Note } from "@/components/ui";

const LANGKAH = [
  { id: 0, label: "Jenis karya", ar: "نوع البحث" },
  { id: 1, label: "Bidang", ar: "المجال" },
  { id: 2, label: "Metode", ar: "المنهج" },
  { id: 3, label: "Data penelitian", ar: "بيانات البحث" },
  { id: 4, label: "Pedoman", ar: "الدليل" },
  { id: 5, label: "Rumusan masalah", ar: "أسئلة البحث" },
];

/** Label singkat pilihan template di wizard, sejajar TEMPLATE_PEDOMAN. */
const LABEL_PEDOMAN_WIZARD = ["Ma'had Aly DDI Mangkoso", "Ma'had Aly As'adiyah Sengkang"];

const KARYA: { id: KaryaType; ikon: typeof IconBook; ket: string }[] = [
  { id: "skripsi", ikon: IconBook, ket: "Satu fenomena, satu metode, lima bab." },
  { id: "tesis", ikon: IconLayers, ket: "Teori lebih dalam, pembahasan lebih luas." },
  { id: "disertasi", ikon: IconCompass, ket: "Kontribusi teoretis orisinal, uji ketat." },
  { id: "jurnal", ikon: IconGlobe, ket: "Artikel IMRaD untuk publikasi." },
];

export default function MulaiPage() {
  const router = useRouter();
  const [langkah, setLangkah] = useState(0);
  const [jenis, setJenis] = useState<KaryaType>("skripsi");
  const [bidangId, setBidangId] = useState("quran");
  const [metode, setMetode] = useState<Metode>("kualitatif");
  const [judulAr, setJudulAr] = useState("");
  const [topikAr, setTopikAr] = useState("");
  const [lokasi, setLokasi] = useState("");
  const [populasi, setPopulasi] = useState("");
  const [fenomenaAr, setFenomenaAr] = useState("");
  const [rumusan, setRumusan] = useState("");
  // Pedoman WAJIB dipilih (keputusan pemilik 29 Okt 2026): indeks
  // TEMPLATE_PEDOMAN untuk template permanen, atau "sendiri" untuk
  // pedoman kampus lain yang disusun belakangan di ruang kerja.
  const [pedomanIdx, setPedomanIdx] = useState<number | "sendiri" | null>(null);
  const [membuat, setMembuat] = useState(false);

  const bidang = useMemo(() => BIDANG.find((b) => b.id === bidangId) ?? BIDANG[0], [bidangId]);
  const bisaLanjut =
    (langkah !== 3 || topikAr.trim().length > 2) &&
    (langkah !== 4 || pedomanIdx !== null);
  const terakhir = langkah === LANGKAH.length - 1;

  async function selesai() {
    setMembuat(true);
    const tpl = typeof pedomanIdx === "number" ? TEMPLATE_PEDOMAN[pedomanIdx] : undefined;
    const p = newProject({
      jenis,
      metode,
      bidangId,
      topikAr: topikAr.trim(),
      judulAr: judulAr.trim(),
      lokasi: lokasi.trim(),
      populasi: populasi.trim(),
      fenomenaAr: fenomenaAr.trim(),
      rumusan: rumusan
        .split("\n")
        .map((s) => s.replace(/^[-*\d.)\s]+/, "").trim())
        .filter(Boolean),
      // Template permanen yang dipilih di langkah Pedoman langsung menjadi
      // struktur + daftar isi proyek sejak awal. "Pedoman Sendiri" tidak
      // mengisi apa pun: struktur disusun dari panel Pedoman kampus.
      ...(tpl ? { strukturPedoman: tpl, daftarIsi: strukturKeDaftarIsi(tpl) } : {}),
    });
    // DATA DULU, BARU SUSUN (keputusan pemilik 29 Okt 2026): draf Bab I
    // langsung disusun otomatis dari data wizard saat proyek dibuat, supaya
    // mahasiswa membuka ruang kerja yang sudah berisi draf — bukan halaman
    // kosong. Yang disusun hanya bagian yang murni berasal dari data wizard
    // (latar belakang dari topik/fenomena, rumusan dan tujuan dari rumusan
    // yang ditulis, manfaat, batasan, definisi). Bab isi tetap dikerjakan
    // lewat pencarian rujukan. Kegagalan menyusun tidak boleh menggagalkan
    // pembuatan proyek.
    try {
      const idBagian = new Set(
        strukturProyek(p).chapters.flatMap((c) => c.sections.map((s) => s.id)),
      );
      const drafAwal: Record<string, string> = {};
      for (const id of ["khalfiya", "masalah", "ahdaf", "fawaid", "hudud", "mustalahat"]) {
        if (idBagian.has(id)) drafAwal[id] = composeSection(p, id).markdown;
      }
      if (Object.keys(drafAwal).length > 0) p.draf = { ...p.draf, ...drafAwal };
    } catch {
      /* draf awal gagal disusun: proyek tetap dibuat, tombol Susun draf tersedia */
    }
    simpanProyek(p);
    // Fase 3: daftarkan ke server agar aturan lapis berlaku (gratis maks 1
    // proyek; ruang lingkup = bidang yang dipilih di sini, terkunci setelah
    // footnote pertama). Bila server menolak (403), proyek lokal dibatalkan.
    // Bila belum masuk Google (401) atau jaringan gagal, proyek lokal tetap
    // jalan seperti sebelumnya — pendaftaran dicoba lagi saat footnote
    // pertama dipasang.
    try {
      const res = await fetch("/api/lapis/proyek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: p.id,
          judul: p.judulAr || p.topikAr || "Tanpa judul",
          kategoriId: bidangId,
        }),
      });
      if (res.status === 403) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        hapusProyek(p.id);
        window.alert(data?.error ?? "Proyek baru ditolak oleh aturan lapis akun Anda.");
        router.push("/proyek");
        return;
      }
    } catch {
      /* jaringan gagal: lanjut lokal */
    }
    router.push(`/proyek/${p.id}`);
  }

  return (
    <div className="wrap py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="eyebrow">Proyek baru</span>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              Siapkan konteks penelitian Anda
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              Enam langkah singkat. Semua jawaban bisa diubah lagi di ruang kerja.
            </p>
          </div>
          <Link href="/proyek" className="btn-quiet shrink-0">
            Daftar proyek
          </Link>
        </div>

        <ol className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
          {LANGKAH.map((l) => {
            const aktif = l.id === langkah;
            const lewat = l.id < langkah;
            return (
              <li key={l.id} className="inline-flex items-center gap-1.5">
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${
                    aktif
                      ? "bg-ink-900 text-parchment-100"
                      : lewat
                        ? "bg-gold-400 text-ink-950"
                        : "bg-ink-900/10 text-ink-500"
                  }`}
                >
                  {lewat ? <IconCheck className="h-3 w-3" /> : l.id + 1}
                </span>
                <span className={aktif ? "text-ink-900" : "text-ink-500"}>{l.label}</span>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 card p-5 sm:p-7">
          {langkah === 0 && (
            <div>
              <h2 className="text-lg font-bold text-ink-900">Karya apa yang sedang Anda tulis?</h2>
              <p className="mt-1 text-[13px] text-ink-600">
                Pilihan ini menentukan struktur bab dan target kata per bagian.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {KARYA.map((k) => {
                  const on = jenis === k.id;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => setJenis(k.id)}
                      className={`rounded-xl border p-4 text-left transition ${
                        on
                          ? "border-gold-500 bg-gold-100/50 shadow-card"
                          : "border-ink-900/10 bg-white/60 hover:border-ink-900/25"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <k.ikon className={`h-5 w-5 ${on ? "text-gold-600" : "text-ink-600"}`} />
                        <span className="font-arabic text-[11px] text-ink-500" dir="rtl">
                          {KARYA_LABEL[k.id].ar}
                        </span>
                      </div>
                      <p className="mt-3 text-[14px] font-bold text-ink-900">{KARYA_LABEL[k.id].id}</p>
                      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-ink-500">
                        {KARYA_LABEL[k.id].jenjang}
                      </p>
                      <p className="mt-2 text-[12px] leading-relaxed text-ink-700">{k.ket}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {langkah === 1 && (
            <div>
              <h2 className="text-lg font-bold text-ink-900">Bidang keilmuan</h2>
              <p className="mt-1 text-[13px] text-ink-600">
                Dipakai untuk memilih teori, rujukan kunci, dan mencocokkan jurnal.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {BIDANG.map((b) => {
                  const on = bidangId === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBidangId(b.id)}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                        on
                          ? "border-gold-500 bg-gold-100/50"
                          : "border-ink-900/10 bg-white/60 hover:border-ink-900/25"
                      }`}
                    >
                      <span>
                        <span className="block text-[13px] font-semibold text-ink-900">{b.labelId}</span>
                        <span className="mt-0.5 block font-arabic text-[12px] text-ink-500" dir="rtl">
                          {b.labelAr}
                        </span>
                      </span>
                      {on && <IconCheck className="h-4 w-4 shrink-0 text-gold-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {langkah === 2 && (
            <div>
              <h2 className="text-lg font-bold text-ink-900">Metode penelitian</h2>
              <p className="mt-1 text-[13px] text-ink-600">
                Metode menentukan bagian yang muncul di Bab III dan cara menulis Bab IV.
              </p>
              <div className="mt-5 grid gap-3">
                {(Object.keys(METODE) as Metode[]).map((m) => {
                  const on = metode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetode(m)}
                      className={`flex items-start gap-4 rounded-xl border p-4 text-left transition ${
                        on
                          ? "border-gold-500 bg-gold-100/50"
                          : "border-ink-900/10 bg-white/60 hover:border-ink-900/25"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                          on ? "border-gold-600 bg-gold-500 text-white" : "border-ink-900/20"
                        }`}
                      >
                        {on && <IconCheck className="h-3 w-3" />}
                      </span>
                      <span>
                        <span className="flex flex-wrap items-baseline gap-2">
                          <span className="text-[14px] font-bold text-ink-900">{METODE[m].labelId}</span>
                          <span className="font-arabic text-[12px] text-ink-500" dir="rtl">
                            {METODE[m].labelAr}
                          </span>
                        </span>
                        <span className="mt-1 block text-[12px] leading-relaxed text-ink-700">
                          {METODE[m].ringkas}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {langkah === 3 && (
            <div>
              <h2 className="text-lg font-bold text-ink-900">Data dasar penelitian</h2>
              <p className="mt-1 text-[13px] text-ink-600">
                Tulis dalam huruf Arab bila sudah ada. Yang masih kosong akan ditandai sebagai
                penanda di draf.
              </p>
              <div className="mt-5 grid gap-4">
                <Field
                  label="Topik / kalimat kunci penelitian (Arab)"
                  hint="Contoh: تعليم اللغة العربية، الوقف الإنتاجي، منهج التفسير الموضوعي"
                >
                  <input
                    className="input text-right font-naskh text-base"
                    dir="rtl"
                    value={topikAr}
                    onChange={(e) => setTopikAr(e.target.value)}
                    placeholder="تعليم اللغة العربية في المعاهد الإسلامية"
                  />
                </Field>
                <Field label="Judul sementara (Arab)" hint="Boleh dikosongkan; bisa diisi nanti.">
                  <input
                    className="input text-right font-naskh text-base"
                    dir="rtl"
                    value={judulAr}
                    onChange={(e) => setJudulAr(e.target.value)}
                    placeholder="فاعلية طريقة المحاورة في تنمية مهارة الكلام"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Lokasi penelitian (Arab)">
                    <input
                      className="input text-right font-naskh"
                      dir="rtl"
                      value={lokasi}
                      onChange={(e) => setLokasi(e.target.value)}
                      placeholder="معهد دار المعارف"
                    />
                  </Field>
                  <Field label="Populasi / subjek (Arab)">
                    <input
                      className="input text-right font-naskh"
                      dir="rtl"
                      value={populasi}
                      onChange={(e) => setPopulasi(e.target.value)}
                      placeholder="طلاب الصف الثاني"
                    />
                  </Field>
                </div>
                <Field
                  label="Fenomena yang Anda amati (Arab)"
                  hint="Satu-dua kalimat. Ini yang akan mengisi placeholder fenomena di latar belakang."
                >
                  <textarea
                    className="input min-h-24 text-right font-naskh text-[15px] leading-loose"
                    dir="rtl"
                    value={fenomenaAr}
                    onChange={(e) => setFenomenaAr(e.target.value)}
                    placeholder="يلاحظ الباحث ضعف الطلاب في المحادثة باللغة العربية رغم دراستهم للنحو"
                  />
                </Field>
              </div>
              {!bisaLanjut && (
                <p className="mt-3 text-[11px] font-medium text-amber-700">
                  Isi topik penelitian dulu untuk melanjutkan.
                </p>
              )}
            </div>
          )}

          {langkah === 4 && (
            <div>
              <h2 className="text-lg font-bold text-ink-900">Pedoman penulisan kampus</h2>
              <p className="mt-1 text-[13px] text-ink-600">
                Wajib dipilih satu. Struktur bab proyek Anda langsung mengikuti pedoman ini,
                dan masih bisa diganti belakangan di ruang kerja.
              </p>
              <div className="mt-5 grid gap-3">
                {TEMPLATE_PEDOMAN.map((t, i) => {
                  const on = pedomanIdx === i;
                  const sub = t.bab.reduce((a, b) => a + b.subBab.length, 0);
                  const atr = t.bab.reduce((a, b) => a + b.aturan.length, 0);
                  return (
                    <button
                      key={t.namaPedoman}
                      type="button"
                      onClick={() => setPedomanIdx(i)}
                      className={`flex items-start gap-4 rounded-xl border p-4 text-left transition ${
                        on
                          ? "border-gold-500 bg-gold-100/50"
                          : "border-ink-900/10 bg-white/60 hover:border-ink-900/25"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                          on ? "border-gold-600 bg-gold-500 text-white" : "border-ink-900/20"
                        }`}
                      >
                        {on && <IconCheck className="h-3 w-3" />}
                      </span>
                      <span>
                        <span className="block text-[14px] font-bold text-ink-900">
                          {LABEL_PEDOMAN_WIZARD[i] ?? t.namaPedoman}
                        </span>
                        <span className="mt-1 block text-[12px] leading-relaxed text-ink-700">
                          {t.namaPedoman} — {t.bab.length} bab · {sub} sub-bab · {atr} aturan.
                          Struktur resmi kampus, langsung terpasang sebagai daftar isi proyek.
                        </span>
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPedomanIdx("sendiri")}
                  className={`flex items-start gap-4 rounded-xl border p-4 text-left transition ${
                    pedomanIdx === "sendiri"
                      ? "border-gold-500 bg-gold-100/50"
                      : "border-ink-900/10 bg-white/60 hover:border-ink-900/25"
                  }`}
                >
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                      pedomanIdx === "sendiri" ? "border-gold-600 bg-gold-500 text-white" : "border-ink-900/20"
                    }`}
                  >
                    {pedomanIdx === "sendiri" && <IconCheck className="h-3 w-3" />}
                  </span>
                  <span>
                    <span className="block text-[14px] font-bold text-ink-900">Pedoman Sendiri</span>
                    <span className="mt-1 block text-[12px] leading-relaxed text-ink-700">
                      Pedoman kampus lain. Proyek dimulai dengan struktur bawaan Kitabah; susun
                      struktur pedoman Anda dari PDF lewat panel Pedoman kampus di ruang kerja.
                    </span>
                  </span>
                </button>
              </div>
              {pedomanIdx === null && (
                <p className="mt-3 text-[11px] font-medium text-amber-700">
                  Pilih satu pedoman dulu untuk melanjutkan.
                </p>
              )}
            </div>
          )}

          {langkah === 5 && (
            <div>
              <h2 className="text-lg font-bold text-ink-900">Rumusan masalah</h2>
              <p className="mt-1 text-[13px] text-ink-600">
                Satu pertanyaan per baris, dalam bahasa Arab. Kosongkan bila masih ragu — aplikasi
                akan menyusun draf pertanyaan awal yang bisa Anda sunting.
              </p>
              <textarea
                className="input mt-5 min-h-32 text-right font-naskh text-[15px] leading-loose"
                dir="rtl"
                value={rumusan}
                onChange={(e) => setRumusan(e.target.value)}
                placeholder={"كيف واقع تعليم المحادثة في المعهد؟\nما العوامل المؤثرة في ضعف مهارة الكلام؟\nكيف يمكن تطوير تعليم المحادثة في ضوء النتائج؟"}
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-ink-900/10 bg-parchment-100/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Jenis
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-ink-900">{KARYA_LABEL[jenis].id}</p>
                </div>
                <div className="rounded-xl border border-ink-900/10 bg-parchment-100/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Bidang
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-ink-900">{bidang.labelId}</p>
                </div>
                <div className="rounded-xl border border-ink-900/10 bg-parchment-100/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Metode
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-ink-900">{METODE[metode].labelId}</p>
                </div>
                <div className="rounded-xl border border-ink-900/10 bg-parchment-100/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Pedoman
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-ink-900">
                    {typeof pedomanIdx === "number"
                      ? (LABEL_PEDOMAN_WIZARD[pedomanIdx] ?? "Template kampus")
                      : "Pedoman Sendiri"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-ink-600">
                Begitu proyek dibuat, <strong className="text-ink-900">draf Bab I langsung
                tersusun otomatis dari data ini</strong> — latar belakang dari topik dan fenomena
                Anda, rumusan dan tujuan dari pertanyaan di atas. Anda tinggal menyunting dan
                mengembangkannya, bukan mulai dari halaman kosong.
              </p>
              <Note jenis="warn">
                <strong>Sebelum mulai:</strong> semua draf tersimpan di peramban ini saja. Ekspor
                .docx secara berkala agar naskah Anda punya cadangan.
              </Note>
            </div>
          )}

          <div className="mt-7 flex items-center justify-between gap-3 border-t border-ink-900/10 pt-5">
            <button
              type="button"
              onClick={() => setLangkah((l) => Math.max(0, l - 1))}
              disabled={langkah === 0}
              className="btn-quiet disabled:opacity-40"
            >
              Kembali
            </button>
            {terakhir ? (
              <button type="button" onClick={selesai} disabled={membuat} className="btn-gold">
                {membuat ? "Menyiapkan…" : "Buat proyek & buka ruang kerja"}
                <IconArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLangkah((l) => Math.min(LANGKAH.length - 1, l + 1))}
                disabled={!bisaLanjut}
                className="btn-primary"
              >
                Lanjut
                <IconArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-ink-500">
          <IconTarget className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Konteks ini dipakai ulang oleh semua modul: penyusun draf, kamus istilah, pencocok jurnal,
          dan pemeriksa naskah.
        </p>
      </div>
    </div>
  );
}

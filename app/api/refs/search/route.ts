import { NextResponse } from "next/server";
import { cariRujukan, kemampuanSumber } from "@/lib/refs";
import { statusPenyedia } from "@/lib/refs/llm/penyedia";
import { BATAS, type SearchRequest, type SourceId } from "@/lib/refs/types";
import { tolakTanpaSesi } from "@/lib/security/akses";
import { penggunaDariRequest, tierEfektif } from "@/lib/server/identitas";
import { bolehLajuServer } from "@/lib/server/laju-server";
import { asalSah, balasanLaju, bolehLaju, ipKlien } from "@/lib/security/laju";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 30 permintaan per menit per IP. */
const JENDELA_MS = 60_000;
const MAKS_PER_IP = 30;
/** Batas lidah global per menit. */
const MAKS_GLOBAL = 600;

/** Kemampuan sumber apa adanya - dipakai UI untuk menjelaskan mode. */
export async function GET(req: Request) {
  // Pengencangan 3 Nov 2026 (R-7): status kesiapan penyedia tidak lagi
  // terbuka untuk anonim; cukup cookie gerbang seperti rute lainnya.
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;
  return NextResponse.json({
    sumber: kemampuanSumber(),
    batas: BATAS,
    llm: statusPenyedia(),
    catatan: [
      "Turath memakai endpoint terbuka api.turath.io (tanpa key).",
      "Shamela, Ketabonline, Usul hanya mencari otomatis bila endpoint resmi diisi lewat environment variable.",
      "Waqfeya hanya dipakai untuk verifikasi halaman cetak, tidak memberi skor.",
      "LLM (bila siap) hanya menyusun istilah pencarian. Nama kitab, jilid, dan halaman selalu dari Turath.",
    ],
  });
}

export async function POST(req: Request) {
  // Pertahanan lapis kedua (N-01): verifikasi cookie sesi di handler sendiri.
  const tolak = tolakTanpaSesi(req);
  if (tolak) return tolak;

  if (!asalSah(req)) {
    return NextResponse.json(
      { error: "Asal permintaan tidak dikenal." },
      { status: 403 },
    );
  }

  // Pengencangan 3 Nov 2026 (S-2): mode konsep membakar LLM server,
  // jadi rute ini wajib sesi identitas, dengan batas per akun dan
  // batas global persisten (lintas instance).
  const u = await penggunaDariRequest(req);
  if (!u) {
    return NextResponse.json(
      { error: "Masuk dengan Google dulu untuk memakai pencarian rujukan.", kode: "WAJIB_LOGIN" },
      { status: 401 },
    );
  }

  const ip = ipKlien(req);

  const perIp = bolehLaju(`refs:ip:${ip}`, MAKS_PER_IP, JENDELA_MS);
  if (!perIp.boleh) {
    return balasanLaju(
      perIp.ulangDetik,
      `Terlalu banyak permintaan. Batas ${MAKS_PER_IP} per menit. Coba lagi dalam ${perIp.ulangDetik} detik.`,
    );
  }
  const perUser = await bolehLajuServer(`refs:user:${u.id}`, MAKS_PER_IP, JENDELA_MS);
  if (!perUser.boleh) {
    return balasanLaju(perUser.ulangDetik, "Jatah akun Anda untuk pencarian ini tercapai. Coba lagi sebentar.");
  }
  const global = await bolehLajuServer("refs:global", MAKS_GLOBAL, JENDELA_MS);
  if (!global.boleh) {
    return balasanLaju(global.ulangDetik, "Server sedang sibuk. Coba lagi sebentar.");
  }

  let body: SearchRequest;
  try {
    body = (await req.json()) as SearchRequest;
  } catch {
    return NextResponse.json({ error: "Badan permintaan bukan JSON." }, { status: 400 });
  }

  const kalimat = Array.isArray(body?.sentences) ? body.sentences : [];
  if (kalimat.length === 0 || kalimat.length > BATAS.maksKalimat) {
    return NextResponse.json(
      { error: `Kirim 1-${BATAS.maksKalimat} kalimat.` },
      { status: 400 },
    );
  }
  if (kalimat.some((s) => typeof s !== "string" || s.length > BATAS.maksPanjangKalimat)) {
    return NextResponse.json(
      { error: `Tiap kalimat maksimal ${BATAS.maksPanjangKalimat} karakter.` },
      { status: 400 },
    );
  }

  // Key hanya diteruskan bila dikirim klien (sessionStorage), tidak disimpan.
  const kunci: Partial<Record<SourceId, string>> = {};
  if (body.kunci && typeof body.kunci === "object") {
    for (const id of ["turath", "shamela", "ketabonline", "usul"] as const) {
      const v = body.kunci[id];
      if (typeof v === "string" && v.trim() && v.length < 200) kunci[id] = v.trim();
    }
  }

  try {
    const mode = body.mode === "konsep" ? "konsep" : "kata";
    const kunciLLM = typeof body.kunciLLM === "string" ? body.kunciLLM.trim() : undefined;
    // Pilihan penyedia dari klien hanya dihormati bila klien membawa
    // kunci LLM-nya sendiri (BYOK). Untuk kunci server, urutan selalu
    // kolam lebih dulu (panggilLLM di lib/refs/llm/penyedia.ts) dan
    // klien tidak bisa melompat langsung ke penyedia env tertentu.
    const penyediaLLM = kunciLLM && Array.isArray(body.penyediaLLM)
      ? body.penyediaLLM.filter((p): p is string => typeof p === "string").slice(0, 9)
      : undefined;
    const hasil = await cariRujukan({
      sentences: kalimat,
      sources: body.sources,
      kunci,
      mode,
      tanpaLLM: body.tanpaLLM === true,
      penyediaLLM,
      kunciLLM,
      premium: tierEfektif(u) === "premium",
      konsepKustom: Array.isArray(body.konsepKustom)
        ? body.konsepKustom.filter((s) => typeof s === "string" && s.trim())
        : undefined,
    });

    // Gerbang relevansi bidang untuk Cari Rujukan (Tahap 4, menutup
    // temuan S3 telaah komit koreksi: jalur ini dulu tidak melewati
    // penilaian bidang sama sekali). Bila klien mengirim konteks
    // bidang proyek, kandidat teratas dinilai gerbang yang sama dengan
    // Generate Footnote dan putusannya menempel pada tiap hasil.
    // Penilaian MODEL hanya berjalan untuk akun Premium atau pemilik
    // kunci pribadi (agar pencarian gratis tidak membakar kolam
    // pemilik); aturan keras bidang yang deterministik selalu
    // diterapkan ke semua akun. Opsi pinjaman mahasiswa ikut dihitung
    // dan diteruskan persis seperti jalur Generate Footnote: akun
    // yang pada jalur itu menilai memakai kunci pinjaman tidak boleh
    // turun ke aturan keras saja di jalur ini (temuan R5 telaah
    // silang Tahap 4).
    const bidangId = typeof body.bidangId === "string" ? body.bidangId.trim().slice(0, 60) : "";
    const judulProyek = typeof body.judulProyek === "string" ? body.judulProyek.trim().slice(0, 300) : "";
    const topikAr = typeof body.topikAr === "string" ? body.topikAr.trim().slice(0, 300) : "";
    if ((bidangId || judulProyek) && hasil.hasil.length > 0) {
      const { getBidang } = await import("@/lib/content/bidang");
      const { bidangMilikProyek, deteksiBidangSumber, nilaiUntukCariRujukan } = await import(
        "@/lib/server/gerbang-relevansi"
      );
      const bidang = bidangId ? getBidang(bidangId) : null;
      const konteks = {
        bidangId,
        bidangLabel: bidang ? `${bidang.labelId} (${bidang.labelAr})` : "",
        judulProyek,
        topik: topikAr,
      };
      const kunciDari = (h: (typeof hasil.hasil)[number]) =>
        `${h.kitab.replace(/^\[[^\]]*\]\s*/, "").trim().toLowerCase()}|${(h.penerbit ?? "").trim().toLowerCase()}`;
      const { opsiKolamUntuk } = await import("@/lib/server/kunci-pribadi");
      const opsiP = await opsiKolamUntuk(u).catch(() => null);
      const bisaNilaiModel =
        tierEfektif(u) === "premium" ||
        Boolean(opsiP?.pribadi) ||
        Boolean(opsiP?.wajibPribadi) ||
        (opsiP?.pinjaman?.length ?? 0) > 0;
      if (bisaNilaiModel) {
        const bentuk = hasil.hasil.map((h) => ({
          kunci: kunciDari(h),
          judul: h.kitab.replace(/^\[[^\]]*\]\s*/, "").trim(),
          wadah: h.penerbit ?? "",
          jenis: /^\[مجلة\]/.test(h.kitab) ? "jurnal" : "buku",
          // Isi kandidat ikut dinilai model, sama seperti jalur
          // Generate Footnote (R5): gerbang membaca teks kutipan
          // sumbernya, bukan hanya judul dan wadahnya.
          isi: h.teks_kutipan?.trim() ? h.teks_kutipan : undefined,
          kalimat: h.kalimat,
        }));
        const jumlahUnik = new Set(bentuk.map((b) => b.kunci)).size;
        // Kegagalan total penilaian dilaporkan JUJUR sebagai semua
        // kandidat unik belum dinilai (R3): angka 0 akan menelan
        // peringatan dan memberi kesan gerbang sudah bekerja.
        let penilaianGagalTotal = false;
        const { putusan, belumDinilai } = await nilaiUntukCariRujukan(bentuk, konteks, {
          pribadi: opsiP?.pribadi,
          wajibPribadi: opsiP?.wajibPribadi,
          pinjaman: opsiP?.pinjaman,
        }).catch(() => {
          penilaianGagalTotal = true;
          return { putusan: new Map(), belumDinilai: jumlahUnik };
        });
        for (const h of hasil.hasil) {
          const p = putusan.get(kunciDari(h));
          if (p) {
            h.gerbang = {
              lolos: p.lolos,
              perluKonfirmasi: p.perluKonfirmasi,
              bidangSumber: p.bidangSumber,
              alasan: p.alasan,
              statusPenilaian: p.statusPenilaian,
              ...(typeof p.skorModel === "number" ? { skorModel: p.skorModel } : {}),
            };
          }
        }
        if (belumDinilai > 0) {
          hasil.peringatan.push(
            penilaianGagalTotal
              ? `${belumDinilai} kandidat belum dinilai gerbang bidang pada pencarian ini karena penilaian gagal berjalan; kandidat itu belum punya putusan bidang.`
              : `${belumDinilai} kandidat belum dinilai gerbang bidang pada pencarian ini (batas penilaian per pencarian tercapai); kandidat itu belum punya putusan bidang.`,
          );
        }
      } else {
        // Tanpa penilaian model: aturan keras saja, putusannya hanya
        // untuk kandidat yang tertahan; yang bersih tidak diberi label
        // lolos yang tidak pernah dinilai model.
        for (const h of hasil.hasil) {
          const judulBersih = h.kitab.replace(/^\[[^\]]*\]\s*/, "").trim();
          const bidangSumber = deteksiBidangSumber(judulBersih, h.penerbit ?? "");
          if (bidangSumber && !bidangMilikProyek(bidangSumber, konteks)) {
            h.gerbang = {
              lolos: false,
              perluKonfirmasi: true,
              bidangSumber,
              alasan: `Judul atau nama jurnal menunjukkan bidang ${bidangSumber}, sedangkan proyek ini bidang ${konteks.bidangLabel || bidangId}. (Penilaian model tidak berjalan untuk akun Anda; yang bekerja aturan keras bidang.)`,
              statusPenilaian: "aturan-keras",
            };
          }
        }
      }
    }
    return NextResponse.json(hasil);
  } catch (e) {
    console.error("Error in refs search:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Pencarian gagal." },
      { status: 502 },
    );
  }
}
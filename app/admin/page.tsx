"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Halaman SUPER ADMIN (perintah pemilik, 3 Nov 2026): semua laporan
 * layanan di satu tempat. Halaman ini hanya kulit; datanya datang dari
 * /api/admin/laporan yang memeriksa sesi pemilik di server. Bukan admin
 * hanya melihat penjelasan, tidak ada data yang bocor ke klien.
 */

interface Laporan {
  dibuat: string;
  admin: string;
  email: { siap: boolean; penyedia: string | null };
  ujiCoba: {
    jumlahPerangkat: number;
    jumlahIpUnik: number;
    jumlahSesi: number;
    totalPercobaanIp: number;
    totalDitolak: number;
    sesiTerbaru: { judul: string; pedoman: string; perangkatId: string; ip: string; dibuat: string; dikembangkan: boolean }[];
    ipTeratas: { ip: string; percobaan: number; ditolak: number; terakhir: string }[];
  };
  pengguna: {
    total: number;
    premiumAktif: number;
    gratis: number;
    nonaktif: number;
    terbaru: {
      id: string;
      nama: string;
      email: string;
      tier: string;
      premiumSampai: string;
      nonaktif: boolean;
      jumlahPerangkat: number;
      dibuat: string;
    }[];
  };
  proyekServer: { total: number; terbaru: { judul: string; kategoriId: string; totalFootnote: number; dibuat: string }[] };
  pembayaran: { total: number; perStatus: Record<string, number>; terbaru: { id: string; email: string; jumlah: number; status: string; dibuat: string }[] };
  insiden: { total: number; terbuka: number; terbaru: { email: string; pesan: string; status: string; dibuat: string; tenggat: string }[] };
  kolam: { penyedia: string; model: string; jumlahKunci: number; sehat: number; jumlahKunciPremium: number; sehatPremium: number }[];
}

function formatWaktu(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID");
}

function Kartu({ label, nilai, ket }: { label: string; nilai: string | number; ket?: string }) {
  return (
    <div className="rounded-2xl border border-ink-900/10 bg-white/70 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-ink-900">{nilai}</p>
      {ket && <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">{ket}</p>}
    </div>
  );
}

function JudulBagian({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 text-lg font-bold text-ink-900">{children}</h2>;
}

const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500";
const td = "px-3 py-2 align-top text-[12.5px] text-ink-800";

type AksiPengguna = "nonaktifkan" | "aktifkan" | "premium" | "reset-perangkat";

export default function AdminPage() {
  const [keadaan, setKeadaan] = useState<"memuat" | "tamu" | "bukan" | "siap" | "galat">("memuat");
  const [data, setData] = useState<Laporan | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesanAksi, setPesanAksi] = useState("");

  async function muat() {
    try {
      const res = await fetch("/api/admin/laporan", { cache: "no-store" });
      if (res.status === 401) return setKeadaan("tamu");
      if (res.status === 403) return setKeadaan("bukan");
      if (!res.ok) return setKeadaan("galat");
      setData((await res.json()) as Laporan);
      setKeadaan("siap");
    } catch {
      setKeadaan("galat");
    }
  }

  useEffect(() => {
    void muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Tindakan per akun dua ketuk: ketuk pertama menyiapkan konfirmasi,
   *  ketuk kedua pada tombol yang sama menjalankan tindakan di server. */
  async function tindak(userId: string, aksi: AksiPengguna) {
    const kunci = `${userId}:${aksi}`;
    if (konfirmasi !== kunci) {
      setKonfirmasi(kunci);
      return;
    }
    setKonfirmasi(null);
    setSibuk(true);
    setPesanAksi("");
    try {
      const res = await fetch("/api/admin/pengguna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, aksi }),
      });
      const j = (await res.json().catch(() => null)) as { error?: string; catatan?: string } | null;
      setPesanAksi(!res.ok ? (j?.error ?? "Tindakan gagal.") : (j?.catatan ?? "Tindakan berhasil diterapkan."));
      if (res.ok) await muat();
    } catch {
      setPesanAksi("Tindakan gagal: jaringan bermasalah.");
    }
    setSibuk(false);
  }

  return (
    <div className="wrap py-10 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <span className="eyebrow">Super admin</span>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          Laporan layanan Kitabah
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Semua laporan di satu tempat: pemakai uji coba, pengguna, proyek, pembayaran, insiden,
          dan kesehatan kolam kunci AI. Halaman ini hanya terbuka untuk akun pemilik.
        </p>

        {keadaan === "memuat" && <p className="mt-8 text-sm text-ink-500">Memuat laporan…</p>}
        {keadaan === "galat" && (
          <p className="mt-8 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Laporan gagal dimuat. Coba muat ulang halaman ini.
          </p>
        )}
        {keadaan === "tamu" && (
          <div className="mt-8 card p-6">
            <p className="text-sm leading-relaxed text-ink-700">
              Anda belum masuk. Masuk dulu dengan akun Google pemilik, lalu kembali ke halaman ini.
            </p>
            <Link href="/masuk?lanjut=/admin" className="btn-primary mt-4 inline-block">
              Masuk
            </Link>
          </div>
        )}
        {keadaan === "bukan" && (
          <div className="mt-8 card p-6">
            <p className="text-sm leading-relaxed text-ink-700">
              Akun yang sedang masuk bukan akun pemilik layanan, jadi laporan tidak ditampilkan.
              Keluar lalu masuk dengan akun pemilik bila Anda memang pemiliknya.
            </p>
          </div>
        )}

        {keadaan === "siap" && data && (
          <>
            <p className="mt-4 text-[12px] text-ink-500">
              Admin: {data.admin} · Laporan dibuat {formatWaktu(data.dibuat)}
            </p>

            <JudulBagian>Uji coba tamu</JudulBagian>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Kartu label="Perangkat pemakai" nilai={data.ujiCoba.jumlahPerangkat} ket="Perangkat berbeda yang pernah mencoba" />
              <Kartu label="IP unik" nilai={data.ujiCoba.jumlahIpUnik} ket="Jaringan berbeda (sidik samaran)" />
              <Kartu label="Sesi uji coba" nilai={data.ujiCoba.jumlahSesi} ket="Total sesi yang pernah dibuat" />
              <Kartu label="Percobaan dari IP" nilai={data.ujiCoba.totalPercobaanIp} ket="Terhitung sejak pencatatan IP dipasang" />
              <Kartu label="Ditolak (jatah habis)" nilai={data.ujiCoba.totalDitolak} ket="Percobaan ke-3 dan seterusnya per IP" />
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-ink-900/10 bg-white/70">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-ink-900/10">
                    <th className={th}>Judul yang dicoba</th>
                    <th className={th}>Pedoman</th>
                    <th className={th}>Sidik IP</th>
                    <th className={th}>Waktu</th>
                    <th className={th}>Dikembangkan</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ujiCoba.sesiTerbaru.map((s, i) => (
                    <tr key={i} className="border-b border-ink-900/5 last:border-0">
                      <td className={td}><span dir="auto">{s.judul || "(tanpa judul)"}</span></td>
                      <td className={td}>{s.pedoman}</td>
                      <td className={td}><span className="font-mono text-[11px]">{s.ip || "—"}</span></td>
                      <td className={td}>{formatWaktu(s.dibuat)}</td>
                      <td className={td}>{s.dikembangkan ? "Ya" : "Tidak"}</td>
                    </tr>
                  ))}
                  {data.ujiCoba.sesiTerbaru.length === 0 && (
                    <tr><td className={td} colSpan={5}>Belum ada sesi uji coba tercatat.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {data.ujiCoba.ipTeratas.length > 0 && (
              <p className="mt-3 text-[12px] leading-relaxed text-ink-500">
                IP paling sering mencoba (sidik samaran):{" "}
                {data.ujiCoba.ipTeratas
                  .map((r) => `${r.ip}… (${r.percobaan} kali${r.ditolak ? `, ${r.ditolak} ditolak` : ""})`)
                  .join(" · ")}
              </p>
            )}

            <JudulBagian>Pengguna dan proyek</JudulBagian>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kartu
                label="Pengguna terdaftar"
                nilai={data.pengguna.total}
                ket={data.pengguna.nonaktif > 0 ? `${data.pengguna.nonaktif} akun dinonaktifkan` : undefined}
              />
              <Kartu label="Premium aktif" nilai={data.pengguna.premiumAktif} />
              <Kartu label="Gratis" nilai={data.pengguna.gratis} />
              <Kartu label="Proyek terdaftar di server" nilai={data.proyekServer.total} />
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-ink-600">
              Tindakan per akun (dua ketuk untuk memastikan): <strong>Nonaktifkan</strong> mengunci
              akun di semua lapis termasuk premium, tanpa menghapus data;{" "}
              <strong>Jadikan Premium</strong> menempelkan premium 30 hari langsung dari server,
              penerima tidak perlu menempel kunci; <strong>Email</strong> membuka draf
              pemberitahuan premium di aplikasi email Anda untuk dikirim ke akun itu;{" "}
              <strong>Reset perangkat</strong> mengosongkan ikatan perangkat akun (batas: gratis
              1 perangkat, premium 2 perangkat), dipakai bila mahasiswa berganti perangkat.
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-600">
              {data.email.siap
                ? `Pengirim email otomatis aktif lewat ${data.email.penyedia}: pemberitahuan premium terkirim sendiri dari server sesudah Anda menekan Jadikan Premium.`
                : "Pengirim email otomatis belum terpasang di server (kunci penyedia belum diisi), jadi pemberitahuan premium belum terkirim sendiri. Memasang kuncinya cukup sekali di pengaturan Vercel."}
            </p>
            {pesanAksi && (
              <p className="mt-2 rounded-lg bg-parchment-100 px-3 py-2 text-[12.5px] font-medium text-ink-800">
                {pesanAksi}
              </p>
            )}
            <div className="mt-3 overflow-x-auto rounded-2xl border border-ink-900/10 bg-white/70">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-ink-900/10">
                    <th className={th}>Pengguna terbaru</th>
                    <th className={th}>Email</th>
                    <th className={th}>Lapis</th>
                    <th className={th}>Status</th>
                    <th className={th}>Perangkat</th>
                    <th className={th}>Terdaftar</th>
                    <th className={th}>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pengguna.terbaru.map((x) => {
                    const subjek = encodeURIComponent("Akun Kitabah Anda sudah Premium");
                    const isi = encodeURIComponent(
                      `Assalamu'alaikum ${x.nama || ""},\n\nAkun Kitabah Anda (${x.email}) sudah diaktifkan sebagai Premium oleh admin${x.premiumSampai ? ` sampai ${formatWaktu(x.premiumSampai)}` : ""}. Silakan masuk seperti biasa di https://www.kitabah.web.id/masuk — tidak perlu menempel kunci apa pun, premium sudah menempel di akun Anda.\n\nSelamat menulis.`,
                    );
                    const btn =
                      "rounded-lg border px-2 py-1 text-[11px] font-semibold disabled:opacity-50 ";
                    return (
                      <tr key={x.id} className="border-b border-ink-900/5 last:border-0">
                        <td className={td}>{x.nama || "(tanpa nama)"}</td>
                        <td className={td}>{x.email}</td>
                        <td className={td}>{x.tier === "premium" ? "Premium" : "Gratis"}</td>
                        <td className={td}>{x.nonaktif ? "Nonaktif" : "Aktif"}</td>
                        <td className={td}>{x.jumlahPerangkat}</td>
                        <td className={td}>{formatWaktu(x.dibuat)}</td>
                        <td className={td}>
                          <span className="flex flex-wrap gap-1">
                            {x.nonaktif ? (
                              <button
                                type="button"
                                disabled={sibuk}
                                onClick={() => void tindak(x.id, "aktifkan")}
                                className={btn + "border-emerald-600/40 text-emerald-700"}
                              >
                                {konfirmasi === `${x.id}:aktifkan` ? "Yakin aktifkan?" : "Aktifkan"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={sibuk}
                                onClick={() => void tindak(x.id, "nonaktifkan")}
                                className={btn + "border-red-600/40 text-red-700"}
                              >
                                {konfirmasi === `${x.id}:nonaktifkan` ? "Yakin nonaktifkan?" : "Nonaktifkan"}
                              </button>
                            )}
                            {x.tier !== "premium" && !x.nonaktif && (
                              <button
                                type="button"
                                disabled={sibuk}
                                onClick={() => void tindak(x.id, "premium")}
                                className={btn + "border-gold-600/50 text-gold-700"}
                              >
                                {konfirmasi === `${x.id}:premium` ? "Yakin jadikan premium?" : "Jadikan Premium"}
                              </button>
                            )}
                            {x.tier === "premium" && (
                              <a
                                href={`mailto:${x.email}?subject=${subjek}&body=${isi}`}
                                className={btn + "inline-block border-ink-900/20 text-ink-700"}
                              >
                                Email premium
                              </a>
                            )}
                            {x.jumlahPerangkat > 0 && (
                              <button
                                type="button"
                                disabled={sibuk}
                                onClick={() => void tindak(x.id, "reset-perangkat")}
                                className={btn + "border-ink-900/25 text-ink-700"}
                              >
                                {konfirmasi === `${x.id}:reset-perangkat` ? "Yakin reset perangkat?" : "Reset perangkat"}
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {data.pengguna.terbaru.length === 0 && (
                    <tr><td className={td} colSpan={7}>Belum ada pengguna terdaftar.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <JudulBagian>Pembayaran dan insiden</JudulBagian>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kartu label="Order pembayaran" nilai={data.pembayaran.total} />
              <Kartu
                label="Rincian status order"
                nilai={Object.entries(data.pembayaran.perStatus).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"}
              />
              <Kartu label="Insiden tercatat" nilai={data.insiden.total} />
              <Kartu label="Insiden terbuka" nilai={data.insiden.terbuka} ket="Standar beres 6 jam atau dana kembali" />
            </div>
            {data.insiden.terbaru.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-ink-900/10 bg-white/70">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-ink-900/10">
                      <th className={th}>Insiden terbaru</th>
                      <th className={th}>Pelapor</th>
                      <th className={th}>Status</th>
                      <th className={th}>Tenggat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.insiden.terbaru.map((x, i) => (
                      <tr key={i} className="border-b border-ink-900/5 last:border-0">
                        <td className={td}>{x.pesan}</td>
                        <td className={td}>{x.email}</td>
                        <td className={td}>{x.status}</td>
                        <td className={td}>{formatWaktu(x.tenggat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <JudulBagian>Kolam kunci AI</JudulBagian>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {data.kolam.map((k) => (
                <Kartu
                  key={k.penyedia}
                  label={`${k.penyedia} · ${k.model}`}
                  nilai={`${k.sehat}/${k.jumlahKunci} kunci sehat`}
                  ket={`Premium: ${k.sehatPremium}/${k.jumlahKunciPremium} kunci sehat`}
                />
              ))}
              {data.kolam.length === 0 && <Kartu label="Kolam" nilai="Tidak terbaca" />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

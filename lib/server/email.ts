/**
 * PENGIRIM EMAIL SERVER (perintah pemilik, 3 Nov 2026): pemberitahuan
 * otomatis dari server, dipakai pertama untuk kabar premium dari Super
 * Admin. Dua penyedia didukung lewat env, pilih yang kuncinya terisi:
 *  - Resend: RESEND_API_KEY (+ EMAIL_FROM dari domain terverifikasi).
 *  - Brevo:  BREVO_API_KEY  (+ EMAIL_FROM dari pengirim terverifikasi).
 * EMAIL_FROM berformat "Nama <email@domain>" atau alamat email saja.
 * RESEND_API_URL / BREVO_API_URL hanya untuk pengujian lokal.
 *
 * Kaidah: pengiriman bersifat best-effort. Tanpa kunci penyedia, fungsi
 * mengembalikan "tidak" dan tindakan pemanggil TETAP berhasil; kegagalan
 * jaringan/penyedia tidak pernah menggagalkan tindakan admin.
 */

export interface HasilEmail {
  terkirim: boolean;
  penyedia: "resend" | "brevo" | null;
  alasan?: string;
}

function parseDari(): { nama: string; email: string } | null {
  const mentah = process.env.EMAIL_FROM?.trim();
  if (!mentah) return null;
  const cocok = mentah.match(/^(.*?)<([^>]+)>$/);
  if (cocok) return { nama: cocok[1]!.trim() || "Kitabah", email: cocok[2]!.trim() };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mentah)) return { nama: "Kitabah", email: mentah };
  return null;
}

function penyediaAktif(): "resend" | "brevo" | null {
  const pilihan = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (pilihan === "resend" && process.env.RESEND_API_KEY?.trim()) return "resend";
  if (pilihan === "brevo" && process.env.BREVO_API_KEY?.trim()) return "brevo";
  if (process.env.RESEND_API_KEY?.trim()) return "resend";
  if (process.env.BREVO_API_KEY?.trim()) return "brevo";
  return null;
}

/** Apakah pengiriman email otomatis sudah terkonfigurasi di server. */
export function emailSiap(): boolean {
  return penyediaAktif() !== null && parseDari() !== null;
}

/** Status ringkas untuk laporan admin. */
export function statusEmail(): { siap: boolean; penyedia: "resend" | "brevo" | null } {
  return { siap: emailSiap(), penyedia: penyediaAktif() };
}

export async function kirimEmail(isi: {
  ke: string;
  subjek: string;
  teks: string;
}): Promise<HasilEmail> {
  const penyedia = penyediaAktif();
  const dari = parseDari();
  if (!penyedia) return { terkirim: false, penyedia: null, alasan: "kunci penyedia email belum diisi" };
  if (!dari) return { terkirim: false, penyedia, alasan: "EMAIL_FROM belum diisi atau tidak sah" };

  try {
    if (penyedia === "resend") {
      const base = process.env.RESEND_API_URL?.trim() || "https://api.resend.com";
      const res = await fetch(`${base}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${dari.nama} <${dari.email}>`,
          to: [isi.ke],
          subject: isi.subjek,
          text: isi.teks,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return { terkirim: false, penyedia, alasan: `Resend menjawab ${res.status}` };
      return { terkirim: true, penyedia };
    }
    const base = process.env.BREVO_API_URL?.trim() || "https://api.brevo.com/v3";
    const res = await fetch(`${base}/smtp/email`, {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY!.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: dari.nama, email: dari.email },
        to: [{ email: isi.ke }],
        subject: isi.subjek,
        textContent: isi.teks,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { terkirim: false, penyedia, alasan: `Brevo menjawab ${res.status}` };
    return { terkirim: true, penyedia };
  } catch (e) {
    return { terkirim: false, penyedia, alasan: e instanceof Error ? e.message : "jaringan gagal" };
  }
}

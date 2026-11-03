/**
 * Pemberitahuan login ke pemilik (perintah pemilik, 3 Nov 2026):
 * setiap mahasiswa masuk, pemilik menerima email berisi siapa,
 * lapis apa, dari perangkat apa, dan kapan. Dua rem agar kotak
 * masuk tidak banjir:
 *  - maksimal 1 email per akun per 6 jam (penghitung persisten), dan
 *  - login akun admin sendiri tidak diberitahukan.
 * Cap loginTerakhir selalu ditulis ke record pengguna (terlihat di
 * panel admin) walau emailnya tertahan rem atau pengirim email
 * belum terpasang. Semua kegagalan ditelan: pemberitahuan tidak
 * boleh pernah menggagalkan login.
 */
import { EMAIL_KONTAK } from "@/lib/legal";
import { ipKlien } from "@/lib/security/laju";
import { apakahAdmin } from "./admin";
import { kirimEmail } from "./email";
import { tierEfektif, type Pengguna } from "./identitas";
import { bolehLajuServer } from "./laju-server";
import { labelPerangkat } from "./perangkat-akun";
import { perbarui } from "./store";

const JENDELA_NOTIF_MS = 6 * 3_600_000;

export async function catatDanBeritahuLogin(u: Pengguna, req: Request): Promise<void> {
  try {
    const kini = new Date();
    const pertama = !u.loginTerakhir;
    await perbarui("pengguna", u.id, { loginTerakhir: kini.toISOString() });
    if (apakahAdmin(u)) return;

    const jatah = await bolehLajuServer(`notif-login:${u.id}`, 1, JENDELA_NOTIF_MS);
    if (!jatah.boleh) return;

    const waktu = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Makassar",
      dateStyle: "full",
      timeStyle: "short",
    }).format(kini);
    const tier = tierEfektif(u) === "premium" ? "Premium" : "Gratis";
    const subjek = pertama
      ? `[Kitabah] Login pertama: ${u.nama || u.email}`
      : `[Kitabah] Login: ${u.nama || u.email}`;
    const teks = [
      "Assalamu'alaikum,",
      "",
      pertama
        ? "Ada pengguna yang baru pertama kali tercatat masuk ke Kitabah:"
        : "Ada pengguna masuk ke Kitabah:",
      "",
      `Nama: ${u.nama || "(tanpa nama)"}`,
      `Email: ${u.email}`,
      `Lapis: ${tier}`,
      `Perangkat: ${labelPerangkat(req.headers.get("user-agent"))}`,
      `IP: ${ipKlien(req)}`,
      `Waktu: ${waktu} WITA`,
      "",
      "Pemberitahuan login dibatasi maksimal 1 email per akun per 6 jam.",
      "Rincian semua akun: https://www.kitabah.web.id/admin",
    ].join("\n");
    await kirimEmail({ ke: EMAIL_KONTAK, subjek, teks });
  } catch {
    /* best-effort: login tidak boleh gagal karena pemberitahuan */
  }
}

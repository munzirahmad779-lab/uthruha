/**
 * ID perangkat sisi klien: satu nilai acak per peramban, dipakai untuk
 * batas perangkat per akun (gratis 1 perangkat, premium 2 perangkat).
 *
 * Disimpan di localStorage dengan kunci yang sama seperti uji coba
 * tamu ("uthruha.perangkatId") DAN dicerminkan ke cookie biasa
 * "uthruha_pid" (bukan tanda tangan, hanya penanda): membersihkan
 * salah satu penyimpanan tidak menciptakan perangkat baru, karena ID
 * dipulihkan dari salinan yang masih ada. Membersihkan keduanya tetap
 * menghasilkan ID baru dan server akan menghitungnya sebagai perangkat
 * baru; pemilik bisa mengaturnya ulang dari panel admin.
 */
const KUNCI_LS = "uthruha.perangkatId";
const KUNCI_COOKIE = "uthruha_pid";

/** Nilai cadangan bila peramban menolak semua penyimpanan. Server
 *  memperlakukan nilai persis ini sebagai "tidak dikenal" dan tidak
 *  menegakkan batas untuknya. */
export const PERANGKAT_TIDAK_DIKENAL = "perangkat-tidak-dikenal";

function dariCookie(): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${KUNCI_COOKIE}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

export function ambilPerangkatId(): string {
  try {
    let id = window.localStorage.getItem(KUNCI_LS);
    if (!id) id = dariCookie();
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `p-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    }
    window.localStorage.setItem(KUNCI_LS, id);
    const umur = 365 * 24 * 3600;
    document.cookie = `${KUNCI_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${umur}; SameSite=Lax`;
    return id;
  } catch {
    return PERANGKAT_TIDAK_DIKENAL;
  }
}

/**
 * Google Doc per proyek untuk Premium (Fase 3, keputusan K).
 *
 * Izin drive.file diminta BERTAHAP oleh klien (GIS) hanya saat tombol ini
 * ditekan — tidak saat login. Token Drive milik pengguna dikirim ke rute
 * ini dan dipakai server untuk membuat folder "Uthruha — <nama proyek>"
 * + satu Google Doc berisi isi proyek dengan kepala "rules" yang boleh
 * dihapus mahasiswa sebelum menyalin/mengunduh sebagai Word.
 *
 * Token tidak disimpan server. Scope drive.file berarti aplikasi hanya
 * melihat/mengubah berkas yang dibuatnya sendiri.
 */

const DRIVE = () => (process.env.DRIVE_API_BASE?.trim() || "https://www.googleapis.com").replace(/\/$/, "");

export const KEPALA_RULES = `ATURAN DOKUMEN INI (boleh dihapus sebelum mengumpulkan):
1. Dokumen ini dibuat otomatis dari proyek Anda di Kitabah. Sunting di sini bebas; perubahan di sini TIDAK mengubah proyek di Kitabah.
2. Rujukan pada footnote harus tetap bisa diverifikasi (DOI/ISBN). Jangan mengubah judul/tahun rujukan tanpa mengecek sumbernya.
3. Unduh sebagai Word lewat File → Download → Microsoft Word (.docx) bila pembimbing meminta berkas Word.
4. Hapus blok aturan ini sebelum menyerahkan naskah.
———————————————————————————————`;

export function bangunHtmlDoc(judul: string, bagian: { judul: string; teks: string }[]): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragraf = (teks: string) =>
    teks
      .split(/\n{2,}/)
      .map((p) => `<p dir="auto">${esc(p.trim()).replace(/\n/g, "<br>")}</p>`)
      .join("\n");
  return [
    "<!DOCTYPE html><html><head><meta charset='utf-8'></head><body>",
    `<pre>${esc(KEPALA_RULES)}</pre>`,
    `<h1 dir="auto">${esc(judul)}</h1>`,
    ...bagian.map((b) => `<h2 dir="auto">${esc(b.judul)}</h2>\n${paragraf(b.teks)}`),
    "</body></html>",
  ].join("\n");
}

async function driveFetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
}

export async function buatDocProyek(opsi: {
  driveToken: string;
  judulProyek: string;
  bagian: { judul: string; teks: string }[];
}): Promise<{ folderId: string; docId: string; webViewLink: string }> {
  const base = DRIVE();
  const namaFolder = `Kitabah — ${opsi.judulProyek}`.slice(0, 120);

  // 1) Cari folder (hanya berkas buatan aplikasi yang terlihat di drive.file).
  const q = encodeURIComponent(
    `name='${namaFolder.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const cari = await driveFetch(opsi.driveToken, `${base}/drive/v3/files?q=${q}&fields=files(id,name)`);
  if (!cari.ok) throw new Error(`Drive menolak pencarian folder (HTTP ${cari.status}) — token Drive mungkin kedaluwarsa, hubungkan ulang.`);
  const hasilCari = (await cari.json()) as { files?: { id: string }[] };
  let folderId = hasilCari.files?.[0]?.id ?? "";

  // 2) Buat folder bila belum ada.
  if (!folderId) {
    const buat = await driveFetch(opsi.driveToken, `${base}/drive/v3/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: namaFolder, mimeType: "application/vnd.google-apps.folder" }),
    });
    if (!buat.ok) throw new Error(`Gagal membuat folder Drive (HTTP ${buat.status}).`);
    folderId = String(((await buat.json()) as { id?: string }).id ?? "");
  }

  // 3) Unggah HTML dengan konversi ke Google Doc (multipart/related).
  const html = bangunHtmlDoc(opsi.judulProyek, opsi.bagian);
  const batas = "uthruha-batas-doc";
  const metadata = {
    name: opsi.judulProyek.slice(0, 120),
    mimeType: "application/vnd.google-apps.document",
    parents: [folderId],
  };
  const badan =
    `--${batas}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${batas}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${batas}--`;
  const unggah = await driveFetch(opsi.driveToken, `${base}/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${batas}` },
    body: badan,
  });
  if (!unggah.ok) throw new Error(`Gagal membuat Google Doc (HTTP ${unggah.status}).`);
  const doc = (await unggah.json()) as { id?: string; webViewLink?: string };
  return { folderId, docId: String(doc.id ?? ""), webViewLink: String(doc.webViewLink ?? "") };
}
